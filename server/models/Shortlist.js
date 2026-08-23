const mongoose = require("mongoose");

const shortlistSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    studentRef: String,
    title: { type: String, required: true },
    roomIds: [{ type: String }],
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }],
    shareToken: { type: String, unique: true, sparse: true },
    parentViewEnabled: { type: Boolean, default: true },
    parentEmail: String,
    note: String,
    expiresAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shortlist", shortlistSchema);
