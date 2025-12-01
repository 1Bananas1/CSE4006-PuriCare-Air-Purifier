// app/devices/add/serial/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const LOCAL_DEVICES_KEY = 'puricare_mock_devices';

type RegistrationPayload = {
  deviceID: string;
  customLocation?: string; // Optional, defaults to 'Bedroom' on backend
  name?: string; // Optional, defaults to model name or 'New Device'
  geo?: [number | null, number | null]; // Tuple: [latitude, longitude] or [null, null]
  measurements?: Record<string, any>; // Optional, defaults to {}
};

// 홈과 동일한 방 타입
type RoomType =
  | 'living' // 거실
  | 'master' // 안방
  | 'small' // 작은방
  | 'small2' // 작은방2
  | 'toilet' // 화장실
  | 'bath'; // 욕실

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

// Helper function to map roomType to Korean label
function getRoomLabel(roomType: RoomType): string {
  const room = ROOM_OPTIONS.find((opt) => opt.value === roomType);
  return room?.label || '거실';
}

async function getDeviceLocation(): Promise<[number, number] | [null, null]> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve([null, null]);

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve([null, null]),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

function addMockDeviceFromSerial(serial: string, roomType: RoomType) {
  if (typeof window === 'undefined') return;

  const nowIso = new Date().toISOString();
  const newDevice: RoomSummary = {
    id: `serial-${Date.now()}`,
    name: '새 기기',
    subtitle: `온라인 · 자동 모드 · 약풍 (목업) · S/N ${serial}`,
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
}

export default function AddDeviceSerialPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { auth } = useAuth() as any;

  const [deviceID, setdeviceID] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('living'); // ✅ 기본: 거실
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmed = deviceID.trim();

    // --- 기본 검증 ---
    if (!trimmed) {
      setError('시리얼 번호를 입력해주세요.');
      return;
    }
    if (trimmed.length < 6) {
      setError('시리얼 번호 형식이 올바르지 않습니다.');
      return;
    }

    setError(null);

    // 🔹 1) 백엔드 연동이 가능한지 체크
    const canCallBackend = API_BASE_URL && auth?.idToken;

    if (!canCallBackend) {
      // ✅ 목업 모드: 로컬에 기기 + 방 정보 저장 후 완료 화면으로
      addMockDeviceFromSerial(trimmed, roomType);
      router.push('/devices/add/serial/success');
      return;
    }

    // 🔹 2) 실제 등록 API 호출
    try {
      setLoading(true);

      // Get user's location for AQI station lookup
      const geo = await getDeviceLocation();

      // Map roomType to Korean label for backend
      const customLocation = getRoomLabel(roomType);

      // Build payload matching backend expectations
      const payload: RegistrationPayload = {
        deviceID: trimmed,
        customLocation,
        geo,
        name: '새 기기', // Default name, backend will use model name if available
      };

      const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error ||
          (res.status === 400
            ? '시리얼 번호가 유효하지 않습니다.'
            : res.status === 409
              ? '이미 등록된 기기입니다.'
              : '기기 등록 중 오류가 발생했습니다.');
        setError(msg);
        setLoading(false);
        return;
      }

      // 🔹 3) 성공 - Backend returns { success: true, deviceId: "..." }
      const response = await res.json();
      console.log('✅ Device registered:', response.deviceId);

      // 🔹 4) Invalidate devices cache to trigger refetch
      await mutate('/api/devices');

      // 🔹 5) 완료 화면으로 이동
      router.push('/devices/add/serial/success');
    } catch (err) {
      console.error('등록 요청 중 오류:', err);
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
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
      {/* 상단 헤더 */}
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
        <div style={{ fontWeight: 800, fontSize: 18 }}>시리얼 번호 입력</div>
      </div>

      {/* 본문 */}
      <section
        className="mobile-wrap"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p style={{ fontSize: 13, opacity: 0.85 }}>
          제품 뒷면 또는 박스에 적힌 시리얼 번호를 정확히 입력해주세요.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            시리얼 번호
            <input
              type="text"
              value={deviceID}
              onChange={(e) => setdeviceID(e.target.value)}
              placeholder="예: PC-AX34K-123456"
              style={{
                marginTop: 6,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(55,65,81,0.9)',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          {/* 방 선택 */}
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              이 기기는 어느 방에 두셨나요?
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
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
                      background: active
                        ? 'rgba(34,197,94,0.15)'
                        : 'transparent',
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

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#f97373',
                marginTop: 2,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #4ade80)',
              color: '#020617',
              fontSize: 14,
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '등록 중...' : '다음'}
          </button>
        </form>
      </section>
    </main>
  );
}
