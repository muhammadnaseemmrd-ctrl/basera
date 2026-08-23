const mongoose = require("mongoose");

const loyaltyClaimSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedPoints: { type: Number, default: 5000 },
    status: { type: String, enum: ["pending", "approved", "rejected", "used", "expired"], default: "pending" },
    preferredDiscountPercent: { type: Number, min: 5, max: 10, default: 5 },
    approvedDiscountPercent: { type: Number, min: 5, max: 10 },
    couponCode: { type: String, uppercase: true, trim: true },
    discount: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
    adminNote: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    expiresAt: Date
  },
  { timestamps: true }
);

loyaltyClaimSchema.index({ student: 1, status: 1 });
loyaltyClaimSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("LoyaltyClaim", loyaltyClaimSchema);
