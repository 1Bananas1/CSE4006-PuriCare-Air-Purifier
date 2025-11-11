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

module.exports = router;
