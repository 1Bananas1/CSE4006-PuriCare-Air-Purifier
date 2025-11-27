/**
 * Room Service - Handles room graph management
 * Manages rooms, room connections (edges), and device assignments
 */

const { db } = require('../config/firebase');

/**
 * Get all rooms for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of room objects
 */

async function getRoomsByUser(userId) {
  try {
    const roomsSnapshot = await db
      .collection('rooms')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const rooms = [];
    roomsSnapshot.forEach((doc) => {
      const data = doc.data();
      rooms.push({
        id: doc.id,
        name: data.name,
        userId: data.userId,
        position: data.position,
        deviceIds: data.deviceIds || [],
        sensors: data.sensors || {
          avgPm25: 0,
          avgPm10: 0,
          avgVoc: 0,
          avgCo2: 0,
          avgTemperature: 0,
          avgHumidity: 0,
        },
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      });
    });
    return rooms;
  } catch (error) {
    console.error('Error getting rooms:', error);
    throw error;
  }
}

/**
 * Create a new room
 * @param {string} userId - User ID
 * @param {Object} roomData - Room data { name, position, deviceIds }
 * @returns {Promise<string>} New room ID
 */
async function createRoom(userId, roomData) {
  const { name, position, deviceIds } = roomData;

  if (!name || !name.trim()) {
    throw new Error('Room name is required');
  }
  if (
    !position ||
    typeof position.x !== 'number' ||
    typeof position.y !== 'number'
  ) {
    throw new Error('Valid position with x and y coordinates is required');
  }
  try {
    let sensors = {
      avgPm25: 0,
      avgPm10: 0,
      avgVoc: 0,
      avgCo2: 0,
      avgTemperature: 0,
      avgHumidity: 0,
    };

    if (deviceIds && deviceIds.length > 0) {
      sensors = await calculateRoomSensorAverages(deviceIds);
    }

    const roomPayload = {
      userId: userId,
      name: name.trim(),
      position: position,
      deviceIds: deviceIds || [],
      sensors: sensors,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const roomRef = await db.collection('rooms').add(roomPayload);

    console.log(`✅ Room created: ${roomRef.id} for user ${userId}`);
    return roomRef.id;
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

/**
 * Update an existing room
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
async function updateRoom(userId, roomId, updates) {
  if (!roomId) {
    throw new Error('Room ID is required!');
  }
  try {
    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      throw new Error('Room not found');
    }

    const roomData = roomDoc.data();
    if (roomData.userId !== userId) {
      throw new Error('Not authorized to update this room');
    }

    const allowedUpdates = {};

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        throw new Error('Room name cannot be empty');
      }
      allowedUpdates.name = updates.name.trim();
    }

    if (updates.position !== undefined) {
      allowedUpdates.position = updates.position;
    }

    if (updates.deviceIds !== undefined) {
      allowedUpdates.deviceIds = updateEdge.deviceIds;
      allowedUpdates.sensors = await calculateRoomSensorAverages(
        updates.deviceIds
      );
    }

    allowedUpdates.updatedAt = new Date();

    await roomRef.update(allowedUpdates);
    console.log(`Room ${roomId} updated`);
  } catch (error) {
    console.error('Error updating room', error);
    throw error;
  }
}

/**
 * Delete a room and its associated edges
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 * @returns {Promise<void>}
 */
async function deleteRoom(userId, roomId) {
  if (!roomId) {
    throw new Error('Room ID is required');
  }

  try {
    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      throw new Error('Room not found');
    }

    const roomData = roomDoc.data();
    if (roomData.userId !== userId) {
      throw new Error('Not authorized to delete this room');
    }

    await db.runTransaction(async (t) => {
      t.delete(roomRef);
      const edgeSnapshots = await db
        .collection('room_edges')
        .where('userId', '==', userId)
        .get();
      edgeSnapshots.forEach((doc) => {
        const edge = doc.data();
        if (edge.sourceRoomId === roomId || edge.targetRoomId === roomId) {
          t.delete(doc.ref);
        }
      });
    });
    console.log(`Room ${roomId} deleted!`);
  } catch (error) {
    console.error('Error deleting room', error);
    throw error;
  }
}

/**
 * Get all edges for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of edge objects
 */
async function getEdgesByUser(userId) {
  try {
    const edgesSnapshot = await db
      .collection('room_edges')
      .where('userId', '==', userId)
      .get();
    const edges = [];
    edgesSnapshot.forEach((doc) => {
      const data = doc.data();
      edges.push({
        id: doc.id,
        userId: doc.userId,
        sourceRoomId: doc.sourceRoomId,
        targetRoomId: doc.targetRoomId,
        type: doc.type,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });
    return edges;
  } catch (error) {
    console.error('Error getting edges:', error);
    throw error;
  }
}

/**
 * Create a new edge between two rooms
 * @param {string} userId - User ID
 * @param {Object} edgeData - Edge data { sourceRoomId, targetRoomId, type }
 * @returns {Promise<string>} New edge ID
 */
async function createEdge(userId, edgeData) {
  const { sourceRoomId, targetRoomId, type } = edgeData;
  if (!sourceRoomId || !targetRoomId) {
    throw new Error('Source and target room are required');
  }
  if (sourceRoomId === targetRoomId) {
    throw new Error('Source cannot be the same as target');
  }
  if (!['door', 'airflow'].includes(type)) {
    // If we want more types say here
    throw new Error('Edge must be "door" or "airflow"');
  }
  try {
    const [sourceDoc, targetDoc] = await Promise.all([
      db.collection('rooms').doc(sourceRoomId).get(),
      db.collection('rooms').doc(targetRoomId).get(),
    ]);

    if (!sourceDoc.exists) {
      throw new Error('Source room not found');
    }
    if (!targetDoc.exists) {
      throw new Error('Target room not found');
    }
    if (
      sourceDoc.data().userId != userId ||
      targetDoc.data().userId !== userId
    ) {
      throw new Error('Not authorized to create an edge between these rooms');
    }
    const existingEdge = await db
      .collection('room_edges')
      .where('userId', '==', userId)
      .where('sourceRoomId', '==', sourceRoomId)
      .where('targetRoomId', '==', targetRoomId)
      .get();
    if (!existingEdge.empty) {
      throw new Error('Edge already exists between these rooms');
    }
    const edgePayload = {
      userId: userId,
      sourceRoomId: sourceRoomId,
      targetRoomId: targetRoomId,
      type: type,
      createdAt: new Date(),
    };
    const edgeRef = await db.collection('room_edges').add(edgePayload);
    console.log(`Edge created: ${edgeRef.id}`);
    return edgeRef.id;
  } catch (error) {
    console.error('Error created edge:', error);
    throw error;
  }
}

/**
 * Helper: Calculate average sensor values for rooms with devices
 * @param {Array<string>} deviceIds - Array of device IDs
 * @returns {Promise<Object>} Sensor averages
 */
async function calculateRoomSensorAverages(deviceIds) {
  if (!deviceIds || deviceIds.length === 0) {
    return {
      avgPm25: 0,
      avgPm10: 0,
      avgVoc: 0,
      avgCo2: 0,
      avgTemperature: 0,
      avgHumidity: 0,
    };
  }

  try {
    // Fetch all devices
    const devicePromises = deviceIds.map((id) =>
      db.collection('devices').doc(id).get()
    );
    const deviceDocs = await Promise.all(devicePromises);

    let sum = {
      pm25: 0,
      pm10: 0,
      voc: 0,
      co2: 0,
      temp: 0,
      humidity: 0,
    };
    let count = 0;

    deviceDocs.forEach((doc) => {
      if (doc.exists) {
        const device = doc.data();
        const measurements = device.data?.measurements || {};

        if (measurements.PM25 !== undefined) sum.pm25 += measurements.PM25;
        if (measurements.PM10 !== undefined) sum.pm10 += measurements.PM10;
        if (measurements.TVOC !== undefined) sum.voc += measurements.TVOC;
        if (measurements.CO2 !== undefined) sum.co2 += measurements.CO2;
        if (measurements.TEMP !== undefined) sum.temp += measurements.TEMP;
        if (measurements.RH !== undefined) sum.humidity += measurements.RH;
        count++;
      }
    });

    if (count === 0) {
      return {
        avgPm25: 0,
        avgPm10: 0,
        avgVoc: 0,
        avgCo2: 0,
        avgTemperature: 0,
        avgHumidity: 0,
      };
    }

    return {
      avgPm25: Math.round(sum.pm25 / count),
      avgPm10: Math.round(sum.pm10 / count),
      avgVoc: Math.round(sum.voc / count),
      avgCo2: Math.round(sum.co2 / count),
      avgTemperature: Math.round((sum.temp / count) * 10) / 10,
      avgHumidity: Math.round(sum.humidity / count),
    };
  } catch (error) {
    console.error('Error calculating sensor averages:', error);
    // Return zeros on error rather than failing
    return {
      avgPm25: 0,
      avgPm10: 0,
      avgVoc: 0,
      avgCo2: 0,
      avgTemperature: 0,
      avgHumidity: 0,
    };
  }
}
/**
 * Update an edge (change type between door/airflow)
 * @param {string} userId - User ID
 * @param {string} edgeId - Edge ID
 * @param {Object} updates - Fields to update (type)
 * @returns {Promise<void>}
 */
async function updateEdge(userId, edgeId, updates) {
  if (!edgeId) {
    throw new Error('Edge ID is required');
  }

  try {
    const edgeRef = db.collection('room_edges').doc(edgeId);
    const edgeDoc = await edgeRef.get();

    // Check if edge exists
    if (!edgeDoc.exists) {
      throw new Error('Edge not found');
    }

    // Verify ownership
    const edgeData = edgeDoc.data();
    if (edgeData.userId !== userId) {
      throw new Error('Not authorized to update this edge');
    }

    // Validate type if provided
    if (updates.type !== undefined) {
      if (!['door', 'airflow'].includes(updates.type)) {
        throw new Error('Edge type must be "door" or "airflow"');
      }
    }

    const allowedUpdates = {};
    if (updates.type !== undefined) {
      allowedUpdates.type = updates.type;
    }
    allowedUpdates.updatedAt = new Date();

    await edgeRef.update(allowedUpdates);
    console.log(`✅ Edge updated: ${edgeId}`);
  } catch (error) {
    console.error('Error updating edge:', error);
    throw error;
  }
}

/**
 * Delete an edge
 * @param {string} userId - User ID
 * @param {string} edgeId - Edge ID
 * @returns {Promise<void>}
 */
async function deleteEdge(userId, edgeId) {
  if (!edgeId) {
    throw new Error('Edge ID is required');
  }

  try {
    const edgeRef = db.collection('room_edges').doc(edgeId);
    const edgeDoc = await edgeRef.get();

    if (!edgeDoc.exists) {
      throw new Error('Edge not found');
    }

    const edgeData = edgeDoc.data();
    if (edgeData.userId !== userId) {
      throw new Error('Not authorized to delete this edge');
    }

    await edgeRef.delete();
    console.log(`✅ Edge deleted: ${edgeId}`);
  } catch (error) {
    console.error('Error deleting edge:', error);
    throw error;
  }
}

module.exports = {
  getRoomsByUser,
  createRoom,
  updateRoom,
  deleteRoom,
  getEdgesByUser,
  createEdge,
  updateEdge,
  deleteEdge,
};
