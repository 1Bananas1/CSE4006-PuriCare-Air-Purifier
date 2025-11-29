// Firebase Cloud Messaging Service Worker
// This file handles background notifications when the app is not open

// Give the service worker access to Firebase Messaging.
// Note: We use importScripts because service workers don't support ES modules yet
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
);

// Initialize the Firebase app in the service worker
// IMPORTANT: This config should match your Vercel environment variables
// Get these values from Firebase Console > Project Settings
// These values are safe to be public (they're client-side config)

// For now, we need to hardcode these since service workers can't access process.env
// TODO: Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: 'AIzaSyDVIlFOgFPTnkkxuUT-P6y1ayM2VALa2r8',
  authDomain: 'cse4006.firebaseapp.com',
  projectId: 'cse4006',
  storageBucket: 'cse4006.appspot.com',
  messagingSenderId: '69702374995',
  appId: '1:69702374995:web:d91730d0bc33b5629518a6',
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message:',
    payload
  );

  // Customize notification here
  const notificationTitle =
    payload.notification?.title || 'PuriCare Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192x192.png', // Add your app icon
    badge: '/badge-72x72.png', // Add your badge icon
    data: payload.data,
    tag: payload.data?.type || 'default', // Prevents duplicate notifications
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  // Show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Get the click action URL from notification data
  const clickAction = event.notification.data?.clickAction || '/';

  // Open or focus the app
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(clickAction) && 'focus' in client) {
            return client.focus();
          }
        }

        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow(clickAction);
        }
      })
  );
});
