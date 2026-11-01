const mongoose = require("mongoose");

const fineWaiverRequestSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // null + requestAll=true means "waive everything outstanding at decision time"
    requestedAmount: { type: Number, min: 1, default: null },
    requestAll: { type: Boolean, default: false },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    // business-clock time of the request (createdAt is wall-clock and ignores QA time travel)
    requestedAt: Date,
    evidence: [String],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedByRole: String,
    // a warden filed it for the student (flagged for head office)
    onBehalf: { type: Boolean, default: false },
    recommendations: [{ by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, byName: String, note: String, at: Date, _id: false }],
    status: { type: String, enum: ["pending", "approved", "partial", "rejected", "cancelled"], default: "pending" },
    approvedAmount: { type: Number, default: 0, min: 0 },
    freeze: { type: Boolean, default: false },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
    decisionNote: String
  },
  { timestamps: true }
);

fineWaiverRequestSchema.index({ hostel: 1, status: 1, createdAt: 1 });
fineWaiverRequestSchema.index({ student: 1, createdAt: -1 });
// one pending request per invoice — also makes concurrent submissions race-safe
fineWaiverRequestSchema.index({ invoice: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

module.exports = mongoose.model("FineWaiverRequest", fineWaiverRequestSchema);
