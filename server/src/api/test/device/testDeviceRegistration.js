require('dotenv').config();
const { db } = require('../../config/firebase');
const { registerDevice } = require('../../services/deviceService');

// Test configuration
const TEST_USER_ID = 'test-user-register';
const TEST_DEVICE_UNCLAIMED = '34566543'; // Device not yet claimed
const TEST_DEVICE_CLAIMED = '23456789'; // Device already claimed
const TEST_DEVICE_INVALID = 'invalid-device-id'; // Device not in system

// Test coordinates
const SEOUL_COORDS = [37.542036, 127.049685]; // Seoul, South Korea (+09:00)
const CHICAGO_COORDS = [41.8781, -87.6298]; // Chicago, USA (-06:00)
const INVALID_COORDS = [999, 999]; // Out of bounds
const NULL_COORDS = [null, null]; // No location

async function testMissingDeviceID() {
  console.log('\n--- Test 1: Missing deviceID ---');
  try {
    await registerDevice(TEST_USER_ID, {
      name: 'Test Device',
      geo: SEOUL_COORDS,
      // deviceID is missing
    });
    console.error('✗ FAILED: Should have thrown error for missing deviceID');
  } catch (error) {
    if (error.message === 'Missing required field: deviceID') {
      console.log('✓ SUCCESS: Correctly rejected missing deviceID');
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function testInvalidDeviceID() {
  console.log('\n--- Test 2: Invalid deviceID (not in masterDeviceList) ---');
  try {
    await registerDevice(TEST_USER_ID, {
      deviceID: TEST_DEVICE_INVALID,
      name: 'Test Device',
      geo: SEOUL_COORDS,
    });
    console.error('✗ FAILED: Should have thrown error for invalid device ID');
  } catch (error) {
    if (
      error.message ===
      'Invalid device ID. The device does not exist in our system.'
    ) {
      console.log('✓ SUCCESS: Correctly rejected invalid device ID');
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function testSuccessfulRegistrationWithValidGeo() {
  console.log('\n--- Test 3: Successful Registration with Valid Geo ---');
  console.log(
    `NOTE: Requires ${TEST_DEVICE_UNCLAIMED} in masterDeviceList with claimedAt: null`
  );
  console.log('NOTE: This test will make a real AQI API call');

  try {
    const deviceData = {
      deviceID: TEST_DEVICE_UNCLAIMED,
      name: 'Seoul Air Purifier',
      customLocation: 'Living Room',
      geo: SEOUL_COORDS,
    };

    console.log('Registering device with payload:');
    console.log(JSON.stringify(deviceData, null, 2));

    const registeredDeviceID = await registerDevice(TEST_USER_ID, deviceData);

    // Verify the device was created in devices collection
    const userDevice = await db
      .collection('devices')
      .doc(registeredDeviceID)
      .get();

    if (!userDevice.exists) {
      console.error('✗ FAILED: Device not found in devices collection');
      return;
    }

    const userData = userDevice.data();

    // NEW: Store timezone and stationIdx for later checks
    const deviceTimezone = userData.data.timezone;
    const deviceStationIdx = userData.data.stationIdx;

    console.log(`\n  Device timezone from AQI API: ${deviceTimezone}`);
    console.log(`  Device station index: ${deviceStationIdx}`);

    const checks = [
      {
        name: 'linkedUserID matches',
        check: userData.linkedUserID === TEST_USER_ID,
      },
      {
        name: 'device name is correct',
        check: userData.data.name === 'Seoul Air Purifier',
      },
      {
        name: 'customLocation is set',
        check: userData.data.customLocation === 'Living Room',
      },
      {
        name: 'timezone is set from AQI API (should be +09:00 for Seoul)',
        check: userData.data.timezone !== null && userData.data.timezone !== 'UTC',
      },
      {
        name: 'stationIdx is set',
        check: userData.data.stationIdx !== null,
      },
      {
        name: 'geo is set correctly',
        check:
          JSON.stringify(userData.data.geo) === JSON.stringify(SEOUL_COORDS),
      },
      {
        name: 'settings initialized',
        check:
          userData.settings.autoMode === false &&
          userData.settings.fanSpeed === 0,
      },
      {
        name: 'status.online is false',
        check: userData.status.online === false,
      },
    ];

    let allPassed = true;
    checks.forEach((item) => {
      if (item.check) {
        console.log(`  ✓ ${item.name}`);
      } else {
        console.log(`  ✗ ${item.name}`);
        allPassed = false;
      }
    });

    // Verify master device was updated
    const masterDevice = await db
      .collection('masterDeviceList')
      .doc(registeredDeviceID)
      .get();

    if (masterDevice.data().claimedAt === null) {
      console.error('✗ FAILED: Master device claimedAt not set');
      allPassed = false;
    } else {
      console.log('  ✓ Master device marked as claimed');
    }

    // NEW: Verify timezone was added to timezones collection
    const timezoneDoc = await db
      .collection('timezones')
      .doc(deviceTimezone)
      .get();

    if (timezoneDoc.exists) {
      const tzData = timezoneDoc.data();
      console.log(`  ✓ Device added to timezone collection: ${deviceTimezone}`);
      console.log(`    Device count in timezone: ${tzData.deviceIds?.length || 0}`);
    } else {
      console.error(`  ✗ FAILED: Timezone ${deviceTimezone} not found in timezones collection`);
      allPassed = false;
    }

    // NEW: Verify station was cached in stations collection
    if (deviceStationIdx) {
      const stationDoc = await db
        .collection('stations')
        .doc(deviceStationIdx.toString())
        .get();

      if (stationDoc.exists) {
        const stationData = stationDoc.data();
        console.log(`  ✓ Station data cached for idx ${deviceStationIdx}`);
        console.log(`    AQI: ${stationData.aqi}`);
        console.log(`    PM2.5: ${stationData.pm25}`);
        console.log(`    Timezone: ${stationData.timezone}`);
        console.log(`    City: ${stationData.cityName}`);
      } else {
        console.error(`  ✗ FAILED: Station ${deviceStationIdx} not found in stations collection`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log(
        '\n✓ SUCCESS: Device registered with AQI data and station caching!'
      );
    } else {
      console.error('\n✗ FAILED: Some validations failed');
    }
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
    console.error(error.stack);
  }
}

async function testRegistrationWithInvalidGeo() {
  console.log('\n--- Test 4: Registration with Invalid Geo Coordinates ---');
  console.log('NOTE: Should set geo to [null, null] and timezone to null');

  try {
    const deviceData = {
      deviceID: TEST_DEVICE_UNCLAIMED + '_geo',
      name: 'Invalid Geo Purifier',
      customLocation: 'Bedroom',
      geo: INVALID_COORDS, // Out of bounds
    };

    console.log('Registering device with out-of-bounds geo:');
    console.log(JSON.stringify(deviceData, null, 2));

    const registeredDeviceID = await registerDevice(TEST_USER_ID, deviceData);

    const userDevice = await db
      .collection('devices')
      .doc(registeredDeviceID)
      .get();

    const userData = userDevice.data();

    const checks = [
      {
        name: 'geo was set to [null, null]',
        check: JSON.stringify(userData.data.geo) === JSON.stringify([null, null]),
      },
      {
        name: 'timezone was set to UTC (fallback)',
        check: userData.data.timezone === 'UTC',
      },
      {
        name: 'stationIdx is null',
        check: userData.data.stationIdx === null,
      },
    ];

    let allPassed = true;
    checks.forEach((item) => {
      if (item.check) {
        console.log(`  ✓ ${item.name}`);
      } else {
        console.log(`  ✗ ${item.name}`);
        allPassed = false;
      }
    });

    if (allPassed) {
      console.log('\n✓ SUCCESS: Invalid geo handled correctly!');
    } else {
      console.error('\n✗ FAILED: Invalid geo not handled properly');
    }
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
  }
}

async function testRegistrationWithNullGeo() {
  console.log('\n--- Test 5: Registration with Null Geo ---');
  console.log('NOTE: Should skip AQI call and set timezone to UTC');

  try {
    const deviceData = {
      deviceID: TEST_DEVICE_UNCLAIMED + '_null',
      name: 'No Location Purifier',
      customLocation: 'Office',
      geo: NULL_COORDS,
    };

    console.log('Registering device with null geo:');
    console.log(JSON.stringify(deviceData, null, 2));

    const registeredDeviceID = await registerDevice(TEST_USER_ID, deviceData);

    const userDevice = await db
      .collection('devices')
      .doc(registeredDeviceID)
      .get();

    const userData = userDevice.data();

    const checks = [
      {
        name: 'geo is [null, null]',
        check: JSON.stringify(userData.data.geo) === JSON.stringify([null, null]),
      },
      {
        name: 'timezone was set to UTC (no AQI call made)',
        check: userData.data.timezone === 'UTC',
      },
      {
        name: 'stationIdx is null (no AQI call made)',
        check: userData.data.stationIdx === null,
      },
    ];

    let allPassed = true;
    checks.forEach((item) => {
      if (item.check) {
        console.log(`  ✓ ${item.name}`);
      } else {
        console.log(`  ✗ ${item.name}`);
        allPassed = false;
      }
    });

    if (allPassed) {
      console.log('\n✓ SUCCESS: Null geo handled correctly!');
    } else {
      console.error('\n✗ FAILED: Null geo not handled properly');
    }
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
  }
}

async function testStationCachingForExistingTimezone() {
  console.log('\n--- Test 6: Station Caching - Existing Timezone, New Station ---');
  console.log('NOTE: Register second device in same timezone but different location');

  try {
    // Use Chicago coordinates (should be -06:00 or -05:00 depending on DST)
    const deviceData = {
      deviceID: TEST_DEVICE_UNCLAIMED + '_chicago',
      name: 'Chicago Purifier',
      customLocation: 'Kitchen',
      geo: CHICAGO_COORDS,
    };

    console.log('Registering device with Chicago coords:');
    console.log(JSON.stringify(deviceData, null, 2));

    const registeredDeviceID = await registerDevice(TEST_USER_ID, deviceData);

    const userDevice = await db
      .collection('devices')
      .doc(registeredDeviceID)
      .get();

    const userData = userDevice.data();
    const deviceTimezone = userData.data.timezone;
    const deviceStationIdx = userData.data.stationIdx;

    console.log(`\n  Timezone: ${deviceTimezone}`);
    console.log(`  Station: ${deviceStationIdx}`);

    // Check station document
    const stationDoc = await db
      .collection('stations')
      .doc(deviceStationIdx.toString())
      .get();

    if (stationDoc.exists) {
      const stationData = stationDoc.data();
      console.log(`  ✓ Station ${deviceStationIdx} found in stations collection`);
      console.log(`    AQI: ${stationData.aqi}`);
      console.log(`    Timezone: ${stationData.timezone}`);
      console.log(`    City: ${stationData.cityName}`);
    } else {
      console.error(`  ✗ FAILED: Station ${deviceStationIdx} not found in stations collection`);
    }

    console.log('\n✓ SUCCESS: Second device registered successfully!');
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
    console.error(error.stack);
  }
}

async function testAlreadyClaimedDevice() {
  console.log('\n--- Test 7: Device Already Claimed ---');
  console.log(
    `NOTE: Requires ${TEST_DEVICE_CLAIMED} in masterDeviceList with claimedAt: <some date>`
  );

  try {
    const deviceData = {
      deviceID: TEST_DEVICE_CLAIMED,
      name: 'Another Purifier',
      geo: SEOUL_COORDS,
    };

    await registerDevice(TEST_USER_ID, deviceData);
    console.error(
      '✗ FAILED: Should have thrown error for already claimed device'
    );
  } catch (error) {
    if (error.message === 'This device has already been registered.') {
      console.log('✓ SUCCESS: Correctly rejected already claimed device');
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('DEVICE REGISTRATION TESTS (WITH AQI INTEGRATION)');
  console.log('='.repeat(60));
  console.log(`Test User ID: ${TEST_USER_ID}\n`);
  console.log('⚠️  SETUP REQUIRED:');
  console.log('  1. The following devices must exist in masterDeviceList:');
  console.log(`     • ${TEST_DEVICE_UNCLAIMED} with claimedAt: null`);
  console.log(`     • ${TEST_DEVICE_UNCLAIMED}_geo with claimedAt: null`);
  console.log(`     • ${TEST_DEVICE_UNCLAIMED}_null with claimedAt: null`);
  console.log(`     • ${TEST_DEVICE_UNCLAIMED}_chicago with claimedAt: null`);
  console.log(`     • ${TEST_DEVICE_CLAIMED} with claimedAt: <any date>`);
  console.log('  2. AQICN_TOKEN must be set in .env file');
  console.log('  3. Internet connection required for AQI API calls\n');

  try {
    await testMissingDeviceID();
    await testInvalidDeviceID();
    await testSuccessfulRegistrationWithValidGeo();
    await testRegistrationWithInvalidGeo();
    await testRegistrationWithNullGeo();
    await testStationCachingForExistingTimezone();
    await testAlreadyClaimedDevice();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETE');
    console.log('='.repeat(60));
    console.log('\nCheck the following collections in Firestore:');
    console.log('  • devices - should have test devices');
    console.log('  • masterDeviceList - devices should be marked as claimed');
    console.log('  • timezones - should have timezone entries with deviceIds');
    console.log('  • stations - should have station documents (stationIdx as doc ID)');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
  } finally {
    console.log('\n--- Test Complete ---');
    console.log('NOTE: Test devices were NOT deleted from collections');
    console.log('      You can manually verify the data in Firestore');
    console.log('      Remember to clean up test data when done!\n');
    process.exit(0);
  }
}

// Run the tests
runTests();
