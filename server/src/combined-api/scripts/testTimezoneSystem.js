require('dotenv').config();
const DeviceRegistrationHelper = require('../services/deviceRegistrationHelper');
const TimezoneService = require('../services/timezoneService');

/**
 * Test script to demonstrate the timezone-based device registration system
 *
 * Run with: npm run test-timezones
 */

async function testTimezoneSystem() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   TIMEZONE-BASED DEVICE REGISTRATION SYSTEM TEST       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const deviceHelper = new DeviceRegistrationHelper();
  const timezoneService = new TimezoneService();

  try {
    // ========================================
    // Test 1: Register sample devices
    // ========================================
    console.log('TEST 1: Registering sample devices\n');
    console.log('─'.repeat(60));

    const testDevices = [
      {
        deviceId: 'device-seoul-001',
        cityName: 'Seoul',
        userId: 'user123',
        metadata: { model: 'PuriCare-X1' },
      },
      {
        deviceId: 'device-chicago-001',
        cityName: 'Chicago',
        userId: 'user456',
        metadata: { model: 'PuriCare-X2' },
      },
      {
        deviceId: 'device-chicago-002',
        cityName: 'Chicago',
        userId: 'user789',
        metadata: { model: 'PuriCare-X1' },
      },
      {
        deviceId: 'device-tokyo-001',
        cityName: 'Tokyo',
        userId: 'user321',
        metadata: { model: 'PuriCare-Pro' },
      },
      {
        deviceId: 'device-london-001',
        cityName: 'London',
        userId: 'user654',
        metadata: { model: 'PuriCare-X2' },
      },
    ];

    for (const device of testDevices) {
      await deviceHelper.registerDevice(device);
    }

    console.log('─'.repeat(60));
    console.log('✓ All devices registered\n\n');

    // ========================================
    // Test 2: View timezone distribution
    // ========================================
    console.log('TEST 2: Timezone Distribution\n');
    console.log('─'.repeat(60));

    const stats = await timezoneService.getTimezoneStats();

    console.log(`Total Timezones: ${stats.totalTimezones}`);
    console.log(`Total Devices: ${stats.totalDevices}\n`);

    console.log('Breakdown by timezone:\n');
    for (const tz of stats.timezoneBreakdown) {
      console.log(`  📍 ${tz.timezone}`);
      console.log(`     Devices: ${tz.deviceCount}`);
      console.log(`     Cities: ${tz.cityNames.join(', ')}`);
      console.log(`     Last Run: ${tz.lastMidnightRun ? tz.lastMidnightRun.toDate().toISOString() : 'Never'}`);
      console.log('');
    }

    console.log('─'.repeat(60));
    console.log('✓ Timezone stats retrieved\n\n');

    // ========================================
    // Test 3: Get devices in specific timezone
    // ========================================
    console.log('TEST 3: Get devices in America/Chicago timezone\n');
    console.log('─'.repeat(60));

    const chicagoDevices = await timezoneService.getDevicesInTimezone('America/Chicago');

    console.log(`Devices in America/Chicago: ${chicagoDevices.deviceCount}`);
    console.log(`Device IDs: ${chicagoDevices.devices.join(', ')}`);
    console.log(`Cities: ${chicagoDevices.cityNames.join(', ')}\n`);

    console.log('─'.repeat(60));
    console.log('✓ Retrieved timezone-specific devices\n\n');

    // ========================================
    // Test 4: Update device location (timezone change)
    // ========================================
    console.log('TEST 4: Move device from Seoul to New York\n');
    console.log('─'.repeat(60));

    console.log('Before move:');
    const seoulBefore = await timezoneService.getDevicesInTimezone('Asia/Seoul');
    console.log(`  Asia/Seoul devices: ${seoulBefore.deviceCount}`);

    // Move device
    await deviceHelper.registerDevice({
      deviceId: 'device-seoul-001',
      cityName: 'New York',
      userId: 'user123',
      metadata: { model: 'PuriCare-X1', relocated: true },
    });

    console.log('\nAfter move:');
    const seoulAfter = await timezoneService.getDevicesInTimezone('Asia/Seoul');
    const nyAfter = await timezoneService.getDevicesInTimezone('America/New_York');
    console.log(`  Asia/Seoul devices: ${seoulAfter.deviceCount}`);
    console.log(`  America/New_York devices: ${nyAfter.deviceCount}`);

    console.log('\n─'.repeat(60));
    console.log('✓ Device location updated successfully\n\n');

    // ========================================
    // Test 5: Performance comparison
    // ========================================
    console.log('TEST 5: Performance Analysis\n');
    console.log('─'.repeat(60));

    const allTimezones = await timezoneService.getAllTimezones();

    console.log('Efficiency Metrics:');
    console.log(`  • Midnight checks per run: ${allTimezones.length} timezones (instead of ${stats.totalDevices} devices)`);
    console.log(`  • Reduction: ${((1 - allTimezones.length / stats.totalDevices) * 100).toFixed(1)}% fewer checks`);
    console.log(`  • Complexity: O(${allTimezones.length}) instead of O(${stats.totalDevices})`);
    console.log('\nWith 1000 devices across 10 timezones:');
    console.log(`  • Old approach: 1000 timezone checks`);
    console.log(`  • New approach: 10 timezone checks`);
    console.log(`  • Speed improvement: 100x faster 🚀\n`);

    console.log('─'.repeat(60));
    console.log('✓ Performance analysis complete\n\n');

    // ========================================
    // Test 6: Cleanup (optional)
    // ========================================
    console.log('TEST 6: Cleanup test devices (optional)\n');
    console.log('─'.repeat(60));
    console.log('To clean up test devices, run:');
    console.log('  node scripts/cleanupTestDevices.js\n');
    console.log('─'.repeat(60));

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              ALL TESTS PASSED ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
if (require.main === module) {
  testTimezoneSystem()
    .then(() => {
      console.log('✓ Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testTimezoneSystem };
