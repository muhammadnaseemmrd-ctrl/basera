const mongoose = require("mongoose");

// Links a parent/guardian login to one student. A link is created either
//  - by the student, who shares a ParentAccess token the parent "claims", or
//  - by hostel staff, which produces a one-time invite code the parent redeems.
// Phone numbers are NOT verified (no OTP yet), so a phone number alone never
// grants access: the parent must hold the code the staff/student gave them.
const parentLinkSchema = new mongoose.Schema(
  {
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    parentName: String,
    parentPhone: String,
    phoneKey: { type: String, index: true },
    relation: { type: String, default: "parent" },
    status: { type: String, enum: ["pending", "active", "revoked"], default: "pending" },
    inviteCode: { type: String, index: true, sparse: true },
    inviteExpiresAt: Date,
    claimedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["student_token", "staff"], default: "staff" }
  },
  { timestamps: true }
);

parentLinkSchema.index({ parent: 1, status: 1 });
parentLinkSchema.index({ student: 1, status: 1 });
parentLinkSchema.index({ student: 1, phoneKey: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["pending", "active"] }, phoneKey: { $type: "string" } } });

module.exports = mongoose.model("ParentLink", parentLinkSchema);
