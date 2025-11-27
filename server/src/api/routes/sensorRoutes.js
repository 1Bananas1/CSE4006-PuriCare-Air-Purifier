/**
 * Sensor Data Routes
 * REST API endpoints for sensor data
 */

const express = require('express');
const router = express.Router();
const { isDatabaseAvailable } = require('../database/init');
const sensorDataService = require('../services/sensorDataService');
const { db } = require('../config/firebase');
const { generalLimiter, sensorDataLimiter } = require('../middleware/rateLimiter');

/**
 * Middleware: Check if database is available
 */
function checkDatabaseAvailable(req, res, next) {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message:
        'Sensor data service is not available. DATABASE_URL not configured.',
    });
  }
  next();
}

/**
 * Middleware: Verify device ownership (for user-initiated requests)
 */
async function verifyDeviceOwnership(req, res, next) {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Check if user owns this device (from Firebase)
    const deviceDoc = await db.collection('devices').doc(deviceId).get();

    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    const deviceData = deviceDoc.data();

    if (deviceData.linkedUserID !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this device',
      });
    }

    // Attach device data to request
    req.device = deviceData;
    next();
  } catch (error) {
    console.error('Error verifying device ownership:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify device ownership',
    });
  }
}

/**
 * POST /api/sensor-data
 * Submit sensor data from simulator/device
 *
 * Body: {
 *   deviceId: string,
 *   timestamp?: string (ISO 8601),
 *   sensors: {
 *     RH: number,
 *     CO: number,
 *     CO2: number,
 *     NO2: number,
 *     PM10: number,
 *     PM25: number,
 *     TEMP: number,
 *     TVOC: number
 *   }
 * }
 */
router.post('/', sensorDataLimiter, checkDatabaseAvailable, async (req, res) => {
  try {
    const { deviceId, timestamp, sensors } = req.body;

    // Validation
    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'deviceId is required',
      });
    }

    if (!sensors || typeof sensors !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sensors object is required',
      });
    }

    // Verify device exists in Firebase
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found in system',
      });
    }

    // Parse timestamp if provided
    const readingTime = timestamp ? new Date(timestamp) : new Date();

    // Process sensor data (store + detect changes + generate alerts)
    const result = await sensorDataService.processSensorData(deviceId, sensors);

    // Update device lastSeen in Firebase
    await db.collection('devices').doc(deviceId).update({
      'status.lastSeen': new Date(),
      'status.online': true,
    });

    // If alerts were generated, emit via WebSocket (if available)
    if (result.hasAlerts && req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`device:${deviceId}`).emit('sensor_alerts', {
        deviceId,
        alerts: result.alerts,
        timestamp: readingTime,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Sensor data stored successfully',
      deviceId,
      timestamp: readingTime,
      alertsGenerated: result.alerts.length,
      alerts: result.alerts,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/sensor-data:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/devices/:deviceId/sensor-data/latest
 * Get latest sensor reading for a device
 * Requires authentication
 */
router.get('/:deviceId/latest', generalLimiter, checkDatabaseAvailable, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify device exists
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    const latestReading = await sensorDataService.getLatestReading(deviceId);

    if (!latestReading) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No sensor data available for this device',
      });
    }

    res.json({
      success: true,
      deviceId,
      data: latestReading,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/devices/:deviceId/latest:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/devices/:deviceId/sensor-data/history
 * Get historical sensor readings for a device
 * Requires authentication
 *
 * Query params:
 *   - startTime: ISO 8601 timestamp (default: 24 hours ago)
 *   - endTime: ISO 8601 timestamp (default: now)
 *   - limit: number (default: 100, max: 1000)
 */
router.get('/:deviceId/history', generalLimiter, checkDatabaseAvailable, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startTime, endTime, limit } = req.query;

    // Verify device exists
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    // Parse query parameters
    const options = {};

    if (startTime) {
      options.startTime = new Date(startTime);
      if (isNaN(options.startTime)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid startTime format',
        });
      }
    }

    if (endTime) {
      options.endTime = new Date(endTime);
      if (isNaN(options.endTime)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid endTime format',
        });
      }
    }

    if (limit) {
      const parsedLimit = parseInt(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid limit value',
        });
      }
      options.limit = Math.min(parsedLimit, 1000); // Max 1000 readings
    }

    const readings = await sensorDataService.getHistoricalReadings(
      deviceId,
      options
    );

    res.json({
      success: true,
      deviceId,
      count: readings.length,
      data: readings,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/devices/:deviceId/history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/devices/:deviceId/alerts
 * Get alerts for a device
 * Requires authentication
 *
 * Query params:
 *   - limit: number (default: 20)
 *   - unacknowledged: boolean (default: false)
 */
router.get('/:deviceId/alerts', generalLimiter, checkDatabaseAvailable, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit, unacknowledged } = req.query;

    // Verify device exists
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    const parsedLimit = limit ? Math.min(parseInt(limit), 100) : 20;
    const unacknowledgedOnly = unacknowledged === 'true';

    const alerts = await sensorDataService.getAlerts(
      deviceId,
      parsedLimit,
      unacknowledgedOnly
    );

    res.json({
      success: true,
      deviceId,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/devices/:deviceId/alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/sensor-data/health
 * Check if sensor data service is available
 */
router.get('/health', (req, res) => {
  const available = isDatabaseAvailable();

  res.json({
    service: 'Sensor Data Service',
    status: available ? 'available' : 'unavailable',
    message: available
      ? 'Database connected and ready'
      : 'DATABASE_URL not configured',
  });
});

module.exports = router;
