const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    mealId: String,
    day: String,
    type: { type: String, enum: ["breakfast", "lunch", "dinner"], default: "lunch" },
    items: [String],
    photoUrl: String,
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const messMenuSchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    weekStartDate: Date,
    meals: [mealSchema],
    city: String,
    messScore: { type: Number, default: 0 },
    updatedByName: String
  },
  { timestamps: true }
);

messMenuSchema.index({ hostel: 1, weekStartDate: -1 });
messMenuSchema.index({ hostelRef: 1, weekStartDate: -1 });
messMenuSchema.index({ city: 1, messScore: -1 });

module.exports = mongoose.model("MessMenu", messMenuSchema);
