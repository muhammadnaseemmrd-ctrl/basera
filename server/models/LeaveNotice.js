const mongoose = require("mongoose");

const line = { label: String, amount: Number, invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice" }, _id: false };

const leaveNoticeSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    bedIndex: Number,
    // business-clock time the notice was given
    requestedAt: { type: Date, required: true },
    intendedLeaveDate: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    // policy snapshot at submission — later policy changes never alter these
    policyDays: { type: Number, required: true },
    shortNoticeAction: String,
    noticeDaysGiven: { type: Number, required: true },
    shortBy: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    shortNoticeCharge: { amount: { type: Number, default: 0 }, chargeDays: Number, invoice: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice" } },
    status: { type: String, enum: ["submitted", "approved", "rejected", "withdrawn", "completed"], default: "submitted" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedByRole: String,
    decidedAt: Date,
    decisionNote: String,
    depositSettlement: {
      deposit: Number,
      dues: [line],
      damages: [line],
      duesTotal: Number,
      damagesTotal: Number,
      net: Number,
      refund: Number,
      payable: Number,
      settledAt: Date,
      settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    completedAt: Date
  },
  { timestamps: true }
);

leaveNoticeSchema.index({ hostel: 1, status: 1, intendedLeaveDate: 1 });
leaveNoticeSchema.index({ student: 1, createdAt: -1 });
// one open notice per stay (race-safe)
leaveNoticeSchema.index({ booking: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["submitted", "approved"] } } });

module.exports = mongoose.model("LeaveNotice", leaveNoticeSchema);
