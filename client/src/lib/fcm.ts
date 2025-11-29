// Firebase Cloud Messaging service
import { getFirebaseMessaging, getToken, onMessage } from './firebase';

// VAPID key for web push (you'll need to generate this in Firebase Console)
// Go to: Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
console.log('VAPID_KEY:', VAPID_KEY);
/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register FCM token with the server
 * @param authToken - The user's authentication token (idToken from auth context)
 */
export async function registerFCMToken(
  authToken?: string | null
): Promise<string | null> {
  try {
    // Wait for service worker to be ready before getting messaging instance
    let messaging = getFirebaseMessaging();

    // If messaging is not available, wait and retry (service worker might still be registering)
    if (!messaging && 'serviceWorker' in navigator) {
      console.log('⏳ Waiting for service worker to be ready...');
      await navigator.serviceWorker.ready;
      // Try again after service worker is ready
      messaging = getFirebaseMessaging();
    }

    if (!messaging) {
      console.warn('Firebase Messaging not available');
      return null;
    }

    // Request permission first
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (!token) {
      console.warn('No FCM token generated');
      return null;
    }

    console.log('FCM token generated:', token);

    // Send token to server (only if authToken is provided)
    if (authToken) {
      await sendTokenToServer(token, authToken);
    } else {
      console.warn('No auth token provided - skipping server registration');
    }

    return token;
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return null;
  }
}

/**
 * Send FCM token to server
 * @param token - The FCM token to register
 * @param authToken - The user's authentication token (idToken from auth context)
 */
async function sendTokenToServer(
  token: string,
  authToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/users/fcm-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send FCM token to server');
    }

    console.log('✓ FCM token sent to server successfully');
  } catch (error) {
    console.error('Error sending FCM token to server:', error);
    throw error;
  }
}

/**
 * Remove FCM token from server (when user revokes permission)
 * @param authToken - The user's authentication token (idToken from auth context)
 */
export async function removeFCMToken(authToken: string): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/users/fcm-token`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to remove FCM token from server');
    }

    console.log('✓ FCM token removed from server');
  } catch (error) {
    console.error('Error removing FCM token from server:', error);
    throw error;
  }
}

/**
 * Check and update FCM permission status
 * Call this on app load to sync permission state with server
 * @param authToken - The user's authentication token (idToken from auth context)
 */
export async function checkAndUpdateFCMPermission(
  authToken: string
): Promise<void> {
  if (!('Notification' in window)) {
    return;
  }

  const permission = Notification.permission;

  if (permission === 'granted') {
    // User has granted permission - register token
    await registerFCMToken(authToken);
  } else if (permission === 'denied') {
    // User has denied permission - remove token from server
    await removeFCMToken(authToken);
  }
  // 'default' = not asked yet, do nothing
}

/**
 * Setup foreground message listener
 * This handles notifications when the app is open
 */
export function setupForegroundMessageListener(
  onMessageReceived: (payload: any) => void
): void {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    onMessageReceived(payload);
  });
}
