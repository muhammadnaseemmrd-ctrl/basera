const mongoose = require("mongoose");

const groupInviteSchema = new mongoose.Schema(
  {
    email: String,
    name: String,
    status: { type: String, enum: ["invited", "joined", "paid", "declined"], default: "invited" },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    joinedAt: Date
  },
  { _id: false }
);

const groupBookingSchema = new mongoose.Schema(
  {
    leadStudent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    leadStudentRef: String,
    leadStudentName: String,
    roomRefs: [String],
    bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    invites: [groupInviteSchema],
    discountApplied: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "holding", "confirmed", "expired", "cancelled"], default: "holding" },
    expiresAt: Date
  },
  { timestamps: true }
);

groupBookingSchema.index({ leadStudent: 1, status: 1 });
groupBookingSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("GroupBooking", groupBookingSchema);
