// Firebase Cloud Messaging Service Worker
// This file handles background notifications when the app is not open

// Take control of all pages immediately
self.addEventListener('install', () => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(self.clients.claim());
});

// Give the service worker access to Firebase Messaging.
// Note: We use importScripts because service workers don't support ES modules yet
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
);

// Initialize the Firebase app in the service worker
// This placeholder will be replaced by the API route with actual config from environment variables
const firebaseConfig = self.__FIREBASE_CONFIG__;

firebase.initializeApp(firebaseConfig);

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
