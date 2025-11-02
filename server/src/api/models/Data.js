const mongoose = require("mongoose");

const dataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    content: mongoose.Schema.Types.Mixed,
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("Data", dataSchema);
