const mongoose = require("mongoose");

// Visitor log for a resident. Only the last 4 CNIC digits are stored (enough to match an
// ID card at the gate, not enough to be a usable identity number).
const visitorSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visitorName: { type: String, required: true, trim: true, maxlength: 80 },
    cnicLast4: { type: String, required: true, match: /^\d{4}$/ },
    relation: { type: String, trim: true, maxlength: 40 },
    purpose: { type: String, required: true, trim: true, maxlength: 200 },
    expectedAt: Date,
    status: { type: String, enum: ["pending", "approved", "denied", "checked_in", "checked_out", "cancelled"], default: "pending" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByRole: String,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decisionNote: String,
    checkInAt: Date,
    checkOutAt: Date,
    outsideHours: { type: Boolean, default: false },
    overrideNote: String
  },
  { timestamps: true }
);

visitorSchema.index({ hostel: 1, block: 1, createdAt: -1 });
visitorSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("Visitor", visitorSchema);
