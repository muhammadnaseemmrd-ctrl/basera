const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema(
  {
    label: String,
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const depositCaseSchema = new mongoose.Schema(
  {
    caseId: { type: String, unique: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true, min: 0 },
    requestedDeduction: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    deductionAmount: { type: Number, default: 0 },
    reason: String,
    status: {
      type: String,
      enum: ["HELD", "REFUND_REQUESTED", "DEDUCTION_REQUESTED", "ACCEPTED", "DISPUTED", "REFUNDED", "DEDUCTED", "AUTO_REFUND_DUE"],
      default: "HELD"
    },
    evidence: [evidenceSchema],
    studentResponse: String,
    adminNote: String,
    dueForAutoRefundAt: Date,
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// See Hostel.js / User.js for why the `next` parameter and call were removed.
depositCaseSchema.pre("validate", function assignCaseId() {
  if (!this.caseId) this.caseId = `HH-DEP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
});

depositCaseSchema.index({ booking: 1 });
depositCaseSchema.index({ status: 1, dueForAutoRefundAt: 1 });

module.exports = mongoose.model("DepositCase", depositCaseSchema);
