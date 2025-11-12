const moment = require('moment-timezone');
const { initializeFirebase } = require('../config/firebase');

/**
 * Timezone Service
 * Manages timezone-based device grouping for efficient midnight routine execution
 *
 * Schema:
 * timezones/{timezoneId}:
 *   - timezone: string (e.g., "America/Chicago")
 *   - deviceIds: array of device IDs
 *   - cityNames: array of unique city names (for reference)
 *   - lastMidnightRun: timestamp
 *   - deviceCount: number
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 */

class TimezoneService {
  constructor() {
    const { db } = initializeFirebase();
    this.db = db;
    this.timezonesCollection = db.collection('timezones');
  }

  /**
   * Encode timezone for use as Firestore document ID
   * Firestore IDs cannot contain slashes, so we replace them
   */
  static encodeTimezoneId(timezone) {
    return timezone.replace(/\//g, '_');
  }

  /**
   * Decode timezone ID back to standard format
   */
  static decodeTimezoneId(timezoneId) {
    // Handle both formats for backwards compatibility
    return timezoneId.replace(/_/g, '/');
  }

  /**
   * Get timezone from city name using geocoding/lookup
   * For now, this is a simple implementation that could be enhanced with:
   * - Google Geocoding API
   * - City timezone database
   * - Lat/lng to timezone conversion
   */
  static getTimezoneFromCity(cityName, latitude = null, longitude = null) {
    // If lat/lng provided, use moment-timezone to find timezone
    if (latitude !== null && longitude !== null) {
      // This is a simplified version - in production you'd use a proper geo->tz library
      // like 'tz-lookup' or 'geo-tz'
      // For now, we'll use a basic city->timezone mapping
      // In production, install: npm install geo-tz
      // const geoTz = require('geo-tz');
      // return geoTz.find(latitude, longitude)[0];
    }

    // Fallback: Basic city name to timezone mapping
    const cityTimezoneMap = {
      // North America
      chicago: 'America/Chicago',
      'new york': 'America/New_York',
      'los angeles': 'America/Los_Angeles',
      denver: 'America/Denver',
      phoenix: 'America/Phoenix',
      seattle: 'America/Los_Angeles',
      miami: 'America/New_York',
      dallas: 'America/Chicago',
      houston: 'America/Chicago',

      // Europe
      london: 'Europe/London',
      paris: 'Europe/Paris',
      berlin: 'Europe/Berlin',
      madrid: 'Europe/Madrid',
      rome: 'Europe/Rome',

      // Asia
      seoul: 'Asia/Seoul',
      tokyo: 'Asia/Tokyo',
      beijing: 'Asia/Shanghai',
      shanghai: 'Asia/Shanghai',
      'hong kong': 'Asia/Hong_Kong',
      singapore: 'Asia/Singapore',
      bangkok: 'Asia/Bangkok',
      mumbai: 'Asia/Kolkata',
      delhi: 'Asia/Kolkata',

      // Australia
      sydney: 'Australia/Sydney',
      melbourne: 'Australia/Melbourne',
      brisbane: 'Australia/Brisbane',

      // South America
      'sao paulo': 'America/Sao_Paulo',
      'buenos aires': 'America/Argentina/Buenos_Aires',
      santiago: 'America/Santiago',
    };

    const normalizedCity = cityName.toLowerCase().trim();
    const timezone = cityTimezoneMap[normalizedCity];

    if (!timezone) {
      console.warn(`⚠️  Unknown city "${cityName}", defaulting to UTC`);
      return 'UTC';
    }

    return timezone;
  }

  /**
   * Add a device to a timezone group
   * Creates the timezone document if it doesn't exist
   */
  async addDeviceToTimezone(deviceId, cityName, timezone) {
    try {
      const timezoneId = TimezoneService.encodeTimezoneId(timezone);
      const timezoneRef = this.timezonesCollection.doc(timezoneId);
      const timezoneDoc = await timezoneRef.get();

      if (timezoneDoc.exists) {
        // Timezone exists - add device if not already present
        const data = timezoneDoc.data();
        const deviceIds = data.deviceIds || [];
        const cityNames = data.cityNames || [];

        // Add device ID if not already in array
        if (!deviceIds.includes(deviceId)) {
          deviceIds.push(deviceId);
        }

        // Add city name if not already in array
        if (!cityNames.includes(cityName)) {
          cityNames.push(cityName);
        }

        await timezoneRef.update({
          deviceIds,
          cityNames,
          deviceCount: deviceIds.length,
          updatedAt: new Date(),
        });

        console.log(
          `✓ Added device ${deviceId} to existing timezone ${timezone}`
        );
      } else {
        // Create new timezone document
        await timezoneRef.set({
          timezone,
          deviceIds: [deviceId],
          cityNames: [cityName],
          deviceCount: 1,
          lastMidnightRun: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(
          `✓ Created new timezone ${timezone} with device ${deviceId}`
        );
      }

      return { success: true, timezone };
    } catch (error) {
      console.error(`❌ Error adding device to timezone:`, error);
      throw error;
    }
  }

  /**
   * Remove a device from a timezone group
   * Deletes the timezone document if no devices remain
   */
  async removeDeviceFromTimezone(deviceId, timezone) {
    try {
      const timezoneId = TimezoneService.encodeTimezoneId(timezone);
      const timezoneRef = this.timezonesCollection.doc(timezoneId);
      const timezoneDoc = await timezoneRef.get();

      if (!timezoneDoc.exists) {
        console.warn(`⚠️  Timezone ${timezone} not found`);
        return { success: false, reason: 'timezone_not_found' };
      }

      const data = timezoneDoc.data();
      const deviceIds = (data.deviceIds || []).filter((id) => id !== deviceId);

      if (deviceIds.length === 0) {
        // No devices left - delete the timezone document
        await timezoneRef.delete();
        console.log(`✓ Deleted timezone ${timezone} (no devices remaining)`);
      } else {
        // Update with remaining devices
        await timezoneRef.update({
          deviceIds,
          deviceCount: deviceIds.length,
          updatedAt: new Date(),
        });
        console.log(`✓ Removed device ${deviceId} from timezone ${timezone}`);
      }

      return {
        success: true,
        timezone,
        remainingDevices: deviceIds.length,
      };
    } catch (error) {
      console.error(`❌ Error removing device from timezone:`, error);
      throw error;
    }
  }

  /**
   * Update device's timezone (when device changes location)
   */
  async updateDeviceTimezone(deviceId, oldTimezone, newTimezone, newCityName) {
    try {
      // Remove from old timezone
      if (oldTimezone) {
        await this.removeDeviceFromTimezone(deviceId, oldTimezone);
      }

      // Add to new timezone
      await this.addDeviceToTimezone(deviceId, newCityName, newTimezone);

      console.log(
        `✓ Moved device ${deviceId} from ${oldTimezone} to ${newTimezone}`
      );
      return { success: true };
    } catch (error) {
      console.error(`❌ Error updating device timezone:`, error);
      throw error;
    }
  }

  /**
   * Get all devices in a specific timezone
   */
  async getDevicesInTimezone(timezone) {
    try {
      const timezoneId = TimezoneService.encodeTimezoneId(timezone);
      const timezoneDoc = await this.timezonesCollection.doc(timezoneId).get();

      if (!timezoneDoc.exists) {
        return { devices: [], cityNames: [] };
      }

      const data = timezoneDoc.data();
      return {
        devices: data.deviceIds || [],
        cityNames: data.cityNames || [],
        lastMidnightRun: data.lastMidnightRun,
        deviceCount: data.deviceCount || 0,
      };
    } catch (error) {
      console.error(`❌ Error getting devices in timezone:`, error);
      throw error;
    }
  }

  /**
   * Get all timezones
   */
  async getAllTimezones() {
    try {
      const snapshot = await this.timezonesCollection.get();
      const timezones = [];

      snapshot.forEach((doc) => {
        timezones.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return timezones;
    } catch (error) {
      console.error(`❌ Error getting all timezones:`, error);
      throw error;
    }
  }

  /**
   * Update last midnight run timestamp for a timezone
   */
  async updateLastMidnightRun(timezone) {
    try {
      const timezoneId = TimezoneService.encodeTimezoneId(timezone);
      await this.timezonesCollection.doc(timezoneId).update({
        lastMidnightRun: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(`❌ Error updating last midnight run:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about timezone distribution
   */
  async getTimezoneStats() {
    try {
      const timezones = await this.getAllTimezones();

      const stats = {
        totalTimezones: timezones.length,
        totalDevices: timezones.reduce(
          (sum, tz) => sum + (tz.deviceCount || 0),
          0
        ),
        timezoneBreakdown: timezones.map((tz) => ({
          timezone: tz.timezone,
          deviceCount: tz.deviceCount,
          cityNames: tz.cityNames,
          lastMidnightRun: tz.lastMidnightRun,
        })),
      };

      return stats;
    } catch (error) {
      console.error(`❌ Error getting timezone stats:`, error);
      throw error;
    }
  }
}

module.exports = TimezoneService;
