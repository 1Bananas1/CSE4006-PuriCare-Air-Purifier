const express = require('express');
const { initializeFirebase } = require('../config/firebase');
const userService = require('../services/userService');
const { authenticateFirebaseToken } = require('../middleware/auth');

const router = express.Router();

// Register a new user
// Note: Client should use Firebase Auth SDK to create user, then call this endpoint
router.post('/register', async (req, res) => {
  try {
    const { uid, email, username } = req.body;

    if (!uid || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'UID and email are required',
      });
    }

    // Check if user already exists in Firestore
    const existingUser = await userService.getUserByUid(uid);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists',
      });
    }

    // Create user document in Firestore
    const user = await userService.createUser(uid, { email, username });

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// Get current user profile
router.get('/me', authenticateFirebaseToken, async (req, res) => {
  try {
    const user = await userService.getUserByUid(req.user.uid);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User profile not found',
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// Update user profile
router.put('/me', authenticateFirebaseToken, async (req, res) => {
  try {
    const { username } = req.body;

    const updates = {};
    if (username) updates.username = username;

    const updatedUser = await userService.updateUser(req.user.uid, updates);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// Verify token endpoint
router.get('/verify', authenticateFirebaseToken, async (req, res) => {
  try {
    const user = await userService.getUserByUid(req.user.uid);

    res.json({
      valid: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.emailVerified,
        ...user,
      },
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// Delete user account
router.delete('/me', authenticateFirebaseToken, async (req, res) => {
  try {
    await userService.deleteUser(req.user.uid);

    res.json({
      message: 'User account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

// Create custom token (for server-side authentication)
router.post('/custom-token', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'UID is required',
      });
    }

    const { auth } = initializeFirebase();
    const customToken = await auth.createCustomToken(uid);

    res.json({
      token: customToken,
    });
  } catch (error) {
    console.error('Create custom token error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

module.exports = router;
