const mongoose = require("mongoose");

const mapAnalyticsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    city: { type: String, index: true },
    bboxHash: String,
    layer: { type: String, index: true },
    searchCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    waitlistCount: { type: Number, default: 0 },
    demandScore: { type: Number, default: 0 },
    points: [mongoose.Schema.Types.Mixed],
    expiresAt: { type: Date, index: { expires: 0 } }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MapAnalytics", mapAnalyticsSchema);
