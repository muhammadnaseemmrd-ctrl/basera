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
    // when the invoice was raised (business clock); fines never count days before this
    issuedAt: Date,
    // late-fee terms snapshotted from the hostel/block policy at creation (later policy
    // changes never touch an issued invoice). finePerDay 0 = no fines (non-rent kinds).
    finePerDay: { type: Number, default: 0, min: 0 },
    maxFine: { type: Number, default: null },
    graceDays: { type: Number, default: 0, min: 0 },
    stopsWhenRentPaid: { type: Boolean, default: true },
    // fine is kept inside the invoice and recomputed from dates (never incremented)
    fineAccrued: { type: Number, default: 0, min: 0 },
    fineWaived: { type: Number, default: 0, min: 0 },
    finePaid: { type: Number, default: 0, min: 0 },
    fineStatus: { type: String, enum: ["none", "accruing", "frozen", "waived", "paid"], default: "none" },
    fineAsOf: Date,
    fineFrozenAt: Date,
    paidInFullAt: Date,
    // explicit negative lines from hostel offers; amount itself never changes
    discounts: [
      {
        offer: { type: mongoose.Schema.Types.ObjectId, ref: "HostelOffer" },
        redemption: { type: mongoose.Schema.Types.ObjectId, ref: "OfferRedemption" },
        name: String,
        amountOff: { type: Number, min: 0 },
        stackable: Boolean,
        _id: false
      }
    ],
    discountTotal: { type: Number, default: 0, min: 0 },
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
