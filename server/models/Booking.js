const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    checkIn: { type: Date, required: true },
    checkOut: Date,
    duration: { type: String, enum: ["monthly", "semester", "weekly", "annual", "daily", "trial"], required: true },
    bookingType: { type: String, enum: ["ADVANCE_RESERVE", "MONTHLY", "SEMESTER", "ANNUAL", "DAILY", "TRIAL"], default: "MONTHLY" },
    bedIndex: Number,
    moveInDate: Date,
    moveOutDate: Date,
    instalmentPlan: { type: String, enum: ["FULL", "TWO_PART", "SEMESTER_4X", "TOKEN_BALANCE"], default: "FULL" },
    instalments: [
      {
        dueDate: Date,
        amount: Number,
        // PENDING_VERIFICATION is additive: it represents a student/warden-
        // reported offline or unconfirmed-gateway payment claim that has not
        // yet been reviewed by an admin/finance user. It must never be
        // treated as equivalent to PAID -- see POST /:id/payment-verification
        // in bookingRoutes.js, which is the only path that can move a claim
        // from PENDING_VERIFICATION to PAID.
        status: { type: String, enum: ["PENDING", "PAID", "OVERDUE", "PENDING_VERIFICATION"], default: "PENDING" },
        paidAt: Date,
        paymentRef: String,
        submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        verifiedAt: Date,
        rejectionReason: String,
        previousBookingStatus: String
      }
    ],
    tokenAmount: Number,
    totalRent: Number,
    serviceFee: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountCode: String,
    securityDeposit: { type: Number, default: 0 },
    // Opt-in Deposit Protection add-on. This is a Basera-side fee + claims
    // mechanism (real, working today) -- `partnerStatus` defaults to
    // "platform_backed_pending_partner" to be transparent that payouts are
    // NOT yet backed by a licensed insurance partner. See bookingRoutes.js.
    depositProtection: {
      optedIn: { type: Boolean, default: false },
      feePkr: { type: Number, default: 0 },
      partnerStatus: { type: String, enum: ["platform_backed_pending_partner", "partner_backed"], default: "platform_backed_pending_partner" }
    },
    depositProtectionClaims: [
      {
        reason: String,
        evidence: [String],
        status: { type: String, enum: ["pending_review", "approved", "denied"], default: "pending_review" },
        filedAt: { type: Date, default: Date.now },
        reviewedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewNote: String
      }
    ],
    escrowStatus: { type: String, enum: ["not_created", "held", "released", "disputed", "refunded", "partially_released"], default: "not_created" },
    nextRentDueDate: Date,
    rentDueDay: { type: Number, min: 1, max: 28, default: 1 },
    hostContactReleasedAt: Date,
    hostPayoutMethod: String,
    lateFee: { type: Number, default: 0 },
    receiptUrl: String,
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute" },
    tenantRating: Number,
    ownerRating: Number,
    beds: { type: Number, default: 1 },
    specialRequests: String,
    totalAmount: { type: Number, required: true },
    commission: { type: Number, required: true },
    ownerReceives: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["jazzcash", "easypaisa", "stripe", "cash"], default: "jazzcash" },
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded", "failed"], default: "pending" },
    paymentRef: String,
    status: { type: String, enum: ["pending", "confirmed", "payment_pending", "active", "overdue", "cancelled", "completed", "disputed", "declined"], default: "pending" },
    declineReason: String,
    cancelReason: String,
    ownerPaidOut: { type: Boolean, default: false },
    ownerPaidOutAt: Date,
    // Additive holding area for a self-reported/unverified rent payment
    // (e.g. cash or bank transfer relayed by the student) submitted via
    // POST /:id/rent-pay before an admin/finance user confirms it via
    // POST /:id/payment-verification. Mirrors the ManualPayment challan
    // review flow so an unverified claim never silently updates the ledger
    // or booking status.
    pendingRentClaim: {
      amount: Number,
      paymentRef: String,
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      submittedAt: Date,
      previousStatus: String
    },
    lifecycleStatus: { type: String, enum: ["none", "switch_requested", "switch_approved", "leave_requested", "leave_approved"], default: "none" },
    lifecycleReason: String,
    lifecycleRequestedAt: Date,
    lifecycleDecidedAt: Date,
    lifecycleDecidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lifecycleDeclineReason: String,
    switchTargetRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    switchTargetHostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    switchNewBooking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    plannedMoveOutDate: Date,
    leaveSettlement: {
      monthlyRent: Number,
      totalCycleDays: Number,
      usedDays: Number,
      unusedDays: Number,
      proratedRentRefund: Number,
      securityDeposit: Number,
      estimatedTotalRefund: Number,
      calculatedAt: Date
    }
  },
  { timestamps: true }
);

bookingSchema.index({ student: 1, status: 1 });
bookingSchema.index({ student: 1, status: 1, createdAt: -1 });
bookingSchema.index({ hostel: 1, status: 1, createdAt: -1 });
bookingSchema.index({ status: 1, lifecycleStatus: 1, nextRentDueDate: 1 });
bookingSchema.index({ status: 1, ownerPaidOutAt: 1 });
bookingSchema.index({ hostel: 1, checkIn: 1 });
bookingSchema.index({ lifecycleStatus: 1, room: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
