// app/(core)/home/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
<<<<<<< HEAD:client/src/app/(core)/home/page.tsx
import { getDevices, Device } from '@/app/lib/api';
import BottomNav from '@/components/layout/bottom-nav';
import WelcomeModal from '@/components/features/welcome-modal';
import DeviceCarousel from '@/components/features/device-carousel';
=======
import BottomNav from '@/components/layout/BottomNav';
import WelcomeModal from '@/components/features/WelcomeModel';
>>>>>>> 98d5033 (add device and modified):client/app/(core)/home/page.tsx

// ─────────────────────────────
// 공통 상수/타입
// ─────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Coords = { lat: number; lon: number };

// 위치 설정 화면에서 쓰는 저장 타입과 키 (fallback 용)
const LOCATION_STORAGE_KEY = 'purecare_location_pref';

type SavedLocation = {
  city: string;
  fullLabel?: string;
  lat?: number;
  lon?: number;
};

// 기본 위치: 서울시청
const SEOUL: Coords = { lat: 37.5665, lon: 126.978 };

// 백엔드 베이스 URL (Heroku 등)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// QR/시리얼로 등록한 목업 기기를 저장하는 key
const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

// 실내 공기질 목업 (추후 백엔드 + ML 연동)
const MOCK_INDOOR_AQI = {
  room: '거실',
  value: 32,
  label: '좋음',
  humidity: 41,
};

export type RoomSummary = {
  id: string;
  name: string;
  subtitle: string;
  lastUpdated: string;
  aqi: number;
  aqiLabel: string;
};

// 백엔드 연동 실패 시 사용할 목업 룸 데이터
const MOCK_ROOMS: RoomSummary[] = [
  {
    id: 'living',
    name: 'Living room',
    subtitle: '온라인 · 자동 모드 · 약풍',
    lastUpdated: '10분 전 (목업 데이터)',
    aqi: 32,
    aqiLabel: '좋음',
  },
  {
    id: 'bath',
    name: 'Bathroom',
    subtitle: '온라인 · 제습 모드 · 약풍',
    lastUpdated: '5분 전 (목업 데이터)',
    aqi: 40,
    aqiLabel: '보통',
  },
  {
    id: 'master',
    name: 'Master room',
    subtitle: '대기 중 · 수면 모드',
    lastUpdated: '어제 (목업 데이터)',
    aqi: 28,
    aqiLabel: '좋음',
  },
];

// 간단 상대 시간 포맷터
function formatRelativeTime(isoOrText: string) {
  if (!isoOrText.includes('T')) return isoOrText;
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) return isoOrText;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

// 날씨 이모지
function weatherEmoji(main?: string, icon?: string) {
  if (!main) return '🌤️';
  const m = main.toLowerCase();
  if (m.includes('thunder')) return '⛈️';
  if (m.includes('drizzle') || m.includes('rain')) return '🌧️';
  if (m.includes('snow')) return '❄️';
  if (m.includes('mist') || m.includes('fog') || m.includes('haze')) return '🌫️';
  if (m.includes('clear')) return icon?.endsWith('n') ? '🌙' : '☀️';
  if (m.includes('cloud')) return '☁️';
  return '🌤️';
}

function ShellCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 18,
        padding: 16,
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(148,163,184,0.35)',
        display: 'block',
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </button>
  );
}

function RoomCard({ room, onClick }: { room: RoomSummary; onClick: () => void }) {
  return (
    <ShellCard onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{room.name}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {room.subtitle}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            마지막 업데이트: {formatRelativeTime(room.lastUpdated)}
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            background: 'rgba(22,163,74,0.25)',
            alignSelf: 'flex-start',
          }}
        >
          실내 AQI {room.aqi} · {room.aqiLabel}
        </div>
      </div>
    </ShellCard>
  );
}

// ─────────────────────────────
// 메인 페이지 컴포넌트
// ─────────────────────────────

