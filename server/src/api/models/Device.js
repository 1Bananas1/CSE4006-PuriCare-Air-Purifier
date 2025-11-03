// models/Device.js
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    deviceId: {
      type: String,
      unique: true,
      required: true,
    },
    location: {
      name: String, // "Living Room", "Bedroom", etc.
      city: String,
      latitude: Number,
      longitude: Number,
      lastUpdated: Date,
    },
    settings: {
      autoMode: { type: Boolean, default: true },
      fanSpeed: { type: Number, default: 1 },
      sensitivity: { type: Number, default: 2 },
    },
    status: {
      online: { type: Boolean, default: false },
      lastSeen: Date,
    },
  },
  {
    timestamps: true,
  }
);

deviceSchema.index({ userId: 1 });
deviceSchema.index({ deviceId: 1 });

module.exports = mongoose.model("Device", deviceSchema);
