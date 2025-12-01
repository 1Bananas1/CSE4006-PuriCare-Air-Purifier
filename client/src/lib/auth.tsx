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
  ready: boolean;             // ← 로컬스토리지 복구 완료 여부
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

  // 첫 로드 시 저장된 상태 복구
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAuth(JSON.parse(raw));
    } catch {}
    setReady(true); // 복구 완료
  }, []);

  // 상태가 바뀔 때마다 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } catch {}
  }, [auth]);

  // 로그아웃: 상태/스토리지 초기화
  const signOut = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
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

  // 여러 탭 간 상태 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = e.newValue ? JSON.parse(e.newValue) : { idToken: null, profile: null };
        setAuth(next);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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

