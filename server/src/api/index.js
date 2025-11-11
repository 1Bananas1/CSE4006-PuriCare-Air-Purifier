// index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');

// Import models
const User = require('./models/Users');
const Data = require('./models/Data');
const Device = require('./models/Device');
const AirQuality = require('./models/AirQuality');
const airQualityService = require('./services/airQuaityService');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MONGODB CONNECTION ==========
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    // Start scheduled jobs after DB connection
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ========== MIDDLEWARE ==========
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
});

// ========== JWT MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ========== HEALTH CHECK ==========
app.get('/health', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const dataCount = await Data.countDocuments();
    const deviceCount = await Device.countDocuments();

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      database:
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      users: userCount,
      dataItems: dataCount,
      devices: deviceCount,
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// ========== AUTHENTICATION ==========

// Register
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ error: 'Username, password, and email required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: 'Username or email already exists' });
    }

    // Create user (password will be hashed automatically by pre-save hook)
    const user = new User({ username, email, password });
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify token
app.get('/auth/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ valid: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER MANAGEMENT ==========

// Get all users (admin view - no passwords)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== DATA OPERATIONS ==========

// CREATE - Add data
app.post('/api/data', authenticateToken, async (req, res) => {
  try {
    const newData = new Data({
      userId: req.user.id,
      ...req.body,
    });
    await newData.save();
    res.status(201).json(newData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// READ - Get all user's data
app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const data = await Data.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// READ - Get single item
app.get('/api/data/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE - Modify data
app.put('/api/data/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Remove data
app.delete('/api/data/:id', authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Deleted successfully', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== DEVICE MANAGEMENT ==========

// Register a new device
app.post('/api/devices', authenticateToken, async (req, res) => {
  try {
    const { name, deviceId, location } = req.body;

    if (!name || !deviceId) {
      return res
        .status(400)
        .json({ error: 'Device name and deviceId required' });
    }

    // Check if device ID already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(409).json({ error: 'Device ID already registered' });
    }

    const device = new Device({
      userId: req.user.id,
      name,
      deviceId,
      location: location || {},
    });

    await device.save();
    res.status(201).json({
      message: 'Device registered successfully',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all user's devices
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single device
app.get('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update device
app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      message: 'Device updated successfully',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete device
app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Optionally delete associated air quality data
    await AirQuality.deleteMany({ deviceId: device._id });

    res.json({ message: 'Device deleted successfully', device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update device location
app.put('/api/devices/:id/location', authenticateToken, async (req, res) => {
  try {
    const { name, city, latitude, longitude } = req.body;

    if (!city && (!latitude || !longitude)) {
      return res.status(400).json({
        error: 'Provide either city name or latitude/longitude',
      });
    }

    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        $set: {
          'location.name': name,
          'location.city': city,
          'location.latitude': latitude,
          'location.longitude': longitude,
          'location.lastUpdated': new Date(),
        },
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      message: 'Device location updated successfully',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AIR QUALITY (Device-specific) ==========

// Get latest cached air quality for a specific device
app.get(
  '/api/devices/:id/airquality/latest',
  authenticateToken,
  async (req, res) => {
    try {
      // Verify device belongs to user
      const device = await Device.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const latestData = await AirQuality.findOne({
        deviceId: device._id,
      })
        .sort({ fetchedAt: -1 })
        .limit(1);

      if (!latestData) {
        return res.status(404).json({
          error: 'No air quality data found. Set device location first.',
        });
      }

      res.json(latestData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get air quality history for a specific device
app.get(
  '/api/devices/:id/airquality/history',
  authenticateToken,
  async (req, res) => {
    try {
      const { days = 7 } = req.query;

      // Verify device belongs to user
      const device = await Device.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const history = await AirQuality.find({
        deviceId: device._id,
        fetchedAt: { $gte: startDate },
      }).sort({ fetchedAt: -1 });

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get air quality for ALL user's devices (dashboard view)
app.get('/api/airquality/all', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.id });
    const deviceIds = devices.map((d) => d._id);

    const latestData = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const data = await AirQuality.findOne({ deviceId })
          .sort({ fetchedAt: -1 })
          .limit(1)
          .populate('deviceId', 'name location');
        return data;
      })
    );

    res.json(latestData.filter((d) => d !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger air quality fetch for a specific device
app.post(
  '/api/devices/:id/airquality/fetch',
  authenticateToken,
  async (req, res) => {
    try {
      // Verify device belongs to user
      const device = await Device.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const result = await airQualityService.updateDeviceAirQuality(device._id);

      if (!result) {
        return res.status(400).json({
          error:
            'Could not fetch air quality. Make sure device location is set.',
        });
      }

      res.json({
        message: 'Air quality data fetched successfully',
        data: result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Manually trigger update for all devices
app.post(
  '/api/admin/airquality/update-all',
  authenticateToken,
  async (req, res) => {
    try {
      const result = await airQualityService.updateAllDevicesAirQuality();
      res.json({
        message: 'Air quality update completed',
        ...result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ========== EXTERNAL API CALLS ==========

// Fetch air quality data (generic)
app.get(
  '/api/external/airquality/:city',
  authenticateToken,
  async (req, res) => {
    try {
      const { city } = req.params;
      const token = process.env.AQICN_TOKEN;

      const response = await axios.get(
        `https://api.waqi.info/feed/${city}/?token=${token}`
      );

      res.json(response.data);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch external data',
        message: error.message,
      });
    }
  }
);

// Generic external API proxy
app.post('/api/external/fetch', authenticateToken, async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, data } = req.body;

    const response = await axios({
      method,
      url,
      headers,
      data,
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch external data',
      message: error.message,
    });
  }
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 JWT authentication enabled`);
  console.log(`⏱️  Rate limiting active`);
  console.log(`📝 Request logging enabled`);
  console.log(`🍃 MongoDB integration active`);
});
