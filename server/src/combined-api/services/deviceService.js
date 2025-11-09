const { db } = require("../config/firebase");

async function registerDevice(secureUserId, deviceData) {
  const { deviceID, geo, measurements, name, timezone } = deviceData;

  if (!deviceID) {
    throw new Error("Missing required field: deviceID");
  }

  const customDocID = deviceID.toString();
  const masterDeviceRef = db.collection("masterDeviceList").doc(customDocID);
  const userDeviceRef = db.collection("devices").doc(customDocID);

  try {
    const newDeviceID = await db.runTransaction(async (t) => {
      const masterDoc = await t.get(masterDeviceRef);

      if (!masterDoc.exists) {
        throw new Error(
          "Invalid device ID. The device does not exist in our system."
        );
      }
      if (masterDoc.data().claimedAt != null) {
        throw new Error("This device has already been registered.");
      }

      const newDevicePayload = {
        data: {
          deviceID: deviceID,
          geo: geo || [null, null],
          measurements: {},
          name: name || masterDoc.data().model || "New Device",
          timezone: timezone || "UTC",
        },
        linkedUserID: secureUserId,
      };
      t.set(userDeviceRef, newDevicePayload);
      t.update(masterDeviceRef, {
        claimedAt: new Date(),
        linkedUserID: secureUserId,
      });
      return customDocID;
    });
    return newDeviceID;
  } catch (error) {
    console.error("transaction failed:", error.message);
    throw error;
  }
}

module.exports = {
  registerDevice,
};
