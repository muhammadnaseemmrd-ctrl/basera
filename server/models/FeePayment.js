const mongoose = require("mongoose");

const feePaymentSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1 },
    // how this payment was split (policy feeAllocation at payment time)
    rentPortion: { type: Number, default: 0, min: 0 },
    finePortion: { type: Number, default: 0, min: 0 },
    // discount granted at payment time (e.g. early payment), shown on the receipt
    discountApplied: { type: Number, default: 0, min: 0 },
    redemptions: [{ type: mongoose.Schema.Types.ObjectId, ref: "OfferRedemption" }],
    method: { type: String, enum: ["cash", "bank_transfer", "jazzcash", "easypaisa", "cheque"], required: true },
    bankName: String,
    transactionId: { type: String, trim: true },
    screenshotUrl: String,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receivedByName: String,
    receivedByRole: String,
    receiptNo: { type: String, required: true, unique: true },
    note: String,
    paidAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["confirmed", "void"], default: "confirmed" },
    voidReason: String,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidedAt: Date,
    whatsappSharedAt: Date
  },
  { timestamps: true }
);

feePaymentSchema.index({ hostel: 1, createdAt: -1 });
feePaymentSchema.index({ student: 1, createdAt: -1 });
feePaymentSchema.index({ invoice: 1 });
// a bank/wallet transaction id can back only one confirmed receipt per hostel
feePaymentSchema.index(
  { hostel: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: "string" }, status: "confirmed" } }
);

module.exports = mongoose.model("FeePayment", feePaymentSchema);
