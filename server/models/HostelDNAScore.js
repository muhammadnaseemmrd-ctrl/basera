const mongoose = require("mongoose");

const dnaDimensionSchema = new mongoose.Schema(
  {
    name: String,
    score: Number,
    basis: String
  },
  { _id: false }
);

const hostelDNAScoreSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    dimensions: [dnaDimensionSchema],
    overallScore: Number,
    computedAt: Date
  },
  { timestamps: true }
);

hostelDNAScoreSchema.index({ hostel: 1, computedAt: -1 });
hostelDNAScoreSchema.index({ hostelRef: 1, computedAt: -1 });

module.exports = mongoose.model("HostelDNAScore", hostelDNAScoreSchema);
