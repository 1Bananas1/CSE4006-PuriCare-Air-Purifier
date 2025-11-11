require('dotenv').config();
const axios = require('axios');
const { auth } = require('../../config/firebase');

/**
 * Test the device registration endpoint
 * Usage: node test/testDeviceRegistration.js [user-id] [device-id]
 */
async function testDeviceRegistration() {
  try {
    // Get user ID from command line or use default
    const userId = process.argv[2] || 'test-user-123';
    const deviceId = process.argv[3] || 'TEST-DEVICE-001';

    console.log('\n🔧 Setting up test...\n');
    console.log('User ID:', userId);
    console.log('Device ID:', deviceId);

    // Step 1: Generate a custom token for the user
    console.log('\n1️⃣  Generating custom token...');
    const customToken = await auth.createCustomToken(userId);
    console.log('✅ Custom token generated');

    // Step 2: For testing, we'll use the custom token as if it were an ID token
    // In production, the client would exchange the custom token for an ID token
    // For server-side testing, we can create a test ID token
    console.log('\n2️⃣  Creating test ID token...');

    // Create a test user if they don't exist
    let user;
    try {
      user = await auth.getUser(userId);
      console.log('✅ User exists:', user.email || user.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('ℹ️  User not found, creating test user...');
        user = await auth.createUser({
          uid: userId,
          email: `${userId}@test.com`,
          emailVerified: true,
        });
        console.log('✅ Test user created');
      } else {
        throw error;
      }
    }

    // Generate a custom token (in real app, client would exchange for ID token)
    const testToken = await auth.createCustomToken(userId);

    // Step 3: Test the registration endpoint
    console.log('\n3️⃣  Testing device registration endpoint...');
    const API_URL = process.env.API_URL || 'http://localhost:3020';

    const deviceData = {
      deviceID: deviceId,
      name: 'Test Air Purifier',
      geo: [38.627, -90.1994], // Saint Louis University coordinates
      timezone: 'America/Chicago',
    };

    console.log('\nRequest payload:');
    console.log(JSON.stringify(deviceData, null, 2));

    try {
      const response = await axios.post(
        `${API_URL}/api/devices/register`,
        deviceData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      console.log('\n✅ SUCCESS! Device registered successfully!\n');
      console.log('Response status:', response.status);
      console.log('Response data:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n' + '='.repeat(60));
      console.log('✅ TEST PASSED');
      console.log('='.repeat(60) + '\n');
    } catch (error) {
      if (error.response) {
        console.log('\n❌ Registration failed\n');
        console.log('Status:', error.response.status);
        console.log('Error:');
        console.log(JSON.stringify(error.response.data, null, 2));

        // Provide helpful debugging info
        console.log('\n🔍 Debugging tips:');
        if (error.response.status === 401) {
          console.log('  → Authentication failed. The token might be invalid.');
          console.log(
            '  → Make sure your server is reading the Authorization header correctly.'
          );
        } else if (error.response.status === 400) {
          console.log(
            '  → The device ID might not exist in masterDeviceList collection.'
          );
          console.log(
            '  → Run: node test/setupTestData.js to create test device data.'
          );
        } else if (error.response.status === 409) {
          console.log(
            '  → This device has already been claimed by another user.'
          );
          console.log(
            '  → Try using a different device ID or reset the test data.'
          );
        }
      } else {
        console.log('\n❌ Request failed:', error.message);
        console.log('\n🔍 Make sure your server is running:');
        console.log('  → npm run dev');
      }
      console.log('\n' + '='.repeat(60));
      console.log('❌ TEST FAILED');
      console.log('='.repeat(60) + '\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
console.log('\n' + '='.repeat(60));
console.log('DEVICE REGISTRATION TEST');
console.log('='.repeat(60));

testDeviceRegistration();
