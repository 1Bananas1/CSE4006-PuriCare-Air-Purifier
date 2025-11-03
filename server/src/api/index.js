// Import Device model at the top
const Device = require("./models/Device");

// ========== DEVICE MANAGEMENT ==========

// Register a new device
app.post("/api/devices", authenticateToken, async (req, res) => {
  try {
    const { name, deviceId, location } = req.body;

    if (!name || !deviceId) {
      return res
        .status(400)
        .json({ error: "Device name and deviceId required" });
    }

    // Check if device ID already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(409).json({ error: "Device ID already registered" });
    }

    const device = new Device({
      userId: req.user.id,
      name,
      deviceId,
      location: location || {},
    });

    await device.save();
    res.status(201).json({
      message: "Device registered successfully",
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all user's devices
app.get("/api/devices", authenticateToken, async (req, res) => {
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
app.get("/api/devices/:id", authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update device
app.put("/api/devices/:id", authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({
      message: "Device updated successfully",
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete device
app.delete("/api/devices/:id", authenticateToken, async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Optionally delete associated air quality data
    await AirQuality.deleteMany({ deviceId: device._id });

    res.json({ message: "Device deleted successfully", device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update device location
app.put("/api/devices/:id/location", authenticateToken, async (req, res) => {
  try {
    const { name, city, latitude, longitude } = req.body;

    if (!city && (!latitude || !longitude)) {
      return res.status(400).json({
        error: "Provide either city name or latitude/longitude",
      });
    }

    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        $set: {
          "location.name": name,
          "location.city": city,
          "location.latitude": latitude,
          "location.longitude": longitude,
          "location.lastUpdated": new Date(),
        },
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({
      message: "Device location updated successfully",
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== AIR QUALITY (Device-specific) ==========

// Get latest cached air quality for a specific device
app.get(
  "/api/devices/:id/airquality/latest",
  authenticateToken,
  async (req, res) => {
    try {
      // Verify device belongs to user
      const device = await Device.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const latestData = await AirQuality.findOne({ deviceId: device._id })
        .sort({ fetchedAt: -1 })
        .limit(1);

      if (!latestData) {
        return res.status(404).json({
          error: "No air quality data found. Set device location first.",
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
  "/api/devices/:id/airquality/history",
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
        return res.status(404).json({ error: "Device not found" });
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
app.get("/api/airquality/all", authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.id });
    const deviceIds = devices.map((d) => d._id);

    const latestData = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const data = await AirQuality.findOne({ deviceId })
          .sort({ fetchedAt: -1 })
          .limit(1)
          .populate("deviceId", "name location");
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
  "/api/devices/:id/airquality/fetch",
  authenticateToken,
  async (req, res) => {
    try {
      // Verify device belongs to user
      const device = await Device.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      const result = await airQualityService.updateDeviceAirQuality(device._id);

      if (!result) {
        return res.status(400).json({
          error:
            "Could not fetch air quality. Make sure device location is set.",
        });
      }

      res.json({
        message: "Air quality data fetched successfully",
        data: result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin: Manually trigger update for all devices
app.post(
  "/api/admin/airquality/update-all",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await airQualityService.updateAllDevicesAirQuality();
      res.json({
        message: "Air quality update completed",
        ...result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
