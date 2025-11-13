'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/lib/auth';

// 타입 가드
declare global {
  interface Window { google?: any }
}

/** UTF-8 안전 JWT Payload 디코더 (Base64URL → Uint8Array → TextDecoder → JSON) */
function decodeJwtPayload(token: string) {
  const b64url = token.split('.')[1] || '';
  // Base64URL → Base64
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // padding 보정
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  else if (pad !== 0) b64 += '===';
  // atob → binary string → Uint8Array
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // UTF-8 decode
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/** 간단 스플래시 */
function Splash() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      background: '#0b0f14',
      color: 'white'
    }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 9999,
          background:'rgba(255,255,255,0.08)',
          border:'1px solid rgba(255,255,255,0.12)',
          animation:'pulse 1.2s ease-in-out infinite'
        }} />
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, letterSpacing: .2 }}>PuriCare</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: .65 }}>breathing made smarter</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.06);opacity:1}}`}</style>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { auth, setAuth, signOut, ready } = useAuth() as any;

  const [showSplash, setShowSplash] = useState(true);
  const [gisLoaded, setGisLoaded] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // 1) 스플래시 1.2초
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // 2) 강제 재로그인 모드 (?force=1) - 스토리지 비우고 다시 진입
  useEffect(() => {
    if (!ready) return;
    if (search.get('force') === '1') {
      signOut(); // localStorage 삭제 + 상태 초기화
    }
  }, [ready, search, signOut]);

  // 3) GIS 로드 후 버튼 렌더링 (One Tap 자동선택 차단)
  useEffect(() => {
    if (showSplash || !gisLoaded || !clientId) return;
    if (!window.google || !btnRef.current) return;

    try { window.google.accounts.id.disableAutoSelect(); } catch {}

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: any) => {
        try {
          const idToken = resp.credential as string;
          const payload = decodeJwtPayload(idToken); // ✅ 한글/이모지 안전

          // 1) 로그인 상태 저장
          setAuth({
            idToken,
            profile: { name: payload.name, email: payload.email, picture: payload.picture },
          });

          // 2) ✅ 환영 팝업용 이름/시간 기록 (홈에서 읽어 1회 노출)
          try {
            localStorage.setItem('purecare_welcome_name', payload.name || '');
            localStorage.setItem('purecare_welcome_at', String(Date.now()));
            // 같은 세션에서 중복 노출 방지 플래그 초기화
            sessionStorage.removeItem('purecare_welcome_consumed');
          } catch {}

          router.replace('/home'); // 로그인 성공 시 홈으로
        } catch (e) {
          console.error(e);
          alert('로그인에 실패했습니다. 다시 시도해주세요.');
        }
      },
      auto_select: false,            // 버튼 클릭으로만
      ux_mode: 'popup',
      cancel_on_tap_outside: true,
      // use_fedcm_for_prompt: false, // 필요 시 주석 해제
    });

    window.google.accounts.id.renderButton(btnRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      locale: 'ko',
      width: 320,
    });
  }, [showSplash, gisLoaded, clientId, setAuth, router]);

  if (showSplash) return <Splash />;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGisLoaded(true)}
      />

      <div style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#0b0f14',
        color: 'white',
        padding: 16
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 16,
          padding: 24,
          background: '#101418',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>PuriCare 로그인</h1>
          <p style={{ opacity: 0.8, marginTop: 8, fontSize: 14 }}>
            서비스를 이용을 위해 구글 계정으로 로그인/회원가입 해주세요.
          </p>

          {/* 이미 로그인 상태여도 버튼은 그대로 보여줌 */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }} ref={btnRef} />

          {/* 현재 로그인된 계정 표시 + 선택지 제공 */}
          {ready && auth?.idToken && (
            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
              현재 로그인됨: <b>{auth.profile?.email ?? '알 수 없음'}</b>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px' }}
                  onClick={() => router.replace('/home')}
                >
                  홈으로 가기
                </button>
                <button
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}
                  onClick={() => {
                    signOut();
                    // 새로고침하여 버튼을 새 상태로 (원탭 캐시도 무력화)
                    location.replace('/login?force=1');
                  }}
                >
                  다른 계정으로 로그인
                </button>
              </div>
            </div>
          )}

          {/* 개발 우회 버튼(선택) */}
          {process.env.NEXT_PUBLIC_DEV_SKIP_GOOGLE_VERIFY === 'true' && (
            <button
              style={{ marginTop: 12, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}
              onClick={() => {
                setAuth({ idToken: 'dev-token', profile: { name: 'Dev User', email: 'dev@local' } });
                try {
                  localStorage.setItem('purecare_welcome_name', 'Dev User');
                  localStorage.setItem('purecare_welcome_at', String(Date.now()));
                  sessionStorage.removeItem('purecare_welcome_consumed');
                } catch {}
                router.replace('/home');
              }}
            >
              개발용 로그인(우회)
            </button>
          )}
        </div>
      </div>
    </>
  );
}
