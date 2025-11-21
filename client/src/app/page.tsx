'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const { auth, ready } = useAuth();

  useEffect(() => {
    if (ready) {
      if (auth.idToken) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [auth.idToken, ready, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
    </div>
  );
}
