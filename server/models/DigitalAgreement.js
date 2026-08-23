const mongoose = require("mongoose");

const digitalAgreementSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    agreementType: { type: String, enum: ["move_in", "room_rules", "condition_checklist"], default: "move_in" },
    version: { type: String, default: "v1" },
    terms: [String],
    studentSignature: {
      name: String,
      signedAt: Date,
      ip: String
    },
    hostSignature: {
      name: String,
      signedAt: Date,
      ip: String
    },
    status: { type: String, enum: ["draft", "student_signed", "host_signed", "completed"], default: "draft" }
  },
  { timestamps: true }
);

digitalAgreementSchema.index({ booking: 1, agreementType: 1 }, { unique: true, sparse: true });
digitalAgreementSchema.index({ bookingRef: 1, agreementType: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("DigitalAgreement", digitalAgreementSchema);
