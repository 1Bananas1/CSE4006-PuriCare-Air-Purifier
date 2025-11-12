require('dotenv').config();
const { auth } = require('../../config/firebase');

/**
 * Create a test user in Firebase Auth and generate a custom token
 * Usage: node test/createTestUser.js [optional-email]
 */
async function createTestUser() {
  try {
    const email = process.argv[2] || `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    console.log('\n🔧 Creating test user...\n');

    let user;
    try {
      // Try to create a new user
      user = await auth.createUser({
        email: email,
        password: password,
        emailVerified: true,
        displayName: 'Test User',
      });
      console.log('✅ New user created successfully!');
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('ℹ️  User already exists, fetching existing user...');
        user = await auth.getUserByEmail(email);
      } else {
        throw error;
      }
    }

    // Generate a custom token for this user
    const customToken = await auth.createCustomToken(user.uid);

    console.log('\n' + '='.repeat(60));
    console.log('TEST USER CREDENTIALS');
    console.log('='.repeat(60));
    console.log('\nUser ID:', user.uid);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nCustom Token (for server-to-server testing):');
    console.log(customToken);
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 TESTING OPTIONS:\n');
    console.log('Option 1: Use testDeviceRegistration.js script');
    console.log('  → node test/testDeviceRegistration.js ' + user.uid);
    console.log('\nOption 2: Get an ID token to use with curl/Postman');
    console.log("  → You'll need to sign in via Firebase Client SDK");
    console.log(
      '  → Or use the custom token above with the testDeviceRegistration.js script'
    );
    console.log('\n');

    return { user, customToken };
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();
