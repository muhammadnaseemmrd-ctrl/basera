const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referredName: String,
    referredEmail: { type: String, lowercase: true, trim: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["invited", "registered", "booked", "completed", "cancelled"], default: "completed" },
    pointsAwarded: { type: Number, default: 1000 },
    awardedAt: Date
  },
  { timestamps: true }
);

const loyaltyAccountSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    pointsBalance: { type: Number, default: 0, min: 0 },
    lifetimePoints: { type: Number, default: 0, min: 0 },
    pointsRedeemed: { type: Number, default: 0, min: 0 },
    referralCount: { type: Number, default: 0, min: 0 },
    referrals: [referralSchema]
  },
  { timestamps: true }
);

loyaltyAccountSchema.index({ referralCode: 1 });

module.exports = mongoose.model("LoyaltyAccount", loyaltyAccountSchema);
