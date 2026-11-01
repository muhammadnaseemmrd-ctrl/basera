const mongoose = require("mongoose");

// One per hostel. Fields deliberately have NO schema defaults: an unset field means
// "inherit the platform default", which resolvePolicy() (services/policyRules.js) reports
// as source "platform". Already-issued invoices/notices snapshot the values they used.
const blockOverrideSchema = new mongoose.Schema(
  {
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true },
    leaveNoticeDays: Number,
    dueDayOfMonth: Number,
    finePerDay: Number,
    maxFine: Number
  },
  { _id: false }
);

const hostelPolicySchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true, unique: true },
    leaveNotice: {
      days: Number,
      shortNoticeAction: { type: String, enum: ["allow_with_charge", "allow_flag_only", "block"] },
      shortNoticeChargeDays: Number,
      wardenCanApprove: Boolean
    },
    lateFee: {
      enabled: Boolean,
      dueDayOfMonth: Number,
      finePerDay: Number,
      graceDays: Number,
      maxFine: { type: Number, default: undefined },
      stopsWhenRentPaid: Boolean
    },
    feeAllocation: { type: String, enum: ["rent_first", "fine_first"] },
    visitors: { enabled: Boolean, start: String, end: String, curfew: String },
    blockOverrides: [blockOverrideSchema],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true, minimize: true }
);

module.exports = mongoose.model("HostelPolicy", hostelPolicySchema);
