const mongoose = require("mongoose");

const hostReputationScoreSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    hostRef: String,
    hostName: String,
    score: { type: Number, default: 80 },
    responseTime: { type: Number, default: 30 },
    cancellationRate: { type: Number, default: 0 },
    disputeRate: { type: Number, default: 0 },
    reviewScore: { type: Number, default: 4.6 },
    verificationScore: { type: Number, default: 90 },
    factors: [{ label: String, value: Number, tone: String }],
    recommendations: [{ title: String, impact: String, action: String }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("HostReputationScore", hostReputationScoreSchema);
