const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    rating: { type: Number, min: 1, max: 5, required: true },
    cleanliness: { type: Number, min: 1, max: 5 },
    food: { type: Number, min: 1, max: 5 },
    internet: { type: Number, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    // Optional video/voice testimonial attached to the review (e.g. a Cloudinary media
    // URL). mediaType stays null when no media is attached.
    mediaUrl: { type: String, trim: true, default: null },
    mediaType: { type: String, enum: ["video", "audio", null], default: null },
    isVerifiedStay: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    moderationStatus: { type: String, enum: ["pending", "approved", "rejected", "flagged"], default: "approved" },
    moderationReason: String,
    flagCount: { type: Number, default: 0 },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date
  },
  { timestamps: true }
);

reviewSchema.index({ hostel: 1, createdAt: -1 });
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
