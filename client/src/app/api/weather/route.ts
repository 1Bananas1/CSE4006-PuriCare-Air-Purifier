import { NextResponse } from 'next/server';

function aqiLabel(n: number | null | undefined) {
  // OpenWeather Air Pollution: 1~5
  switch (n) {
    case 1:
      return { label: '좋음', color: '#34d399' };
    case 2:
      return { label: '보통', color: '#a3e635' };
    case 3:
      return { label: '민감군 나쁨', color: '#f59e0b' };
    case 4:
      return { label: '나쁨', color: '#f97316' };
    case 5:
      return { label: '매우 나쁨', color: '#ef4444' };
    default:
      return { label: '알 수 없음', color: '#9ca3af' };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat/lon required' }, { status: 400 });
  }
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'OPENWEATHER_API_KEY missing' },
      { status: 500 }
    );
  }

  try {
    // 현재 날씨 + 대기오염 동시 호출
    const [rCurrent, rAir] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${key}`,
        { cache: 'no-store' }
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`,
        { cache: 'no-store' }
      ),
    ]);

    if (!rCurrent.ok || !rAir.ok) {
      const detail = await (rCurrent.ok ? rAir.text() : rCurrent.text());
      return NextResponse.json(
        { error: 'upstream_error', detail },
        { status: 502 }
      );
    }

    const current = await rCurrent.json();
    const air = await rAir.json();

    const temp = Math.round(current.main?.temp ?? 0);
    const humidity = current.main?.humidity ?? null;

    const weather0 = current.weather?.[0] ?? {};
    const description = weather0.description ?? '';
    const weatherMain = weather0.main ?? ''; // Clear, Rain, Snow 등
    const icon = weather0.icon ?? ''; // 10d, 01n 같은 코드

    const city = current.name;
    const aqiValue = air?.list?.[0]?.main?.aqi ?? null;
    const aqi = aqiLabel(aqiValue);

    return NextResponse.json({
      coord: current.coord,
      city,
      current: {
        temp,
        humidity,
        description,
        main: weatherMain,
        icon,
      },
      aqi: { value: aqiValue, ...aqi },
      ts: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', detail: e?.message },
      { status: 500 }
    );
  }
}
