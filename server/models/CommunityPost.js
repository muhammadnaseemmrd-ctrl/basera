const mongoose = require("mongoose");

const communityPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorName: String,
    authorRole: String,
    scope: { type: String, enum: ["global", "city", "university", "hostel"], default: "city" },
    city: String,
    university: String,
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel" },
    hostelName: String,
    type: { type: String, enum: ["announcement", "study_group", "roommate", "lost_found", "marketplace", "general"], default: "general" },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    images: [String],
    likes: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "published", "rejected", "hidden"], default: "published" },
    moderationNote: String
  },
  { timestamps: true }
);

communityPostSchema.index({ scope: 1, city: 1, university: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("CommunityPost", communityPostSchema);
