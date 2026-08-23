const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    note: String
  },
  { _id: false }
);

const moveInChecklistSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    bookingRef: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    roomConditionPhotos: [String],
    items: [checklistItemSchema],
    studentSignedAt: Date,
    hostSignedAt: Date,
    status: { type: String, enum: ["pending", "student_ready", "host_ready", "completed"], default: "pending" }
  },
  { timestamps: true }
);

moveInChecklistSchema.index({ booking: 1 }, { unique: true, sparse: true });
moveInChecklistSchema.index({ bookingRef: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("MoveInChecklist", moveInChecklistSchema);
