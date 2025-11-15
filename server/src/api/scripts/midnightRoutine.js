require('dotenv').config();
const moment = require('moment-timezone');
const { db } = require('../config/firebase');
const TimezoneService = require('../services/timezoneService');

async function runMidnightRoutine() {
  console.log('\n=== MIDNIGHT ROUTINE CHECK ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Initialize services
    const timezoneService = new TimezoneService();

    const now = new Date();
    const timezones = await timezoneService.getAllTimezones();

    if (timezones.length === 0) {
      console.log('⚠️  No timezones found in database');
      console.log(
        'Timezones are automatically created when devices are registered.'
      );
      console.log('Register a device to populate the timezones collection.\n');
      return;
    }

    console.log(`Found ${timezones.length} timezones to check:\n`);

    let midnightCount = 0;
    let devicesProcessed = 0;

    for (let i = 0; i < timezones.length; i++) {
      const timezoneData = timezones[i];
      const timezoneId = timezoneData.timezone;

      // Get current time in this timezone
      const localTime = moment.tz(now, timezoneId);
      const hour = localTime.hour();
      const minute = localTime.minute();

      // Check if it's midnight (30-minute window: 23:45-00:14)
      const isMidnight =
        (hour === 23 && minute >= 45) || (hour === 0 && minute <= 14);

      // Log timezone status
      console.log(`[${i + 1}/${timezones.length}] ${timezoneId}:`);
      console.log(
        `    Local Time: ${localTime.format('YYYY-MM-DD HH:mm:ss z')}`
      );
      console.log(`    Devices: ${timezoneData.deviceCount || 0}`);
      console.log(`    Cities: ${(timezoneData.cityNames || []).join(', ')}`);
      console.log(`    Is Midnight Window: ${isMidnight ? '✓ YES' : '✗ NO'}`);

      if (isMidnight) {
        midnightCount++;

        // Check if already ran today
        const lastRun = timezoneData.lastMidnightRun;
        const lastRunMoment = lastRun
          ? moment(lastRun.toDate ? lastRun.toDate() : lastRun).tz(timezoneId)
          : null;
        const alreadyRanToday =
          lastRunMoment && localTime.isSame(lastRunMoment, 'day');

        console.log(
          `    Last Run: ${lastRun ? lastRunMoment.format('YYYY-MM-DD HH:mm:ss z') : 'Never'}`
        );
        console.log(
          `    Already Ran Today: ${alreadyRanToday ? 'YES (skipping)' : 'NO'}`
        );

        if (!alreadyRanToday) {
          console.log(`    🌙 EXECUTING MIDNIGHT ROUTINE for ${timezoneId}`);
          console.log(
            `    → Processing ${timezoneData.deviceCount} devices...`
          );

          // Get all devices in this timezone
          const deviceIds = timezoneData.deviceIds || [];
          devicesProcessed += deviceIds.length;

          // Process each device in this timezone
          for (const deviceId of deviceIds) {
            // Fetch full device data
            const deviceDoc = await db
              .collection('devices')
              .doc(deviceId)
              .get();

            if (!deviceDoc.exists) {
              console.log(
                `      ⚠️  Device ${deviceId} not found in devices collection`
              );
              continue;
            }

            const deviceData = deviceDoc.data();
            const cityName = deviceData.cityName || 'Unknown';

            console.log(`      • Device ${deviceId} in ${cityName}`);

            // TODO: Add your midnight routine logic here based on city/device
            // Examples:
            // - Reset daily air quality counters
            // - Generate daily reports for this device
            // - Send notifications based on city
            // - Clean up old sensor data
            // - Update device statistics

            // Example: You can access device-specific data
            // if (cityName === 'Seoul') {
            //   // Do something specific for Seoul devices
            // }
          }

          // Update last run timestamp for this timezone
          await timezoneService.updateLastMidnightRun(timezoneId);

          console.log(`    ✓ Processed ${deviceIds.length} devices`);
          console.log(`    ✓ Updated lastMidnightRun timestamp`);
        }
      }

      console.log(''); // Empty line between timezones
    }

    console.log('=== SUMMARY ===');
    console.log(`Total timezones checked: ${timezones.length}`);
    console.log(`Timezones at midnight: ${midnightCount}`);
    console.log(`Devices processed: ${devicesProcessed}`);
    console.log(`Completed at: ${new Date().toISOString()}\n`);
  } catch (error) {
    console.error('❌ Error running midnight routine:', error);
    throw error;
  }
}

// Allow script to be run directly or imported
if (require.main === module) {
  // Running directly via `node midnightRoutine.js` or `npm run midnight`
  runMidnightRoutine()
    .then(() => {
      console.log('✓ Midnight routine completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Midnight routine failed:', error);
      process.exit(1);
    });
}

// Export for use in other modules (e.g., cron jobs)
module.exports = { runMidnightRoutine };
