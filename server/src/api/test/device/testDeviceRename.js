require('dotenv').config();
const { db } = require('../../config/firebase');
const { renameDevice } = require('../../services/deviceService');

// Test configuration
const TEST_USER_ID = 'test-user-123';
const TEST_DEVICE_ID = 'test-device-rename-001';
const NEW_NAME = 'My Awesome Air Purifier';

async function setupTestDevice() {
  console.log('Setting up test device...');

  // Create a test device
  await db
    .collection('devices')
    .doc(TEST_DEVICE_ID)
    .set({
      data: {
        deviceID: TEST_DEVICE_ID,
        geo: [31.2047372, 121.4489017],
        measurements: {
          temp: 23,
          RH: 45,
        },
        name: 'Original Name',
        timezone: 'Asia/Shanghai',
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

  console.log('Test device created with ID:', TEST_DEVICE_ID);
}

async function cleanupTestDevice() {
  console.log('Cleaning up test device...');
  await db.collection('devices').doc(TEST_DEVICE_ID).delete();
  console.log('Test device deleted');
}

async function testRenameSuccess() {
  console.log('\n--- Test 1: Successful Rename ---');

  try {
    // Rename the device
    await renameDevice(TEST_USER_ID, TEST_DEVICE_ID, NEW_NAME);

    // Verify the name was updated
    const deviceDoc = await db.collection('devices').doc(TEST_DEVICE_ID).get();
    const deviceData = deviceDoc.data();

    if (deviceData.data.name === NEW_NAME) {
      console.log('✓ SUCCESS: Device renamed to:', deviceData.data.name);
    } else {
      console.error(
        '✗ FAILED: Expected name to be',
        NEW_NAME,
        'but got',
        deviceData.data.name
      );
    }
  } catch (error) {
    console.error('✗ FAILED: Unexpected error:', error.message);
  }
}

async function testRenameUnauthorized() {
  console.log('\n--- Test 2: Unauthorized User ---');

  try {
    // Try to rename with wrong user ID
    await renameDevice('wrong-user-id', TEST_DEVICE_ID, 'Hacked Name');
    console.error('✗ FAILED: Should have thrown authorization error');
  } catch (error) {
    if (error.message === 'Not Authorized') {
      console.log(
        '✓ SUCCESS: Authorization check works, error:',
        error.message
      );
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function testRenameNonexistentDevice() {
  console.log('\n--- Test 3: Nonexistent Device ---');

  try {
    // Try to rename device that doesn't exist
    await renameDevice(TEST_USER_ID, 'fake-device-id', 'New Name');
    console.error('✗ FAILED: Should have thrown error for nonexistent device');
  } catch (error) {
    if (error.message === 'Not Authorized') {
      console.log(
        '✓ SUCCESS: Nonexistent device rejected, error:',
        error.message
      );
    } else {
      console.error('✗ FAILED: Wrong error message:', error.message);
    }
  }
}

async function runTests() {
  console.log('=== Device Rename Tests ===\n');

  try {
    // Setup
    await setupTestDevice();

    // Run tests
    await testRenameSuccess();
    await testRenameUnauthorized();
    await testRenameNonexistentDevice();

    console.log('\n=== All Tests Complete ===');
  } catch (error) {
    console.error('Test suite failed:', error);
  } finally {
    // Cleanup
    await cleanupTestDevice();
    process.exit(0);
  }
}

// Run the tests
runTests();
