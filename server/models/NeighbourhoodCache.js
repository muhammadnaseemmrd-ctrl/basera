const mongoose = require("mongoose");

const neighbourhoodCacheSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    lat: Number,
    lng: Number,
    radius: Number,
    score: Number,
    categoryScores: Object,
    pois: [Object],
    fetchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

neighbourhoodCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("NeighbourhoodCache", neighbourhoodCacheSchema);
