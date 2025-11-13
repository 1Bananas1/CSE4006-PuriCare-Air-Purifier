'use client';

import { useEffect, useRef } from 'react';

type KakaoMapProps = {
  lat: number;
  lon: number;
  height?: number;
  zoom?: number;
};

export default function KakaoMap({
  lat,
  lon,
  height = 220,
  zoom = 3,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const drawMap = () => {
      const { kakao } = window as any;   // 👈 여기서 kakao 가져옴

      kakao.maps.load(() => {
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(lat, lon),
          level: zoom,
        });

        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(lat, lon),
          map,
        });

        // 필요하면 이후 map.relayout(), map.setCenter(...) 추가
      });
    };

    // 이미 kakao sdk 로드된 경우
    if ((window as any).kakao && (window as any).kakao.maps) {
      drawMap();
      return;
    }

    // 처음 로드하는 경우
    const script = document.createElement('script');
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY}&autoload=false`;
    script.async = true;
    script.onload = drawMap;
    document.head.appendChild(script);

    // cleanup는 굳이 안 해도 됨
  }, [lat, lon, zoom]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    />
  );
}

