// app/report/page.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import BottomNav from '@/components/layout/bottom-nav';

type Range = 'day' | 'week' | 'month';

const MOCK_USAGE = {
  day: 1.2, // kWh
  week: 8.5,
  month: 26.7,
};

const MOCK_COST = {
  day: 430, // 원
  week: 3100,
  month: 9700,
};

const MOCK_SAVING = {
  day: 5, // %
  week: 8,
  month: 12,
};

// 간단 미니 막대 그래프용 목업 (0 ~ 1 사이 비율)
const MOCK_SERIES: Record<Range, number[]> = {
  day: [0.3, 0.5, 0.2, 0.6, 0.4],
  week: [0.4, 0.6, 0.5, 0.7, 0.3, 0.5, 0.4],
  month: [0.2, 0.4, 0.3, 0.6, 0.5, 0.7, 0.4, 0.5, 0.3, 0.6, 0.5, 0.8],
};

function RangeTabs({
  value,
  onChange,
  labels,
}: {
  value: Range;
  onChange: (v: Range) => void;
  labels: { today: string; thisWeek: string; thisMonth: string };
}) {
  const items: { label: string; value: Range }[] = [
    { label: labels.today, value: 'day' },
    { label: labels.thisWeek, value: 'week' },
    { label: labels.thisMonth, value: 'month' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        border: '1px solid rgba(148,163,184,0.4)',
        padding: 4,
        gap: 4,
        boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 999,
              border: 'none',
              background: active ? '#f9fafb' : 'transparent',
              color: active ? '#020617' : 'var(--text)',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              letterSpacing: active ? 0.1 : 0,
              boxShadow: active ? '0 6px 18px rgba(15,23,42,0.3)' : 'none',
              transition: 'all .18s ease-out',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
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
      <div
        style={{
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: 0.2,
        }}
      >
        {title}
      </div>
      {body && <div style={{ opacity: 0.9, fontSize: 13.5 }}>{body}</div>}
    </div>
  );
}

// 막대 여러 개 세로로 세운 간단 그래프
function TinyBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 0.01);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        height: 76,
        paddingInline: 2,
      }}
    >
      {values.map((v, i) => {
        const h = (v / max) * 100;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 999,
              background: 'rgba(30,41,59,0.8)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: `${h}%`,
                width: '100%',
                borderRadius: 999,
                background:
                  'linear-gradient(180deg, #a5b4fc 0%, #38bdf8 40%, #22c55e 100%)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function ReportPage() {
  const t = useTranslations('ReportPage');
  const [range, setRange] = useState<Range>('day');

  const usage = MOCK_USAGE[range];
  const cost = MOCK_COST[range];
  const saving = MOCK_SAVING[range];
  const series = MOCK_SERIES[range];

  const rangeLabel =
    range === 'day' ? t('today') : range === 'week' ? t('thisWeek') : t('thisMonth');

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
          {t('title')}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            opacity: 0.6,
          }}
        >
          {t('subtitle')}
        </div>
      </div>

      {/* 컨텐츠 */}
      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'grid',
          gap: 14,
          flex: 1,
        }}
      >
        {/* 기간 탭 */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <RangeTabs
            value={range}
            onChange={setRange}
            labels={{
              today: t('today'),
              thisWeek: t('thisWeek'),
              thisMonth: t('thisMonth'),
            }}
          />
        </div>

        {/* 1) 오늘/이번 주/이번 달 사용 요약 */}
        <Card
          title={t('usageSummary', { period: rangeLabel })}
          body={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{t('powerUsage')}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {usage.toFixed(1)} {t('kwhUnit')}
                </div>
                <div style={{ opacity: 0.78, fontSize: 12 }}>
                  {t('estimatedCost', { cost: cost.toLocaleString() })}
                </div>
              </div>
              <div
                style={{
                  width: 1,
                  height: 44,
                  background: 'rgba(148,163,184,0.6)',
                  opacity: 0.7,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {t('savingsRate')}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#4ade80',
                  }}
                >
                  {saving}%
                </div>
                <div style={{ opacity: 0.82, fontSize: 12 }}>
                  {t('savingsComparison', { period: rangeLabel })}
                </div>
              </div>
            </div>
          }
        />

        {/* 2) 에너지 사용 패턴 (미니 그래프) */}
        <Card
          title={t('energyUsagePattern', { period: rangeLabel })}
          body={
            <div style={{ display: 'grid', gap: 8 }}>
              <TinyBarChart values={series} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                <span>{t('lowUsage')}</span>
                <span>{t('highUsage')}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {t('patternNote')}
              </div>
            </div>
          }
        />

        {/* 3) 절감 진행 상황 */}
        <Card
          title={t('savingsGoalProgress')}
          body={
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                {t('savingsGoalDescription', { percent: saving })}
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.85)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${Math.min(saving, 100)}%`,
                    background:
                      'linear-gradient(90deg, #22c55e 0%, #4ade80 45%, #a3e635 100%)',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, opacity: 0.78 }}>
                {t('savingsLogicNote')}
              </div>
            </div>
          }
        />

        {/* 4) AI 예측 */}
        <Card
          title={t('aiPrediction')}
          body={
            <div style={{ fontSize: 12.5, opacity: 0.9, lineHeight: 1.45 }}>
              {t('aiPredictionDescription')}
            </div>
          }
        />
      </section>

      <BottomNav />
    </main>
  );
}
