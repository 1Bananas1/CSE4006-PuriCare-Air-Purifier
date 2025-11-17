/**
 * Device Service - Handles device registration to a user,
 * deletion (unregistering)
 * Renaming
 */

const { db } = require('../config/firebase');
const TimezoneService = require('./timezoneService');
const aqiScripts = require('../scripts/aqiScripts');

function getAqiLabel(pm25) {
  if (pm25 <= 15) return '좋음'; // Good
  if (pm25 <= 35) return '보통'; // Moderate
  if (pm25 <= 75) return '나쁨'; // Unhealthy
  return '매우 나쁨'; // Very Unhealthy
}

async function registerDevice(secureUserId, deviceData) {
  const { customLocation, deviceID, geo, measurements, name } = deviceData;
  // Validation Phase
  if (!deviceID) {
    throw new Error('Missing required field: deviceID');
  }
  const [lat, long] = deviceData.geo || [null, null];
  if (
    lat === null ||
    long === null ||
    lat < -90 ||
    lat > 90 ||
    long < -180 ||
    long > 180
  ) {
    deviceData.geo = [null, null];
  }

  // Fetch Phase
  let aqiData = null;
  let stationIdx = null;
  if (deviceData.geo[0] !== null && deviceData.geo[1] !== null) {
    try {
      // Make API call to get nearest station data
      aqiData = await firstRegistrationCall(deviceData.geo);

      // Extract timezone and station ID from response
      deviceData.timezone = aqiData.data.time.tz; // e.g., "+09:00"
      stationIdx = aqiData.data.idx; // e.g., 1682
    } catch (error) {
      console.error('AQI fetch failed during registration:', error);
      // Continue with registration even if AQI call fails
      deviceData.timezone = null;
    }
  } else {
    deviceData.timezone = null;
  }
  // Registering the device
  const customDocID = deviceID.toString();
  const masterDeviceRef = db.collection('masterDeviceList').doc(customDocID);
  const userDeviceRef = db.collection('devices').doc(customDocID);

  try {
    const newDeviceID = await db.runTransaction(async (t) => {
      const masterDoc = await t.get(masterDeviceRef);
      // Validate if it is an actual serial code
      if (!masterDoc.exists) {
        throw new Error(
          'Invalid device ID. The device does not exist in our system.'
        );
      }
      // Validate if already claimed
      if (masterDoc.data().claimedAt != null) {
        throw new Error('This device has already been registered.');
      }
      // Device payload
      const newDevicePayload = {
        data: {
          version: '1.0.0',
          customLocation: customLocation || 'Bedroom',
          deviceID: deviceID,
          geo: geo || [null, null],
          measurements: {},
          name: name || masterDoc.data().model || 'New Device',
          timezone: deviceData.timezone || 'UTC',
          stationIdx: stationIdx || null,
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
      // update master device list
      t.set(userDeviceRef, newDevicePayload);
      t.update(masterDeviceRef, {
        claimedAt: new Date(),
        linkedUserID: secureUserId,
      });
      return customDocID;
    });
    if (aqiData && deviceData.timezone) {
      cacheStationData(aqiData).catch((err) => {
        console.error('Failed to cache station data: ', err);
      });
    }
    const timezoneService = new TimezoneService();
    const deviceTimezone = deviceData.timezone || 'UTC';
    await timezoneService.addDeviceToTimezone(
      newDeviceID,
      customLocation || 'Unknown',
      deviceTimezone
    );
    console.log(`✅ Device ${newDeviceID} added to timezone ${deviceTimezone}`);
    return newDeviceID;
  } catch (error) {
    console.error('transaction failed:', error.message);
    throw error;
  }
}

async function firstRegistrationCall(geo) {
  const [lat, long] = geo;
  const apiToken = process.env.AQICN_TOKEN;
  const response = await fetch(
    `https://api.waqi.info/feed/geo:${lat};${long}/?token=${apiToken}`
  );
  if (!response.ok) {
    throw new Error(`AQI API request failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== 'ok') {
    throw new Error(`AQI API returned error: ${data.data}`);
  }
  return data;
}

async function cacheStationData(aqiData) {
  const { data } = aqiData;
  const timezone = data.time.tz;
  const stationIdx = data.idx;

  // Reference to this specific station document
  const stationRef = db.collection('stations').doc(stationIdx.toString());
  const stationDoc = await stationRef.get();

  const stationData = {
    stationIdx: stationIdx,
    timezone: timezone,
    dominentPol: data.dominentpol,
    aqi: data.aqi,
    co: data.iaqi.co?.v || null,
    dew: data.iaqi.dew?.v || null,
    h: data.iaqi.h?.v || null,
    no2: data.iaqi.no2?.v || null,
    o3: data.iaqi.o3?.v || null,
    p: data.iaqi.p?.v || null,
    pm10: data.iaqi.pm10?.v || null,
    pm25: data.iaqi.pm25?.v || null,
    r: data.iaqi.r?.v || null,
    so2: data.iaqi.so2?.v || null,
    t: data.iaqi.t?.v || null,
    w: data.iaqi.w?.v || null,
    cityName: data.city.name,
    cityUrl: data.city.url,
    cityGeo: data.city.geo,
    lastUpdated: new Date(),
  };

  if (!stationDoc.exists) {
    // Station doesn't exist - create it
    await stationRef.set({
      ...stationData,
      createdAt: new Date(),
    });
    console.log(`Created new station ${stationIdx} (${timezone})`);
  } else {
    // Station exists - update with fresh data
    await stationRef.update(stationData);
    console.log(`Updated station ${stationIdx} with fresh data`);
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

async function getDevicesByUser(secureUserId) {
  try {
    const devicesQuery = db
      .collection('devices')
      .where('linkedUserID', '==', secureUserId);

    const snapshot = await devicesQuery.get();

    if (snapshot.empty) {
      return [];
    }

    const devices = [];
    snapshot.forEach((doc) => {
      const docData = doc.data();

      // Get all the nested data objects
      const settings = docData.settings || {};
      const status = docData.status || {};
      const data = docData.data || {};
      const measurements = data.measurements || {};

      // --- Build the frontend payload ---

      // 1. Determine AQI
      const aqiValue = measurements.pm25 || 0;
      const aqiLabel = getAqiLabel(aqiValue);

      // 2. Build Subtitle
      const onlineStatus = status.online ? '온라인' : '오프라인';
      const mode = settings.autoMode ? '자동 모드' : '수동 모드';
      const subtitle = `${onlineStatus} · ${mode}`;

      // 3. Format lastSeen timestamp
      // (Sends ISO string, frontend can format it)
      const lastUpdated = status.lastSeen
        ? status.lastSeen.toDate().toISOString()
        : new Date(0).toISOString(); // Use epoch if not set

      // 4. Push the complete RoomSummary object
      devices.push({
        id: doc.id, // The deviceID
        name: data.name || 'Unnamed Device',
        subtitle: subtitle,
        lastUpdated: lastUpdated,
        aqi: aqiValue,
        aqiLabel: aqiLabel,
      });
    });

    return devices;
  } catch (error) {
    console.error('Error fetching devices:', error.message);
    throw error;
  }
}

module.exports = {
  registerDevice,
  renameDevice,
  deleteDevice,
  getDevicesByUser,
};
