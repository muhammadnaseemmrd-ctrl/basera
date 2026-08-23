const mongoose = require("mongoose");

const checkInVerificationSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    selfieUrl: String,
    cnicPhotoUrl: String,
    matchConfidence: Number,
    status: { type: String, enum: ["matched", "retry_required", "manual_review", "overridden"], default: "retry_required" },
    attempts: { type: Number, default: 1 },
    verifiedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

checkInVerificationSchema.index({ booking: 1, createdAt: -1 });
checkInVerificationSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("CheckInVerification", checkInVerificationSchema);
