const mongoose = require("mongoose");

const savedRouteSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    title: String,
    mode: { type: String, enum: ["walking", "driving", "cycling"], default: "walking" },
    waypoints: [Object],
    totalDistanceKm: Number,
    totalDurationMin: Number,
    shareCode: { type: String, index: true },
    createdByName: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("SavedRoute", savedRouteSchema);
