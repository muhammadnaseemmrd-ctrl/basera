const mongoose = require("mongoose");

const vendorOrderSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    studentName: String,
    vendorId: String,
    vendorName: String,
    service: String,
    amount: Number,
    scheduledFor: Date,
    status: { type: String, enum: ["requested", "confirmed", "completed", "cancelled"], default: "requested" },
    address: String,
    notes: String
  },
  { timestamps: true }
);

vendorOrderSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("VendorOrder", vendorOrderSchema);
