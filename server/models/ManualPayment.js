const mongoose = require("mongoose");

const manualPaymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    studentName: String,
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    amount: { type: Number, required: true },
    method: { type: String, enum: ["bank_transfer", "cash_deposit", "jazzcash_manual", "easypaisa_manual"], default: "bank_transfer" },
    reference: { type: String, unique: true },
    status: { type: String, enum: ["challan_issued", "proof_submitted", "approved", "rejected"], default: "challan_issued" },
    proofUrl: String,
    proofReference: String,
    payerName: String,
    adminNote: String,
    reviewedByName: String,
    reviewedAt: Date,
    dueAt: Date,
    ledgerTransactionId: String
  },
  { timestamps: true }
);

manualPaymentSchema.index({ student: 1, status: 1 });
manualPaymentSchema.index({ reference: 1 }, { unique: true });

module.exports = mongoose.model("ManualPayment", manualPaymentSchema);
