'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/layout/bottom-nav';

type PrivacyState = {
  dataCollection: boolean;
  audioProcessing: boolean;
  location: boolean;
};

const STORAGE_KEY = 'purecare_privacy';

export default function PrivacySettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<PrivacyState>({
    dataCollection: true,
    audioProcessing: true,
    location: true,
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setState(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const toggle = (key: keyof PrivacyState) =>
    setState((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDownload = () => {
    alert('실제 데이터 다운로드는 백엔드 구현 후 제공됩니다.');
  };

  const handleDeleteAccount = () => {
    if (!confirm('내 계정을 삭제하시겠습니까? 이 동작은 되돌릴 수 없습니다.'))
      return;
    alert('백엔드 계정 삭제 API와 연동되면 실제 삭제가 수행됩니다.');
  };

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
        <div style={{ fontWeight: 800, fontSize: 18 }}>개인정보 보호</div>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 14 }}
      >
        {/* 설명 / 정책 링크 자리 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            fontSize: 13,
          }}
        >
          PuriCare는 오디오, 위치, 기기 데이터 등을 사용하여
          <br />
          더욱 능동적인 공기질 관리를 제공합니다.
          <br />
          <br />
          자세한 내용은{' '}
          <span style={{ textDecoration: 'underline', opacity: 0.9 }}>
            전체 개인정보 처리방침
          </span>
          (추후 링크)에서 확인하실 수 있습니다.
        </div>

        {/* 토글 카드 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          <ToggleRow
            label="데이터 수집 동의"
            desc="기기 로그와 사용 패턴을 수집하여 루틴 추천과 성능 개선에 사용합니다."
            value={state.dataCollection}
            onChange={() => toggle('dataCollection')}
          />
          <ToggleRow
            label="오디오 처리 (기침/재채기 감지)"
            desc="로컬 또는 서버에서 기침, 재채기, 코골이 등의 소리를 분석합니다."
            value={state.audioProcessing}
            onChange={() => toggle('audioProcessing')}
          />
          <ToggleRow
            label="위치 서비스"
            desc="도시별 AQI / 날씨 데이터를 가져와 실내 운전을 조정합니다."
            value={state.location}
            onChange={() => toggle('location')}
          />
        </div>

        {/* 데이터 다운로드 */}
        <button
          onClick={handleDownload}
          style={{
            marginTop: 4,
            borderRadius: 12,
            border: '1px solid var(--divider)',
            padding: '10px 12px',
            background: 'var(--surface)',
            color: 'inherit',
            fontSize: 14,
            textAlign: 'left',
          }}
        >
          내 데이터 다운로드
        </button>

        {/* 계정 삭제 */}
        <button
          onClick={handleDeleteAccount}
          style={{
            marginTop: 4,
            borderRadius: 12,
            border: 'none',
            padding: '10px 12px',
            background: 'transparent',
            color: '#f97373',
            fontSize: 14,
            textAlign: 'left',
          }}
        >
          내 계정 삭제
        </button>
      </section>

      <BottomNav />
    </main>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={onChange}
        type="button"
        style={{
          minWidth: 46,
          height: 26,
          borderRadius: 999,
          border: 'none',
          padding: 2,
          background: value ? '#4f46e5' : 'rgba(148,163,184,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: 'white',
          }}
        />
      </button>
    </div>
  );
}
