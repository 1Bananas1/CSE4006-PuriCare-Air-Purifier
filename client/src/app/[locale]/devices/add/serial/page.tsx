// app/devices/add/serial/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

type RegistrationPayload = {
  deviceID: string;
  customLocation?: string; // Optional, defaults to 'Bedroom' on backend
  name?: string; // Optional, defaults to model name or 'New Device'
  geo?: [number | null, number | null]; // Tuple: [latitude, longitude] or [null, null]
  measurements?: Record<string, any>; // Optional, defaults to {}
};

type RoomType =
  | 'living'
  | 'master'
  | 'small'
  | 'small2'
  | 'toilet'
  | 'bath';

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

export default function AddDeviceSerialPage() {
  const t = useTranslations('DevicesAddSerialPage');
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { auth, ready } = useAuth() as any;

  const [serial, setSerial] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('living');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 아직 auth 준비 안 됐으면 렌더링 안 함
  if (!ready) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmed = serial.trim();

    // 1. 기본 검증
    if (!trimmed) {
      setError(t('errorRequired'));
      return;
    }
    if (trimmed.length < 6) {
      setError(t('errorFormat'));
      return;
    }
    if (!auth?.idToken) {
      setError(t('errorAuth'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Get user's location for AQI station lookup
      const geo = await getDeviceLocation();

      // Map roomType to Korean label for backend
      const customLocation = getRoomLabel(roomType);

      // Build payload matching backend expectations
      const payload: RegistrationPayload = {
        deviceID: trimmed,
        customLocation,
        geo,
        name: '새 기기', // Default name, backend will use model name if available
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
        const msg =
          data?.error ||
          (res.status === 400
            ? t('errorInvalidSerial')
            : res.status === 409
              ? t('errorAlreadyRegistered')
              : t('errorRegisterGeneric'));
        setError(msg);
        setLoading(false);
        return;
      }

      // Success - Backend returns { success: true, deviceId: "..." }
      const response = await res.json();
      console.log('✅ Device registered:', response.deviceId);

      // Invalidate devices cache to trigger refetch
      await mutate('/api/devices');

      // 성공 페이지 이동
      router.push('/devices/add/serial/success');
    } catch (err) {
      console.error('등록 요청 중 오류:', err);
      setError(t('errorRegisterGeneric'));
      setLoading(false);
    }
  };

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          padding: '12px 16px 8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label={t('back')}
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {t('title')}
        </div>
      </div>

      {/* 본문 */}
      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p style={{ fontSize: 13, opacity: 0.85 }}>
          {t('description')}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* 시리얼 입력 */}
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            {t('serialLabel')}
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder={t('serialPlaceholder')}
              style={{
                marginTop: 6,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(55,65,81,0.9)',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          {/* 방 선택 */}
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {t('roomQuestion')}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
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
                      background: active
                        ? 'rgba(34,197,94,0.15)'
                        : 'transparent',
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

          {/* 에러 */}
          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#f97373',
              }}
            >
              {error}
            </div>
          )}

          {/* 제출 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 999,
              border: 'none',
              background:
                'linear-gradient(135deg, #22c55e, #4ade80)',
              color: '#020617',
              fontSize: 14,
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t('submitLoading') : t('submitNext')}
          </button>
        </form>
      </section>
    </main>
  );
}
