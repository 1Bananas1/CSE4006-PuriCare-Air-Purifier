// app/devices/add/page.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function AddDevicePage() {
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
          onClick={() => router.back()}
          aria-label="뒤로"
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>기기 추가</div>
      </div>

      {/* 본문: 옵션 2개 카드 */}
      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        {/* QR 코드 스캔 */}
        <button
          type="button"
          onClick={() => router.push('/devices/add/qr')}
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            minHeight: 80,
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>QR 코드 스캔</div>
          <div
            style={{
              opacity: 0.85,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            카메라로 제품의 QR 코드를 스캔하세요.
          </div>
        </button>

        {/* 시리얼 번호 입력 */}
        <button
          type="button"
          onClick={() => router.push('/devices/add/serial')}
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            minHeight: 80,
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>시리얼 번호 입력</div>
          <div
            style={{
              opacity: 0.85,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            수동으로 시리얼 번호를 입력하세요.
          </div>
        </button>
      </section>
    </main>
  );
}
