const mongoose = require("mongoose");

const visitRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    preferredDate: { type: Date, required: true },
    preferredTime: String,
    note: String,
    status: { type: String, enum: ["pending", "confirmed", "rejected", "completed"], default: "pending" }
  },
  { timestamps: true }
);

visitRequestSchema.index({ hostel: 1, preferredDate: 1 });

module.exports = mongoose.model("VisitRequest", visitRequestSchema);
