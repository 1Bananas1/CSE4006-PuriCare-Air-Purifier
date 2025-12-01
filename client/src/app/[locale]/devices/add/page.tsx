//app/[locale]/devices/add/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function AddDevicePage() {
  const t = useTranslations('DevicesAddPage');
  const router = useRouter();

  return (
    <main
      className="pb-safe"
      style={{ minHeight: '100dvh', background: 'var(--bg)' }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          padding: '12px 16px 8px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
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

      {/* 옵션 카드 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12 }}
      >
        {/* QR 스캔 */}
        <button
          type="button"
          onClick={() => router.push('/devices/add/qr')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            padding: 14,
            minHeight: 72,
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {t('qrScan')}
          </div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            {t('qrScanDescription')}
          </div>
        </button>

        {/* 시리얼 입력 */}
        <button
          type="button"
          onClick={() => router.push('/devices/add/serial')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            padding: 14,
            minHeight: 72,
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {t('serialInput')}
          </div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            {t('serialInputDescription')}
          </div>
        </button>
      </section>
    </main>
  );
}
