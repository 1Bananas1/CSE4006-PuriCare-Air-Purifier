'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/lib/auth';

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      <div style={{ opacity: 0.8, fontSize: 13 }}>{k}</div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{v || '-'}</div>
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations('ProfilePage');
  const c = useTranslations('Common');
  const router = useRouter();
  const { auth } = useAuth();

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
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {t('title', { name: auth.profile?.name ?? c('user') })}
        </div>
      </div>

      <section className="mobile-wrap" style={{ padding: 16 }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <Row k={t('name')} v={auth.profile?.name || ''} />
          <Row k={t('email')} v={auth.profile?.email || ''} />
        </div>
      </section>
    </main>
  );
}
