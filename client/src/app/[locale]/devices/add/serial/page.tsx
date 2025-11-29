// app/devices/add/serial/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';
import { registerDevice } from '@/lib/api';

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

    const deviceId = serial.trim();

    // 1. 기본 검증
    if (!deviceId) {
      setError(t('errorRequired'));
      return;
    }
    if (deviceId.length < 6) {
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
      /**
       * 명세서 그대로 호출
       * POST /api/devices/register
       * {
       *   deviceId,
       *   name,
       *   location
       * }
       */
      await registerDevice({
        deviceId,
        name: 'Air Purifier',
        location: roomType,
      });

      // 홈 기기 목록 최신화
      await mutate('/api/devices');

      // 성공 페이지 이동
      router.push('/devices/add/serial/success');
    } catch (err: any) {
      console.error('Register device failed:', err);

      const msg =
        err?.message?.includes('409')
          ? t('errorAlreadyRegistered')
          : err?.message?.includes('400')
          ? t('errorInvalidSerial')
          : t('errorRegisterGeneric');

      setError(msg);
      setLoading(false);
      return;
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
