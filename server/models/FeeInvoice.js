const mongoose = require("mongoose");

const feeInvoiceSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    bedIndex: Number,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    title: { type: String, required: true, trim: true },
    // e.g. "2026-11" for monthly rent; free text for one-offs
    period: { type: String, trim: true },
    kind: { type: String, enum: ["rent", "security_deposit", "mess", "utilities", "fine", "other"], default: "rent" },
    amount: { type: Number, required: true, min: 1 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: Date,
    status: { type: String, enum: ["unpaid", "partial", "paid", "void"], default: "unpaid" },
    voidReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

feeInvoiceSchema.index({ hostel: 1, status: 1, dueDate: 1 });
feeInvoiceSchema.index({ student: 1, status: 1 });
feeInvoiceSchema.index({ block: 1, status: 1 });
// one rent invoice per student per period (prevents double billing)
feeInvoiceSchema.index(
  { student: 1, hostel: 1, kind: 1, period: 1 },
  // partialFilterExpression does not support $ne, so list the live statuses explicitly.
  { unique: true, partialFilterExpression: { period: { $type: "string" }, status: { $in: ["unpaid", "partial", "paid"] } } }
);

module.exports = mongoose.model("FeeInvoice", feeInvoiceSchema);
