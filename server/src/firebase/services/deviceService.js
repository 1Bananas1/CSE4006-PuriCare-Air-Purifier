const { initializeFirebase } = require('../config/firebase');
const userService = require('./userService');

class DeviceService {
  constructor() {
    const { db } = initializeFirebase();
    this.db = db;
    this.devicesCollection = db.collection('devices');
  }

  // Register a new device
  async registerDevice(uid, deviceData) {
    try {
      const { deviceId, name, location } = deviceData;

      // Check if device ID already exists
      const existingDevice = await this.getDeviceByDeviceId(deviceId);
      if (existingDevice) {
        throw new Error('Device ID already registered');
      }

      const device = {
        userId: uid,
        deviceId,
        name,
        location: location || {
          name: null,
          city: null,
          latitude: null,
          longitude: null,
          lastUpdated: null
        },
        settings: {
          autoMode: true,
          fanSpeed: 1,
          sensitivity: 2
        },
        status: {
          online: false,
          lastSeen: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await this.devicesCollection.add(device);

      // Increment user's device count
      await userService.incrementDeviceCount(uid);

      return { id: docRef.id, ...device };
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  // Get device by Firestore document ID
  async getDeviceById(deviceDocId) {
    try {
      const deviceDoc = await this.devicesCollection.doc(deviceDocId).get();

      if (!deviceDoc.exists) {
        return null;
      }

      return { id: deviceDoc.id, ...deviceDoc.data() };
    } catch (error) {
      console.error('Error getting device:', error);
      throw error;
    }
  }

  // Get device by deviceId (hardware ID)
  async getDeviceByDeviceId(deviceId) {
    try {
      const snapshot = await this.devicesCollection
        .where('deviceId', '==', deviceId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting device by deviceId:', error);
      throw error;
    }
  }

  // Get all devices for a user
  async getUserDevices(uid) {
    try {
      const snapshot = await this.devicesCollection
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      const devices = [];
      snapshot.forEach(doc => {
        devices.push({ id: doc.id, ...doc.data() });
      });

      return devices;
    } catch (error) {
      console.error('Error getting user devices:', error);
      throw error;
    }
  }

  // Update device
  async updateDevice(deviceDocId, uid, updates) {
    try {
      const device = await this.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.devicesCollection.doc(deviceDocId).update(updateData);
      return await this.getDeviceById(deviceDocId);
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  }

  // Update device location
  async updateDeviceLocation(deviceDocId, uid, locationData) {
    try {
      const device = await this.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      const location = {
        name: locationData.name || device.location.name,
        city: locationData.city || device.location.city,
        latitude: locationData.latitude || device.location.latitude,
        longitude: locationData.longitude || device.location.longitude,
        lastUpdated: new Date().toISOString()
      };

      await this.devicesCollection.doc(deviceDocId).update({
        location,
        updatedAt: new Date().toISOString()
      });

      return await this.getDeviceById(deviceDocId);
    } catch (error) {
      console.error('Error updating device location:', error);
      throw error;
    }
  }

  // Update device status
  async updateDeviceStatus(deviceId, statusData) {
    try {
      const device = await this.getDeviceByDeviceId(deviceId);

      if (!device) {
        throw new Error('Device not found');
      }

      const status = {
        online: statusData.online !== undefined ? statusData.online : device.status.online,
        lastSeen: new Date().toISOString()
      };

      await this.devicesCollection.doc(device.id).update({
        status,
        updatedAt: new Date().toISOString()
      });

      return await this.getDeviceById(device.id);
    } catch (error) {
      console.error('Error updating device status:', error);
      throw error;
    }
  }

  // Delete device
  async deleteDevice(deviceDocId, uid) {
    try {
      const device = await this.getDeviceById(deviceDocId);

      if (!device) {
        throw new Error('Device not found');
      }

      if (device.userId !== uid) {
        throw new Error('Unauthorized: Device does not belong to user');
      }

      // Delete device
      await this.devicesCollection.doc(deviceDocId).delete();

      // Decrement user's device count
      await userService.decrementDeviceCount(uid);

      // Note: You might also want to delete associated environment data

      return { success: true, device };
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  }

  // Count user's devices
  async countUserDevices(uid) {
    try {
      const snapshot = await this.devicesCollection
        .where('userId', '==', uid)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      console.error('Error counting devices:', error);
      throw error;
    }
  }
}

module.exports = new DeviceService();
