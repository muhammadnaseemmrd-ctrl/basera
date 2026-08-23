const mongoose = require("mongoose");

const hostelPulseSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    viewsLast24h: { type: Number, default: 0 },
    bookingsLast24h: { type: Number, default: 0 },
    lastReviewAge: String,
    lastMessUpdate: Date,
    pulseLevel: { type: String, enum: ["active", "moderate", "quiet"], default: "moderate" },
    expiresAt: Date
  },
  { timestamps: true }
);

hostelPulseSchema.index({ hostel: 1 });
hostelPulseSchema.index({ hostelRef: 1 });
hostelPulseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("HostelPulse", hostelPulseSchema);
