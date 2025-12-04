const moment = require('moment-timezone');
const { db, admin } = require('../config/firebase');

/**
 * Notification Service
 * Sends air quality notifications during reasonable hours (8 AM - 9 PM)
 * Prevents duplicate notifications on the same day
 */

class NotificationService {
  constructor() {
    this.db = db;
    this.notificationsCollection = db.collection('notifications');
  }

  /**
   * Process pending notifications and send them during reasonable hours
   * Called hourly by cron job
   */
  async processPendingNotifications() {
    console.log('\n=== NOTIFICATION SERVICE ===');
    console.log(`Started at: ${new Date().toISOString()}\n`);

    try {
      // Get all pending notifications
      const pendingSnapshot = await this.notificationsCollection
        .where('status', '==', 'pending')
        .get();

      if (pendingSnapshot.empty) {
        console.log('✓ No pending notifications to process\n');
        return { sent: 0, skipped: 0, failed: 0 };
      }

      console.log(`Found ${pendingSnapshot.size} pending notifications\n`);

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const notifDoc of pendingSnapshot.docs) {
        const notification = notifDoc.data();
        const deviceId = notification.deviceId;

        try {
          // Get device to check timezone
          const deviceDoc = await db.collection('devices').doc(deviceId).get();

          if (!deviceDoc.exists) {
            console.log(`⚠️  Device ${deviceId} not found - skipping`);
            await notifDoc.ref.update({
              status: 'failed',
              error: 'Device not found',
            });
            failed++;
            continue;
          }

          const deviceData = deviceDoc.data();
          const timezone = deviceData.data?.timezone || 'UTC';

          // Get current local time for device's timezone
          const localTime = moment().tz(timezone);
          const hour = localTime.hour();

          // Check if it's reasonable hours (8 AM - 9 PM)
          const isReasonableHour = hour >= 8 && hour < 21;

          console.log(`[${deviceId}]`);
          console.log(`  Timezone: ${timezone}`);
          console.log(
            `  Local time: ${localTime.format('YYYY-MM-DD HH:mm:ss z')}`
          );
          console.log(
            `  Reasonable hour: ${isReasonableHour ? 'YES' : 'NO (8AM-9PM)'}`
          );

          if (!isReasonableHour) {
            console.log(`  → Skipping until reasonable hours\n`);
            skipped++;
            continue;
          }

          // Check if similar notification already sent today
          const todayStart = localTime.clone().startOf('day').toDate();
          const existingSentSnapshot = await this.notificationsCollection
            .where('deviceId', '==', deviceId)
            .where('type', '==', notification.type)
            .where('status', '==', 'sent')
            .where('sentAt', '>=', todayStart)
            .get();

          if (!existingSentSnapshot.empty) {
            console.log(`  → Already sent today - marking as duplicate\n`);
            await notifDoc.ref.update({ status: 'duplicate' });
            skipped++;
            continue;
          }

          // Send notification (integrate with your notification system here)
          await this.sendNotification(deviceId, notification);

          // Mark as sent
          await notifDoc.ref.update({
            status: 'sent',
            sentAt: new Date(),
          });

          console.log(`  ✓ Notification sent!\n`);
          sent++;
        } catch (error) {
          console.error(`  ❌ Error processing notification:`, error.message);
          await notifDoc.ref.update({
            status: 'failed',
            error: error.message,
          });
          failed++;
        }
      }

      console.log('=== SUMMARY ===');
      console.log(`Sent: ${sent}`);
      console.log(`Skipped: ${skipped}`);
      console.log(`Failed: ${failed}\n`);

      return { sent, skipped, failed };
    } catch (error) {
      console.error('❌ Error processing notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to user
   * This is a stub - integrate with your notification provider
   * Options: Firebase Cloud Messaging, SendGrid, Twilio, etc.
   */
  async sendNotification(deviceId, notification) {
    // Get device owner's user ID
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    const userId = deviceDoc.data().linkedUserID;

    // Get user's notification preferences
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    console.log(`  Sending to user ${userId}:`);
    console.log(`    Title: ${notification.title}`);
    console.log(`    Message: ${notification.message}`);

    // TODO: Integrate with notification provider
    // Examples:

    // 1. Firebase Cloud Messaging (Push notifications)
    if (userData.fcmToken) {
      try {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title: notification.title,
            body: notification.message,
          },
          data: {
            ...notification.data,
            type: notification.type,
            deviceId: deviceId,
            clickAction: notification.data?.clickAction || '/dashboard',
          },
          webpush: {
            fcmOptions: {
              link: notification.data?.clickAction || '/dashboard',
            },
          },
        });

        console.log(`    ✓ Push notification sent via FCM`);
      } catch (fcmError) {
        // Handle invalid/expired tokens
        if (
          fcmError.code === 'messaging/invalid-registration-token' ||
          fcmError.code === 'messaging/registration-token-not-registered'
        ) {
          console.log(`    ⚠️  FCM token invalid/expired - removing from user`);

          // Remove invalid token from user document
          await db.collection('users').doc(userId).update({
            fcmToken: null,
            fcmTokenUpdatedAt: new Date(),
          });
        } else {
          console.error(`    ❌ FCM error:`, fcmError.message);
        }
      }
    }

    // 2. Email (SendGrid, Mailgun, etc.)
    // if (userData.email && userData.emailNotifications) {
    //   await sendEmail({
    //     to: userData.email,
    //     subject: notification.title,
    //     body: notification.message,
    //   });
    // }

    // 3. SMS (Twilio)
    // if (userData.phone && userData.smsNotifications) {
    //   await sendSMS({
    //     to: userData.phone,
    //     body: notification.message,
    //   });
    // }

    // 4. In-app notification (store in Firestore for frontend to poll)
    await db
      .collection('users')
      .doc(userId)
      .collection('inboxNotifications')
      .add({
        ...notification,
        deviceId,
        read: false,
        createdAt: new Date(),
      });

    console.log(`    ✓ In-app notification created`);
  }

  /**
   * Create a notification manually (for testing or other triggers)
   */
  async createNotification(deviceId, notificationData) {
    const notificationRef = this.notificationsCollection.doc();

    await notificationRef.set({
      deviceId,
      ...notificationData,
      createdAt: new Date(),
      sentAt: null,
      status: 'pending',
    });

    console.log(`✓ Created notification for device ${deviceId}`);
    return notificationRef.id;
  }

  /**
   * Get notification statistics
   */
  async getStats() {
    const [pending, sent, failed] = await Promise.all([
      this.notificationsCollection.where('status', '==', 'pending').get(),
      this.notificationsCollection.where('status', '==', 'sent').get(),
      this.notificationsCollection.where('status', '==', 'failed').get(),
    ]);

    return {
      pending: pending.size,
      sent: sent.size,
      failed: failed.size,
      total: pending.size + sent.size + failed.size,
    };
  }
}

module.exports = NotificationService;
