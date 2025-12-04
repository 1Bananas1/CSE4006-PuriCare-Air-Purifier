'use client';

import { useEffect } from 'react';
import { registerFCMToken, setupForegroundMessageListener } from '@/lib/fcm';
import { useAuth } from '@/lib/auth';

/**
 * NotificationProvider
 *
 * This component handles:
 * 1. Registering the service worker
 * 2. Requesting notification permission (only when user is authenticated)
 * 3. Registering the FCM token with the server
 * 4. Listening for foreground messages
 *
 * Add this to your root layout to enable notifications app-wide
 */
export default function NotificationProvider() {
  const { auth, ready } = useAuth();

  // Register service worker on mount (doesn't require auth)
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Register service worker and cleanup old ones
    const setupServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // First, unregister any old Firebase Cloud Messaging service workers
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            // Remove old Firebase Messaging service worker with different scope
            if (registration.scope.includes('firebase-cloud-messaging-push-scope')) {
              console.log('🗑️ Unregistering old Firebase Messaging service worker:', registration.scope);
              await registration.unregister();
            }
          }

          // Now register our custom service worker
          const registration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
          );
          console.log('✅ Service Worker registered:', registration);
          return registration;
        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
          return null;
        }
      }
      return null;
    };

    setupServiceWorker();
  }, []);

  // Setup FCM only when user is authenticated
  useEffect(() => {
    // Wait for auth to be ready and check if user is authenticated
    if (!ready || !auth.idToken) {
      console.log('⏸️ Skipping FCM setup - user not authenticated');
      return;
    }

    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      return;
    }

    // Function to setup FCM
    const setupFCM = async () => {
      try {
        console.log('🔔 Setting up FCM notifications for authenticated user...');

        // Register FCM token (this will request permission if needed)
        const token = await registerFCMToken(auth.idToken);

        if (token) {
          console.log('✅ FCM token registered:', token);
        } else {
          console.log('⚠️ FCM token not registered (user may have denied permission)');
        }

        // Setup foreground message listener
        setupForegroundMessageListener((payload) => {
          console.log('📬 Foreground message received:', payload);

          // Show a browser notification for foreground messages
          const notificationTitle = payload.notification?.title || 'New Notification';
          const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/icon-192x192.png',
            data: payload.data,
          };

          // Show notification
          if (Notification.permission === 'granted') {
            new Notification(notificationTitle, notificationOptions);
          }

          // You can also update your UI here, e.g., add to notification list
          // or show a toast notification
        });

      } catch (error) {
        console.error('❌ Error setting up FCM:', error);
      }
    };

    // Setup FCM when user is authenticated
    setupFCM();
  }, [ready, auth.idToken]);

  // This component doesn't render anything
  return null;
}
