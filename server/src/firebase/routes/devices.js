const express = require('express');
const deviceService = require('../services/deviceService');
const environmentService = require('../services/environmentService');
const { authenticateFirebaseToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateFirebaseToken);

// Register a new device
router.post('/', async (req, res) => {
  try {
    const { deviceId, name, location } = req.body;

    if (!deviceId || !name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Device ID and name are required'
      });
    }

    const device = await deviceService.registerDevice(req.user.uid, {
      deviceId,
      name,
      location
    });

    res.status(201).json({
      message: 'Device registered successfully',
      device
    });
  } catch (error) {
    console.error('Register device error:', error);

    if (error.message === 'Device ID already registered') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get all user's devices
router.get('/', async (req, res) => {
  try {
    const devices = await deviceService.getUserDevices(req.user.uid);

    res.json({
      count: devices.length,
      devices
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get a specific device
router.get('/:id', async (req, res) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id);

    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found'
      });
    }

    if (device.userId !== req.user.uid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Unauthorized access to device'
      });
    }

    res.json(device);
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update a device
router.put('/:id', async (req, res) => {
  try {
    const { name, settings } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (settings) updates.settings = settings;

    const device = await deviceService.updateDevice(
      req.params.id,
      req.user.uid,
      updates
    );

    res.json({
      message: 'Device updated successfully',
      device
    });
  } catch (error) {
    console.error('Update device error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update device location
router.put('/:id/location', async (req, res) => {
  try {
    const { name, city, latitude, longitude } = req.body;

    if (!city && (!latitude || !longitude)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide either city or latitude/longitude'
      });
    }

    const device = await deviceService.updateDeviceLocation(
      req.params.id,
      req.user.uid,
      { name, city, latitude, longitude }
    );

    res.json({
      message: 'Device location updated successfully',
      device
    });
  } catch (error) {
    console.error('Update device location error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Delete a device
router.delete('/:id', async (req, res) => {
  try {
    const result = await deviceService.deleteDevice(req.params.id, req.user.uid);

    res.json({
      message: 'Device deleted successfully',
      device: result.device
    });
  } catch (error) {
    console.error('Delete device error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get latest environment data for a device
router.get('/:id/environment/latest', async (req, res) => {
  try {
    const data = await environmentService.getLatestEnvironmentData(
      req.params.id,
      req.user.uid
    );

    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No environment data found for this device'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Get latest environment data error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get environment data history for a device
router.get('/:id/environment/history', async (req, res) => {
  try {
    const { days = 7, limit = 100 } = req.query;

    const history = await environmentService.getEnvironmentDataHistory(
      req.params.id,
      req.user.uid,
      { days: parseInt(days), limit: parseInt(limit) }
    );

    res.json({
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Get environment data history error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get device statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const statistics = await environmentService.getDeviceStatistics(
      req.params.id,
      req.user.uid,
      parseInt(days)
    );

    if (!statistics) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No data available for statistics'
      });
    }

    res.json(statistics);
  } catch (error) {
    console.error('Get device statistics error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get latest data for all user's devices (dashboard)
router.get('/all/environment', async (req, res) => {
  try {
    const allData = await environmentService.getAllUserDevicesLatestData(req.user.uid);

    res.json({
      count: allData.length,
      devices: allData
    });
  } catch (error) {
    console.error('Get all devices environment data error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
