'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { auth, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !auth.idToken) {
      router.push('/login');
    }
  }, [auth.idToken, ready, router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!auth.idToken) {
    return null;
  }

  return <>{children}</>;
}
