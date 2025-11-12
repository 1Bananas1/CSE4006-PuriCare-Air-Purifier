/**
 * Device Service - Handles device registration to a user,
 * deletion (unregistering)
 * Renaming
 */

const { db } = require('../config/firebase');

async function registerDevice(secureUserId, deviceData) {
  const { customLocation, deviceID, geo, measurements, name, timezone } =
    deviceData;

  if (!deviceID) {
    throw new Error('Missing required field: deviceID');
  }

  const customDocID = deviceID.toString();
  const masterDeviceRef = db.collection('masterDeviceList').doc(customDocID);
  const userDeviceRef = db.collection('devices').doc(customDocID);

  try {
    const newDeviceID = await db.runTransaction(async (t) => {
      const masterDoc = await t.get(masterDeviceRef);

      if (!masterDoc.exists) {
        throw new Error(
          'Invalid device ID. The device does not exist in our system.'
        );
      }
      if (masterDoc.data().claimedAt != null) {
        throw new Error('This device has already been registered.');
      }

      const newDevicePayload = {
        data: {
          version: '1.0.0',
          customLocation: customLocation || 'Bedroom',
          deviceID: deviceID,
          geo: geo || [null, null],
          measurements: {},
          name: name || masterDoc.data().model || 'New Device',
          timezone: timezone || 'UTC',
        },
        linkedUserID: secureUserId,
        settings: {
          autoMode: false,
          fanSpeed: 0,
          sensitivity: 0,
        },
        status: {
          lastSeen: new Date(),
          online: false,
        },
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
    console.error('transaction failed:', error.message);
    throw error;
  }
}

async function renameDevice(secureUserId, deviceID, newName) {
  const device = await db.collection('devices').doc(deviceID).get();
  if (!device.exists || device.data().linkedUserID !== secureUserId) {
    throw new Error('Not Authorized');
  }
  await db.collection('devices').doc(deviceID).update({
    'data.name': newName,
  });
}

async function deleteDevice(secureUserId, deviceID) {
  const userDeviceRef = db.collection('devices').doc(deviceID);
  const masterDeviceRef = db.collection('masterDeviceList').doc(deviceID);

  try {
    await db.runTransaction(async (t) => {
      const device = await t.get(userDeviceRef);
      if (!device.exists || device.data().linkedUserID !== secureUserId) {
        throw new Error('Not Authorized');
      }

      const masterDevice = await t.get(masterDeviceRef);
      if (!masterDevice.exists || masterDevice.data().claimedAt === null) {
        throw new Error('Not authorized');
      }

      t.update(masterDeviceRef, {
        claimedAt: null,
      });
    });
  } catch (error) {
    console.error('transaction failed:', error.message);
    throw error;
  }
}

module.exports = {
  registerDevice,
  renameDevice,
  deleteDevice,
};
