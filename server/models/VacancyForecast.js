const mongoose = require("mongoose");

const vacancyForecastSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    roomRef: String,
    expectedVacancyDate: Date,
    confidence: Number,
    basedOn: [String],
    recommendedActions: [String],
    computedAt: Date
  },
  { timestamps: true }
);

vacancyForecastSchema.index({ room: 1, computedAt: -1 });
vacancyForecastSchema.index({ roomRef: 1, computedAt: -1 });

module.exports = mongoose.model("VacancyForecast", vacancyForecastSchema);
