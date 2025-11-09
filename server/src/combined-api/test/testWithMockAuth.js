require("dotenv").config();
const axios = require("axios");

/**
 * Test device registration by bypassing auth temporarily
 * This script demonstrates what the request should look like
 *
 * IMPORTANT: To actually test, you need to either:
 * 1. Get a real ID token from your frontend app after user login
 * 2. Temporarily disable auth middleware for testing
 * 3. Use Firebase Auth REST API to get an ID token
 *
 * Usage: node test/testWithMockAuth.js [device-id]
 */
async function testWithoutAuth() {
  try {
    const deviceId = process.argv[2] || "TEST-DEVICE-001";
    const API_URL = process.env.API_URL || "http://localhost:3020";

    console.log("\n" + "=".repeat(60));
    console.log("DEVICE REGISTRATION TEST (Mock Auth)");
    console.log("=".repeat(60));
    console.log("\n⚠️  WARNING: This test won't work with auth enabled!\n");
    console.log("To make this work, you need ONE of these options:\n");
    console.log("1. Get a real Firebase ID token from your app");
    console.log("2. Temporarily comment out auth in deviceRoutes.js");
    console.log("3. Use the Firebase Auth REST API (see below)");
    console.log("\n" + "=".repeat(60) + "\n");

    const deviceData = {
      deviceID: deviceId,
      name: "Test Air Purifier",
      geo: [38.6270, -90.1994],
      timezone: "America/Chicago",
    };

    console.log("Request payload:");
    console.log(JSON.stringify(deviceData, null, 2));
    console.log("\nAttempting request without auth token...\n");

    try {
      const response = await axios.post(
        `${API_URL}/api/devices/register`,
        deviceData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ SUCCESS (auth must be disabled)!\n");
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) {
          console.log("❌ Got 401 Unauthorized (expected with auth enabled)\n");
          console.log("To test properly, see instructions below.\n");
        } else {
          console.log("Response:", error.response.status);
          console.log(JSON.stringify(error.response.data, null, 2));
        }
      } else {
        console.log("❌ Request failed:", error.message);
        console.log("\n🔍 Make sure your server is running: npm run dev\n");
      }
    }

    console.log("=".repeat(60));
    console.log("HOW TO GET A REAL ID TOKEN FOR TESTING");
    console.log("=".repeat(60));
    console.log("\nOption 1: From your mobile app/frontend");
    console.log("  After signing in with Firebase Auth, call:");
    console.log("  → firebase.auth().currentUser.getIdToken()");
    console.log("  Then use that token in the Authorization header\n");

    console.log("Option 2: Use Firebase Auth REST API");
    console.log("  See: testWithRestAPI.js for an automated approach\n");

    console.log("Option 3: Temporarily disable auth (NOT recommended)");
    console.log("  In deviceRoutes.js, comment out authenticateFirebaseToken:");
    console.log("  → router.post('/register', async (req, res) => {");
    console.log("     const userId = 'test-user-123'; // hardcode for testing");
    console.log("\n");

  } catch (error) {
    console.error("Test error:", error.message);
  }
}

testWithoutAuth();
