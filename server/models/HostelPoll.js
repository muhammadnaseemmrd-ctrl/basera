const mongoose = require("mongoose");

const pollOptionSchema = new mongoose.Schema(
  {
    label: String,
    votes: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { _id: true }
);

const hostelPollSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
    audience: { type: String, enum: ["students", "hosts", "all"], default: "students" },
    city: String,
    university: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, enum: ["mess", "activity", "maintenance", "policy", "general"], default: "general" },
    options: [pollOptionSchema],
    status: { type: String, enum: ["active", "closed", "hidden"], default: "active" },
    closesAt: Date
  },
  { timestamps: true }
);

hostelPollSchema.index({ status: 1, city: 1, university: 1, createdAt: -1 });

module.exports = mongoose.model("HostelPoll", hostelPollSchema);
