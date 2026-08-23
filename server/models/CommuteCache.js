const mongoose = require("mongoose");

const commuteCacheSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    from: Object,
    to: Object,
    profile: String,
    distanceMeters: Number,
    durationSeconds: Number,
    geometry: [[Number]],
    fetchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

commuteCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("CommuteCache", commuteCacheSchema);
