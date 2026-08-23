const mongoose = require("mongoose");

const alumniReviewSchema = new mongoose.Schema(
  {
    pros: [String],
    cons: [String],
    text: { type: String, maxlength: 500 },
    rating: Number,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const alumniRecordSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentRef: String,
    university: String,
    graduationYear: Number,
    monthsStayed: Number,
    badge: { type: String, default: "Alumni" },
    review: alumniReviewSchema,
    referralsGenerated: { type: Number, default: 0 }
  },
  { timestamps: true }
);

alumniRecordSchema.index({ hostel: 1, university: 1, graduationYear: 1 });
alumniRecordSchema.index({ hostelRef: 1, university: 1, graduationYear: 1 });
alumniRecordSchema.index({ student: 1, hostel: 1 });

module.exports = mongoose.model("AlumniRecord", alumniRecordSchema);