export default function HomePage() {
  const { auth } = useAuth();
  const router = useRouter();

  // 로그인 안 되어 있으면 /login으로
  useEffect(() => {
    if (!auth.idToken) router.replace('/login');
  }, [auth.idToken, router]);

  const name = useMemo(
    () => auth.profile?.name ?? '사용자',
    [auth.profile?.name],
  );

  // 현재 좌표 상태
  const [coords, setCoords] = useState<Coords>(SEOUL);

  // ✅ GPS + 저장된 위치 fallback
  useEffect(() => {
    // window.localStorage 사용 시 SSR 방지
    const useSavedLocation = () => {
      try {
        const raw =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(LOCATION_STORAGE_KEY)
            : null;
        if (raw) {
          const saved: SavedLocation = JSON.parse(raw);
          if (
            typeof saved.lat === 'number' &&
            typeof saved.lon === 'number'
          ) {
            setCoords({ lat: saved.lat, lon: saved.lon });
            return true;
          }
        }
      } catch {
        // ignore
      }
      return false;
    };

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      // geolocation 자체가 없으면 바로 fallback 시도
      if (!useSavedLocation()) {
        setCoords(SEOUL);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        // 권한 거부 or 오류 → 저장된 위치 사용 시도, 실패 시 서울 기본값
        if (!useSavedLocation()) {
          setCoords(SEOUL);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      },
    );
  }, []);

  // 실외 날씨 / AQI
  const { data: weather } = useSWR(
    coords ? `/api/weather?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: geo } = useSWR(
    coords ? `/api/geocode?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // ✅ 도시 이름도 저장된 위치를 우선 fallback 으로 활용
  let city: string = geo?.city ?? 'Seoul';
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (raw) {
        const saved: SavedLocation = JSON.parse(raw);
        if (!geo?.city && saved.city) {
          city = saved.city;
        }
      }
    }
  } catch {
    // ignore
  }

  const temp = weather?.current?.temp ?? '-';
  const humidity = weather?.current?.humidity ?? '-';
  const main = weather?.current?.main;
  const icon = weather?.current?.icon;
  const aqiValue = weather?.aqi?.value ?? '-';
  const aqiLabel = weather?.aqi?.label ?? '';
  const emoji = weatherEmoji(main, icon);

  // ─────────────────────────────
  // 디바이스 리스트 (백엔드 + 목업 + 로컬 추가분)
  // ─────────────────────────────

  const authedFetcher = async (path: string) => {
    if (!auth.idToken || !API_BASE_URL) throw new Error('no-auth-or-api-url');

    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${auth.idToken}` },
    });

    if (!res.ok) throw new Error(`failed-to-fetch-devices: ${res.status}`);
    return res.json();
  };

<<<<<<< HEAD:client/src/app/(core)/home/page.tsx
  const {
    data: rooms, // This will contain the device list
    error: roomsError,
    isLoading: isLoadingRooms,
    mutate: refreshDevices,
  } = useSWR<Device[]>(
    auth.idToken ? 'devices' : null, // Only fetch if logged in
    () => getDevices(),
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
=======
  const { data: roomsFromApi, error: roomsError } = useSWR<RoomSummary[]>(
    auth.idToken && API_BASE_URL ? '/api/devices' : null,
    authedFetcher,
>>>>>>> 98d5033 (add device and modified):client/app/(core)/home/page.tsx
  );
  const averageIndoorAQI = useMemo(() => {
    if (!rooms || rooms.length === 0) return { value: 0, lbel: 'No Data' };

    const totalAQI = rooms.reduce((sum, room) => sum + room.aqi, 0);
    const avgAQI = Math.round(totalAQI / rooms.length);

    let label = 'Good';
    if (avgAQI > 100) label = 'Unhealthy';
    else if (avgAQI > 50) label = 'Moderate';

    return { value: avgAQI, label };
  }, [rooms]);

  const usingMock =
    !API_BASE_URL || roomsError || !roomsFromApi || roomsFromApi.length === 0;

  const baseRooms: RoomSummary[] = usingMock ? MOCK_ROOMS : roomsFromApi!;

  // 🔽 QR/시리얼로 프론트에서 임시로 추가한 기기들(localStorage)
  const [extraRooms, setExtraRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    try {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(LOCAL_DEVICES_KEY)
          : null;
      if (!raw) return;

      const parsed = JSON.parse(raw) as RoomSummary[];

      // 🔽 이름 정규화 : "새 기기 (QR 등록)" → "새 기기"
      const normalized = parsed.map((room) => ({
        ...room,
        name:
          room.name && room.name.startsWith('새 기기')
            ? '새 기기'
            : room.name ?? '새 기기',
      }));

      setExtraRooms(normalized);
    } catch {
      // 파싱 실패 무시
    }
  }, []);

  const displayRooms = [...baseRooms, ...extraRooms];

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <WelcomeModal />

      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 4px 16px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>홈</div>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 14 }}
      >
        {/* 1. 인사 + 실내 AQI */}
        <ShellCard onClick={() => router.push('/profile')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 24 }}>💙</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                Welcome back, {name}!
              </div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
              {rooms && rooms.length > 0
                ? averageIndoorAQI.value <= 50
                  ? "Your air quality is looking great today. I'm here to keep your home healthy and comfortable."
                  : averageIndoorAQI.value <= 100
                    ? "Your air quality is moderate. I'm monitoring things and will alert you if anything changes."
                    : "I've noticed the air quality needs attention. I'm working to improve it for you."
                : "Add your first device to start monitoring your home's air quality."}
            </div>
            <div
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 14,
                background:
                  averageIndoorAQI.value <= 50
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))'
                    : averageIndoorAQI.value <= 100
                      ? 'linear-gradient(135deg, rgba(234,179,8,0.25), rgba(202,138,4,0.15))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15))',
                border:
                  averageIndoorAQI.value <= 50
                    ? '1.5px solid rgba(34,197,94,0.4)'
                    : averageIndoorAQI.value <= 100
                      ? '1.5px solid rgba(234,179,8,0.4)'
                      : '1.5px solid rgba(239,68,68,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            ></div>
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                Indoor Air Quality ·{' '}
                {rooms && rooms.length > 0
                  ? `${rooms.length} ${rooms.length === 1 ? 'device' : 'devices'}`
                  : 'No devices'}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color:
                    averageIndoorAQI.value <= 50
                      ? '#22c55e'
                      : averageIndoorAQI.value <= 100
                        ? '#eab308'
                        : '#ef4444',
                }}
              >
                AQI {averageIndoorAQI.value}{' '}
                <span style={{ fontSize: 13, color: '#fff', opacity: 0.9 }}>
                  ({averageIndoorAQI.label})
                </span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                {rooms && rooms.length > 0
                  ? `Monitoring ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`
                  : 'Add devices to start monitoring'}
              </div>
            </div>
            <div
              style={{
                marginTop: 4,
                padding: 10,
                borderRadius: 14,
                background: 'rgba(15,118,110,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  실내 공기질 요약 · {MOCK_INDOOR_AQI.room}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  AQI {MOCK_INDOOR_AQI.value}{' '}
                  <span style={{ fontSize: 13 }}>
                    ({MOCK_INDOOR_AQI.label})
                  </span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  현재 실내 습도 {MOCK_INDOOR_AQI.humidity}% · 자동 모드 유지 중
                </div>
              </div>

              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '999px',
                  background: `conic-gradient(${
                    averageIndoorAQI.value <= 50
                      ? '#22c55e'
                      : averageIndoorAQI.value <= 100
                        ? '#eab308'
                        : '#ef4444'
                  } 0deg, ${
                    averageIndoorAQI.value <= 50
                      ? '#22c55e'
                      : averageIndoorAQI.value <= 100
                        ? '#eab308'
                        : '#ef4444'
                  } ${Math.min((averageIndoorAQI.value / 300) * 360, 360)}deg, rgba(15,23,42,0.8) ${Math.min((averageIndoorAQI.value / 300) * 360, 360)}deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 7,
                    borderRadius: '999px',
                    background: 'rgba(15,23,42,0.96)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {averageIndoorAQI.value}
                </div>
              </div>
            </div>
          </div>
        </ShellCard>

        {/* 2. 현재 위치 / 날씨 */}
        <ShellCard onClick={() => router.push('/weather')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span>
                {city} {temp}°
              </span>
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Humidity {humidity}% · Aqi Value {aqiValue}
              {aqiLabel ? ` (${aqiLabel})` : ''} if you touch, you can see more
              information.
            </div>
          </div>
        </ShellCard>

<<<<<<< HEAD:client/src/app/(core)/home/page.tsx
        {/* device carousel */}
        <section style={{ marginTop: 8 }}>
          <div
            className="mobile-wrap"
            style={{ paddingLeft: 16, marginBottom: 12 }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>My Devices</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              {isLoadingRooms
                ? 'Loading devices...'
                : rooms && rooms.length > 0
                  ? 'Tap any device to view details and controls'
                  : 'No devices registered yet'}
            </div>
          </div>
          {isLoadingRooms ? (
            <div
              className="mobile-wrap"
              style={{ textAlign: 'center', padding: 40, opacity: 0.7 }}
            >
              Loading devices...
            </div>
          ) : rooms && rooms.length > 0 ? (
            <DeviceCarousel
              devices={rooms.map((room) => ({
                id: room.id,
                name: room.name,
                aqi: room.aqi,
                aqiLabel: room.aqiLabel,
                status: room.status.online ? 'online' : 'offline',
                mode: room.settings.autoMode ? 'Auto' : 'Manual',
              }))}
            />
          ) : (
            <div
              className="mobile-wrap"
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                opacity: 0.7,
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                No devices registered yet
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Click "Add Device" below to get started
              </div>
            </div>
          )}
        </section>

        {/* 3. 방 / 기기 카드들 */}
        {MOCK_ROOMS.map((room) => (
=======
        {/* 3. 기기 리스트 */}
        {usingMock && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              marginTop: 4,
              marginBottom: -4,
            }}
          >
            ※ 현재 서버와 연동되지 않아 예시(목업) 데이터가 표시되는
            상태입니다.
          </div>
        )}

        {displayRooms.map((room) => (
>>>>>>> 98d5033 (add device and modified):client/app/(core)/home/page.tsx
          <RoomCard
            key={room.id}
            room={room}
            onClick={() => router.push(`/room/${room.id}`)}
          />
        ))}

        {/* 4. add device */}
        <ShellCard onClick={() => router.push('/devices/add')}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>+ add device</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            QR 스캔 또는 시리얼 넘버로 공기청정기를 등록할 수 있어요.
          </div>
        </ShellCard>
      </section>

      <BottomNav />
    </main>
  );
}
