require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3020;

const { initializeFirebase } = require("./config/firebase");

try {
  initializeFirebase();
  console.log("🔥 Firebase initialized");
} catch (error) {
  console.error("❌ Failed to initialize Firebase:", error);
  process.exit(1);
}
app.use(express.json());

app.get("/", (req, res) => {
  res.send("PureCare API is running");
});

app.get("/health", async (req, res) => {
  try {
    const { db } = initializeFirebase();

    // Try to read from Firestore to verify connection
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

