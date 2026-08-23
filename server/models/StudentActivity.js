const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    status: { type: String, enum: ["joined", "maybe", "cancelled"], default: "joined" },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const contributionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["jazzcash", "easypaisa", "stripe", "cash"], default: "jazzcash" },
    paymentRef: String,
    status: { type: String, enum: ["pending", "paid", "refunded"], default: "paid" },
    paidAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const studentActivitySchema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ["trip", "sports", "dining", "study", "shopping", "other"], default: "trip" },
    location: { type: String, required: true },
    activityDate: { type: Date, required: true },
    description: String,
    capacity: { type: Number, default: 8, min: 1 },
    contributionTarget: { type: Number, default: 0, min: 0 },
    contributionPerPerson: { type: Number, default: 0, min: 0 },
    paymentNote: String,
    status: { type: String, enum: ["planning", "open", "locked", "completed", "cancelled"], default: "open" },
    visibility: { type: String, enum: ["hostel", "campus", "public"], default: "campus" },
    participants: [participantSchema],
    contributions: [contributionSchema]
  },
  { timestamps: true }
);

studentActivitySchema.index({ activityDate: 1, status: 1 });
studentActivitySchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model("StudentActivity", studentActivitySchema);
