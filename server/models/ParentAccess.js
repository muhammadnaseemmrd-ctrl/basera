const mongoose = require("mongoose");

const parentAccessSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    studentName: String,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    roomIds: [String],
    parentName: String,
    parentEmail: String,
    parentPhone: String,
    token: { type: String, unique: true },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active" },
    consentAcknowledgedAt: Date,
    lastViewedAt: Date,
    expiresAt: Date
  },
  { timestamps: true }
);

parentAccessSchema.index({ token: 1 }, { unique: true });
parentAccessSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("ParentAccess", parentAccessSchema);
