// app/settings/privacy/page.tsx (예시 경로)
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/layout/bottom-nav';
import { useAuth } from '@/lib/auth';

type PrivacyState = {
  dataCollection: boolean;
  audioProcessing: boolean;
  location: boolean;
};

const STORAGE_KEY = 'purecare_privacy';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const DEFAULT_STATE: PrivacyState = {
  dataCollection: true,
  audioProcessing: true,
  location: true,
};

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { auth } = useAuth();
  const [state, setState] = useState<PrivacyState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  // 1) 최초 로드: 백엔드 > 없으면 localStorage > 기본값
  useEffect(() => {
    const load = async () => {
      try {
        // 백엔드 사용 가능하면 서버에서 불러오기
        if (auth.idToken && API_BASE_URL) {
          const res = await fetch(`${API_BASE_URL}/api/privacy`, {
            headers: {
              Authorization: `Bearer ${auth.idToken}`,
            },
          });

          if (res.ok) {
            const serverState = (await res.json()) as Partial<PrivacyState>;
            const merged = { ...DEFAULT_STATE, ...serverState };
            setState(merged);
            // 로컬에도 캐시
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            }
            setLoading(false);
            return;
          }
        }

        // 여기까지 왔으면: 백엔드 사용 불가 or 실패 → localStorage 사용
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as PrivacyState;
              setState({ ...DEFAULT_STATE, ...parsed });
              setLoading(false);
              return;
            } catch {
              /* ignore */
            }
          }
        }

        setState(DEFAULT_STATE);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.idToken]);

  // 2) 상태 변경 시: localStorage + 백엔드에 저장
  useEffect(() => {
    if (loading) return; // 초기 로딩 중일 땐 저장 X

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    const syncToServer = async () => {
      if (!auth.idToken || !API_BASE_URL) return;

      try {
        await fetch(`${API_BASE_URL}/api/privacy`, {
          method: 'PUT', // or PATCH
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify(state),
        });
      } catch (e) {
        console.error('privacy sync failed', e);
        // 실패해도 UI는 그대로 두고 조용히 무시 (필요하면 토스트 추가)
      }
    };

    syncToServer();
  }, [state, auth.idToken, loading]);

  const toggle = (key: keyof PrivacyState) =>
    setState((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDownload = () => {
    if (!auth.idToken || !API_BASE_URL) {
      alert('로그인 후 데이터 다운로드가 가능합니다.');
      return;
    }
    // 실제 구현 시: 다운로드 페이지로 이동하거나 파일 다운로드 API 호출
    alert('실제 데이터 다운로드는 백엔드 구현 후 제공됩니다.');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('내 계정을 삭제하시겠습니까? 이 동작은 되돌릴 수 없습니다.')) return;

    if (!auth.idToken || !API_BASE_URL) {
      alert('로그인 또는 서버 연결 상태를 확인해 주세요.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.idToken}`,
        },
      });

      if (!res.ok) {
        alert('계정 삭제 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      // TODO: useAuth에 logout 함수가 있다면 여기서 호출
      alert('계정이 삭제되었습니다.');
      router.replace('/login');
    } catch (e) {
      console.error(e);
      alert('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
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
        <div style={{ fontWeight: 800, fontSize: 18 }}>개인정보 보호</div>
      </div>

      <section className="mobile-wrap" style={{ padding: 16, display: 'grid', gap: 14 }}>
        {/* 설명 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            fontSize: 13,
          }}
        >
          PuriCare는 오디오, 위치, 기기 데이터 등을 사용하여
          <br />
          더욱 능동적인 공기질 관리를 제공합니다.
          <br />
          <br />
          자세한 내용은{' '}
          <span style={{ textDecoration: 'underline', opacity: 0.9 }}>
            전체 개인정보 처리방침
          </span>
          (추후 링크)에서 확인하실 수 있습니다.
        </div>

        {/* 토글 카드 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 12,
            display: 'grid',
            gap: 10,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <ToggleRow
            label="데이터 수집 동의"
            desc="기기 로그와 사용 패턴을 수집하여 루틴 추천과 성능 개선에 사용합니다."
            value={state.dataCollection}
            onChange={() => !loading && toggle('dataCollection')}
          />
          <ToggleRow
            label="오디오 처리 (기침/재채기 감지)"
            desc="로컬 또는 서버에서 기침, 재채기, 코골이 등의 소리를 분석합니다."
            value={state.audioProcessing}
            onChange={() => !loading && toggle('audioProcessing')}
          />
          <ToggleRow
            label="위치 서비스"
            desc="도시별 AQI / 날씨 데이터를 가져와 실내 운전을 조정합니다."
            value={state.location}
            onChange={() => !loading && toggle('location')}
          />
        </div>

        <button
          onClick={handleDownload}
          style={{
            marginTop: 4,
            borderRadius: 12,
            border: '1px solid var(--divider)',
            padding: '10px 12px',
            background: 'var(--surface)',
            color: 'inherit',
            fontSize: 14,
            textAlign: 'left',
          }}
        >
          내 데이터 다운로드
        </button>

        <button
          onClick={handleDeleteAccount}
          style={{
            marginTop: 4,
            borderRadius: 12,
            border: 'none',
            padding: '10px 12px',
            background: 'transparent',
            color: '#f97373',
            fontSize: 14,
            textAlign: 'left',
          }}
        >
          내 계정 삭제
        </button>
      </section>

      <BottomNav />
    </main>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={onChange}
        type="button"
        style={{
          minWidth: 46,
          height: 26,
          borderRadius: 999,
          border: 'none',
          padding: 2,
          background: value ? '#4f46e5' : 'rgba(148,163,184,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: 'white',
          }}
        />
      </button>
    </div>
  );
}
