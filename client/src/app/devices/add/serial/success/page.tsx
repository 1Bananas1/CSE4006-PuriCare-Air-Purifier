// app/devices/add/serial/success/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function AddDeviceSerialSuccessPage() {
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
          aria-label="뒤로"
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>기기 등록 완료</div>
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
            기기가 성공적으로 등록되었어요
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.85,
              lineHeight: 1.5,
            }}
          >
            이제 홈 화면에서 실시간 공기질과
            <br />
            기기 상태를 확인할 수 있습니다.
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
            홈으로 이동
          </button>

          <button
            type="button"
            onClick={() => router.push('/devices')}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid var(--divider)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            내 기기 목록 보기
          </button>
        </div>
      </section>
    </main>
  );
}