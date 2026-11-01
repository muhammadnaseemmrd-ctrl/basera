const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    // null block = hostel-wide notice
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    type: { type: String, enum: ["staff_termination", "staff_suspension", "fee_reminder", "safety", "general"], default: "general" },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "StaffMember" },
    audience: { type: [String], enum: ["students", "parents", "staff"], default: ["students", "parents"] },
    pinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
    studentRecipients: { type: Number, default: 0 },
    parentRecipients: { type: Number, default: 0 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

noticeSchema.index({ hostel: 1, block: 1, createdAt: -1 });

module.exports = mongoose.model("Notice", noticeSchema);
