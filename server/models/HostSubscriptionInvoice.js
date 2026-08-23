const mongoose = require("mongoose");

const hostSubscriptionInvoiceSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostRef: String,
    hostName: String,
    plan: { type: String, default: "STARTER" },
    period: String,
    amount: { type: Number, required: true },
    status: { type: String, enum: ["issued", "proof_submitted", "paid", "overdue", "waived"], default: "issued" },
    manualPaymentRef: String,
    proofUrl: String,
    dueAt: Date,
    paidAt: Date,
    ledgerTransactionId: String
  },
  { timestamps: true }
);

hostSubscriptionInvoiceSchema.index({ host: 1, period: 1 }, { unique: false });

module.exports = mongoose.model("HostSubscriptionInvoice", hostSubscriptionInvoiceSchema);
