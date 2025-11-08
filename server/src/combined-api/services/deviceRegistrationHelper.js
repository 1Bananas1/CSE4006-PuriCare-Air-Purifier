const TimezoneService = require('./timezoneService');
const { initializeFirebase } = require('../config/firebase');

/**
 * Device Registration Helper
 * Handles device registration and automatic timezone management
 */

class DeviceRegistrationHelper {
  constructor() {
    const { db } = initializeFirebase();
    this.db = db;
    this.timezoneService = new TimezoneService();
  }

  /**
   * Register a new device
   * Automatically adds device to appropriate timezone collection
   *
   * @param {Object} deviceData - Device information
   * @param {string} deviceData.deviceId - Unique device identifier
   * @param {string} deviceData.cityName - City name (e.g., "Seoul", "Chicago")
   * @param {number} [deviceData.latitude] - Optional latitude for precise timezone lookup
   * @param {number} [deviceData.longitude] - Optional longitude for precise timezone lookup
   * @param {string} [deviceData.userId] - Optional user ID who owns the device
   * @param {Object} [deviceData.metadata] - Optional additional metadata
   *
   * @returns {Promise<Object>} Registration result with device ID and timezone
   */
  async registerDevice(deviceData) {
    const { deviceId, cityName, latitude, longitude, userId, metadata = {} } = deviceData;

    try {
      console.log(`\n📱 Registering device: ${deviceId}`);
      console.log(`   City: ${cityName}`);

      // Step 1: Determine timezone from city or coordinates
      const timezone = TimezoneService.getTimezoneFromCity(cityName, latitude, longitude);
      console.log(`   Detected timezone: ${timezone}`);

      // Step 2: Check if device already exists
      const deviceRef = this.db.collection('devices').doc(deviceId);
      const existingDevice = await deviceRef.get();

      if (existingDevice.exists) {
        const existingData = existingDevice.data();
        const oldTimezone = existingData.timezone;

        // If timezone changed, update timezone collections
        if (oldTimezone && oldTimezone !== timezone) {
          console.log(`   ⚠️  Timezone changed from ${oldTimezone} to ${timezone}`);
          await this.timezoneService.updateDeviceTimezone(
            deviceId,
            oldTimezone,
            timezone,
            cityName
          );
        } else if (!oldTimezone) {
          // Old device without timezone - add to timezone collection
          await this.timezoneService.addDeviceToTimezone(deviceId, cityName, timezone);
        }

        // Update existing device
        await deviceRef.update({
          cityName,
          timezone,
          latitude: latitude || existingData.latitude || null,
          longitude: longitude || existingData.longitude || null,
          userId: userId || existingData.userId || null,
          metadata: { ...existingData.metadata, ...metadata },
          updatedAt: new Date(),
        });

        console.log(`   ✓ Updated existing device`);

        return {
          success: true,
          deviceId,
          timezone,
          isNewDevice: false,
        };
      }

      // Step 3: Create new device document
      const newDeviceData = {
        deviceId,
        cityName,
        timezone,
        latitude: latitude || null,
        longitude: longitude || null,
        userId: userId || null,
        metadata,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await deviceRef.set(newDeviceData);
      console.log(`   ✓ Created device document`);

      // Step 4: Add device to timezone collection
      await this.timezoneService.addDeviceToTimezone(deviceId, cityName, timezone);

      console.log(`   ✓ Device registered successfully\n`);

      return {
        success: true,
        deviceId,
        timezone,
        isNewDevice: true,
      };

    } catch (error) {
      console.error(`   ❌ Registration failed:`, error);
      throw error;
    }
  }

  /**
   * Unregister/delete a device
   * Automatically removes device from timezone collection
   */
  async unregisterDevice(deviceId) {
    try {
      console.log(`\n🗑️  Unregistering device: ${deviceId}`);

      // Step 1: Get device data to find timezone
      const deviceRef = this.db.collection('devices').doc(deviceId);
      const deviceDoc = await deviceRef.get();

      if (!deviceDoc.exists) {
        console.log(`   ⚠️  Device not found`);
        return { success: false, reason: 'device_not_found' };
      }

      const deviceData = deviceDoc.data();
      const timezone = deviceData.timezone;

      // Step 2: Remove from timezone collection
      if (timezone) {
        await this.timezoneService.removeDeviceFromTimezone(deviceId, timezone);
      }

      // Step 3: Delete device document
      await deviceRef.delete();
      console.log(`   ✓ Device unregistered successfully\n`);

      return {
        success: true,
        deviceId,
        timezone,
      };

    } catch (error) {
      console.error(`   ❌ Unregistration failed:`, error);
      throw error;
    }
  }

  /**
   * Bulk register multiple devices
   * Useful for migration or initial setup
   */
  async bulkRegisterDevices(devicesArray) {
    console.log(`\n📦 Bulk registering ${devicesArray.length} devices...`);

    const results = {
      successful: [],
      failed: [],
      total: devicesArray.length,
    };

    for (const deviceData of devicesArray) {
      try {
        const result = await this.registerDevice(deviceData);
        results.successful.push({ deviceId: deviceData.deviceId, ...result });
      } catch (error) {
        results.failed.push({
          deviceId: deviceData.deviceId,
          error: error.message,
        });
      }
    }

    console.log(`\n✓ Bulk registration complete:`);
    console.log(`   Successful: ${results.successful.length}`);
    console.log(`   Failed: ${results.failed.length}\n`);

    return results;
  }

  /**
   * Migrate existing devices to timezone collection
   * Run this once to populate timezone collection from existing devices
   */
  async migrateExistingDevices() {
    console.log(`\n🔄 Starting device migration to timezone collection...\n`);

    try {
      const devicesSnapshot = await this.db.collection('devices').get();

      if (devicesSnapshot.empty) {
        console.log('⚠️  No devices found to migrate');
        return { success: true, migrated: 0 };
      }

      console.log(`Found ${devicesSnapshot.size} devices to migrate`);

      let migratedCount = 0;
      let errorCount = 0;

      for (const deviceDoc of devicesSnapshot.docs) {
        const deviceData = deviceDoc.data();
        const deviceId = deviceDoc.id;

        try {
          // Get or determine timezone
          let timezone = deviceData.timezone;

          if (!timezone) {
            // Device doesn't have timezone yet - determine it
            timezone = TimezoneService.getTimezoneFromCity(
              deviceData.cityName,
              deviceData.latitude,
              deviceData.longitude
            );

            // Update device with timezone
            await deviceDoc.ref.update({
              timezone,
              updatedAt: new Date(),
            });
          }

          // Add to timezone collection
          await this.timezoneService.addDeviceToTimezone(
            deviceId,
            deviceData.cityName || 'Unknown',
            timezone
          );

          migratedCount++;
          console.log(`✓ Migrated ${deviceId} to ${timezone}`);

        } catch (error) {
          errorCount++;
          console.error(`✗ Failed to migrate ${deviceId}:`, error.message);
        }
      }

      console.log(`\n✓ Migration complete:`);
      console.log(`   Migrated: ${migratedCount}`);
      console.log(`   Errors: ${errorCount}\n`);

      return {
        success: true,
        migrated: migratedCount,
        errors: errorCount,
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

module.exports = DeviceRegistrationHelper;
