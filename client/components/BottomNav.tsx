'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const p = usePathname();
  const Item = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
  }) => {
    const active = p === href;
    return (
      <Link
        href={href}
        className="nav-item"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 56 /* 터치 타겟 44px 이상 */,
          gap: 4,
          color: active ? '#fff' : 'rgba(255,255,255,.7)',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 11 }}>{label}</span>
      </Link>
    );
  };

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#0e141b',
        borderTop: '1px solid rgba(255,255,255,.08)',
        paddingBottom: 'env(safe-area-inset-bottom)' /* ✅ 홈바 안전영역 */,
        zIndex: 40,
      }}
    >
      <div className="mobile-wrap" style={{ display: 'flex' }}>
        <Item href="/automation" icon={'⏱️'} label="자동화" />
        <Item href="/home" icon={'🏠'} label="홈" />
        <Item href="/report" icon={<b>R</b>} label="리포트" />
        <Item href="/settings" icon={'⚙️'} label="설정" />
      </div>
    </nav>
  );
}
