const mongoose = require("mongoose");

const airQualitySchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      name: String,
      city: String,
      latitude: Number,
      longitude: Number,
    },
    data: {
      aqi: Number,
      pm25: Number,
      pm10: Number,
      o3: Number,
      no2: Number,
      so2: Number,
      co: Number,
      dominentpol: String,
      temperature: Number,
      humidity: Number,

      raw: mongoose.Schema.Types.Mixed,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

airQualitySchema.index({ deviceId: 1, fetchedAt: -1 });
airQualitySchema.index({ userId: 1, fetchedAt: -1 });

module.exports = mongoose.model("AirQuality", airQualitySchema);
