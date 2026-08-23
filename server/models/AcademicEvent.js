const mongoose = require("mongoose");

const academicEventSchema = new mongoose.Schema(
  {
    university: String,
    city: String,
    eventType: {
      type: String,
      enum: ["semester_start", "mid_terms", "exam_season", "semester_end", "eid_break", "summer_break", "custom"],
      default: "custom"
    },
    title: String,
    startDate: Date,
    endDate: Date,
    autoActions: [String],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

academicEventSchema.index({ university: 1, city: 1, startDate: 1 });
academicEventSchema.index({ eventType: 1, startDate: 1 });

module.exports = mongoose.model("AcademicEvent", academicEventSchema);
