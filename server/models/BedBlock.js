const mongoose = require("mongoose");

const bedBlockSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    bedIndex: { type: Number, required: true, min: 0 },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    reason: { type: String, enum: ["maintenance", "owner_hold", "deep_cleaning", "reserved", "booked_offline"], default: "maintenance" },
    note: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["active", "released"], default: "active" }
  },
  { timestamps: true }
);

bedBlockSchema.index({ room: 1, bedIndex: 1, status: 1, from: 1, to: 1 });

module.exports = mongoose.model("BedBlock", bedBlockSchema);
