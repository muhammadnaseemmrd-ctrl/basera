const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, index: true },
    entryId: { type: String, required: true, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: [
        "BOOKING_PAYMENT",
        "COMMISSION_RECOGNITION",
        "HOST_PAYOUT",
        "RENT_PAYMENT",
        "DEPOSIT_REFUND",
        "DEPOSIT_DEDUCTION",
        "DISCOUNT",
        "LATE_FEE",
        "ACTIVITY_CONTRIBUTION",
        "ACTIVITY_REFUND",
        "HOST_MANAGEMENT_FEE",
        "GATEWAY_FEE",
        "MANUAL_ADJUSTMENT"
      ],
      required: true
    },
    account: {
      type: String,
      enum: [
        "gateway_cash",
        "student_receivable",
        "escrow_rent",
        "escrow_deposit",
        "platform_service_fee",
        "platform_commission",
        "platform_discount",
        "host_payable",
        "host_receivable",
        "student_payable",
        "activity_pool",
        "platform_management_fee",
        "gateway_fee_expense",
        "adjustment"
      ],
      required: true
    },
    direction: { type: String, enum: ["debit", "credit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    gateway: String,
    paymentRef: String,
    idempotencyKey: String,
    memo: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ booking: 1, createdAt: -1 });
ledgerEntrySchema.index({ host: 1, createdAt: -1 });
ledgerEntrySchema.index({ student: 1, createdAt: -1 });
ledgerEntrySchema.index({ type: 1, createdAt: -1 });
ledgerEntrySchema.index({ account: 1, direction: 1 });
ledgerEntrySchema.index({ idempotencyKey: 1, entryId: 1 });

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);
