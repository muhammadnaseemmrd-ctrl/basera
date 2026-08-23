const mongoose = require("mongoose");

const alertAcknowledgementSchema = new mongoose.Schema(
  {
    alert: { type: mongoose.Schema.Types.ObjectId, ref: "GlobalAlert", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    channel: { type: String, enum: ["banner", "student_support", "dashboard"], default: "banner" },
    acknowledgedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

alertAcknowledgementSchema.index({ alert: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("AlertAcknowledgement", alertAcknowledgementSchema);
