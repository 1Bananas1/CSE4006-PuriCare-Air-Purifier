require('dotenv').config();
const moment = require('moment-timezone');
const { db } = require('../config/firebase');
const NotificationService = require('../services/notificationService');

async function processNotifications() {
  console.log('\n=== PROCESSING PENDING NOTIFICATIONS ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    const notificationService = new NotificationService();

    // Get pending notifs
    const pendingNotifications = await db
      .collection('notifications')
      .where('status', '==', 'pending')
      .get();

    if (pendingNotifications.empty) {
      console.log('No pending notifications to process\n');
      return { sent: 0, skipped: 0, failed: 0 };
    }

    console.log(`Found ${pendingNotifications.size} pending notifications\n`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // For each notification
    for (const notificationDoc of pendingNotifications.docs) {
      const notification = notificationDoc.data();

      try {
        // Get device to check timezone
        const deviceDoc = await db
          .collection('devices')
          .doc(notification.deviceId)
          .get();

        if (!deviceDoc.exists) {
          console.log(`⚠️  Device ${notification.deviceId} not found - skipping`);
          await notificationDoc.ref.update({
            status: 'failed',
            error: 'Device not found',
          });
          failed++;
          continue;
        }

        const device = deviceDoc.data();
        const timezoneValue = device.data?.timezone || 'UTC';

        // Handle both named timezones (e.g., 'Asia/Seoul') and UTC offsets (e.g., '+09:00')
        let deviceTime;
        if (timezoneValue.startsWith('+') || timezoneValue.startsWith('-')) {
          // It's a UTC offset like '+09:00' - use utcOffset instead of tz
          deviceTime = moment().utcOffset(timezoneValue);
        } else {
          // It's a named timezone like 'Asia/Seoul' or 'UTC'
          deviceTime = moment.tz(new Date(), timezoneValue);
        }

        const timezone = timezoneValue; // For logging
        const hour = deviceTime.hour();
        const isReasonableHour = hour >= 8 && hour < 21;

        console.log(`[${notification.deviceId}]`);
        console.log(`  Timezone: ${timezone}`);
        console.log(`  Local time: ${deviceTime.format('YYYY-MM-DD HH:mm:ss z')}`);
        console.log(`  Reasonable hour: ${isReasonableHour ? 'YES' : 'NO (8AM-9PM)'}`);

        if (!isReasonableHour) {
          console.log(`  → Skipping until reasonable hours\n`);
          skipped++;
          continue;
        }

        // Check for duplicates - same type sent today
        const todayStart = deviceTime.clone().startOf('day').toDate();
        const existingSentSnapshot = await db
          .collection('notifications')
          .where('deviceId', '==', notification.deviceId)
          .where('type', '==', notification.type)
          .where('status', '==', 'sent')
          .where('sentAt', '>=', todayStart)
          .get();

        if (!existingSentSnapshot.empty) {
          console.log(`  → Already sent today - marking as duplicate\n`);
          await notificationDoc.ref.update({ status: 'duplicate' });
          skipped++;
          continue;
        }

        // Send notification
        await notificationService.sendNotification(notification.deviceId, {
          title: notification.title,
          message: notification.message,
          data: notification.data,
          type: notification.type,
        });

        // Mark as sent
        await notificationDoc.ref.update({
          status: 'sent',
          sentAt: new Date(),
        });

        console.log(`  ✓ Notification sent!\n`);
        sent++;
      } catch (error) {
        console.error(`  ❌ Error processing notification:`, error.message);
        await notificationDoc.ref.update({
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

// Allow script to be run directly or imported
if (require.main === module) {
  processNotifications()
    .then(() => {
      console.log('✓ Notification processing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Notification processing failed:', error);
      process.exit(1);
    });
}

module.exports = { processNotifications };