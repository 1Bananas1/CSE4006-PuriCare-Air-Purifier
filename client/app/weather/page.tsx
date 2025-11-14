'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import KakaoMap from '@/components/KakaoMap';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// 기본값: 서울시청
const SEOUL = { lat: 37.5665, lon: 126.978 };

type Coords = { lat: number; lon: number };

// 날씨 → 이모지 매핑
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

// 시간 포맷 (UNIX seconds 기준)
function formatHour(ts: number) {
  const d = new Date(ts * 1000);
  const h = d.getHours();
  return `${h}시`;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function formatDay(ts: number) {
  const d = new Date(ts * 1000);
  return `${WEEK[d.getDay()]}요일`;
}

function Card({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--divider)',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gap: 6,
        minHeight: 56,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      {body && <div style={{ opacity: 0.85, fontSize: 13 }}>{body}</div>}
    </div>
  );
}

export default function WeatherPage() {
  const router = useRouter();

  const [coords, setCoords] = useState<Coords>(SEOUL);
  const [locStatus, setLocStatus] = useState<
    'idle' | 'loading' | 'ok' | 'denied' | 'error'
  >('idle');

  // 위치 요청 함수
  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocStatus('error');
      return;
    }

    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLocStatus('ok');
      },
      (err) => {
        console.warn('Geolocation error', err);
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus('denied');
        } else {
          setLocStatus('error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  // 첫 진입 시 한 번만 위치 요청
  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1) 현재 날씨 / AQI
  const {
    data: weather,
    error: weatherError,
    isLoading,
  } = useSWR(
    coords ? `/api/weather?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // 2) 카카오 역지오코딩
  const { data: geo } = useSWR(
    coords ? `/api/geocode?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // 3) 예보 (시간별 + 일별) 백엔드가 해야 할 부분
  //    backend 팀이 /api/forecast?lat&lon 에서
  //    { hourly: [{ dt, temp, main, icon }...],
  //      daily: [{ dt, tempMin, tempMax, main, icon }...] } 형태로 내려준다고 가정
  const {
    data: forecast,
    error: forecastError,
    isLoading: forecastLoading,
  } = useSWR(
    coords ? `/api/forecast?lat=${coords.lat}&lon=${coords.lon}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  //  배열이 아니면 그냥 빈 배열로
  const hourly: any[] = Array.isArray(forecast?.hourly)
    ? forecast.hourly.slice(0, 12) // 상위 12시간만
    : [];
  const daily: any[] = Array.isArray(forecast?.daily)
    ? forecast.daily.slice(0, 5) // 상위 5일만
    : [];

  // 헤더에는 "서울특별시" / "경기도" 이런 1뎁스만 표시
  const cityLabel = geo?.city || '서울특별시';

  // 아래 카드에는 전체 주소 라인
  const fullAddressLabel = [geo?.city, geo?.district, geo?.neighborhood]
    .filter(Boolean)
    .join(' ');

  const temp = weather?.current?.temp;
  const humidity = weather?.current?.humidity;
  const desc = weather?.current?.description;
  const main = weather?.current?.main;
  const icon = weather?.current?.icon;
  const aqiValue = weather?.aqi?.value;
  const aqiLabel = weather?.aqi?.label;
  const aqiColor = weather?.aqi?.color;
  const emoji = weatherEmoji(main, icon);

  const locationHint =
    locStatus === 'loading'
      ? '현재 위치를 불러오는 중입니다…'
      : locStatus === 'denied'
        ? '위치 권한이 거부되어, 이전 위치 또는 서울 기준으로 표시 중입니다.'
        : locStatus === 'error'
          ? '위치 정보를 가져오지 못해, 이전 위치 또는 서울 기준으로 표시 중입니다.'
          : '';

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* 헤더 : 도시만 */}
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
        <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>
          {cityLabel} · 날씨/습도/지도
        </div>
        <button
          onClick={requestLocation}
          aria-label="내 위치 다시 찾기"
          style={{
            fontSize: 18,
            height: 36,
            width: 36,
            borderRadius: 18,
            border: '1px solid var(--divider)',
            background: 'transparent',
          }}
        >
          📍
        </button>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12 }}
      >
        {/* 지도 */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--divider)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <KakaoMap lat={coords.lat} lon={coords.lon} height={220} zoom={3} />
        </div>

        {/* 위치 상태 힌트 */}
        {locationHint && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              marginTop: -4,
              marginBottom: 4,
            }}
          >
            {locationHint}
          </div>
        )}

        {/* 현재 위치 */}
        <Card
          title="현재 위치"
          body={
            fullAddressLabel
              ? fullAddressLabel
              : '위치 정보를 불러오는 중입니다.'
          }
        />

        {/* 현재 기상 */}
        <Card
          title="현재 기상"
          body={
            weatherError ? (
              '데이터를 불러오지 못했습니다.'
            ) : isLoading ? (
              '로딩 중…'
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                {/* 이모지 + 설명 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    minWidth: 70,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 40 }}>{emoji}</div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{desc}</div>
                </div>

                {/* 숫자 정보 */}
                <div
                  style={{
                    display: 'flex',
                    flex: 1,
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>기온</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                      {temp ?? '-'}°
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>습도</div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                      {humidity ?? '-'}%
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>AQI</div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 20,
                        color: aqiColor || 'inherit',
                      }}
                    >
                      {aqiValue ?? '-'}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      {aqiLabel ?? ''}
                    </div>
                  </div>
                </div>
              </div>
            )
          }
        />

        {/* 예보 (시간별 + 일별) */}
        <Card
          title="예보"
          body={
            forecastError ? (
              '예보 데이터를 불러오지 못했습니다.'
            ) : forecastLoading ? (
              '예보 데이터를 불러오는 중입니다…'
            ) : !hourly.length && !daily.length ? (
              '예보 데이터가 없습니다.'
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {/* 시간별 예보 - 가로 스크롤 */}
                {hourly.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      오늘 · 시간별
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        paddingBottom: 4,
                      }}
                    >
                      {hourly.map((h: any) => (
                        <div
                          key={h.dt}
                          style={{
                            minWidth: 64,
                            padding: '6px 8px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'grid',
                            gap: 2,
                            justifyItems: 'center',
                            fontSize: 11,
                          }}
                        >
                          <div style={{ opacity: 0.8 }}>{formatHour(h.dt)}</div>
                          <div style={{ fontSize: 18 }}>
                            {weatherEmoji(h.main, h.icon)}
                          </div>
                          <div style={{ fontWeight: 700 }}>
                            {Math.round(h.temp)}°
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 일자별 예보 - 세로 스크롤 */}
                {daily.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      5일간 요약
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: 6,
                        fontSize: 13,
                      }}
                    >
                      {daily.map((d: any) => {
                        const min =
                          d.tempMin ??
                          d.temp_min ??
                          d.temp?.min ??
                          d.min ??
                          null;
                        const max =
                          d.tempMax ??
                          d.temp_max ??
                          d.temp?.max ??
                          d.max ??
                          null;

                        return (
                          <div
                            key={d.dt}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <div style={{ width: 68 }}>{formatDay(d.dt)}</div>
                            <div style={{ width: 28, textAlign: 'center' }}>
                              {weatherEmoji(d.main, d.icon)}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                textAlign: 'center',
                                opacity: 0.8,
                              }}
                            >
                              {d.main ?? ''}
                            </div>
                            <div
                              style={{
                                width: 80,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {max !== null ? Math.round(max) : '-'}° /{' '}
                              {min !== null ? Math.round(min) : '-'}°
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          }
        />
      </section>
    </main>
  );
}
