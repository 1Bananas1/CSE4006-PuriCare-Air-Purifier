require("dotenv").config();
const { db } = require("../config/firebase");

/**
 * Set up test device data in Firebase
 * Creates test devices in the masterDeviceList collection
 * Usage: node test/setupTestData.js
 */
async function setupTestData() {
  try {
    console.log("\n🔧 Setting up test data in Firebase...\n");

    // Test devices to create
    const testDevices = [
      {
        id: "TEST-DEVICE-001",
        model: "PuriCare X1",
        manufacturer: "TestCorp",
        claimedAt: null,
        linkedUserID: null,
      },
      {
        id: "TEST-DEVICE-002",
        model: "PuriCare X2 Pro",
        manufacturer: "TestCorp",
        claimedAt: null,
        linkedUserID: null,
      },
      {
        id: "TEST-DEVICE-003",
        model: "PuriCare Mini",
        manufacturer: "TestCorp",
        claimedAt: null,
        linkedUserID: null,
      },
    ];

    console.log(`Creating ${testDevices.length} test devices...\n`);

    for (const device of testDevices) {
      const deviceRef = db.collection("masterDeviceList").doc(device.id);
      const existingDoc = await deviceRef.get();

      if (existingDoc.exists) {
        console.log(`⚠️  Device ${device.id} already exists`);
        const data = existingDoc.data();
        if (data.claimedAt) {
          console.log(`   → Currently claimed by: ${data.linkedUserID}`);
          console.log(`   → Claimed at: ${data.claimedAt.toDate()}`);

          // Ask if we should reset it (in a real script, you might want user input)
          console.log(`   → Resetting to unclaimed state...`);
          await deviceRef.update({
            claimedAt: null,
            linkedUserID: null,
          });
          console.log(`   ✅ Reset successfully`);
        } else {
          console.log(`   ✅ Already unclaimed and ready for testing`);
        }
      } else {
        await deviceRef.set({
          model: device.model,
          manufacturer: device.manufacturer,
          claimedAt: device.claimedAt,
          linkedUserID: device.linkedUserID,
          createdAt: new Date(),
        });
        console.log(`✅ Created device: ${device.id} (${device.model})`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ TEST DATA SETUP COMPLETE");
    console.log("=".repeat(60));
    console.log("\nAvailable test devices:");
    testDevices.forEach((device) => {
      console.log(`  • ${device.id} - ${device.model}`);
    });
    console.log("\n📝 Next steps:");
    console.log("  1. Run: node test/testDeviceRegistration.js [user-id] TEST-DEVICE-001");
    console.log("  2. Or use: node test/createTestUser.js to create a test user first\n");
  } catch (error) {
    console.error("\n❌ Error setting up test data:", error);
    process.exit(1);
  }
}

setupTestData();
