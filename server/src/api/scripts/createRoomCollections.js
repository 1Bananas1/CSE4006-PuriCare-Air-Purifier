// server/src/api/scripts/createRoomCollections.js
const { db } = require('../config/firebase');

async function initializeRoomCollections() {
  console.log('🏗️  Initializing room collections...');

  // Create sample room document (will auto-create collection)
  const sampleRoom = {
    id: 'sample_room',
    userId: 'system',
    name: 'Sample Room',
    position: { x: 0, y: 0 },
    deviceIds: [],
    sensors: {
      avgPm25: 0,
      avgPm10: 0,
      avgVoc: 0,
      avgCo2: 0,
      avgTemperature: 0,
      avgHumidity: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('rooms').doc('sample_room').set(sampleRoom);
  console.log('✅ Created rooms collection');

  // Create sample edge
  const sampleEdge = {
    id: 'sample_edge',
    userId: 'system',
    sourceRoomId: 'sample_room',
    targetRoomId: 'sample_room',
    type: 'door',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('room_edges').doc('sample_edge').set(sampleEdge);
  console.log('✅ Created room_edges collection');

  // Delete samples (optional)
  await db.collection('rooms').doc('sample_room').delete();
  await db.collection('room_edges').doc('sample_edge').delete();
  console.log('🧹 Cleaned up sample documents');
}

initializeRoomCollections()
  .then(() => {
    console.log('✅ Room collections initialized');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed to initialize:', err);
    process.exit(1);
  });
