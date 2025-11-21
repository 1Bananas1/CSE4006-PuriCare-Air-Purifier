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

          // Collect unique station IDs for this timezone
          const stationIds = new Set();
          const deviceStationMap = new Map(); // deviceId -> stationIdx

          for (const deviceId of deviceIds) {
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
            const stationIdx = deviceData.data?.stationIdx;
            const cityName = deviceData.data?.cityName || 'Unknown';

            console.log(`      • Device ${deviceId} in ${cityName}`);

            if (stationIdx) {
              stationIds.add(stationIdx);
              deviceStationMap.set(deviceId, stationIdx);
            }
          }

          console.log(
            `    → Found ${stationIds.size} unique stations to refresh`
          );

          // Refresh outdoor AQI data for each station
          let stationsRefreshed = 0;
          let notificationsCreated = 0;

          for (const stationIdx of stationIds) {
            try {
              // Fetch fresh AQI data from WAQI API
              const apiToken = process.env.AQICN_TOKEN;
              const response = await fetch(
                `https://api.waqi.info/feed/@${stationIdx}/?token=${apiToken}`
              );

              if (!response.ok) {
                console.log(
                  `      ⚠️  Failed to fetch station ${stationIdx}: HTTP ${response.status}`
                );
                continue;
              }

              const aqiResponse = await response.json();

              if (aqiResponse.status !== 'ok') {
                console.log(
                  `      ⚠️  Station ${stationIdx} API error: ${aqiResponse.data}`
                );
                continue;
              }

              const data = aqiResponse.data;

              // Update station cache in Firestore
              const stationRef = db
                .collection('stations')
                .doc(stationIdx.toString());

              const stationData = {
                stationIdx: stationIdx,
                timezone: data.time.tz,
                dominentPol: data.dominentpol,
                aqi: data.aqi,
                co: data.iaqi?.co?.v || null,
                dew: data.iaqi?.dew?.v || null,
                h: data.iaqi?.h?.v || null,
                no2: data.iaqi?.no2?.v || null,
                o3: data.iaqi?.o3?.v || null,
                p: data.iaqi?.p?.v || null,
                pm10: data.iaqi?.pm10?.v || null,
                pm25: data.iaqi?.pm25?.v || null,
                r: data.iaqi?.r?.v || null,
                so2: data.iaqi?.so2?.v || null,
                t: data.iaqi?.t?.v || null,
                w: data.iaqi?.w?.v || null,
                cityName: data.city?.name || 'Unknown',
                cityUrl: data.city?.url || null,
                cityGeo: data.city?.geo || null,
                lastUpdated: new Date(),
              };

              await stationRef.set(stationData, { merge: true });
              stationsRefreshed++;

              console.log(
                `      ✓ Refreshed station ${stationIdx}: AQI=${data.aqi}, PM2.5=${data.iaqi?.pm25?.v || 'N/A'}`
              );

              // Check if outdoor pollution is unhealthy (PM2.5 > 55 or AQI > 100)
              const outdoorPM25 = data.iaqi?.pm25?.v;
              const outdoorAQI = data.aqi;
              const isUnhealthy =
                (outdoorPM25 && outdoorPM25 > 55) || outdoorAQI > 100;

              if (isUnhealthy) {
                // Create pending notifications for devices using this station
                for (const [deviceId, devStationIdx] of deviceStationMap) {
                  if (devStationIdx === stationIdx) {
                    // Create notification document
                    const notificationRef = db
                      .collection('notifications')
                      .doc();

                    await notificationRef.set({
                      deviceId: deviceId,
                      type: 'outdoor_pollution_warning',
                      severity: outdoorAQI > 150 ? 'high' : 'medium',
                      title: 'High Outdoor Pollution Detected',
                      message: `Outdoor air quality is ${outdoorAQI > 150 ? 'unhealthy' : 'moderate to unhealthy'}. Keep windows closed. Current outdoor PM2.5: ${outdoorPM25 || 'N/A'} µg/m³, AQI: ${outdoorAQI}`,
                      data: {
                        outdoorPM25: outdoorPM25,
                        outdoorAQI: outdoorAQI,
                        stationIdx: stationIdx,
                        cityName: data.city?.name || 'Unknown',
                      },
                      createdAt: new Date(),
                      sentAt: null, // Will be sent during daytime hours
                      status: 'pending', // pending, sent, failed
                    });

                    notificationsCreated++;
                  }
                }
              }
            } catch (error) {
              console.log(
                `      ❌ Error refreshing station ${stationIdx}:`,
                error.message
              );
            }
          }

          console.log(`    ✓ Refreshed ${stationsRefreshed} stations`);
          console.log(`    ✓ Created ${notificationsCreated} notifications`);

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
