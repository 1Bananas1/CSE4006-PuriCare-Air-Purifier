const express = require('express');
const router = express.Router();

const { authenticateFirebaseToken } = require('../middleware/auth');
const { writeLimiter, generalLimiter } = require('../middleware/rateLimiter');
const { db } = require('../config/firebase');

/**
 * POST /api/users/fcm-token
 * Register or update a user's FCM token
 */

router.post(
  '/fcm-token',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          error: 'Invalid FCM token. Token must be a non-empty string.',
        });
      }

      //update user doc with FCM token
      await db.collection('users').doc(userId).set(
        {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date(),
        },
        { merge: true }
      );
      console.log(`FCM token registered for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'FCM token registered successfully',
      });
    } catch (error) {
      console.error('Error registering FCM token:', error);
      res.status(500).json({ error: 'Failed to register FCM token' });
    }
  }
);

/**
 * DELETE /api/users/fcm-token
 * Remove user's FCM token when permission revoked
 */
router.delete(
  '/fcm-token',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;

      await db.collection('users').doc(userId).update({
        fcmToken: null,
        fcmTokenUpdatedAt: new Date(),
      });

      console.log(`FCM token removed for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'FCM token removed successfully',
      });
    } catch (error) {
      console.error('Error removing FCM token:', error);
      res.status(500).json({ error: 'Failed to remove FCM token' });
    }
  }
);

/**
 * GET /api/users/notification-preferences
 * Get user's notification preferences
 */
router.get(
  '/notification-preferences',
  generalLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const preferences = userData.notificationPreferences || {
        enabled: true,
        pollutionWarnings: true,
        maintenanceReminders: true,
        deviceOffline: true,
        filterReplacementDue: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        pushNotifications: true,
        inAppNotifications: true,
      };

      res.status(200).json({
        success: true,
        preferences,
      });
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res
        .status(500)
        .json({ error: 'Failed to fetch notification preferences' });
    }
  }
);

/**
 * PUT /api/users/notification-preferences
 * Update user's notification preferences
 */
router.put(
  '/notification-preferences',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const preferences = req.body;

      // Validate preferences object
      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'Invalid preferences object' });
      }

      // Update user document
      await db.collection('users').doc(userId).set(
        {
          notificationPreferences: preferences,
        },
        { merge: true }
      );

      console.log(`Notification preferences updated for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Notification preferences updated successfully',
        preferences,
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res
        .status(500)
        .json({ error: 'Failed to update notification preferences' });
    }
  }
);

module.exports = router;
