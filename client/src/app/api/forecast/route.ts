// app/api/forecast/route.ts
import { NextResponse } from 'next/server';

// 간단 캐싱 무효화
export const dynamic = 'force-dynamic';

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
    // One Call(현재+시간별+일별) — free도 가능(일부 제한)
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&lang=kr&appid=${key}`;
    const r = await fetch(url, { cache: 'no-store' });

    if (!r.ok) {
      return NextResponse.json(
        { error: 'upstream_error', detail: await r.text() },
        { status: 502 }
      );
    }
    const j = await r.json();

    // 시간별: 다음 12개만
    const hourly = (j.hourly ?? []).slice(0, 12).map((h: any) => ({
      ts: h.dt * 1000,
      temp: Math.round(h.temp),
      main: h.weather?.[0]?.main,
      icon: h.weather?.[0]?.icon,
    }));

    // 일별: 7일
    const daily = (j.daily ?? []).slice(0, 7).map((d: any) => ({
      ts: d.dt * 1000,
      min: Math.round(d.temp?.min),
      max: Math.round(d.temp?.max),
      main: d.weather?.[0]?.main,
      icon: d.weather?.[0]?.icon,
    }));

    return NextResponse.json({ hourly, daily, ts: Date.now() });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', detail: e?.message },
      { status: 500 }
    );
  }
}
