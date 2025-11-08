require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Initialize Firebase
const { initializeFirebase } = require('./config/firebase');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.FIREBASE_API_PORT || 3001;

// ========== INITIALIZE FIREBASE ==========
try {
  initializeFirebase();
  console.log('🔥 Firebase initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

// ========== MIDDLEWARE ==========
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api', limiter);
app.use('/auth', authLimiter);

// ========== HEALTH CHECK ==========
app.get('/health', async (req, res) => {
  try {
    const { db } = initializeFirebase();

    // Try to read from Firestore to verify connection
    const testDoc = await db.collection('_health').doc('test').get();

    res.json({
      status: 'healthy',
      service: 'PuriCare Firebase API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      firebase: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ========== ROUTES ==========
app.use('/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/data', dataRoutes);

// ========== EXTERNAL API INTEGRATION (Optional) ==========
// Keep your external API calls if needed
const axios = require('axios');
const { authenticateFirebaseToken } = require('./middleware/auth');

// Fetch air quality data from external API
app.get('/api/external/airquality/:city', authenticateFirebaseToken, async (req, res) => {
  try {
    const { city } = req.params;
    const token = process.env.AQICN_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'Air quality API token not configured'
      });
    }

    const response = await axios.get(
      `https://api.waqi.info/feed/${city}/?token=${token}`
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: 'External API Error',
      message: error.message
    });
  }
});

// Generic external API proxy
app.post('/api/external/fetch', authenticateFirebaseToken, async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, data } = req.body;

    const response = await axios({
      method,
      url,
      headers,
      data
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: 'External API Error',
      message: error.message
    });
  }
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.path
  });
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 PuriCare Firebase API Server');
  console.log('='.repeat(50));
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Firebase Authentication enabled`);
  console.log(`🗄️  Firestore database connected`);
  console.log(`⏱️  Rate limiting active`);
  console.log(`📝 Request logging enabled`);
  console.log('='.repeat(50));
});

module.exports = app;
