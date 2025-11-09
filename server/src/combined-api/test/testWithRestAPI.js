require("dotenv").config();
const axios = require("axios");
const { db } = require("../config/firebase");

/**
 * Test device registration using Firebase REST API to get a real ID token
 * This works around the service account permission issue
 *
 * Prerequisites:
 * 1. You need your Firebase Web API Key
 * 2. You need to enable Email/Password auth in Firebase Console
 * 3. You need to create a test user in Firebase Console
 *
 * Usage: node test/testWithRestAPI.js <email> <password> [device-id]
 */

async function testWithRestAPI() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];
    const deviceId = process.argv[4] || "TEST-DEVICE-001";

    console.log("\n" + "=".repeat(60));
    console.log("DEVICE REGISTRATION TEST (Firebase REST API)");
    console.log("=".repeat(60) + "\n");

    // Check if credentials provided
    if (!email || !password) {
      console.log("❌ Missing credentials!\n");
      console.log("Usage: node test/testWithRestAPI.js <email> <password> [device-id]\n");
      console.log("Example:");
      console.log("  node test/testWithRestAPI.js test@example.com MyPassword123 TEST-DEVICE-001\n");
      console.log("Setup steps:");
      console.log("1. Go to Firebase Console → Authentication");
      console.log("2. Enable Email/Password sign-in method");
      console.log("3. Add a test user manually");
      console.log("4. Get your Web API Key from Project Settings\n");
      console.log("Then run this script with those credentials.\n");
      return;
    }

    // You need to add your Firebase Web API Key to .env
    const API_KEY = process.env.FIREBASE_WEB_API_KEY;

    if (!API_KEY) {
      console.log("❌ Missing FIREBASE_WEB_API_KEY in .env file!\n");
      console.log("To fix:");
      console.log("1. Go to Firebase Console → Project Settings → General");
      console.log("2. Scroll to 'Your apps' → Web API Key");
      console.log("3. Add to .env file:");
      console.log("   FIREBASE_WEB_API_KEY=your-api-key-here\n");
      return;
    }

    console.log("📧 Email:", email);
    console.log("🔑 Device ID:", deviceId);
    console.log("\n1️⃣  Getting ID token from Firebase Auth REST API...\n");

    // Sign in with Firebase REST API to get ID token
    const authResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        email: email,
        password: password,
        returnSecureToken: true,
      }
    );

    const idToken = authResponse.data.idToken;
    const userId = authResponse.data.localId;

    console.log("✅ Successfully authenticated!");
    console.log("   User ID:", userId);
    console.log("   Token expires in:", authResponse.data.expiresIn, "seconds\n");

    // Now test the device registration
    console.log("2️⃣  Testing device registration endpoint...\n");

    const PORT = process.env.PORT || 3020;
    const API_URL = process.env.API_URL || `http://localhost:${PORT}`;
    console.log("   API URL:", API_URL);

    const deviceData = {
      deviceID: deviceId,
      name: "Test Air Purifier",
      geo: [38.6270, -90.1994], // Saint Louis University
      timezone: "America/Chicago",
    };

    console.log("Request payload:");
    console.log(JSON.stringify(deviceData, null, 2));
    console.log("");

    try {
      const response = await axios.post(
        `${API_URL}/api/devices/register`,
        deviceData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      console.log("✅ SUCCESS! Device registered!\n");
      console.log("Response:");
      console.log(JSON.stringify(response.data, null, 2));
      console.log("\n" + "=".repeat(60));
      console.log("✅ TEST PASSED");
      console.log("=".repeat(60));
      console.log("\nVerifying in Firebase...\n");

      // Verify the device was created in Firestore
      const deviceDoc = await db.collection("devices").doc(deviceId).get();
      const masterDoc = await db.collection("masterDeviceList").doc(deviceId).get();

      if (deviceDoc.exists) {
        console.log("✅ Device document created in 'devices' collection");
        console.log("   Linked to user:", deviceDoc.data().linkedUserID);
      }

      if (masterDoc.exists) {
        const data = masterDoc.data();
        console.log("✅ Master device list updated");
        console.log("   Claimed at:", data.claimedAt?.toDate());
        console.log("   Linked user:", data.linkedUserID);
      }

      console.log("");

    } catch (error) {
      if (error.response) {
        console.log("❌ Registration failed\n");
        console.log("Status:", error.response.status);
        console.log("Error:", JSON.stringify(error.response.data, null, 2));

        if (error.response.status === 400) {
          console.log("\n💡 Tip: Run 'npm run test:setup' to create test devices");
        } else if (error.response.status === 409) {
          console.log("\n💡 Tip: Device already claimed. Try a different device ID");
          console.log("   or run 'npm run test:setup' to reset test devices");
        } else if (error.response.status === 500) {
          console.log("\n💡 Server error! Check your server logs for details.");
          console.log("   The error is being logged in the terminal where 'npm run dev' is running.");
          console.log("\n🔍 Common causes:");
          console.log("   • Database connection issue");
          console.log("   • Missing fields in device data");
          console.log("   • Firebase Firestore permissions");
        }
      } else {
        console.log("❌ Request failed:", error.message);
        console.log("\n🔍 Make sure your server is running: npm run dev");
      }
      console.log("\n" + "=".repeat(60));
      console.log("❌ TEST FAILED");
      console.log("=".repeat(60) + "\n");
      process.exit(1);
    }

  } catch (error) {
    if (error.response?.status === 400) {
      console.log("\n❌ Authentication failed!");
      console.log("Error:", error.response.data.error.message);
      console.log("\nPossible issues:");
      console.log("  • Email/password incorrect");
      console.log("  • User doesn't exist in Firebase Auth");
      console.log("  • Email/Password auth not enabled in Firebase Console\n");
    } else {
      console.error("\n❌ Test error:", error.message);
    }
    process.exit(1);
  }
}

testWithRestAPI();
