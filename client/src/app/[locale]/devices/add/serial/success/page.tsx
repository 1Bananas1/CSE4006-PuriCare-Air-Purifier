// app/devices/add/serial/success/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function AddDeviceSerialSuccessPage() {
  const t = useTranslations('DevicesAddSerialSuccessPage');
  const router = useRouter();

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
          onClick={() => router.push('/devices/add')}
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
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            border: '2px solid #22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 42 }}>✓</span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            {t('successTitle')}
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              lineHeight: 1.5,
            }}
          >
            {t.rich('successBody', {
              br: () => <br />,
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/home')}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #4ade80)',
              color: '#020617',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {t('goHome')}
          </button>
        </div>
      </section>
    </main>
  );
}
