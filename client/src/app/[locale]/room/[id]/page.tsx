// app/room/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import BottomNav from '@/components/layout/bottom-nav';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

type RoomDetail = {
  name: string;
  state: string;
  mode: string;
  wind: string;
  filterPercent: number;
  filterEta: string;
  pm25: string;
  voc: string;
};

// 방별 목업 데이터 (추후 백엔드 연동)
// key는 Home에서 쓰는 roomType 또는 기본 id(living/bath/master)와 맞춰둠
const ROOM_DETAIL: Record<string, RoomDetail> = {
  living: {
    name: '거실',
    state: '켜짐',
    mode: 'AUTO',
    wind: '2단',
    filterPercent: 68,
    filterEta: '교체까지 예상 3주',
    pm25: 'PM2.5 12 µg/m³',
    voc: 'VOC 낮음',
  },
  master: {
    name: '안방',
    state: '대기',
    mode: 'SLEEP',
    wind: '1단',
    filterPercent: 82,
    filterEta: '교체까지 예상 1달',
    pm25: 'PM2.5 9 µg/m³',
    voc: 'VOC 매우 낮음',
  },
  small: {
    name: '작은방',
    state: '켜짐',
    mode: 'AUTO',
    wind: '1단',
    filterPercent: 74,
    filterEta: '교체까지 예상 4주',
    pm25: 'PM2.5 15 µg/m³',
    voc: 'VOC 보통',
  },
  small2: {
    name: '작은방2',
    state: '켜짐',
    mode: 'AUTO',
    wind: '1단',
    filterPercent: 60,
    filterEta: '교체까지 예상 2주',
    pm25: 'PM2.5 18 µg/m³',
    voc: 'VOC 보통',
  },
  toilet: {
    name: '화장실',
    state: '켜짐',
    mode: 'DEODORIZE',
    wind: '강풍',
    filterPercent: 55,
    filterEta: '교체까지 예상 2주',
    pm25: 'PM2.5 20 µg/m³',
    voc: 'VOC 높음',
  },
  bath: {
    name: '욕실',
    state: '켜짐',
    mode: 'DEHUMIDIFY',
    wind: '1단',
    filterPercent: 54,
    filterEta: '교체까지 예상 2주',
    pm25: 'PM2.5 18 µg/m³',
    voc: 'VOC 보통',
  },
};

// 공통 카드
function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid rgba(148,163,184,0.4)',
        padding: 16,
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

export default function RoomPage() {
  const t = useTranslations('RoomPage');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) ?? 'living';

  // 1) roomType(living/master/...)로 찾고
  // 2) 없으면 generic(새 기기) 정보로 fallback
  const data: RoomDetail =
    ROOM_DETAIL[id] ?? {
      name: '새 기기',
      state: '정보 준비 중',
      mode: '-',
      wind: '-',
      filterPercent: 100,
      filterEta: '백엔드 연동 후 표시됩니다.',
      pm25: 'PM2.5 데이터 준비 중',
      voc: 'VOC 데이터 준비 중',
    };

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 8px 16px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label={t('back')}
          style={{
            height: 40,
            width: 40,
            borderRadius: 20,
            border: '1px solid var(--divider)',
            background: 'transparent',
            fontSize: 18,
          }}
        >
          ←
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{data.name}</div>
      </div>

      {/* 내용 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12, flex: 1 }}
      >
        <InfoCard title={t('status')}>
          {data.state === '켜짐' ? t('on') : t('standby')} · {data.mode} · {data.wind}
        </InfoCard>

        <InfoCard title={t('filterLife')}>
          {t('filterReplacement', {
            percent: data.filterPercent,
            eta: data.filterEta.replace('교체까지 예상 ', '').replace('달', ' month').replace('주', ' weeks')
          })}
        </InfoCard>

        <InfoCard title={t('sensors')}>
          {data.pm25} · {data.voc}
        </InfoCard>
      </section>

      <BottomNav />
    </main>
  );
}
