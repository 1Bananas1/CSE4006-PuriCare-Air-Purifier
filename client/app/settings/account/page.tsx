'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { useState } from 'react';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { auth, setAuth, signOut } = useAuth();
  const [name, setName] = useState(auth.profile?.name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // 실제론 백엔드로 PATCH 요청; 지금은 로컬 상태만 갱신
    setAuth((prev) => ({
      ...prev,
      profile: { ...prev.profile, name },
    }));
    setTimeout(() => setSaving(false), 400);
  };

  const handleLogout = () => {
    if (!confirm('로그아웃하시겠습니까?')) return;
    signOut();
    router.replace('/login');
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
        <div style={{ fontWeight: 800, fontSize: 18 }}>계정</div>
      </div>

      <section
        className="mobile-wrap"
        style={{ padding: 16, display: 'grid', gap: 16 }}
      >
        {/* 프로필 카드 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {auth.profile?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={auth.profile.picture}
                alt="avatar"
                style={{ width: '100%', height: '100%', borderRadius: '50%' }}
              />
            ) : (
              (auth.profile?.name ?? 'U')[0]
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {auth.profile?.name ?? '이름 없음'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {auth.profile?.email ?? '이메일 정보 없음'}
            </div>
          </div>
        </div>

        {/* 이름 수정 섹션 */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1px solid var(--divider)',
            padding: 16,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>표시 이름</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="표시할 이름을 입력하세요"
            style={{
              borderRadius: 10,
              border: '1px solid var(--divider)',
              padding: '10px 12px',
              background: 'transparent',
              color: 'inherit',
              fontSize: 14,
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 4,
              borderRadius: 10,
              border: 'none',
              padding: '10px 12px',
              background: '#4f46e5',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          style={{
            marginTop: 8,
            width: '100%',
            borderRadius: 12,
            border: '1px solid rgba(248,113,113,0.5)',
            padding: '10px 12px',
            background: 'rgba(248,113,113,0.08)',
            color: '#fca5a5',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          로그아웃
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
