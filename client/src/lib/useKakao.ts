'use client';
import { useEffect, useState } from 'react';

export default function useKakao(key?: string) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const appKey = key || process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

    // 여기에 추가 (이 한 줄!)
    console.log('[KAKAO] appKey prefix:', (appKey || '').slice(0, 6));

    if (!appKey) {
      console.error('[KAKAO] NEXT_PUBLIC_KAKAO_MAP_APP_KEY is missing');
      return;
    }

    // 이미 로드됨
    if (typeof window !== 'undefined' && (window as any).kakao?.maps) {
      (window as any).kakao.maps.load(() => setReady(true));
      return;
    }

    const id = 'kakao-map-sdk';
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        (window as any).kakao?.maps?.load?.(() => setReady(true));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = () => {
      try {
        (window as any).kakao.maps.load(() => setReady(true));
      } catch (e) {
        console.error('[KAKAO] maps.load failed:', e);
      }
    };
    script.onerror = (e) => {
      console.error('[KAKAO] SDK script load error:', e);
    };
    document.head.appendChild(script);
  }, [key]);

  return ready;
}


