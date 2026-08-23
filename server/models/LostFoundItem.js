const mongoose = require("mongoose");

const lostFoundItemSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reporterName: String,
    city: String,
    university: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    type: { type: String, enum: ["lost", "found"], default: "lost" },
    itemName: { type: String, required: true, trim: true },
    description: String,
    location: String,
    images: [String],
    status: { type: String, enum: ["open", "claimed", "returned", "hidden"], default: "open" },
    claimNote: String,
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    claimedAt: Date
  },
  { timestamps: true }
);

lostFoundItemSchema.index({ status: 1, type: 1, city: 1, university: 1, createdAt: -1 });

module.exports = mongoose.model("LostFoundItem", lostFoundItemSchema);
