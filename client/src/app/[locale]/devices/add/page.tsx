'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function AddDevicePage() {
  const t = useTranslations('DevicesAddPage');
  const c = useTranslations('Common');
  const router = useRouter();

  return (
    <main
      className="pb-safe"
      style={{ minHeight: '100dvh', background: 'var(--bg)' }}
    >
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
        <div style={{ fontWeight: 800, fontSize: 18 }}>{t('title')}</div>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12 }}
      >
        <button
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            padding: 14,
            minHeight: 72,
            textAlign: 'left',
          }}
          onClick={() => alert(t('qrScanAlert'))}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t('qrScan')}</div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            {t('qrScanDescription')}
          </div>
        </button>

        <button
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            padding: 14,
            minHeight: 72,
            textAlign: 'left',
          }}
          onClick={() => alert(t('serialInputAlert'))}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t('serialInput')}</div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            {t('serialInputDescription')}
          </div>
        </button>
      </section>
    </main>
  );
}
