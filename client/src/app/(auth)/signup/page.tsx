'use client';

import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ maxWidth: 400, width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>
          Sign Up
        </h1>
        <p style={{ marginBottom: 24, opacity: 0.8 }}>
          Sign up functionality is coming soon.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#4f46e5',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Go to Login
        </button>
      </div>
    </main>
  );
}
