const mongoose = require("mongoose");

const loyaltyRedemptionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rewardId: { type: String, required: true },
    rewardName: { type: String, required: true },
    pointsCost: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "fulfilled", "cancelled"], default: "pending" }
  },
  { timestamps: true }
);

loyaltyRedemptionSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("LoyaltyRedemption", loyaltyRedemptionSchema);
