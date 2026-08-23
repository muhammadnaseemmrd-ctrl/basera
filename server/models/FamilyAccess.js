const mongoose = require("mongoose");

const familyAccessSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    studentName: String,
    guardianPhone: String,
    guardianName: String,
    relation: String,
    accessToken: { type: String, unique: true },
    isVerified: { type: Boolean, default: false },
    notifyOnRent: { type: Boolean, default: true },
    notifyOnSOS: { type: Boolean, default: true },
    lastCheckInRequestedAt: Date,
    lastSafeCheckInAt: Date,
    expiresAt: Date
  },
  { timestamps: true }
);

familyAccessSchema.index({ student: 1 });
familyAccessSchema.index({ accessToken: 1 }, { unique: true });

module.exports = mongoose.model("FamilyAccess", familyAccessSchema);
