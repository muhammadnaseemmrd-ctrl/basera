const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    name: { type: String, required: true, trim: true },
    wardenId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    floorCount: { type: Number, default: 1 },
    notes: String
  },
  { timestamps: true }
);

blockSchema.index({ hostelId: 1 });
blockSchema.index({ wardenId: 1 });

module.exports = mongoose.model("Block", blockSchema);
