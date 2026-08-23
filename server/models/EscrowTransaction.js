const mongoose = require("mongoose");

const escrowTransactionSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    paymentId: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    totalAmount: { type: Number, required: true },
    rentAmount: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 7 },
    commissionAmount: { type: Number, default: 0 },
    hostPayoutAmount: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["HELD", "RELEASED", "DISPUTED", "REFUNDED", "PARTIALLY_RELEASED"],
      default: "HELD"
    },
    releaseAfter: Date,
    releasedAt: Date,
    commissionTransferredAt: Date,
    hostPayoutTransferredAt: Date,
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute" },
    releaseBlockedBy: String,
    payoutMethod: String
  },
  { timestamps: true }
);

escrowTransactionSchema.index({ status: 1, releaseAfter: 1 });
escrowTransactionSchema.index({ bookingId: 1 });

module.exports = mongoose.model("EscrowTransaction", escrowTransactionSchema);
