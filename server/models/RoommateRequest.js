const mongoose = require("mongoose");

const roommateRequestSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requesterName: String,
    targetStudent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetName: String,
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    roomTitle: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    city: String,
    university: String,
    compatibilityScore: { type: Number, default: 80 },
    message: String,
    status: { type: String, enum: ["pending", "accepted", "rejected", "cancelled"], default: "pending" },
    respondedAt: Date
  },
  { timestamps: true }
);

roommateRequestSchema.index({ requester: 1, status: 1, createdAt: -1 });
roommateRequestSchema.index({ targetStudent: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("RoommateRequest", roommateRequestSchema);
