const mongoose = require("mongoose");

const campusAmbassadorSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    name: String,
    email: String,
    university: String,
    city: String,
    strengths: [String],
    status: { type: String, enum: ["applied", "approved", "rejected", "paused"], default: "applied" },
    trustScore: { type: Number, default: 70 },
    tasksCompleted: { type: Number, default: 0 },
    approvedAt: Date,
    reviewedByName: String
  },
  { timestamps: true }
);

campusAmbassadorSchema.index({ university: 1, status: 1 });

module.exports = mongoose.model("CampusAmbassador", campusAmbassadorSchema);
