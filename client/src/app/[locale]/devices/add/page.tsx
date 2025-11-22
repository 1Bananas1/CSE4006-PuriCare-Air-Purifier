'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

export default function AddDevicePage() {
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
          aria-label="뒤로"
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>기기 추가</div>
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
          onClick={() => alert('QR 스캔: 카메라 권한 요청 → QR 인식')}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>QR 코드 스캔</div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            카메라로 제품의 QR 코드를 스캔하세요.
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
          onClick={() => alert('시리얼 입력')}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>시리얼 번호 입력</div>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            수동으로 시리얼 번호를 입력하세요.
          </div>
        </button>
      </section>
    </main>
  );
}
