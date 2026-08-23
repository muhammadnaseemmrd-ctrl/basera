const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true },
    originalMessage: String,
    isFlagged: { type: Boolean, default: false },
    flagReason: String,
    readAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
