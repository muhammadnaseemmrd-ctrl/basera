const mongoose = require("mongoose");

const waitlistRuleSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    title: String,
    city: String,
    university: String,
    maxBudget: Number,
    roomType: String,
    gender: String,
    notifyChannels: [String],
    status: { type: String, enum: ["active", "paused", "matched"], default: "active" },
    lastRunAt: Date,
    matches: [
      {
        roomId: String,
        title: String,
        pricePerHead: Number,
        availableBeds: Number,
        matchedAt: Date
      }
    ]
  },
  { timestamps: true }
);

waitlistRuleSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("WaitlistRule", waitlistRuleSchema);
