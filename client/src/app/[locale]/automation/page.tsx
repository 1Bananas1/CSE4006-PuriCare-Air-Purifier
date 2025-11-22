// app/automation/page.tsx
'use client';

import { useState } from 'react';
import BottomNav from '@/components/layout/bottom-nav';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

type AutoType = 'routine' | 'schedule';

type AutomationItem = {
  id: number;
  name: string;
  description: string;
  type: AutoType;
  badge: string;
  detail: string;
  active: boolean;
};

// 나중에 백엔드와 ML 연동 시 /api/automation 같은 걸로 대체
const INITIAL_AUTOMATIONS: AutomationItem[] = [
  {
    id: 1,
    name: '귀가 30분 전 미리 켜기',
    description:
      '평일 18시 이후, 집 근처 도착 시 자동으로 강풍으로 가동합니다.',
    type: 'routine',
    badge: '위치 + 시간',
    detail: '퇴근 시간대 + 집 반경 500m 이내 진입 시 실행',
    active: true,
  },
  {
    id: 2,
    name: '수면 모드',
    description:
      '23시 이후 방 안 CO₂/PM2.5가 일정 수준 이상이면 조용한 수면 모드로 전환합니다.',
    type: 'routine',
    badge: '야간 · 수면',
    detail: '심야 시간 + 센서 데이터 기반, 팬 속도·조명 자동 조절',
    active: true,
  },
  {
    id: 3,
    name: '외출 시 자동 OFF',
    description: '집에서 1시간 이상 벗어나 있으면 절전 모드로 전환합니다.',
    type: 'schedule',
    badge: '절전',
    detail: '위치 이탈 감지 후 일정 시간 지나면 기기 OFF',
    active: false,
  },
];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        background: checked ? '#22c55e' : 'rgba(148,163,184,0.4)',
        boxShadow: checked ? '0 0 0 1px rgba(34,197,94,0.5)' : 'none',
        transition: 'all .18s ease-out',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#020617',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }}
      />
    </button>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(148,163,184,0.16)',
        border: '1px solid rgba(148,163,184,0.35)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {label}
    </span>
  );
}

function Card({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <div
      style={{
        background:
          'radial-gradient(circle at top left, rgba(148,163,184,0.18), transparent 55%)',
        border: '1px solid rgba(148,163,184,0.35)',
        borderRadius: 18,
        padding: 16,
        display: 'grid',
        gap: 8,
        boxShadow: '0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(15,23,42,0.7)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.2 }}>
        {title}
      </div>
      {body && <div style={{ opacity: 0.9, fontSize: 13.5 }}>{body}</div>}
    </div>
  );
}

export default function AutomationPage() {
  const [items, setItems] = useState<AutomationItem[]>(INITIAL_AUTOMATIONS);

  const toggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              active: !it.active,
            }
          : it
      )
    );
  };

  const activeCount = items.filter((i) => i.active).length;

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top, #020617 0%, #020617 40%, #020617 70%, #020617 100%)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 10px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background:
            'linear-gradient(to bottom, rgba(2,6,23,0.98), rgba(2,6,23,0.9), transparent)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.2,
          }}
        >
          자동화
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            opacity: 0.6,
          }}
        >
          루틴/스케줄로 공기청정기를 알아서 돌게 만들어요.
        </div>
      </div>

      {/* 콘텐츠 */}
      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'grid',
          gap: 14,
          flex: 1,
        }}
      >
        {/* 요약 카드 */}
        <Card
          title="자동화 요약"
          body={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  현재 활성화된 자동화
                </div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {activeCount}개
                </div>
                <div style={{ fontSize: 12, opacity: 0.78 }}>
                  루틴과 스케줄은 나중에 백엔드/ML 연동 후 실제 데이터로
                  계산됨요. integration with backend and ml to show routine and
                  schedule
                </div>
              </div>
              <div
                aria-hidden
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  background:
                    'conic-gradient(from 200deg, #22c55e, #38bdf8, #a855f7, #22c55e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#020617',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  ⏱️
                </div>
              </div>
            </div>
          }
        />

        {/* 내 자동화 리스트 */}
        <Card
          title="내 자동화"
          body={
            items.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                아직 등록된 자동화가 없습니다. 아래 “새 자동화 만들기” 버튼으로
                루틴을 추가해 보세요.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: 'rgba(15,23,42,0.9)',
                      border: '1px solid rgba(51,65,85,0.9)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      columnGap: 12,
                      rowGap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {item.name}
                        <Chip
                          label={item.type === 'routine' ? '루틴' : '스케줄'}
                        />
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {item.description}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: 4,
                      }}
                    >
                      <Toggle
                        checked={item.active}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          opacity: 0.65,
                        }}
                      >
                        {item.active ? '사용 중' : '일시 정지'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        />

        {/* 추천 자동화 영역 – 실제 추천은 나중에 ML 연결 */}
        <Card
          title="추천 자동화"
          body={
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                사용 패턴, 날씨, 실내 공기질을 보고 <b>추천 루틴</b>을 보여줄
                예정입니다.
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 6,
                  fontSize: 12,
                  opacity: 0.9,
                }}
              >
                <li>• 미세먼지 ‘나쁨’ 예보 시, 귀가 시간대 자동 강풍 모드</li>
                <li>• 새벽 시간대 CO₂ 높을 때 자동 환기 모드 제안</li>
                <li>• 집에 아무도 없을 때 절전 루틴 추천</li>
              </ul>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                전부 예시고, 추후 백엔드와 ml 연동을 통해야만 사용 가능
                (integration with backend and ml)
              </div>
            </div>
          }
        />
      </section>

      {/* 플로팅 버튼 (나중에 /automation/new 같은 페이지로 연결 예정) */}
      <button
        type="button"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 80,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background:
            'linear-gradient(135deg, #38bdf8 0%, #22c55e 45%, #a855f7 100%)',
          color: '#020617',
          fontSize: 28,
          fontWeight: 700,
          boxShadow: '0 18px 40px rgba(0,0,0,0.8)',
        }}
        onClick={() => {
          // TODO: 나중에 router.push('/automation/new') 같은 곳으로 연결
          alert('새 자동화 만들기는 백엔드/ML 설계 후 연결할 예정입니다.');
        }}
      >
        +
      </button>

      <BottomNav />
    </main>
  );
}
