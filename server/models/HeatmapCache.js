const mongoose = require("mongoose");

const heatmapCacheSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    city: String,
    type: String,
    filters: Object,
    points: [Object],
    fetchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

heatmapCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 15 * 60 });

module.exports = mongoose.model("HeatmapCache", heatmapCacheSchema);
