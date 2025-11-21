// app/devices/add/qr/confirm/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate } from 'swr';

const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

type RoomType =
  | 'living'   // 거실
  | 'master'   // 안방
  | 'small'    // 작은방
  | 'small2'   // 작은방2
  | 'toilet'   // 화장실
  | 'bath';    // 욕실

type RoomSummary = {
  id: string;
  name: string;
  subtitle: string;
  lastUpdated: string;
  aqi: number;
  aqiLabel: string;
  roomType?: RoomType;
};

const ROOM_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'living', label: '거실' },
  { value: 'master', label: '안방' },
  { value: 'small', label: '작은방' },
  { value: 'small2', label: '작은방2' },
  { value: 'toilet', label: '화장실' },
  { value: 'bath', label: '욕실' },
];

function addMockDeviceFromQr(roomType: RoomType) {
  if (typeof window === 'undefined') return;

  const nowIso = new Date().toISOString();
  const newDevice: RoomSummary = {
    id: `qr-${Date.now()}`,
    name: '새 기기',
    subtitle: '온라인 · 자동 모드 · 약풍 (목업)',
    lastUpdated: nowIso,
    aqi: 30,
    aqiLabel: '좋음',
    roomType,
  };

  try {
    const raw = window.localStorage.getItem(LOCAL_DEVICES_KEY);
    const list: RoomSummary[] = raw ? JSON.parse(raw) : [];
    list.push(newDevice);
    window.localStorage.setItem(LOCAL_DEVICES_KEY, JSON.stringify(list));
  } catch {
    // 목업이라 실패해도 무시
  }

  // 나중에 진짜 백엔드 붙으면 이 키로 SWR 캐시 무효화
  mutate('/api/devices');
}

export default function QrConfirmPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>('living'); // ✅ 기본: 거실

  const handleConfirm = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // “네, 맞아요” → 목업 기기 추가 후 홈으로
    addMockDeviceFromQr(roomType);
    router.replace('/home');
  };

  const handleRetryQr = () => {
    router.replace('/devices/add/qr');
  };

  const handleGoSerial = () => {
    router.replace('/devices/add/serial');
  };

  return (
    <main
      className="pb-safe"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <div
        className="mobile-wrap"
        style={{
          padding: '12px 16px 8px 16px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={handleRetryQr}
          aria-label="뒤로"
          style={{ fontSize: 20, height: 44, width: 44 }}
        >
          ←
        </button>
        <div style={{ fontWeight: 800, fontSize: 18 }}>기기 등록 확인</div>
      </div>

      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
        }}
      >
        <div
          style={{
            borderRadius: 18,
            padding: 18,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            QR 코드가 제대로
            <br />
            촬영되었나요?
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            제품 뒷면 스티커에 적힌 QR 코드와 방금 촬영한 코드가
            <strong> 맞다고 느껴지면</strong> 아래&nbsp;
            <strong>“네, 맞아요 (기기 등록)”</strong> 버튼을 눌러 기기를
            등록해 주세요.
            <br />
            잘못 찍었거나 다른 제품인 것 같다면 아래 버튼으로 다시 시도할 수
            있습니다.
          </div>
        </div>

        {/* 방 선택 */}
        <div
          style={{
            borderRadius: 14,
            padding: 14,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            이 기기는 어느 방에 두셨나요?
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 4,
            }}
          >
            {ROOM_OPTIONS.map((opt) => {
              const active = roomType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoomType(opt.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid #22c55e'
                      : '1px solid rgba(148,163,184,0.6)',
                    background: active ? 'rgba(34,197,94,0.15)' : 'transparent',
                    fontSize: 13,
                    color: '#e5e7eb',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 메인 액션 버튼 */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          style={{
            height: 52,
            borderRadius: 999,
            border: 'none',
            background:
              'linear-gradient(135deg, #22c55e, #16a34a, #0f766e)',
            color: '#0b1120',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {isSubmitting ? '등록 처리 중...' : '네, 맞아요 (기기 등록)'}
        </button>

        {/* 다시 시도 / 다른 방법 */}
        <div
          style={{
            marginTop: 8,
            borderRadius: 14,
            padding: 12,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.35)',
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            번호가 잘못된 것 같나요?
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            같은 제품을 다시 촬영하거나, 시리얼 번호를 직접 입력해서 등록할 수
            있어요.
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={handleRetryQr}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: 'transparent',
                color: '#e5e7eb',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              QR 다시 찍기
            </button>
            <button
              type="button"
              onClick={handleGoSerial}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: 'transparent',
                color: '#e5e7eb',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              시리얼 번호로 등록
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}