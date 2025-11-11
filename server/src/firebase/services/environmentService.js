const { initializeFirebase } = require('../config/firebase');
const deviceService = require('./deviceService');

class EnvironmentService {
  constructor() {
    const { db } = initializeFirebase();
    this.db = db;
    this.environmentCollection = db.collection('environmentData');
  }

  // Store environment data from device
  async storeEnvironmentData(deviceId, environmentData) {
    try {
      // Verify device exists
      const device = await deviceService.getDeviceByDeviceId(deviceId);

      if (!device) {
        throw new Error('Device not found');
      }

      const data = {
        deviceId: device.id, // Firestore document ID
        deviceHardwareId: deviceId, // Physical device ID
        userId: device.userId,
        data: {
          aqi: environmentData.aqi || null,
          pm25: environmentData.pm25 || null,
          pm10: environmentData.pm10 || null,
          o3: environmentData.o3 || null,
          no2: environmentData.no2 || null,
          so2: environmentData.so2 || null,
          co: environmentData.co || null,
          dominantPollutant: environmentData.dominantPollutant || null,
          temperature: environmentData.temperature || null,
          humidity: environmentData.humidity || null,
          pressure: environmentData.pressure || null,
          // You can add more sensor data here
          raw: environmentData.raw || null,
        },
        location: device.location,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await this.environmentCollection.add(data);

      // Update device last seen status
      await deviceService.updateDeviceStatus(deviceId, { online: true });

      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error storing environment data:', error);
      throw error;
    }
  }

  // Get latest environment data for a device
  async getLatestEnvironmentData(deviceDocId, uid) {
    try {
      // Verify device belongs to user
      const device = await deviceService.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      const snapshot = await this.environmentCollection
        .where('deviceId', '==', deviceDocId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting latest environment data:', error);
      throw error;
    }
  }

  // Get environment data history for a device
  async getEnvironmentDataHistory(deviceDocId, uid, options = {}) {
    try {
      // Verify device belongs to user
      const device = await deviceService.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      const { days = 7, limit = 100 } = options;

      // Calculate start date
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await this.environmentCollection
        .where('deviceId', '==', deviceDocId)
        .where('timestamp', '>=', startDate.toISOString())
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const history = [];
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });

      return history;
    } catch (error) {
      console.error('Error getting environment data history:', error);
      throw error;
    }
  }

  // Get latest data for all user's devices
  async getAllUserDevicesLatestData(uid) {
    try {
      const devices = await deviceService.getUserDevices(uid);

      const latestDataPromises = devices.map(async (device) => {
        const snapshot = await this.environmentCollection
          .where('deviceId', '==', device.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (snapshot.empty) {
          return {
            device,
            data: null,
          };
        }

        const doc = snapshot.docs[0];
        return {
          device,
          data: { id: doc.id, ...doc.data() },
        };
      });

      return await Promise.all(latestDataPromises);
    } catch (error) {
      console.error('Error getting all user devices latest data:', error);
      throw error;
    }
  }

  // Delete old environment data (cleanup function)
  async deleteOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const snapshot = await this.environmentCollection
        .where('timestamp', '<', cutoffDate.toISOString())
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      return {
        success: true,
        deletedCount: snapshot.size,
      };
    } catch (error) {
      console.error('Error deleting old data:', error);
      throw error;
    }
  }

  // Get aggregated statistics for a device
  async getDeviceStatistics(deviceDocId, uid, days = 7) {
    try {
      // Verify device belongs to user
      const device = await deviceService.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await this.environmentCollection
        .where('deviceId', '==', deviceDocId)
        .where('timestamp', '>=', startDate.toISOString())
        .orderBy('timestamp', 'asc')
        .get();

      if (snapshot.empty) {
        return null;
      }

      // Calculate statistics
      const dataPoints = [];
      snapshot.forEach((doc) => {
        dataPoints.push(doc.data());
      });

      const stats = {
        count: dataPoints.length,
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        averages: this.calculateAverages(dataPoints),
        min: this.calculateMin(dataPoints),
        max: this.calculateMax(dataPoints),
      };

      return stats;
    } catch (error) {
      console.error('Error getting device statistics:', error);
      throw error;
    }
  }

  // Helper function to calculate averages
  calculateAverages(dataPoints) {
    const fields = ['aqi', 'pm25', 'pm10', 'temperature', 'humidity'];
    const averages = {};

    fields.forEach((field) => {
      const values = dataPoints
        .map((d) => d.data[field])
        .filter((v) => v !== null && v !== undefined);

      if (values.length > 0) {
        averages[field] = values.reduce((a, b) => a + b, 0) / values.length;
      } else {
        averages[field] = null;
      }
    });

    return averages;
  }

  // Helper function to calculate min values
  calculateMin(dataPoints) {
    const fields = ['aqi', 'pm25', 'pm10', 'temperature', 'humidity'];
    const min = {};

    fields.forEach((field) => {
      const values = dataPoints
        .map((d) => d.data[field])
        .filter((v) => v !== null && v !== undefined);

      if (values.length > 0) {
        min[field] = Math.min(...values);
      } else {
        min[field] = null;
      }
    });

    return min;
  }

  // Helper function to calculate max values
  calculateMax(dataPoints) {
    const fields = ['aqi', 'pm25', 'pm10', 'temperature', 'humidity'];
    const max = {};

    fields.forEach((field) => {
      const values = dataPoints
        .map((d) => d.data[field])
        .filter((v) => v !== null && v !== undefined);

      if (values.length > 0) {
        max[field] = Math.max(...values);
      } else {
        max[field] = null;
      }
    });

    return max;
  }
}

module.exports = new EnvironmentService();
