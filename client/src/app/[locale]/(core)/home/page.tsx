// app/(core)/home/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { getDevices, Device } from '@/app/lib/api';
import BottomNav from '@/components/layout/bottom-nav';
import WelcomeModal from '@/components/features/welcome-modal';
import DeviceCarousel from '@/components/features/device-carousel';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Coords = { lat: number; lon: number };

function weatherEmoji(main?: string, icon?: string) {
  if (!main) return '🌤️';
  const m = main.toLowerCase();

  if (m.includes('thunder')) return '⛈️';
  if (m.includes('drizzle') || m.includes('rain')) return '🌧️';
  if (m.includes('snow')) return '❄️';
  if (m.includes('mist') || m.includes('fog') || m.includes('haze'))
    return '🌫️';
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
    [auth.profile?.name]
  );

  // 현재 좌표 상태
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        // Geolocation failed - will try to use device location as fallback
        console.log('Geolocation permission denied or unavailable');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  }, []);

  // 실외 날씨 / AQI
  const { data: weather } = useSWR(
    coords ? `/api/weather?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: geo } = useSWR(
    coords ? `/api/geocode?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const city = coords ? (geo?.city ?? c('unknown')) : 'Location unavailable';
  const temp = weather?.current?.temp ?? '-';
  const humidity = weather?.current?.humidity ?? '-';
  const main = weather?.current?.main;
  const icon = weather?.current?.icon;
  const aqiValue = weather?.aqi?.value ?? '-';
  const aqiLabel = weather?.aqi?.label ?? '';
  const emoji = coords ? weatherEmoji(main, icon) : '📍';

  const authedFetcher = (url: string) => {
    if (!auth.idToken) {
      throw new Error('not authorized');
    }
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${auth.idToken}`,
      },
    }).then((r) => {
      if (!r.ok) {
        throw new Error('failed to fetch data');
      }
      return r.json();
    });
  };

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

  // Fallback: Use first device's location if geolocation failed
  useEffect(() => {
    // Only use device location if we don't already have coords
    if (coords) return;

    // Check if we have devices with geo data
    if (rooms && rooms.length > 0) {
      // Find first device with valid geo coordinates
      const deviceWithGeo = rooms.find(
        (device) =>
          device.data?.geo &&
          device.data.geo[0] !== null &&
          device.data.geo[1] !== null
      );

      if (deviceWithGeo && deviceWithGeo.data?.geo) {
        const [lat, lon] = deviceWithGeo.data.geo;
        setCoords({ lat, lon });
        console.log(
          `Using location from device "${deviceWithGeo.name}": ${lat}, ${lon}`
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

      {/* 헤더 */}
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

      {/* 컨텐츠 */}
      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 14 }}
      >
        {/* 1. 인사 + 실내 AQI 요약 */}
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

        {/* 2. 현재 위치 / 날씨 카드 */}
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

        {/* 기기 추가 */}
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
