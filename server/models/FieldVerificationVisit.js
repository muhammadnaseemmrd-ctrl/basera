const mongoose = require("mongoose");

const fieldVerificationVisitSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    hostelName: String,
    city: String,
    assignedTo: String,
    scheduledAt: Date,
    status: { type: String, enum: ["scheduled", "in_progress", "submitted", "approved", "rejected"], default: "scheduled" },
    gps: {
      lat: Number,
      lng: Number
    },
    checklist: [
      {
        key: String,
        label: String,
        passed: Boolean,
        note: String
      }
    ],
    photos: [String],
    signature: String,
    qualityScore: Number,
    submittedAt: Date,
    reviewedAt: Date,
    reviewedByName: String
  },
  { timestamps: true }
);

fieldVerificationVisitSchema.index({ status: 1, city: 1 });

module.exports = mongoose.model("FieldVerificationVisit", fieldVerificationVisitSchema);
