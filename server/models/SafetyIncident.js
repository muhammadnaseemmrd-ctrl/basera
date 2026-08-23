const mongoose = require("mongoose");

const safetyIncidentSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    hostelName: String,
    city: { type: String, index: true },
    area: String,
    category: { type: String, default: "general" },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: { type: String, enum: ["open", "investigating", "resolved", "dismissed"], default: "open" },
    title: String,
    description: String,
    evidence: [{ label: String, url: String }],
    actions: [{ note: String, actorName: String, createdAt: { type: Date, default: Date.now } }],
    resolvedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("SafetyIncident", safetyIncidentSchema);
