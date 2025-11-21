// app/settings/location/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
<<<<<<< HEAD:client/src/app/settings/location/page.tsx
import BottomNav from '@/components/layout/bottom-nav';
=======
import BottomNav from '@/components/layout/BottomNav';
>>>>>>> 98d5033 (add device and modified):client/app/settings/location/page.tsx

declare global {
  interface Window {
    kakao?: any;
  }
}

// 이제 lat / lon까지 같이 저장
type SavedLocation = {
  city: string;       // 예: '서울특별시'
  fullLabel?: string; // 예: '서울특별시 성동구 사근동'
  lat?: number;
  lon?: number;
};

const STORAGE_KEY = 'purecare_location_pref';
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export default function LocationSettingsPage() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SavedLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const [kakaoReady, setKakaoReady] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // 1) 저장된 위치 로드
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as SavedLocation;
        setSelected(data);
        setQuery(data.city);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // 2) Kakao JS SDK 로드 (services 라이브러리 포함)
  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      console.warn('NEXT_PUBLIC_KAKAO_JS_KEY 가 설정되어 있지 않습니다.');
      return;
    }

    // 이미 로드되어 있으면 바로 사용
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      setKakaoReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.kakao.maps.load(() => {
        setKakaoReady(true);
      });
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // 3) 자동완성 검색
  const handleSearch = () => {
    if (!kakaoReady || !window.kakao || !window.kakao.maps?.services) {
      alert('지도를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);

    // @ts-ignore
    const places = new window.kakao.maps.services.Places();

    places.keywordSearch(query.trim(), (data: any[], status: string) => {
      setSearching(false);

      // @ts-ignore
      if (status !== window.kakao.maps.services.Status.OK) {
        setResults([]);
        return;
      }

      setResults(data.slice(0, 5)); // 상위 5개만
    });
  };

  // Enter 누르면 검색
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // 4) 결과 선택 → 도시 + 전체 주소 + 위도/경도 저장
  const handleSelect = (place: any) => {
    const address: string =
      place.address_name || place.road_address_name || place.place_name;
    const tokens = address.split(' ');
    const city = tokens[0] || address;

    const lat = Number(place.y); // 위도
    const lon = Number(place.x); // 경도

    setSelected({
      city,
      fullLabel: address,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
    });
    setQuery(city);
    setResults([]); // 리스트 닫기
  };

  // 5) 저장
  const handleSave = () => {
    if (!selected && !query.trim()) {
      alert('도시 이름을 입력하거나 검색 결과에서 선택해주세요.');
      return;
    }

    const loc: SavedLocation = selected ?? { city: query.trim() };

    setSaving(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));

    setTimeout(() => {
      setSaving(false);
      alert('위치가 저장되었습니다.');
      router.back();
    }, 250);
  };

  // 6) GPS 버튼 (현재는 안내만)
  const handleUseGPS = () => {
    alert('실제 GPS → 도시 자동입력은 다음 단계에서 구현할 예정입니다.');
  };

  // 7) 삭제
  const handleDelete = () => {
    if (!confirm('저장된 위치를 삭제할까요?\n홈 화면은 기본 도시로 표시됩니다.')) return;

    localStorage.removeItem(STORAGE_KEY);
    setSelected(null);
    setQuery('');
    setResults([]);

    alert('저장된 위치가 삭제되었습니다.');
  };

  return (
    <main
      className="pb-safe"
      style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* 헤더 */}
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

        <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>위치</div>

        <button
          onClick={handleSave}
          style={{
            fontSize: 14,
            padding: '6px 10px',
            borderRadius: 999,
            border: 'none',
            background: '#4f46e5',
            color: 'white',
            fontWeight: 600,
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 14 }}
      >
        {/* 검색 박스 + 자동완성 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* 상단 인풋 라인 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔍</span>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="도시 또는 동 이름을 입력하세요 (예: 서울, 성동구 사근동)"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                fontSize: 14,
                outline: 'none',
              }}
            />

            <button
              type="button"
              onClick={handleUseGPS}
              aria-label="현재 위치 사용"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                border: '1px solid var(--divider)',
                background: 'transparent',
                fontSize: 16,
              }}
            >
              📍
            </button>
          </div>

          {/* 검색 버튼 / 상태 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            <button
              type="button"
              onClick={handleSearch}
              style={{
                borderRadius: 999,
                border: '1px solid var(--divider)',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.02)',
                color: 'inherit',
                fontSize: 12,
              }}
            >
              {searching ? '검색 중…' : '카카오 장소 검색'}
            </button>
            {!kakaoReady && <span>지도를 초기화하는 중입니다…</span>}
          </div>

          {/* 자동완성 결과 리스트 */}
          {results.length > 0 && (
            <div
              style={{
                marginTop: 4,
                borderRadius: 10,
                border: '1px solid var(--divider)',
                background: 'rgba(0,0,0,0.3)',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {results.map((place) => {
                const addr: string =
                  place.address_name ||
                  place.road_address_name ||
                  place.place_name;

                const tokens = addr.split(' ');
                const city = tokens[0] || addr;

                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelect(place)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: 13,
                      borderBottom:
                        '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{city}</div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.75,
                        marginTop: 2,
                      }}
                    >
                      {addr}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 저장된 위치 카드 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>저장된 위치</div>

          {selected ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {selected.city}
              </div>
              {selected.fullLabel && (
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.75,
                    marginTop: 4,
                  }}
                >
                  {selected.fullLabel}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  marginTop: 4,
                }}
              >
                이 위치는 홈 화면과 날씨 추천에 사용됩니다.
              </div>

              <button
                onClick={handleDelete}
                style={{
                  marginTop: 12,
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid rgba(248,113,113,0.4)',
                  padding: '8px 12px',
                  background: 'rgba(248,113,113,0.08)',
                  color: '#f87171',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                저장된 위치 삭제
              </button>
            </>
          ) : (
            <div style={{ opacity: 0.7 }}>
              아직 저장된 위치가 없습니다.
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}