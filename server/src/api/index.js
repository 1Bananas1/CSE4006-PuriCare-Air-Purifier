require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');

const { db } = require('./config/firebase');
const { initializeDatabase, runMigrations } = require('./database/init');
const deviceRoutes = require('./routes/deviceRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const controlRoutes = require('./routes/controlRoutes');
const exportRoutes = require('./routes/exportRoutes');
const { runMidnightRoutine } = require('./scripts/midnightRoutine');
const { processNotifications } = require('./scripts/processNotifications');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3020;

// Configure allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CLIENT_URL,
  process.env.VERCEL_URL,
].filter(Boolean); // Remove undefined/null values

// CORS origin validation function
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// Initialize Socket.io
const io = new Server(server, {
  cors: corsOptions,
});

// Enable CORS for frontend
app.use(cors(corsOptions));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('PureCare API is running');
});

app.get('/health', async (req, res) => {
  try {
    // 'db' is imported directly
    const testDoc = await db.collection('_health').doc('test').get();

    res.json({
      status: 'healthy',
      service: 'PuriCare Firebase API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      firebase: 'connected',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Make io accessible to routes
app.set('io', io);

// ========== ROUTES ==========
// Device management routes (Firebase-based)
app.use('/api/devices', deviceRoutes);

// Sensor data routes (PostgreSQL-based)
app.use('/api/sensor-data', sensorRoutes);

// Device control routes
app.use('/api/control', controlRoutes);

// Data export routes
app.use('/api/export', exportRoutes);

// ========== WEBSOCKET HANDLERS ==========

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify Firebase token (optional for simulator)
    // For now, accept any token
    // TODO: Implement proper authentication

    next();
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log(`✅ WebSocket client connected: ${socket.id}`);

  // Join device-specific room
  socket.on('join_device', async (deviceId) => {
    try {
      // Verify device exists
      const deviceDoc = await db.collection('devices').doc(deviceId).get();

      if (!deviceDoc.exists) {
        socket.emit('error', { message: 'Device not found' });
        return;
      }

      socket.join(`device:${deviceId}`);
      console.log(`📱 Socket ${socket.id} joined room: device:${deviceId}`);

      socket.emit('joined_device', { deviceId });
    } catch (error) {
      console.error('Error joining device room:', error);
      socket.emit('error', { message: 'Failed to join device room' });
    }
  });

  // Leave device room
  socket.on('leave_device', (deviceId) => {
    socket.leave(`device:${deviceId}`);
    console.log(`📱 Socket ${socket.id} left room: device:${deviceId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ WebSocket client disconnected: ${socket.id}`);
  });
});

// ========== SCHEDULED TASKS ==========

/**
 * Midnight Routine Scheduler
 * Runs every hour to check for timezone-specific midnight windows
 * Refreshes outdoor AQI station data and creates pollution warnings
 */
cron.schedule('0 * * * *', async () => {
  console.log('\n⏰ [CRON] Running midnight routine check...');
  try {
    await runMidnightRoutine();
  } catch (error) {
    console.error('❌ [CRON] Midnight routine failed:', error);
  }
});

/**
 * Notification Processor
 * Runs every hour to send pending notifications during reasonable hours (8 AM - 9 PM)
 */
cron.schedule('15 * * * *', async () => {
  console.log('\n⏰ [CRON] Processing pending notifications...');
  try {
    await processNotifications();
  } catch (error) {
    console.error('❌ [CRON] Notification processing failed:', error);
  }
});

console.log('📅 Scheduled tasks initialized:');
console.log('   • Midnight routine: Every hour at :00');
console.log('   • Notifications: Every hour at :15');

// ========== INITIALIZE DATABASE & START SERVER ==========
async function startServer() {
  try {
    // Initialize PostgreSQL (optional - gracefully handles missing DATABASE_URL)
    const pool = initializeDatabase();

    if (pool) {
      console.log('🔧 Running database migrations...');
      await runMigrations();
    } else {
      console.warn('⚠️  Sensor data features disabled - DATABASE_URL not set');
      console.warn('   To enable: Set DATABASE_URL environment variable');
    }

    // Start HTTP + WebSocket server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
