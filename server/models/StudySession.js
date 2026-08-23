const mongoose = require("mongoose");

const studySessionSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    hostelName: String,
    university: String,
    city: String,
    subject: String,
    location: String,
    scheduledAt: Date,
    maxParticipants: { type: Number, default: 6 },
    notes: String,
    sharedNotesUrl: String,
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organizerName: String,
    attendees: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, name: String, joinedAt: Date }],
    loyaltyAwarded: { type: Boolean, default: false },
    status: { type: String, enum: ["open", "full", "completed", "cancelled"], default: "open" }
  },
  { timestamps: true }
);

studySessionSchema.index({ hostel: 1, scheduledAt: 1 });
studySessionSchema.index({ hostelRef: 1, scheduledAt: 1 });
studySessionSchema.index({ city: 1, university: 1, scheduledAt: 1 });

module.exports = mongoose.model("StudySession", studySessionSchema);
