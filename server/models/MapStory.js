const mongoose = require("mongoose");

const mapStorySchema = new mongoose.Schema(
  {
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelRef: String,
    hostelName: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
    title: { type: String, default: "Neighbourhood Tour" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "published" },
    stops: [
      {
        title: String,
        description: String,
        lat: Number,
        lng: Number,
        photo: String,
        order: Number
      }
    ]
  },
  { timestamps: true }
);

mapStorySchema.index({ hostel: 1, status: 1 });
mapStorySchema.index({ hostelRef: 1, status: 1 });

module.exports = mongoose.model("MapStory", mapStorySchema);
