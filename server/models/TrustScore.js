const mongoose = require("mongoose");

const trustScoreSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    score: { type: Number, default: 50 },
    grade: String,
    breakdown: {
      payments: Number,
      disputes: Number,
      profile: Number,
      completion: Number,
      community: Number
    },
    recommendations: [String],
    lastUpdated: Date
  },
  { timestamps: true }
);

trustScoreSchema.index({ student: 1 }, { unique: false });
trustScoreSchema.index({ studentRef: 1 });

module.exports = mongoose.model("TrustScore", trustScoreSchema);
