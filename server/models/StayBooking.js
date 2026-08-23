const mongoose = require("mongoose");

// Deliberately separate from Booking.js: student bookings are monthly-rent-plus-escrow
// (instalments, security deposit, escrow status, lifecycle switch/leave flows). A hotel or
// guest-house stay is nights x nightly rate with a simple pending/confirmed/cancelled/
// completed lifecycle -- forcing it through the monthly escrow model would mean carrying a
// pile of unused fields (instalmentPlan, escrowStatus, rentDueDay, ...) that don't apply to
// a 2-night weekend booking. See Property.js for the matching property model.
const stayBookingSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    guestUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    guestCount: { type: Number, default: 1 },
    nights: Number,
    nightlyRatePkr: Number,
    totalPkr: { type: Number, required: true },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending" },
    // Short-stay guests reasonably expect faster direct contact than the long-term
    // student/host contact-gating flow (see contactGatingService.js) -- that gate exists
    // mainly to protect months of rent/commission from off-platform disintermediation,
    // which is a much smaller risk for a 1-3 night booking, and guests need to coordinate
    // check-in logistics quickly. So this phone number is shared with the property owner
    // immediately when the booking is created, not gated behind a paid/confirmed status.
    contactPhone: { type: String, required: true },
    specialRequests: String,
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    paymentMethod: { type: String, enum: ["jazzcash", "easypaisa", "stripe", "cash"], default: "jazzcash" },
    cancelReason: String
  },
  { timestamps: true }
);

stayBookingSchema.index({ propertyId: 1, checkInDate: 1, checkOutDate: 1, status: 1 });
stayBookingSchema.index({ guestUserId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("StayBooking", stayBookingSchema);
