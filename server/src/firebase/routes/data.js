const express = require('express');
const environmentService = require('../services/environmentService');

const router = express.Router();

// Upload environment data from IoT device
// This endpoint uses API key authentication instead of Firebase Auth
// because it's called by hardware devices, not user clients
router.post('/upload', async (req, res) => {
  try {
    // Verify API key from device
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    const { deviceId, data } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Device ID is required'
      });
    }

    if (!data) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Environment data is required'
      });
    }

    // Store the environment data
    const storedData = await environmentService.storeEnvironmentData(deviceId, data);

    res.status(201).json({
      message: 'Environment data stored successfully',
      id: storedData.id,
      timestamp: storedData.timestamp
    });
  } catch (error) {
    console.error('Upload environment data error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not registered. Please register the device first.'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Batch upload for multiple readings
router.post('/upload/batch', async (req, res) => {
  try {
    // Verify API key from device
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    const { deviceId, readings } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Device ID is required'
      });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Readings array is required and must not be empty'
      });
    }

    // Store all readings
    const results = [];
    const errors = [];

    for (const data of readings) {
      try {
        const storedData = await environmentService.storeEnvironmentData(deviceId, data);
        results.push({
          success: true,
          id: storedData.id,
          timestamp: storedData.timestamp
        });
      } catch (error) {
        errors.push({
          success: false,
          error: error.message,
          data
        });
      }
    }

    res.status(201).json({
      message: `Stored ${results.length} of ${readings.length} readings`,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Health check for devices
router.post('/ping', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Device ID is required'
      });
    }

    const deviceService = require('../services/deviceService');
    await deviceService.updateDeviceStatus(deviceId, { online: true });

    res.json({
      message: 'Ping received',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ping error:', error);

    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not registered'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
