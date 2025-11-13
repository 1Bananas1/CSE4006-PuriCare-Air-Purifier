'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

type MenuItem = {
  label: string;
  description: string;
  href: string;
  icon: string; 
};

const MENU: MenuItem[] = [
  {
    label: 'Account',
    description: 'Profile / Nickname / Logout',
    href: '/settings/account',
    icon: '👤',
  },
  {
    label: 'My device',
    description: '등록된 공기청정기 관리(Registered air purifier management)',
    href: '/settings/devices',
    icon: '📦',
  },
  {
    label: 'Location',
    description: '도시 / 위치 기반 추천 설정(City / Location Based Recommendation Settings)',
    href: '/settings/location',
    icon: '📍',
  },
  {
    label: 'Privacy',
    description: '오디오·위치 데이터 처리 동의(Consent to audio and location data processing)',
    href: '/settings/privacy',
    icon: '🛡️',
  },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main
      className="pb-safe"
      style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}
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
        설정
      </div>

      {/* 메뉴 리스트 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 10 }}
      >
        {MENU.map((item) => (
          <button
            key={item.label}
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
              <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{item.description}</div>
            </div>
            <div style={{ fontSize: 18, opacity: 0.6 }}>›</div>
          </button>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
