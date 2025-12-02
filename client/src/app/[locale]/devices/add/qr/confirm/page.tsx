// app/devices/add/qr/confirm/page.tsx
'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

type RegistrationPayload = {
  deviceID: string;
  customLocation?: string; // Optional, defaults to 'Bedroom' on backend
  name?: string; // Optional, defaults to model name or 'New Device'
  geo?: [number | null, number | null]; // Tuple: [latitude, longitude] or [null, null]
  measurements?: Record<string, any>; // Optional, defaults to {}
};

type RoomType =
  | 'living' // 거실
  | 'master' // 안방
  | 'small' // 작은방
  | 'small2' // 작은방2
  | 'toilet' // 화장실
  | 'bath'; // 욕실

type RoomSummary = {
  id: string;
  name: string;
  subtitle: string;
  lastUpdated: string;
  aqi: number;
  aqiLabel: string;
  roomType?: RoomType;
};

const ROOM_OPTIONS: { value: RoomType; labelKey: string }[] = [
  { value: 'living', labelKey: 'room.living' },
  { value: 'master', labelKey: 'room.master' },
  { value: 'small', labelKey: 'room.small' },
  { value: 'small2', labelKey: 'room.small2' },
  { value: 'toilet', labelKey: 'room.toilet' },
  { value: 'bath', labelKey: 'room.bath' },
];

// Helper function to map roomType to Korean label
function getRoomLabel(roomType: RoomType): string {
  const labels: Record<RoomType, string> = {
    living: '거실',
    master: '안방',
    small: '작은방',
    small2: '작은방2',
    toilet: '화장실',
    bath: '욕실',
  };
  return labels[roomType] || '거실';
}

async function getDeviceLocation(): Promise<[number, number] | [null, null]> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve([null, null]);

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve([null, null]),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

function addMockDeviceFromQr(roomType: RoomType) {
  if (typeof window === 'undefined') return;

  const nowIso = new Date().toISOString();
  const newDevice: RoomSummary = {
    id: `qr-${Date.now()}`,
    name: '새 기기',
    subtitle: '온라인 · 자동 모드 · 약풍 (목업)',
    lastUpdated: nowIso,
    aqi: 30,
    aqiLabel: '좋음',
    roomType,
  };

  try {
    const raw = window.localStorage.getItem(LOCAL_DEVICES_KEY);
    const list: RoomSummary[] = raw ? JSON.parse(raw) : [];
    list.push(newDevice);
    window.localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
  } catch {
    // 목업이라 실패해도 무시
  }

  mutate('/api/devices');
}

export default function QrConfirmPage() {
  const t = useTranslations('DevicesAddQrConfirmPage');
  const router = useRouter();
  const { auth } = useAuth() as any;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>('living'); // 기본: 거실

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let deviceId: string | null = null;

      if (typeof window !== 'undefined') {
        deviceId = window.sessionStorage.getItem(
          'puricare_last_qr_device_id',
        );
      }

      // QR에서 기기 ID를 제대로 못 읽은 경우
      if (!deviceId) {
        alert(t('errorNoDeviceId') || 'QR 코드에서 기기 ID를 인식하지 못했습니다. 다시 촬영해 주세요.');
        setIsSubmitting(false);
        router.replace('/devices/add/qr');
        return;
      }

      const hasBackendAuth = !!auth?.idToken;

      // 1) 백엔드 연동 가능한 경우 → 명세서대로 payload 구성
      if (hasBackendAuth) {
        // Get user's location for AQI station lookup
        const geo = await getDeviceLocation();

        // Map roomType to Korean label for backend
        const customLocation = getRoomLabel(roomType);

        // Build payload matching backend expectations
        const payload: RegistrationPayload = {
          deviceID: deviceId,
          customLocation,
          geo,
          name: '새 기기(QR)', // Default name, backend will use model name if available
        };

        const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const errorMsg = data?.error || '기기 등록 중 오류가 발생했습니다.';
          alert(errorMsg);
          setIsSubmitting(false);
          return;
        }

        // Success - Backend returns { success: true, deviceId: "..." }
        const response = await res.json();
        console.log('✅ Device registered from QR:', response.deviceId);

        // 기기 등록 후 홈에서 기기 리스트 최신화
        await mutate('/api/devices');

        router.replace('/home');
        return;
      }

      // 2) 혹시 토큰이 없거나 백엔드 연결 안 된 경우 → fallback 목업
      console.warn('No auth token detected, falling back to mock device.');
      addMockDeviceFromQr(roomType);
      router.replace('/home');
    } catch (err) {
      console.error('QR 등록 중 오류:', err);
      alert('기기 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryQr = () => {
    router.replace('/devices/add/qr');
  };

  const handleGoSerial = () => {
    router.replace('/devices/add/serial');
  };

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 8px 16px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={handleRetryQr}
          aria-label={t('back')}
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{t('title')}</div>
      </div>

      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
        }}
      >
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            {t('introTitleLine1')}
            <br />
            {t('introTitleLine2')}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            {t.rich('introBody', {
              strong: (chunk) => <strong>{chunk}</strong>,
              br: () => <br />,
            })}
          </div>
        </div>

        {/* 방 선택 */}
        <div
          style={{
            borderRadius: 14,
            padding: 14,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {t('roomQuestion')}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 4,
            }}
          >
            {ROOM_OPTIONS.map((opt) => {
              const active = roomType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoomType(opt.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid #22c55e'
                      : '1px solid rgba(148,163,184,0.6)',
                    background: active ? 'rgba(34,197,94,0.15)' : 'transparent',
                    fontSize: 13,
                    color: '#e5e7eb',
                  }}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 메인 액션 버튼 */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          style={{
            height: 52,
            borderRadius: 999,
            border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a, #0f766e)',
            color: '#0b1120',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {isSubmitting ? t('submitLoading') : t('submitLabel')}
        </button>

        {/* 다시 시도 / 다른 방법 */}
        <div
          style={{
            marginTop: 8,
            borderRadius: 14,
            padding: 12,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {t('retryTitle')}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {t('retryBody')}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={handleRetryQr}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: 'transparent',
                color: '#e5e7eb',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {t('retryQr')}
            </button>
            <button
              type="button"
              onClick={handleGoSerial}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: 'transparent',
                color: '#e5e7eb',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {t('retrySerial')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

