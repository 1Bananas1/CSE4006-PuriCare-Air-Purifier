require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const helmet = require("helmet");
const mongoose = require("mongoose");

const User = require("./models/Users");
const Data = require("./models/Data");

const app = express();
const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 attempts per 15 minutes
  message: "Too many login attempts, please try again later.",
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

app.get("/health", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const dataCount = await Data.countDocuments();

    res.json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      users: userCount,
      dataItems: dataCount,
    });
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

app.post("/auth/register", authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res
        .status(400)
        .json({ error: "Username, password, and email required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }

    // Create user (password will be hashed automatically by pre-save hook)
    const user = new User({ username, email, password });
    await user.save();

    res.status(201).json({
      message: "User created successfully",
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

app.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
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

app.get("/auth/verify", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ valid: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/data", authenticateToken, async (req, res) => {
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

app.get("/api/data", authenticateToken, async (req, res) => {
  try {
    const data = await Data.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/data/:id", authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/data/:id", authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/data/:id", authenticateToken, async (req, res) => {
  try {
    const item = await Data.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Deleted successfully", item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(
  "/api/external/airquality/:city",
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
        error: "Failed to fetch external data",
        message: error.message,
      });
    }
  }
);

app.post("/api/external/fetch", authenticateToken, async (req, res) => {
  try {
    const { url, method = "GET", headers = {}, data } = req.body;

    const response = await axios({
      method,
      url,
      headers,
      data,
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch external data",
      message: error.message,
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 JWT authentication enabled`);
  console.log(`⏱️  Rate limiting active`);
  console.log(`📝 Request logging enabled`);
  console.log(`🍃 MongoDB integration active`);
});
