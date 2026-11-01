const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    status: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    byName: String,
    byRole: String,
    note: String,
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", default: null },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    category: {
      type: String,
      enum: ["plumbing", "electricity", "cleaning", "food", "wifi", "security", "furniture", "staff_conduct", "payment", "other"],
      default: "other"
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    evidence: [String],
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    status: { type: String, enum: ["raised", "under_review", "in_progress", "fixed", "resolved", "reopened", "escalated"], default: "raised" },
    assignedTo: String,
    reopenCount: { type: Number, default: 0 },
    reviewedAt: Date,
    fixedAt: Date,
    resolvedAt: Date,
    escalatedAt: Date,
    rating: { type: Number, min: 1, max: 5 },
    ratingComment: String,
    timeline: [timelineSchema]
  },
  { timestamps: true }
);

complaintSchema.index({ hostel: 1, status: 1, createdAt: -1 });
complaintSchema.index({ block: 1, status: 1 });
complaintSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("Complaint", complaintSchema);
