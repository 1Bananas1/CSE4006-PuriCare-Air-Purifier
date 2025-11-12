require('dotenv').config();
const { db } = require('../../config/firebase');
const { deleteDevice } = require('../../services/deviceService');

// Test configuration
const TEST_USER_ID = 'test-user-123';
const TEST_DEVICE_REGISTERED = '23456789'; // Device with valid claimedAt
const TEST_DEVICE_UNCLAIMED = '1234567890'; // Device with claimedAt: null

async function setupTestDevice(deviceId) {
  console.log(`Setting up test device ${deviceId}...`);

  // Create a test device in the devices collection
  await db
    .collection('devices')
    .doc(deviceId)
    .set({
      data: {
        deviceID: deviceId,
        geo: [38.627, -90.1994], // Saint Louis coordinates
        measurements: {},
        name: 'Test Device for Unregister',
        timezone: 'America/Chicago',
      },
      linkedUserID: TEST_USER_ID,
      settings: {
        autoMode: false,
        fanSpeed: 0,
        sensitivity: 0,
      },
      status: {
        lastSeen: new Date(),
        online: false,
      },
    });

  console.log(`✓ Test device ${deviceId} created in devices collection`);
}

async function cleanupTestDevice(deviceId) {
  console.log(`Cleaning up test device ${deviceId}...`);
  try {
    await db.collection('devices').doc(deviceId).delete();
    console.log(`✓ Test device ${deviceId} deleted from devices collection`);
  } catch (error) {
    console.log(
      `Note: Device ${deviceId} may not exist (expected for some tests)`
    );
  }
}

async function checkMasterDeviceStatus(deviceId) {
  const masterDoc = await db.collection('masterDeviceList').doc(deviceId).get();
  if (!masterDoc.exists) {
    console.log(`⚠️  Device ${deviceId} not found in masterDeviceList`);
    return null;
  }
  return masterDoc.data();
}

async function testUnregisterSuccess() {
  console.log('\n--- Test 1: Successful Device Unregistration ---');
  console.log(`Device ID: ${TEST_DEVICE_REGISTERED}`);

  try {
    // Setup: Create device in devices collection
    await setupTestDevice(TEST_DEVICE_REGISTERED);

    // Check initial state in masterDeviceList
    console.log('\nBefore unregistration:');
    const beforeData = await checkMasterDeviceStatus(TEST_DEVICE_REGISTERED);
    if (beforeData) {
      console.log('  claimedAt:', beforeData.claimedAt);
      console.log('  linkedUserID:', beforeData.linkedUserID || 'none');
    }

    // Attempt to unregister
    await deleteDevice(TEST_USER_ID, TEST_DEVICE_REGISTERED);

    // Verify the device was unregistered in masterDeviceList
    const afterData = await checkMasterDeviceStatus(TEST_DEVICE_REGISTERED);
    if (afterData && afterData.claimedAt === null) {
      console.log('\nAfter unregistration:');
      console.log('  claimedAt:', afterData.claimedAt);
      console.log('\n✓ SUCCESS: Device unregistered successfully!');
    } else {
      console.error('\n✗ FAILED: claimedAt was not set to null');
      console.error('  Current claimedAt:', afterData?.claimedAt);
    }

    // Note: The device should still exist in devices collection
    // (deleteDevice only updates masterDeviceList, doesn't delete from devices)
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
  }
}

async function testUnregisterAlreadyUnclaimed() {
  console.log(
    '\n--- Test 2: Attempt to Unregister Already Unclaimed Device ---'
  );
  console.log(`Device ID: ${TEST_DEVICE_UNCLAIMED}`);

  try {
    // Setup: Create device in devices collection (mimicking a device that shouldn't exist)
    await setupTestDevice(TEST_DEVICE_UNCLAIMED);

    // Check state in masterDeviceList
    console.log('\nMaster device status:');
    const masterData = await checkMasterDeviceStatus(TEST_DEVICE_UNCLAIMED);
    if (masterData) {
      console.log('  claimedAt:', masterData.claimedAt);
      console.log('  linkedUserID:', masterData.linkedUserID || 'none');
    }

    // Attempt to unregister - should fail because claimedAt is null
    await deleteDevice(TEST_USER_ID, TEST_DEVICE_UNCLAIMED);
    console.error('\n✗ FAILED: Should have thrown "Not authorized" error');
  } catch (error) {
    if (error.message === 'Not authorized') {
      console.log('\n✓ SUCCESS: Correctly rejected unregistration attempt');
      console.log('  Error message:', error.message);
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function testUnregisterUnauthorized() {
  console.log('\n--- Test 3: Unauthorized User Attempting Unregistration ---');
  console.log(`Device ID: ${TEST_DEVICE_REGISTERED}`);

  try {
    // Setup: Ensure device exists
    await setupTestDevice(TEST_DEVICE_REGISTERED);

    // Try to unregister with wrong user ID
    await deleteDevice('wrong-user-id', TEST_DEVICE_REGISTERED);
    console.error('\n✗ FAILED: Should have thrown authorization error');
  } catch (error) {
    if (error.message === 'Not Authorized') {
      console.log('\n✓ SUCCESS: Authorization check works');
      console.log('  Error message:', error.message);
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function testUnregisterNonexistentDevice() {
  console.log('\n--- Test 4: Nonexistent Device ---');

  const FAKE_DEVICE = 'fake-device-99999';
  console.log(`Device ID: ${FAKE_DEVICE}`);

  try {
    // Try to unregister device that doesn't exist
    await deleteDevice(TEST_USER_ID, FAKE_DEVICE);
    console.error(
      '\n✗ FAILED: Should have thrown error for nonexistent device'
    );
  } catch (error) {
    if (error.message === 'Not Authorized') {
      console.log('\n✓ SUCCESS: Nonexistent device rejected');
      console.log('  Error message:', error.message);
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('DEVICE UNREGISTRATION TESTS');
  console.log('='.repeat(60));
  console.log(`\nTest User ID: ${TEST_USER_ID}`);
  console.log(`Registered Device: ${TEST_DEVICE_REGISTERED}`);
  console.log(`Unclaimed Device: ${TEST_DEVICE_UNCLAIMED}`);

  try {
    // Run tests
    await testUnregisterSuccess();
    await testUnregisterAlreadyUnclaimed();
    await testUnregisterUnauthorized();
    await testUnregisterNonexistentDevice();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETE');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error);
  } finally {
    // Cleanup
    console.log('\n--- Cleanup ---');
    await cleanupTestDevice(TEST_DEVICE_REGISTERED);
    await cleanupTestDevice(TEST_DEVICE_UNCLAIMED);
    console.log('Cleanup complete\n');
    process.exit(0);
  }
}

// Run the tests
runTests();
