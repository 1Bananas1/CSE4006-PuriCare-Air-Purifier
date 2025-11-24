/**
 * Room Routes
 * API endpoints for room graph management
 */

const express = require('express');
const router = express.Router();
const { authenticateFirebaseToken } = require('../middleware/auth');
const roomService = require('../services/roomService');

// ========== ROOM ENDPOINTS ==========

/**
 * GET /api/rooms
 * Get all rooms for authenticated user
 */
router.get('/', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('🔍 GET /api/rooms called');
    console.log('✅ User authenticated - UID:', userId);

    const rooms = await roomService.getRoomsByUser(userId);
    console.log(`📦 Rooms found: ${rooms.length}`);

    res.status(200).json({ rooms });
  } catch (error) {
    console.error('Error in GET /api/rooms:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 * Body: { name, position: { x, y }, deviceIds: [] }
 */
router.post('/', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const roomData = req.body;

    console.log('🏗️  POST /api/rooms called');
    console.log('Room data:', roomData);

    const newRoomId = await roomService.createRoom(userId, roomData);

    res.status(201).json({
      success: true,
      roomId: newRoomId,
      message: 'Room created successfully',
    });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('Valid')) {
      return res.status(400).send({ error: error.message });
    }
    console.error('Error in POST /api/rooms:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * PATCH /api/rooms/:roomId
 * Update a room
 * Body: { name?, position?, deviceIds? }
 */
router.patch('/:roomId', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const roomId = req.params.roomId;
    const updates = req.body;

    console.log(`📝 PATCH /api/rooms/${roomId} called`);

    await roomService.updateRoom(userId, roomId, updates);

    res.status(200).json({
      success: true,
      message: 'Room updated successfully',
    });
  } catch (error) {
    if (error.message === 'Room not found') {
      return res.status(404).send({ error: error.message });
    }
    if (error.message === 'Not authorized to update this room') {
      return res.status(403).send({ error: error.message });
    }
    if (error.message.includes('cannot be empty')) {
      return res.status(400).send({ error: error.message });
    }
    console.error('Error in PATCH /api/rooms/:roomId:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * DELETE /api/rooms/:roomId
 * Delete a room and its connected edges
 */
router.delete('/:roomId', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const roomId = req.params.roomId;

    console.log(`🗑️  DELETE /api/rooms/${roomId} called`);

    await roomService.deleteRoom(userId, roomId);

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Room not found') {
      return res.status(404).send({ error: error.message });
    }
    if (error.message === 'Not authorized to delete this room') {
      return res.status(403).send({ error: error.message });
    }
    console.error('Error in DELETE /api/rooms/:roomId:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

// ========== EDGE ENDPOINTS ==========

/**
 * GET /api/rooms/edges
 * Get all edges (connections) for authenticated user
 */
router.get('/edges', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('🔍 GET /api/rooms/edges called');

    const edges = await roomService.getEdgesByUser(userId);
    console.log(`📦 Edges found: ${edges.length}`);

    res.status(200).json({ edges });
  } catch (error) {
    console.error('Error in GET /api/rooms/edges:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * POST /api/rooms/edges
 * Create a new edge between two rooms
 * Body: { sourceRoomId, targetRoomId, type: "door" | "airflow" }
 */
router.post('/edges', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const edgeData = req.body;

    console.log('🔗 POST /api/rooms/edges called');
    console.log('Edge data:', edgeData);

    const newEdgeId = await roomService.createEdge(userId, edgeData);

    res.status(201).json({
      success: true,
      edgeId: newEdgeId,
      message: 'Edge created successfully',
    });
  } catch (error) {
    if (
      error.message.includes('required') ||
      error.message.includes('must be') ||
      error.message.includes('Cannot create')
    ) {
      return res.status(400).send({ error: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).send({ error: error.message });
    }
    if (error.message.includes('Not authorized')) {
      return res.status(403).send({ error: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).send({ error: error.message });
    }
    console.error('Error in POST /api/rooms/edges:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * PATCH /api/rooms/edges/:edgeId
 * Update edge type (door <-> airflow)
 * Body: { type: "door" | "airflow" }
 */
router.patch('/edges/:edgeId', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const edgeId = req.params.edgeId;
    const updates = req.body;

    console.log(`📝 PATCH /api/rooms/edges/${edgeId} called`);

    await roomService.updateEdge(userId, edgeId, updates);

    res.status(200).json({
      success: true,
      message: 'Edge updated successfully',
    });
  } catch (error) {
    if (error.message === 'Edge not found') {
      return res.status(404).send({ error: error.message });
    }
    if (error.message === 'Not authorized to update this edge') {
      return res.status(403).send({ error: error.message });
    }
    if (error.message.includes('must be')) {
      return res.status(400).send({ error: error.message });
    }
    console.error('Error in PATCH /api/rooms/edges/:edgeId:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

/**
 * DELETE /api/rooms/edges/:edgeId
 * Delete an edge
 */
router.delete('/edges/:edgeId', authenticateFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const edgeId = req.params.edgeId;

    console.log(`🗑️  DELETE /api/rooms/edges/${edgeId} called`);

    await roomService.deleteEdge(userId, edgeId);

    res.status(200).json({
      success: true,
      message: 'Edge deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Edge not found') {
      return res.status(404).send({ error: error.message });
    }
    if (error.message === 'Not authorized to delete this edge') {
      return res.status(403).send({ error: error.message });
    }
    console.error('Error in DELETE /api/rooms/edges/:edgeId:', error);
    res.status(500).send({ error: 'An internal server error occurred.' });
  }
});

module.exports = router;
