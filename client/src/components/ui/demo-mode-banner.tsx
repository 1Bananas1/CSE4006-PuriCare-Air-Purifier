'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, usePathname } from '@/i18n/routing';

/**
 * Demo Mode Indicator Banner
 *
 * Shows a persistent banner when the user is in demo mode
 * Allows quick exit back to login page
 */
export default function DemoModeBanner() {
  const { auth, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === '/login') return null;

  // Only show in demo mode
  if (!auth.demoMode) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(99, 102, 241, 0.9))',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🎭</span>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.2,
            }}
          >
            Demo Mode
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.9,
              color: 'white',
            }}
          >
            Exploring with sample data • No real API calls
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          signOut();
          router.replace('/login');
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
        }}
      >
        Exit Demo
      </button>
    </div>
  );
}
