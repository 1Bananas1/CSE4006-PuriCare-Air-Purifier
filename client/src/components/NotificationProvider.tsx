'use client';

import { useEffect } from 'react';
import { registerFCMToken, setupForegroundMessageListener } from '@/lib/fcm';

/**
 * NotificationProvider
 *
 * This component handles:
 * 1. Requesting notification permission from the user
 * 2. Registering the FCM token with the server
 * 3. Listening for foreground messages
 *
 * Add this to your root layout to enable notifications app-wide
 */
export default function NotificationProvider() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Function to setup FCM
    const setupFCM = async () => {
      try {
        console.log('🔔 Setting up FCM notifications...');

        // Register FCM token (this will request permission if needed)
        const token = await registerFCMToken();

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

    // Setup FCM when component mounts
    setupFCM();
  }, []);

  // This component doesn't render anything
  return null;
}
