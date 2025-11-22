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
const ROOM_DETAIL: Record<string, RoomDetail> = {
  living: {
    name: 'Living room',
    state: '켜짐',
    mode: 'AUTO',
    wind: '2단',
    filterPercent: 68,
    filterEta: '교체까지 예상 3주',
    pm25: 'PM2.5 12 µg/m³',
    voc: 'VOC 낮음',
  },
  bath: {
    name: 'Bathroom',
    state: '켜짐',
    mode: 'DEHUMIDIFY',
    wind: '1단',
    filterPercent: 54,
    filterEta: '교체까지 예상 2주',
    pm25: 'PM2.5 18 µg/m³',
    voc: 'VOC 보통',
  },
  master: {
    name: 'Master room',
    state: '대기',
    mode: 'SLEEP',
    wind: '1단',
    filterPercent: 82,
    filterEta: '교체까지 예상 1달',
    pm25: 'PM2.5 9 µg/m³',
    voc: 'VOC 매우 낮음',
  },
};

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
  const router = useRouter();
  const params = useParams<{ id: string }>(); // ✅ 여기서 params를 훅으로
  const id = (params?.id as string) ?? 'living';

  const data = ROOM_DETAIL[id] ?? ROOM_DETAIL['living'];

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
          aria-label="뒤로"
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
        <InfoCard title="상태">
          {data.state} · {data.mode} · {data.wind}
        </InfoCard>

        <InfoCard title="필터 수명">
          {data.filterPercent}% ({data.filterEta})
        </InfoCard>

        <InfoCard title="센서">
          {data.pm25} · {data.voc}
        </InfoCard>
      </section>

      <BottomNav />
    </main>
  );
}
