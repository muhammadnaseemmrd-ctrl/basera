const mongoose = require("mongoose");

const signatureSchema = new mongoose.Schema(
  {
    name: String,
    cnic: String,
    signedAt: Date,
    ipAddress: String
  },
  { _id: false }
);

const tenancyAgreementSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    contractId: { type: String, unique: true },
    pdfUrl: String,
    studentSig: signatureSchema,
    hostSig: signatureSchema,
    signedAt: Date,
    customClauses: [String],
    status: { type: String, enum: ["generated", "student_signed", "host_signed", "fully_signed"], default: "generated" }
  },
  { timestamps: true }
);

tenancyAgreementSchema.index({ booking: 1 });
tenancyAgreementSchema.index({ contractId: 1 }, { unique: true });

module.exports = mongoose.model("TenancyAgreement", tenancyAgreementSchema);
