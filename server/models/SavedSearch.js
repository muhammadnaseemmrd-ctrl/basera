const mongoose = require("mongoose");

const savedSearchSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    filters: {
      city: String,
      university: String,
      maxBudget: Number,
      roomType: String,
      genderPolicy: String,
      amenities: [String]
    },
    frequency: { type: String, enum: ["instant", "daily", "weekly"], default: "daily" },
    isActive: { type: Boolean, default: true },
    lastMatchedAt: Date
  },
  { timestamps: true }
);

savedSearchSchema.index({ student: 1, isActive: 1 });
savedSearchSchema.index({ "filters.city": 1, "filters.maxBudget": 1 });

module.exports = mongoose.model("SavedSearch", savedSearchSchema);
