'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Profile = { name?: string; email?: string; picture?: string };
type AuthState = {
  idToken: string | null;     // Google ID 토큰
  profile: Profile | null;    // 디코딩된 프로필
};

type AuthContext = {
  auth: AuthState;
  setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
  signOut: () => void;
  ready: boolean;             // ← 로컬스토리지 복구 완료 여부
};

const STORAGE_KEY = 'purecare_auth';

const AuthCtx = createContext<AuthContext>({
  auth: { idToken: null, profile: null },
  setAuth: () => {},
  signOut: () => {},
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

  // 로그아웃: 상태/스토리지 초기화
  const signOut = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setAuth({ idToken: null, profile: null });
  };

  const value = useMemo(
    () => ({ auth, setAuth, signOut, ready }),
    [auth, ready]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

