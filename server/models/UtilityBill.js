const mongoose = require("mongoose");

const billLineSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["electricity", "gas", "water", "internet", "other"], default: "electricity" },
    amount: { type: Number, default: 0 },
    proofUrl: String
  },
  { _id: false }
);

const billSplitSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    studentName: String,
    roomTitle: String,
    occupancyDays: Number,
    weight: Number,
    share: Number,
    breakdown: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

const utilityBillSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostRef: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    month: Number,
    year: Number,
    includeInRentInvoice: { type: Boolean, default: true },
    bills: [billLineSchema],
    splits: [billSplitSchema],
    totalAmount: Number,
    status: { type: String, enum: ["draft", "posted", "absorbed"], default: "posted" }
  },
  { timestamps: true }
);

utilityBillSchema.index({ host: 1, year: 1, month: 1 });
utilityBillSchema.index({ hostel: 1, year: 1, month: 1 });

module.exports = mongoose.model("UtilityBill", utilityBillSchema);
