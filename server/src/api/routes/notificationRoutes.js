const express = require('express');
const router = express.Router();

const { authenticateFirebaseToken } = require('../middleware/auth');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiter');
const { db } = require('../config/firebase');

/**
 * GET /api/notifications
 * Get user's notifications (inbox notifications)
 * Query params:
 *   - limit: number of notifications (default: 100, max: 100)
 *   - unreadOnly: boolean - only return unread notifications
 */
router.get('/', generalLimiter, authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    // Query user's inbox notifications
    let query = db
      .collection('users')
      .doc(userId)
      .collection('inboxNotifications')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.where('read', '==', false);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        notifications: [],
        count: 0,
      });
    }

    // Map notifications with IDs
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
    }));

    res.status(200).json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const notificationId = req.params.id;

      const notificationRef = db
        .collection('users')
        .doc(userId)
        .collection('inboxNotifications')
        .doc(notificationId);

      const notificationDoc = await notificationRef.get();

      if (!notificationDoc.exists) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Mark as read
      await notificationRef.update({
        read: true,
        readAt: new Date(),
      });

      console.log(
        `✓ Notification ${notificationId} marked as read for user ${userId}`
      );

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }
);

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch(
  '/read-all',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;

      // Get all unread notifications
      const unreadSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('inboxNotifications')
        .where('read', '==', false)
        .get();

      if (unreadSnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: 'No unread notifications',
          count: 0,
        });
      }

      // batch update all to read
      const batch = db.batch();
      const now = new Date();

      unreadSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
          readAt: now,
        });
      });

      await batch.commit();

      console.log(
        `✓ Marked ${unreadSnapshot.size} notifications as read for user ${userId}`
      );

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        count: unreadSnapshot.size,
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res
        .status(500)
        .json({ error: 'Failed to mark all notifications as read' });
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * delete notification
 */
router.delete(
  '/:id',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;
      const notificationId = req.params.id;

      const notificationRef = db
        .collection('users')
        .doc(userId)
        .collection('inboxNotifications')
        .doc(notificationId);

      const notificationDoc = await notificationRef.get();

      if (!notificationDoc.exists) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Delete the notification
      await notificationRef.delete();

      console.log(
        `✓ Notification ${notificationId} deleted for user ${userId}`
      );

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }
);

/**
 * DELETE /api/notifications
 * delete all read notifications (cleanup)
 */
router.delete(
  '/',
  writeLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;

      // Get all read notifications
      const readSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('inboxNotifications')
        .where('read', '==', true)
        .get();

      if (readSnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: 'No read notifications to delete',
          count: 0,
        });
      }

      // Batch delete
      const batch = db.batch();
      readSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(
        `✓ Deleted ${readSnapshot.size} read notifications for user ${userId}`
      );

      res.status(200).json({
        success: true,
        message: 'All read notifications deleted',
        count: readSnapshot.size,
      });
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      res.status(500).json({ error: 'Failed to delete read notifications' });
    }
  }
);

/**
 * GET /api/notifications/unread-count
 * get count of unread notifications
 */
router.get(
  '/unread-count',
  generalLimiter,
  authenticateFirebaseToken,
  async (req, res) => {
    try {
      const userId = req.user.uid;

      const unreadSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('inboxNotifications')
        .where('read', '==', false)
        .get();

      res.status(200).json({
        success: true,
        count: unreadSnapshot.size,
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }
);

module.exports = router;
