require('dotenv').config();
const { db } = require('../../config/firebase');
const { registerDevice } = require('../../services/deviceService');

// Test configuration
const TEST_USER_ID = 'test-user-register';
const TEST_DEVICE_UNCLAIMED = '34566543'; // Device not yet claimed
const TEST_DEVICE_CLAIMED = '23456789'; // Device already claimed
const TEST_DEVICE_INVALID = 'invalid-device-id'; // Device not in system

async function testMissingDeviceID() {
  console.log('\n--- Test 1: Missing deviceID ---');
  try {
    await registerDevice(TEST_USER_ID, {
      name: 'Test Device',
      geo: [38.627, -90.1994],
      timezone: 'America/Chicago',
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
      geo: [38.627, -90.1994],
      timezone: 'America/Chicago',
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

async function testSuccessfulRegistration() {
  console.log('\n--- Test 3: Successful Registration ---');
  console.log(
    `NOTE: Requires ${TEST_DEVICE_UNCLAIMED} in masterDeviceList with claimedAt: null`
  );
  try {
    const deviceData = {
      deviceID: TEST_DEVICE_UNCLAIMED,
      name: 'My Air Purifier',
      customLocation: 'Living Room',
      geo: [38.627, -90.1994],
      timezone: 'America/Chicago',
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
    const checks = [
      {
        name: 'linkedUserID matches',
        check: userData.linkedUserID === TEST_USER_ID,
      },
      {
        name: 'device name is correct',
        check: userData.data.name === 'My Air Purifier',
      },
      {
        name: 'customLocation is set',
        check: userData.data.customLocation === 'Living Room',
      },
      {
        name: 'timezone is set',
        check: userData.data.timezone === 'America/Chicago',
      },
      {
        name: 'geo is set correctly',
        check:
          JSON.stringify(userData.data.geo) ===
          JSON.stringify([38.627, -90.1994]),
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

    if (allPassed) {
      console.log(
        '\n✓ SUCCESS: Device registered successfully with all validations!'
      );
    } else {
      console.error('\n✗ FAILED: Some validations failed');
    }
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
  }
}

async function testAlreadyClaimedDevice() {
  console.log('\n--- Test 4: Device Already Claimed ---');
  console.log(
    `NOTE: Requires ${TEST_DEVICE_CLAIMED} in masterDeviceList with claimedAt: <some date>`
  );
  try {
    const deviceData = {
      deviceID: TEST_DEVICE_CLAIMED,
      name: 'Another Purifier',
      geo: [38.627, -90.1994],
      timezone: 'America/Chicago',
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
  console.log('DEVICE REGISTRATION TESTS');
  console.log('='.repeat(60));
  console.log(`Test User ID: ${TEST_USER_ID}\n`);
  console.log(
    '⚠️  SETUP REQUIRED: The following devices must exist in masterDeviceList:'
  );
  console.log(`  • ${TEST_DEVICE_UNCLAIMED} with claimedAt: null`);
  console.log(
    `  • ${TEST_DEVICE_CLAIMED} with claimedAt: <any non-null date>\n`
  );

  try {
    await testMissingDeviceID();
    await testInvalidDeviceID();
    await testSuccessfulRegistration();
    await testAlreadyClaimedDevice();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETE');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error);
  } finally {
    console.log('\n--- Test Complete ---');
    console.log('NOTE: Test devices were NOT deleted from devices collection');
    console.log('      You can manually verify the fields in Firestore');
    console.log('      Remember to clean up when done!\n');
    process.exit(0);
  }
}

// Run the tests
runTests();
