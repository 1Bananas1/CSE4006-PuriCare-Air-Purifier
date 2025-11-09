require("dotenv").config();
const express = require("express");

const { db } = require("./config/firebase");
const deviceRoutes = require("./routes/deviceRoutes");

const app = express();
const PORT = process.env.PORT || 3020;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("PureCare API is running");
});

app.get("/health", async (req, res) => {
  try {
    // 'db' is imported directly
    const testDoc = await db.collection("_health").doc("test").get();

    res.json({
      status: "healthy",
      service: "PuriCare Firebase API",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      firebase: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// ========== ROUTES ==========
// 3. Plug in your device routes under the '/api/devices' path
// This means the '/register' route in deviceRoutes.js
// is now reachable at: POST /api/devices/register
app.use("/api/devices", deviceRoutes);

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
