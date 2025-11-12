require('dotenv').config();
const { auth } = require('../../config/firebase');

/**
 * Generate a custom Firebase auth token for testing
 * Usage: node test/generateTestToken.js [optional-user-id]
 */
async function generateTestToken() {
  try {
    // Use a test user ID (you can pass one as argument or use default)
    const testUserId = process.argv[2] || 'test-user-123';

    // Create a custom token
    const customToken = await auth.createCustomToken(testUserId);

    console.log('\n✅ Test token generated successfully!\n');
    console.log('User ID:', testUserId);
    console.log('\nCustom Token (use this for testing):');
    console.log(customToken);
    console.log(
      '\n📝 IMPORTANT: This is a custom token. To use it with the API:'
    );
    console.log('1. You need to exchange it for an ID token first');
    console.log(
      '2. Or, use the createTestUser.js script to create a real user and get an ID token\n'
    );

    return customToken;
  } catch (error) {
    console.error('❌ Error generating token:', error);
    process.exit(1);
  }
}

generateTestToken();
