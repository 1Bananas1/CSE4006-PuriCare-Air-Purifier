'use client';

import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

type Device = {
  id: string;
  name: string;
  room: string;
  model: string;
  status: 'online' | 'offline';
};

const MOCK_DEVICES: Device[] = [
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

export default function DevicesSettingsPage() {
  const router = useRouter();

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
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
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
        <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>내 기기</div>
        <button
          onClick={handleAdd}
          aria-label="기기 추가"
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

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 12 }}
      >
        {MOCK_DEVICES.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 14,
              border: '1px solid var(--divider)',
              padding: 16,
              fontSize: 14,
            }}
          >
            등록된 기기가 없습니다.
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
              기기 추가
            </button>
          </div>
        ) : (
          MOCK_DEVICES.map((d) => (
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
                  {d.room} · {d.model}
                </div>
              </div>
              <button
                onClick={() => handleMenu(d)}
                aria-label="기기 옵션"
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
