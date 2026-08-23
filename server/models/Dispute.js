const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema(
  {
    caseId: { type: String, unique: true, sparse: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    raisedAgainst: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: ["ROOM_CONDITION", "PAYMENT", "BEHAVIOUR", "REFUND", "OTHER"], default: "OTHER" },
    description: { type: String, minlength: 20 },
    evidence: [
      {
        type: { type: String, enum: ["photo", "video", "document", "message"], default: "document" },
        url: String,
        originalName: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["open", "under_review", "awaiting_owner", "awaiting_student", "resolved", "dismissed", "rejected"], default: "open" },
    outcome: { type: String, enum: ["FULL_REFUND_STUDENT", "PARTIAL_REFUND", "RELEASE_TO_HOST", "SPLIT", "DISMISSED", ""] },
    splitRatio: Number,
    adminNote: String,
    resolutionNote: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
    frivolousFeePaid: { type: Boolean, default: false },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

disputeSchema.index({ status: 1, priority: 1 });
disputeSchema.pre("validate", function setCaseId(next) {
  if (!this.caseId) {
    const year = new Date().getFullYear();
    this.caseId = `HH-DSP-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
  }
  if (!this.bookingId && this.booking) this.bookingId = this.booking;
  if (!this.raisedBy && this.openedBy) this.raisedBy = this.openedBy;
  next();
});

module.exports = mongoose.model("Dispute", disputeSchema);
