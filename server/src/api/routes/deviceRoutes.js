const express = require('express');
const router = express.Router();

const { authenticateFirebaseToken } = require('../middleware/auth');

const deviceService = require('../services/deviceService');

router.post('/register', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const deviceData = req.body;
    const newDeviceID = await deviceService.registerDevice(userId, deviceData);
    res.status(201).send({ success: true, deviceId: newDeviceID });
  } catch (error) {
    if (error.message.includes('Invalid device ID')) {
      return res.status(400).send({ error: error.message });
    }
    if (error.message.includes('already been registered')) {
      return res.status(409).send({ error: error.message });
    }
    console.error('Error in /api/devices/register:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

router.delete('/:deviceId', authenticateFirebaseToken, async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const userId = req.user.uid;
    await deviceService.deleteDevice(userId, deviceId);
    res
      .status(200)
      .send({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    if (error.message === 'Not Authorized') {
      return res.status(403).send({ error: error.message });
    }
    if (error.message === 'Not authorized') {
      return res.status(403).send({ error: error.message });
    }
    console.error('Error in DELETE /api/devices/:deviceId:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

router.get('/', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('🔍 GET /api/devices called');
    console.log('✅ User authenticated - UID:', userId);
    const devices = await deviceService.getDevicesByUser(userId);
    console.log('📦 Devices found:', devices.length);
    res.status(200).json(devices);
  } catch (error) {
    console.error('Error in GET /api/devices: ', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

router.get(
  '/public/stations/:stationIdx',
  async (req, res) => {
    try {
      const stationIdx = req.params.stationIdx; // ← Extract from URL
      const stationData = await deviceService.getStationData(stationIdx); // ← Call your service
      res.status(200).json(stationData); // ← Send back the data
    } catch (error) {
      if (error.message === 'Station does not exist') {
        return res.status(404).send({ error: error.message }); // ← 404 for not found
      }
      console.error('Error in GET /api/devices/stations/:stationIdx:', error);
      res.status(500).send({ error: 'An internal server error occurred.' });
    }
  }
);

module.exports = router;
