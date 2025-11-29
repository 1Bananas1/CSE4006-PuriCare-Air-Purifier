// app/(core)/home/page.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';

// 실제 파일 경로에 맞게 필요하면 수정
//   - BottomNav가 src/components/BottomNav.tsx 에 있으면 이렇게:
import BottomNav from '@/components/layout/bottom-nav';
//   - WelcomeModal이 src/components/features/WelcomeModal.tsx 라고 가정
import WelcomeModal from '@/components/features/welcome-modal';
//   - 방 카드 / 디바이스 캐러셀 컴포넌트 (경로는 폴더 보고 맞춰줘)
import DeviceCarousel from '@/components/features/device-carousel';
import RoomCard from '@/components/rooms/RoomCard';

// ─────────────────────────────
// 공통 상수/타입
// ─────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Coords = { lat: number; lon: number };

const LOCATION_STORAGE_KEY = 'purecare_last_location';

type SavedLocation = {
  lat: number;
  lon: number;
  city?: string;
};

const SEOUL: Coords = { lat: 37.5665, lon: 126.978 }; // 기본 서울 좌표

// 백엔드 API 베이스 URL (환경변수에 맞게 이름 수정해도 됨)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

type RoomSummary = {
  id: string;
  name: string;
  aqi: number;
  aqiLabel: string;
  status: { online: boolean };
  settings: { autoMode: boolean };
  data?: {
    geo?: [number | null, number | null];
  };
};

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
  children: ReactNode;
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

export default function HomePage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const t = useTranslations('HomePage');
  const c = useTranslations('Common');
  const n = useTranslations('Navigation');

  // 로그인 안 되어 있으면 /login으로 (localStorage 복구 완료 후)
  useEffect(() => {
    if (ready && !auth.idToken) router.replace('/login');
  }, [auth.idToken, ready, router]);

  const name = useMemo(
    () => auth.profile?.name ?? '사용자',
    [auth.profile?.name],
  );

  // 현재 좌표 상태
  const [coords, setCoords] = useState<Coords | null>(null);

  // ✅ GPS + 저장된 위치 fallback
  useEffect(() => {
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
        console.log('Geolocation permission denied or unavailable');
        // 여기서도 savedLocation → SEOUL fallback 가능
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

  const city = coords ? (geo?.city ?? c('unknown')) : 'Location unavailable';
  const temp = weather?.current?.temp ?? '-';
  const humidity = weather?.current?.humidity ?? '-';
  const main = weather?.current?.main;
  const icon = weather?.current?.icon;
  const aqiValue = weather?.aqi?.value ?? '-';
  const aqiLabel = weather?.aqi?.label ?? '';
  const emoji = coords ? weatherEmoji(main, icon) : '📍';

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

  const {
    data: roomsFromApi,
    error: roomsError,
    isLoading: isLoadingRooms,
  } = useSWR<RoomSummary[]>(
    auth.idToken && API_BASE_URL ? '/api/devices' : null,
    authedFetcher,
  );

  // 필요하면 목업 데이터 import 해서 사용
  const mockRooms: RoomSummary[] = []; // TODO: 목업 있으면 여기로
  const usingMock = !!roomsError || !roomsFromApi;
  const rooms: RoomSummary[] = usingMock
    ? mockRooms
    : roomsFromApi ?? [];

  // UI에서 사용할 최종 rooms (필요하면 정렬/필터링)
  const displayRooms = rooms;

  const averageIndoorAQI = useMemo(() => {
    if (!rooms || rooms.length === 0) {
      return { value: 0, label: 'No Data' };
    }

    const totalAQI = rooms.reduce((sum, room) => sum + room.aqi, 0);
    const avgAQI = Math.round(totalAQI / rooms.length);

    let label = 'Good';
    if (avgAQI > 100) label = 'Unhealthy';
    else if (avgAQI > 50) label = 'Moderate';

    return { value: avgAQI, label };
  }, [rooms]);

  // Fallback: Use first device's location if geolocation failed
  useEffect(() => {
  // Only use device location if we don't already have coords
  if (coords) return;
  if (!rooms || rooms.length === 0) return;

  const deviceWithGeo = rooms.find((device) => {
    const g = device.data?.geo;
    // null / undefined 다 걸러주기
    return g && g[0] != null && g[1] != null;
  });

  if (deviceWithGeo && deviceWithGeo.data?.geo) {
    const [latRaw, lonRaw] = deviceWithGeo.data.geo;

    if (latRaw != null && lonRaw != null) {
      const lat = latRaw; // 여기서부터는 number 로 좁혀짐
      const lon = lonRaw;

      setCoords({ lat, lon });
      console.log(
        `Using location from device "${deviceWithGeo.name}": ${lat}, ${lon}`,
      );
    }
  }
}, [coords, rooms]);


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
        <div style={{ fontSize: 18, fontWeight: 800 }}>{n('home')}</div>
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
                {t('welcome')}, {name}!
              </div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
              {rooms && rooms.length > 0
                ? averageIndoorAQI.value <= 50
                  ? t('goodAQINotice1')
                  : averageIndoorAQI.value <= 100
                    ? t('moderateAQINotice1')
                    : t('badAQINotice1')
                : t('addDeviceNotice')}
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
              {c('humidity')} {humidity}% · AQI {aqiValue}
              {aqiLabel ? ` (${aqiLabel})` : ''}
            </div>
          </div>
        </ShellCard>

        {/* device carousel */}
        <section style={{ marginTop: 8 }}>
          <div
            className="mobile-wrap"
            style={{ paddingLeft: 16, marginBottom: 12 }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {t('myDevices')}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              {isLoadingRooms
                ? 'Loading devices...'
                : rooms && rooms.length > 0
                  ? 'Tap any device to view details and controls'
                  : c('noDevicesRegistered')}
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
                {c('noDevicesRegistered')}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {t('addDeviceInstructions')}
              </div>
            </div>
          )}
        </section>

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
          <RoomCard
            key={room.id}
            room={room}
            onClick={() => router.push(`/room/${room.id}`)}
          />
        ))}

        {/* 4. add device */}
        <ShellCard onClick={() => router.push('/devices/add')}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            + {c('addDevice')}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {t('registerQR')}
          </div>
        </ShellCard>
      </section>

      <BottomNav />
    </main>
  );
}
