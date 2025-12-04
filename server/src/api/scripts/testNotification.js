require('dotenv').config();
const { db } = require('../config/firebase');
const NotificationService = require('../services/notificationService');

/**
 * Test script to send a notification
 * Usage: node testNotification.js <deviceId>
 */

async function sendTestNotification() {
  const deviceId = process.argv[2];

  if (!deviceId) {
    console.error('❌ Please provide a device ID');
    console.log('Usage: node testNotification.js <deviceId>');
    console.log('Example: node testNotification.js your-device-id-here');
    process.exit(1);
  }

  try {
    console.log(`\n🧪 Testing notification for device: ${deviceId}\n`);

    // Check if device exists
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      console.error(`❌ Device ${deviceId} not found`);
      process.exit(1);
    }

    const deviceData = deviceDoc.data();
    const userId = deviceData.linkedUserID;

    if (!userId) {
      console.error(`❌ Device ${deviceId} is not linked to a user`);
      process.exit(1);
    }

    console.log(`✓ Device found, linked to user: ${userId}`);

    // Check if user has FCM token
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData?.fcmToken) {
      console.log(`✓ User has FCM token registered`);
    } else {
      console.log(`⚠️  User does NOT have FCM token (push notification will not be sent)`);
    }

    // Create test notification
    const notificationService = new NotificationService();

    const testNotification = {
      type: 'test_notification',
      title: 'Test Notification',
      message: 'This is a test notification from PuriCare! If you see this, notifications are working! 🎉',
      data: {
        testData: 'Hello from test script',
        timestamp: new Date().toISOString(),
        clickAction: '/home',
      },
    };

    console.log(`\n📤 Sending notification...`);

    await notificationService.sendNotification(deviceId, testNotification);

    console.log(`\n✅ Test notification sent successfully!`);
    console.log(`\nWhat was done:`);
    console.log(`  • In-app notification created in Firestore`);
    if (userData?.fcmToken) {
      console.log(`  • Push notification sent via FCM`);
    }
    console.log(`\nCheck:`);
    console.log(`  • Your app should show the notification`);
    console.log(`  • Firestore: users/${userId}/inboxNotifications`);
    console.log(`\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error sending test notification:', error);
    process.exit(1);
  }
}

sendTestNotification();
