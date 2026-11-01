const mongoose = require("mongoose");

const offerRedemptionSchema = new mongoose.Schema(
  {
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "HostelOffer", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    // set when the discount was granted at payment time (early payment); voiding that payment reverses it
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "FeePayment" },
    amountOff: { type: Number, required: true, min: 0 },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    appliedByRole: String,
    appliedAt: Date,
    status: { type: String, enum: ["applied", "pending_approval", "reversed", "rejected"], default: "applied" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reversedReason: String,
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reversedAt: Date
  },
  { timestamps: true }
);

offerRedemptionSchema.index({ offer: 1, student: 1, status: 1 });
offerRedemptionSchema.index({ hostel: 1, createdAt: -1 });
// one live redemption of an offer per invoice (double-click safe)
offerRedemptionSchema.index({ offer: 1, invoice: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["applied", "pending_approval"] } } });

module.exports = mongoose.model("OfferRedemption", offerRedemptionSchema);
