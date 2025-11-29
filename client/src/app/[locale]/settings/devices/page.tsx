'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import BottomNav from '@/components/layout/bottom-nav';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';


// ────────────────────────
// 공통 상수/타입 (Home 과 맞춤)
// ────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

// 방 타입
type RoomType =
  | 'living'   // 거실
  | 'master'   // 안방
  | 'small'    // 작은방
  | 'small2'   // 작은방2
  | 'toilet'   // 화장실
  | 'bath';    // 욕실

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  living: '거실',
  master: '안방',
  small: '작은방',
  small2: '작은방2',
  toilet: '화장실',
  bath: '욕실',
};

// Home 에서 사용하는 RoomSummary 타입의 축약본
type MockRoomSummary = {
  id: string;
  name: string;
  subtitle: string;
  lastUpdated: string;
  aqi: number;
  aqiLabel: string;
  roomType?: RoomType;
};

// 이 페이지에서 쓸 Device 타입
type Device = {
  id: string;
  name: string;
  room?: string;
  model?: string;
  status?: 'online' | 'offline';
};

// 디자인용 기본 목업 (백엔드/목업 둘 다 없을 때)
const FALLBACK_DEVICES: Device[] = [
  {
    id: '1',
    name: 'Living room purifier',
    room: '거실',
    model: 'PuriCare PC-01',
    status: 'online',
  },
  {
    id: '2',
    name: 'Bedroom purifier',
    room: '침실',
    model: 'PuriCare PC-01 Mini',
    status: 'offline',
  },
];

const fetcher = (url: string, idToken: string) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`failed: ${r.status}`);
    return r.json();
  });

export default function DevicesSettingsPage() {
  const t = useTranslations('SettingsDevicesPage');
  const c = useTranslations('Common');
  const router = useRouter();
  const { auth } = useAuth();

  // ────────────────────────
  // 1) 백엔드에서 기기 목록 가져오기
  //    (백엔드에선 { id, name, room, model, status } 형태라고 가정)
  // ────────────────────────
  const canCallBackend = API_BASE_URL && auth.idToken;
  const { data: apiDevices, error: apiError } = useSWR<Device[]>(
    canCallBackend ? [`${API_BASE_URL}/api/devices`, auth.idToken] : null,
    ([url, token]) => fetcher(url, token as string),
  );

  // ────────────────────────
  // 2) QR/시리얼로 추가한 로컬 목업 기기 가져오기
  //    (Home 의 LOCAL_DEVICES_KEY 와 동일)
  // ────────────────────────
  let mockDevicesFromLocal: Device[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LOCAL_DEVICES_KEY);
      if (raw) {
        const list = JSON.parse(raw) as MockRoomSummary[];
        mockDevicesFromLocal = list.map((r) => {
          const roomLabel = r.roomType ? ROOM_TYPE_LABEL[r.roomType] : '위치 미지정';

          // subtitle 에서 모델명을 정확히 알 수 없으니, 그냥 목업 모델명으로 표시
          const model = 'PuriCare (목업 기기)';

          return {
            id: r.id,
            name: r.name || '새 기기',
            room: roomLabel,
            model,
            status: 'online',
          };
        });
      }
    } catch {
      // 파싱 실패시 무시
    }
  }

  // ────────────────────────
  // 3) 최종 디바이스 리스트 결정
  // ────────────────────────
  const hasBackendDevices = !!apiDevices && apiDevices.length > 0;
  const hasLocalMock = mockDevicesFromLocal.length > 0;

  let devicesToShow: Device[];

  if (hasBackendDevices || hasLocalMock) {
    devicesToShow = [
      ...(apiDevices ?? []),
      ...mockDevicesFromLocal,
    ];
  } else if (!canCallBackend || apiError) {
    // 백엔드가 없거나 에러인데 로컬 목업도 없으면 디자인용 기본값
    devicesToShow = FALLBACK_DEVICES;
  } else {
    devicesToShow = [];
  }

  const handleAdd = () => {
    alert('QR 스캔 / 시리얼 입력 플로우는 다음 단계에서 구현합니다.');
  };

  const handleMenu = (device: Device) => {
    alert(
      `${device.name} 컨텍스트 메뉴\n\n- 이름 변경\n- 식별\n- 설정\n- 삭제\n\n실제 동작은 기기 API 연동 후 구현합니다.`
    );
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
          aria-label={t('back')}
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{t('title')}</div>
        <button
          onClick={handleAdd}
          aria-label={t('addDevice')}
          style={{
            fontSize: 22,
            height: 40,
            width: 40,
            borderRadius: 999,
            border: '1px solid var(--divider)',
            background: 'transparent',
          }}
        >
          +
        </button>
      </div>

      <section className="mobile-wrap" style={{ padding: 16, display: 'grid', gap: 12 }}>
        {devicesToShow.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 14,
              border: '1px solid var(--divider)',
              padding: 16,
              fontSize: 14,
            }}
          >
            {t('noDevices')}
            <br />
            <button
              onClick={handleAdd}
              style={{
                marginTop: 10,
                borderRadius: 10,
                border: 'none',
                padding: '8px 12px',
                background: '#4f46e5',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t('addDevice')}
            </button>
          </div>
        ) : (
          devicesToShow.map((d) => (
            <div
              key={d.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 14,
                border: '1px solid var(--divider)',
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(96,165,250,0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                🌀
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background:
                        d.status === 'online'
                          ? 'rgba(74,222,128,0.12)'
                          : 'rgba(148,163,184,0.16)',
                      color: d.status === 'online' ? '#4ade80' : '#cbd5f5',
                    }}
                  >
                    {d.status === 'online' ? '온라인' : '오프라인'}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {d.room ?? '위치 미지정'}
                  {d.model ? ` · ${d.model}` : ''}
                </div>
              </div>
              <button
                onClick={() => handleMenu(d)}
                aria-label={t('deviceOptions')}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 20,
                  opacity: 0.7,
                }}
              >
                ⋯
              </button>
            </div>
          ))
        )}
      </section>

      <BottomNav />
    </main>
  );
}