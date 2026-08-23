const mongoose = require("mongoose");

const roommateProfileSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    city: String,
    university: String,
    budget: Number,
    genderPreference: { type: String, enum: ["any", "boys", "girls", "professionals"], default: "any" },
    sleepSchedule: { type: String, enum: ["early", "balanced", "late"], default: "balanced" },
    studyStyle: { type: String, enum: ["silent", "normal", "group"], default: "normal" },
    cleanliness: { type: String, enum: ["relaxed", "regular", "strict"], default: "regular" },
    noiseTolerance: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    foodPreference: { type: String, enum: ["mess", "self_cook", "outside", "any"], default: "any" },
    guestsComfort: { type: String, enum: ["rare", "sometimes", "often"], default: "sometimes" },
    notes: String
  },
  { timestamps: true }
);

roommateProfileSchema.index({ city: 1, university: 1, budget: 1 });

module.exports = mongoose.model("RoommateProfile", roommateProfileSchema);
