const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let firebaseApp;

function initializeFirebase() {
  if (firebaseApp) {
    return { admin, db: firebaseApp.firestore(), auth: firebaseApp.auth() };
  }

  try {
    // You can initialize with service account key file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      const serviceAccount = require(path.resolve(serviceAccountPath));

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    } else {
      // Or initialize with individual credentials from environment variables
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    console.log('✅ Firebase Admin SDK initialized successfully');

    const db = firebaseApp.firestore();
    const auth = firebaseApp.auth();

    return { admin, db, auth };
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

module.exports = { initializeFirebase };
