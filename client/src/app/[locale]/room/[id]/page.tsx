// app/room/[id]/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import BottomNav from '@/components/layout/bottom-nav';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import useSWR from 'swr';

import { getRooms, updateRoom, type RoomNode } from '@/lib/api';

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
// key는 예전 home에서 쓰던 roomType(living/bath/master/...) 기준
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

  // 이 페이지의 id는 "기기 ID"로 사용 (Home에서 router.push(`/room/${room.id}`) 호출)
  const deviceId = (params?.id as string) ?? '';

  // ─────────────────────────────
  // 1) 기본 룸 상세(옛 목업) – 백엔드 없을 때용 fallback
  // ─────────────────────────────
  const mockDetail: RoomDetail =
    ROOM_DETAIL[deviceId] ?? {
      name: '새 기기',
      state: '정보 준비 중',
      mode: '-',
      wind: '-',
      filterPercent: 100,
      filterEta: '백엔드 연동 후 표시됩니다.',
      pm25: 'PM2.5 데이터 준비 중',
      voc: 'VOC 데이터 준비 중',
    };

  // ─────────────────────────────
  // 2) Room Graph와 연동된 방 목록 / 현재 매핑 상태
  //    - GET /api/rooms   → getRooms()
  //    - PATCH /api/rooms/:roomId  → updateRoom({ deviceIds })
  // ─────────────────────────────

  const {
    data: rooms,
    isLoading: roomsLoading,
    error: roomsError,
    mutate: mutateRooms,
  } = useSWR<RoomNode[]>(deviceId ? 'rooms-for-device-detail' : null, getRooms);

  // 현재 이 deviceId를 가지고 있는 Room 찾기
  const currentRoomId = useMemo(() => {
    if (!rooms || !deviceId) return '';
    const found = rooms.find((r) => r.deviceIds.includes(deviceId));
    return found?.id ?? '';
  }, [rooms, deviceId]);

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // rooms / deviceId가 바뀌면 드롭다운 값 최신화
  const effectiveSelectedRoomId = selectedRoomId || currentRoomId;

  const handleRoomChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newRoomId = e.target.value; // '' 이면 "어느 방에도 연결 안 함"
    if (!rooms || !deviceId) return;

    // UI 즉시 반영
    setSelectedRoomId(newRoomId);

    // 실제로 변경이 없으면 리턴
    if (newRoomId === currentRoomId) return;

    try {
      const ops: Promise<unknown>[] = [];

      // 1) 이전 방에서 이 기기 제거
      if (currentRoomId) {
        const prevRoom = rooms.find((r) => r.id === currentRoomId);
        if (prevRoom) {
          const nextIds = prevRoom.deviceIds.filter((id) => id !== deviceId);
          ops.push(updateRoom(prevRoom.id, { deviceIds: nextIds }));
        }
      }

      // 2) 새 방에 이 기기 추가 (선택이 '' 인 경우는 건너뜀)
      if (newRoomId) {
        const targetRoom = rooms.find((r) => r.id === newRoomId);
        if (targetRoom) {
          const alreadyIn = targetRoom.deviceIds.includes(deviceId);
          const nextIds = alreadyIn
            ? targetRoom.deviceIds
            : [...targetRoom.deviceIds, deviceId];
          ops.push(updateRoom(targetRoom.id, { deviceIds: nextIds }));
        }
      }

      await Promise.all(ops);
      await mutateRooms();
      alert('방 연결이 업데이트되었습니다.');
    } catch (err) {
      console.error(err);
      alert('방 연결 변경 중 오류가 발생했습니다.');
      // 실패 시 UI 되돌리기
      setSelectedRoomId(currentRoomId);
    }
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
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {mockDetail.name}
        </div>
      </div>

      {/* 내용 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12, flex: 1 }}
      >
        {/* 2-1. 방 매핑 카드 (Room Graph 연동 핵심) */}
        <InfoCard title="연결된 방">
          {roomsLoading ? (
            <>방 목록을 불러오는 중입니다...</>
          ) : roomsError ? (
            <>방 정보를 불러오는 중 오류가 발생했습니다.</>
          ) : !rooms || rooms.length === 0 ? (
            <>아직 생성된 방이 없습니다. Room Graph 페이지에서 방을 먼저 만들어 주세요.</>
          ) : (
            <>
              <div style={{ marginBottom: 8, fontSize: 13 }}>
                이 기기가 어떤 방에 속하는지 선택하면, Room Graph에서도
                동일하게 반영됩니다.
              </div>
              <select
                value={effectiveSelectedRoomId}
                onChange={handleRoomChange}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.7)',
                  background: 'rgba(15,23,42,0.9)',
                  color: 'inherit',
                  fontSize: 14,
                }}
              >
                <option value="">
                  (아직 어떤 방에도 연결되지 않음)
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </InfoCard>

        {/* 기존 상태 카드들 – 일단 목업 유지 */}
        <InfoCard title={t('status')}>
          {mockDetail.state === '켜짐' ? t('on') : t('standby')} ·{' '}
          {mockDetail.mode} · {mockDetail.wind}
        </InfoCard>

        <InfoCard title={t('filterLife')}>
          {t('filterReplacement', {
            percent: mockDetail.filterPercent,
            eta: mockDetail.filterEta
              .replace('교체까지 예상 ', '')
              .replace('달', ' month')
              .replace('주', ' weeks'),
          })}
        </InfoCard>

        <InfoCard title={t('sensors')}>
          {mockDetail.pm25} · {mockDetail.voc}
        </InfoCard>
      </section>

      <BottomNav />
    </main>
  );
}
