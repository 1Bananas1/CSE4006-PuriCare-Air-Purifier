'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';

function Row({ k, v }: { k: string; v?: string | number }) {
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

function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface)',
        border: '1px solid var(--divider)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {children}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { auth } = useAuth();

  // 자동화 개수 목업
  const [automationCount] = useState(3);

  // 공기질 목업 데이터
  const [airSummary] = useState({
    avgAqi: 32,
    worstAqi: 40,
    mostUsedRoom: 'Living room',
  });

  // 프라이버시 요약 정보(localStorage와 동일)
  const [privacy, setPrivacy] = useState({
    dataCollection: true,
    audioProcessing: true,
    location: true,
  });

  useEffect(() => {
    const raw = localStorage.getItem('purecare_privacy');
    if (raw) {
      try {
        setPrivacy(JSON.parse(raw));
      } catch {}
    }
  }, []);

  return (
    <main className="pb-safe" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* 헤더 */}
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
          zIndex: 10,
        }}
      >
        <button onClick={() => router.back()} aria-label="뒤로" style={{ fontSize: 20, height: 44, width: 44 }}>
          ←
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Hello, {auth.profile?.name ?? '사용자'}</div>
      </div>

      <section className="mobile-wrap" style={{ padding: 16 }}>

        {/* 1. 계정 정보 */}
        <Card>
          <Row k="이름" v={auth.profile?.name || ''} />
          <Row k="이메일" v={auth.profile?.email || ''} />
        </Card>

        {/* 2. 공기질 요약 */}
        <Card onClick={() => router.push('/report')}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>공기 상태 요약</div>
          <Row k="오늘 평균 AQI" v={airSummary.avgAqi} />
          <Row k="최악 AQI" v={airSummary.worstAqi} />
          <Row k="가장 자주 사용하는 방" v={airSummary.mostUsedRoom} />
        </Card>

        {/* 3. 자동화 상태 */}
        <Card onClick={() => router.push('/automation')}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>자동화</div>
          <Row k="활성화된 자동화" v={`${automationCount}개`} />
        </Card>

        {/* 4. 개인정보/데이터 설정 요약 */}
        <Card onClick={() => router.push('/settings/privacy')}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>개인정보 설정</div>
          <Row k="데이터 수집 동의" v={privacy.dataCollection ? 'ON' : 'OFF'} />
          <Row k="오디오 처리(기침/재채기 감지)" v={privacy.audioProcessing ? 'ON' : 'OFF'} />
          <Row k="위치 서비스" v={privacy.location ? 'ON' : 'OFF'} />
        </Card>

        {/* 5. 앱 설정 */}
        <Card onClick={() => router.push('/settings/app')}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>앱 설정</div>
          <Row k="언어" v="한국어" />
          <Row k="온도 단위" v="°C" />
          <Row k="거리 단위" v="km" />
        </Card>
      </section>
    </main>
  );
}
