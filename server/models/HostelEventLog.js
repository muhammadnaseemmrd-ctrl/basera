const mongoose = require("mongoose");

// One row per already-sent scheduled event ("due-soon:<invoice>:<day>", "leave-7d:<notice>").
// The unique key makes reminder jobs safe to run twice, late, or for a missed day.
const hostelEventLogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    recipients: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("HostelEventLog", hostelEventLogSchema);
