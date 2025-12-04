// Firebase client-side configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

// Firebase configuration from environment variables
// Note: Must use NEXT_PUBLIC_ prefix for client-side access in Next.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006'}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006',
  storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006'}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Log config status for debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Firebase Config Status:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    hasSenderId: !!firebaseConfig.messagingSenderId,
    hasAppId: !!firebaseConfig.appId,
  });
}

// Initialize Firebase (only once)
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Export Firebase app
export { app };

// Initialize Firebase Cloud Messaging
// Note: This only works in browser environment, not during SSR
let messaging: Messaging | null = null;

export const getFirebaseMessaging = () => {
  // Check if we're in the browser and messaging is supported
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (!messaging) {
      try {
        // Check if service worker is registered before initializing messaging
        // This prevents Firebase from auto-registering its own service worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          messaging = getMessaging(app);
          console.log('✅ Firebase Messaging initialized with existing service worker');
        } else {
          console.warn('⚠️ Service worker not ready yet. Skipping Firebase Messaging initialization.');
          return null;
        }
      } catch (error) {
        console.error('Error initializing Firebase Messaging:', error);
      }
    }
    return messaging;
  }
  return null;
};

// Export messaging utilities
export { getToken, onMessage };
