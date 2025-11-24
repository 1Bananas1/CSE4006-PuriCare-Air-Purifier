'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import BottomNav from '@/components/layout/bottom-nav';

export default function SettingsPage() {
  const t = useTranslations('SettingsPage');
  const router = useRouter();

  const menu = [
    {
      labelKey: 'account',
      descriptionKey: 'accountDescription',
      href: '/settings/account',
      icon: '👤',
    },
    {
      labelKey: 'myDevice',
      descriptionKey: 'myDeviceDescription',
      href: '/settings/devices',
      icon: '📦',
    },
    {
      labelKey: 'location',
      descriptionKey: 'locationDescription',
      href: '/settings/location',
      icon: '📍',
    },
    {
      labelKey: 'privacy',
      descriptionKey: 'privacyDescription',
      href: '/settings/privacy',
      icon: '🛡️',
    },
  ];

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
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        {t('title')}
      </div>

      {/* 메뉴 리스트 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 10 }}
      >
        {menu.map((item) => (
          <button
            key={item.labelKey}
            onClick={() => router.push(item.href)}
            style={{
              textAlign: 'left',
              background: 'var(--surface)',
              borderRadius: 14,
              border: '1px solid var(--divider)',
              padding: '14px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {t(item.labelKey as any)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {t(item.descriptionKey as any)}
              </div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.6 }}>›</div>
          </button>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
