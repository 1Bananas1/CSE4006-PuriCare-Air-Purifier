'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';

type Profile = { name?: string; email?: string; picture?: string };
type AuthState = {
  idToken: string | null;     // Google ID 토큰
  profile: Profile | null;    // 디코딩된 프로필
  demoMode?: boolean;         // 데모 모드 플래그
};

type AuthContext = {
  auth: AuthState;
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
  signOut: () => void;
  enterDemoMode: () => void;  // 데모 모드 진입
  ready: boolean;             // ← sessionStorage 복구 완료 여부
};

const STORAGE_KEY = 'purecare_auth';

const AuthCtx = createContext<AuthContext>({
  auth: { idToken: null, profile: null, demoMode: false },
  setAuth: () => {},
  signOut: () => {},
  enterDemoMode: () => {},
  ready: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ idToken: null, profile: null });
  const [ready, setReady] = useState(false);

  // 첫 로드 시 저장된 상태 복구 (sessionStorage - 탭 닫으면 자동 삭제)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setAuth(parsed);
        setReady(true); // 복구 완료
        return;
      }
      // sessionStorage에 없으면 localStorage 체크 (데모 모드 영속성)
      const rawLocal = localStorage.getItem(STORAGE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        // localStorage에 데모 모드가 있으면 복구
        if (parsed.demoMode) {
          setAuth(parsed);
        }
      }
    } catch {}
    setReady(true); // 복구 완료
  }, []);

  // 상태가 바뀔 때마다 sessionStorage에 저장 (보안 강화)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      // 데모 모드일 때만 localStorage에도 저장 (영속성)
      if (auth.demoMode) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      } else {
        // 데모 모드가 아니면 localStorage에서 제거
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, [auth]);

  // 로그아웃: 상태/스토리지 초기화
  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setAuth({ idToken: null, profile: null, demoMode: false });
  }, []);

  // 데모 모드 진입
  const enterDemoMode = useCallback(() => {
    const demoAuth: AuthState = {
      idToken: 'DEMO_MODE',
      profile: {
        name: 'Demo User',
        email: 'demo@purecare.app',
        picture: undefined,
      },
      demoMode: true,
    };
    setAuth(demoAuth);
  }, []);

  // 토큰 만료 시 자동 로그아웃 처리
  useEffect(() => {
    const onAuthExpired = () => {
      console.log('Auth token expired - logging out');
      signOut();
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, [signOut]);

  const value = useMemo(
    () => ({ auth, setAuth, signOut, enterDemoMode, ready }),
    [auth, ready, signOut, enterDemoMode]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

