// app/devices/add/serial/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

// 홈과 동일한 방 타입
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

function addMockDeviceFromSerial(serial: string, roomType: RoomType) {
  if (typeof window === 'undefined') return;

  const nowIso = new Date().toISOString();
  const newDevice: RoomSummary = {
    id: `serial-${Date.now()}`,
    name: '새 기기',
    subtitle: `온라인 · 자동 모드 · 약풍 (목업) · S/N ${serial}`,
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
}

export default function AddDeviceSerialPage() {
  const t = useTranslations('DevicesAddSerialPage');
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { auth } = useAuth() as any;

  const [serial, setSerial] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('living'); // 기본: 거실
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmed = serial.trim();

    // --- 기본 검증 ---
    if (!trimmed) {
      setError(t('errorRequired'));
      return;
    }
    if (trimmed.length < 6) {
      setError(t('errorFormat'));
      return;
    }

    setError(null);

    // 1) 백엔드 연동 가능 여부 체크
    const canCallBackend = API_BASE_URL && auth?.idToken;

    if (!canCallBackend) {
      // 목업 모드: 로컬에 기기 + 방 정보 저장 후 완료 화면으로
      addMockDeviceFromSerial(trimmed, roomType);
      router.push('/devices/add/serial/success');
      return;
    }

    // 2) 실제 등록 API 호출
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.idToken}`,
        },
        body: JSON.stringify({ serial: trimmed, roomType }), // 방 정보 같이 전송
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msgKey =
          data?.errorKey ??
          (res.status === 400
            ? 'errorInvalidSerial'
            : res.status === 409
            ? 'errorAlreadyRegistered'
            : 'errorRegisterGeneric');

        setError(t(msgKey));
        setLoading(false);
        return;
      }

      // 3) 성공 시 응답으로 온 Device 하나 받기
      const newDevice = (await res.json()) as RoomSummary;

      // 4) 홈에서 사용하는 리스트 캐시 업데이트
      await mutate(
        '/api/devices',
        (prev: any) => (Array.isArray(prev) ? [...prev, newDevice] : [newDevice]),
        false,
      );

      // 5) 완료 화면으로 이동
      router.push('/devices/add/serial/success');
    } catch (err) {
      console.error('등록 요청 중 오류:', err);
      setError(t('networkError'));
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
      {/* 상단 헤더 */}
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
        <div style={{ fontWeight: 800, fontSize: 18 }}>{t('title')}</div>
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
            gap: 12,
          }}
        >
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
          <div style={{ marginTop: 4 }}>
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

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#f97373',
                marginTop: 2,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #4ade80)',
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
