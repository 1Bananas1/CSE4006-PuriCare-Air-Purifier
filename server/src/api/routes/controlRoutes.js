/**
 * Device Control Routes
 * API endpoints for controlling air purifier devices
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

/**
 * POST /api/control/:deviceId/fan-speed
 * Set device fan speed
 */
router.post('/:deviceId/fan-speed', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { speed } = req.body;

    // Validate speed (0-10)
    if (typeof speed !== 'number' || speed < 0 || speed > 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'speed must be a number between 0 and 10',
      });
    }

    // Verify device exists
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    // Update device settings in Firebase
    await db.collection('devices').doc(deviceId).update({
      'settings.fanSpeed': speed,
      'status.lastSeen': new Date(),
    });

    // Emit WebSocket event to notify connected clients and simulator
    const io = req.app.get('io');
    if (io) {
      io.to(`device:${deviceId}`).emit('device_control', {
        type: 'fan_speed',
        value: speed,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'Fan speed updated',
      deviceId,
      fanSpeed: speed,
    });
  } catch (error) {
    console.error('Error setting fan speed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * POST /api/control/:deviceId/auto-mode
 * Toggle auto mode on/off
 */
router.post('/:deviceId/auto-mode', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'enabled must be a boolean',
      });
    }

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    await db.collection('devices').doc(deviceId).update({
      'settings.autoMode': enabled,
      'status.lastSeen': new Date(),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`device:${deviceId}`).emit('device_control', {
        type: 'auto_mode',
        value: enabled,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `Auto mode ${enabled ? 'enabled' : 'disabled'}`,
      deviceId,
      autoMode: enabled,
    });
  } catch (error) {
    console.error('Error toggling auto mode:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * POST /api/control/:deviceId/sensitivity
 * Set device sensitivity level
 */
router.post('/:deviceId/sensitivity', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { level } = req.body;

    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'level must be one of: low, medium, high',
      });
    }

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    // Map level to numeric value
    const sensitivityMap = { low: 0, medium: 1, high: 2 };
    const sensitivityValue = sensitivityMap[level];

    await db.collection('devices').doc(deviceId).update({
      'settings.sensitivity': sensitivityValue,
      'status.lastSeen': new Date(),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`device:${deviceId}`).emit('device_control', {
        type: 'sensitivity',
        value: level,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `Sensitivity set to ${level}`,
      deviceId,
      sensitivity: level,
    });
  } catch (error) {
    console.error('Error setting sensitivity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * POST /api/control/:deviceId/power
 * Turn device on/off
 */
router.post('/:deviceId/power', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { on } = req.body;

    if (typeof on !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'on must be a boolean',
      });
    }

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    await db
      .collection('devices')
      .doc(deviceId)
      .update({
        'status.online': on,
        'status.lastSeen': new Date(),
        // If turning off, set fan speed to 0
        ...(on ? {} : { 'settings.fanSpeed': 0 }),
      });

    const io = req.app.get('io');
    if (io) {
      io.to(`device:${deviceId}`).emit('device_control', {
        type: 'power',
        value: on,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `Device turned ${on ? 'on' : 'off'}`,
      deviceId,
      power: on,
    });
  } catch (error) {
    console.error('Error setting power:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * GET /api/control/:deviceId/status
 * Get current device control status
 */
router.get('/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    const data = deviceDoc.data();
    const sensitivityMap = { 0: 'low', 1: 'medium', 2: 'high' };

    res.json({
      success: true,
      deviceId,
      status: {
        online: data.status?.online || false,
        fanSpeed: data.settings?.fanSpeed || 0,
        autoMode: data.settings?.autoMode || false,
        sensitivity: sensitivityMap[data.settings?.sensitivity] || 'medium',
        lastSeen: data.status?.lastSeen?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error getting device status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

module.exports = router;
