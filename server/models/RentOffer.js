const mongoose = require("mongoose");

const offerRoundSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ["student", "host", "system"], default: "student" },
    price: Number,
    message: String,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const rentOfferSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    roomRef: String,
    roomTitle: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    studentName: String,
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostRef: String,
    listedPrice: Number,
    offeredPrice: Number,
    duration: String,
    moveInDate: Date,
    status: { type: String, enum: ["pending", "countered", "accepted", "declined", "expired"], default: "pending" },
    rounds: [offerRoundSchema],
    expiresAt: Date
  },
  { timestamps: true }
);

rentOfferSchema.index({ room: 1, status: 1 });
rentOfferSchema.index({ student: 1, status: 1 });
rentOfferSchema.index({ host: 1, status: 1 });

module.exports = mongoose.model("RentOffer", rentOfferSchema);
