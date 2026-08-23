const mongoose = require("mongoose");

const globalAlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    category: { type: String, enum: ["safety", "policy", "weather", "transport", "hostel", "health", "general"], default: "general" },
    severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
    audience: { type: String, enum: ["all", "students", "hosts"], default: "all" },
    status: { type: String, enum: ["pending", "published", "rejected", "expired"], default: "pending" },
    hostelName: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    city: String,
    university: String,
    targetTags: [String],
    ackRequired: { type: Boolean, default: false },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedByName: String,
    submittedByRole: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminNote: String,
    publishedAt: Date,
    expiresAt: Date
  },
  { timestamps: true }
);

globalAlertSchema.index({ status: 1, expiresAt: 1 });
globalAlertSchema.index({ audience: 1, city: 1, university: 1, status: 1 });
globalAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("GlobalAlert", globalAlertSchema);
