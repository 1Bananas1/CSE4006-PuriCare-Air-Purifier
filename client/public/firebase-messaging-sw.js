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
// IMPORTANT: You must replace these placeholder values with the correct values from your Firebase project.
// Go to Firebase Console > Project Settings > General tab > Your apps > Web app
// These values are safe to be public (they're client-side config).
const firebaseConfig = {
  apiKey: 'AIzaSyAeSnru6_8Hld7ZHeiTo8qJrAk-gCqeJqs', // Replace with "Web API Key" from Firebase Console
  authDomain: 'cse4006.firebaseapp.com',
  projectId: 'cse4006',
  storageBucket: 'cse4006.appspot.com',
  messagingSenderId: '69702374995', // Replace with "Messaging Sender ID" from Firebase Console
  appId: '1:69702374995:ios:bb18d3a16210a19e9518a6', // Replace with "App ID" from Firebase Console
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
