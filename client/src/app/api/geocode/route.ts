import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat/lon required' }, { status: 400 });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'KAKAO_REST_API_KEY missing' },
      { status: 500 }
    );
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${key}`,
        // 🔸 한국어로 응답 받기
        'Accept-Language': 'ko-KR',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'kakao_error', detail: text },
        { status: 502 }
      );
    }

    const json = await res.json();
    const region = json.documents?.[0];

    // 전부 한글 기준
    const city = region?.region_1depth_name ?? null; // 서울특별시
    const district = region?.region_2depth_name ?? null; // 성동구
    const neighborhood = region?.region_3depth_name ?? null; // 금호3가동 등

    return NextResponse.json({
      city,
      district,
      neighborhood,
      full: [city, district, neighborhood].filter(Boolean).join(' '),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'server_error', detail: e?.message },
      { status: 500 }
    );
  }
}
