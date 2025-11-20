'use client';

import { useEffect } from 'react';

export function PWALifecycle() {
  // Service worker can be re-enabled in production deployment
  useEffect(() => {
    // Unregister any existing service workers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
  }, []);

  return null;
}
