const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Hostel = require("../models/Hostel");
const validate = require("../middleware/validate");
const { protect, authorize } = require("../middleware/auth");
const { recordAudit } = require("../services/auditService");
const { reviews } = require("../data/mockData");

const router = express.Router();

const moderationForComment = (comment = "", verifiedStay = false) => {
  const text = String(comment).toLowerCase();
  const hasContact = /(\+?\d[\d\s-]{8,}|@|whatsapp|direct payment|outside basera)/i.test(text);
  const hasAbuse = /(scam|fraud|thief|fake)/i.test(text);
  if (hasContact || hasAbuse) {
    return {
      moderationStatus: "flagged",
      isPublished: false,
      moderationReason: hasContact ? "Potential contact/payment leakage" : "Potential abuse or fraud allegation"
    };
  }
  if (!verifiedStay) return { moderationStatus: "pending", isPublished: false, moderationReason: "Non-verified stay requires admin approval" };
  return { moderationStatus: "approved", isPublished: true };
};

const publicReview = (review) => {
  const source = review?.toObject ? review.toObject() : review;
  return {
    ...source,
    id: String(source._id || source.id),
    studentName: source.student?.name || source.student || source.studentName,
    university: source.student?.university || source.university
  };
};

router.post(
  "/",
  protect,
  [
    body("hostel").notEmpty().withMessage("Hostel is required."),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5."),
    body("comment").trim().isLength({ min: 10 }).withMessage("Comment must be at least 10 characters."),
    // Optional video/voice testimonial URL -- a simple URL input for now. If this proves
    // popular, swap in the existing Cloudinary upload service for a real upload widget.
    body("mediaUrl").optional({ nullable: true, checkFalsy: true }).isURL().withMessage("Media URL must be a valid URL."),
    body("mediaType").optional({ nullable: true, checkFalsy: true }).isIn(["video", "audio"]).withMessage("Media type must be 'video' or 'audio'.")
  ],
  validate,
  async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        const moderation = moderationForComment(req.body.comment, true);
        const review = { id: `demo-${Date.now()}`, student: req.user.name, studentName: req.user.name, ...req.body, isVerifiedStay: true, ...moderation, createdAt: new Date().toISOString() };
        reviews.unshift(review);
        await recordAudit(req, { action: "review.submitted", entityType: "Review", entityId: review.id, metadata: moderation });
        return res.status(201).json({ review, demo: true });
      }

      const verifiedBooking = await Booking.findOne({
        student: req.user._id || req.user.id,
        hostel: req.body.hostel,
        status: { $in: ["completed", "confirmed"] }
      });

      const review = await Review.create({
        ...req.body,
        student: req.user._id || req.user.id,
        booking: verifiedBooking?._id,
        isVerifiedStay: Boolean(verifiedBooking),
        ...moderationForComment(req.body.comment, Boolean(verifiedBooking))
      });

      const aggregate = await Review.aggregate([
        { $match: { hostel: review.hostel, moderationStatus: "approved", isPublished: true } },
        { $group: { _id: "$hostel", average: { $avg: "$rating" }, count: { $sum: 1 } } }
      ]);
      if (aggregate[0]) {
        await Hostel.findByIdAndUpdate(review.hostel, {
          rating: { average: Number(aggregate[0].average.toFixed(1)), count: aggregate[0].count }
        });
      }

      await recordAudit(req, { action: "review.submitted", entityType: "Review", entityId: review._id, metadata: { moderationStatus: review.moderationStatus } });
      return res.status(201).json({ review });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/hostel/:hostelId", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: reviews.filter((review) => review.hostel === req.params.hostelId) });
    const results = await Review.find({ hostel: req.params.hostelId, isPublished: true, moderationStatus: "approved" }).populate("student", "name university avatar").sort({ createdAt: -1 });
    return res.json({ results: results.map(publicReview) });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/moderation", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const fallback = reviews.map((review) => ({
        ...review,
        studentName: review.studentName || review.student,
        moderationStatus: review.moderationStatus || "approved",
        isPublished: review.isPublished ?? true
      }));
      return res.json({ results: fallback, demo: true });
    }
    const results = await Review.find({ moderationStatus: { $in: ["pending", "flagged", "rejected", "approved"] } })
      .populate("student", "name university email")
      .populate("hostel", "name city")
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ results: results.map(publicReview) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/moderate", protect, authorize("admin"), async (req, res, next) => {
  try {
    const status = req.body.status || "approved";
    if (mongoose.connection.readyState !== 1) {
      const review = reviews.find((item) => item.id === req.params.id) || reviews[0];
      Object.assign(review, {
        moderationStatus: status,
        isPublished: status === "approved",
        moderationReason: req.body.reason,
        moderatedBy: req.user.id,
        moderatedAt: new Date().toISOString()
      });
      await recordAudit(req, { action: `review.${status}`, entityType: "Review", entityId: review.id, metadata: { reason: req.body.reason } });
      return res.json({ review: publicReview(review), demo: true });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        moderationStatus: status,
        isPublished: status === "approved",
        moderationReason: req.body.reason,
        moderatedBy: req.user._id || req.user.id,
        moderatedAt: new Date()
      },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: "Review not found." });
    await recordAudit(req, { action: `review.${status}`, entityType: "Review", entityId: review._id, metadata: { reason: req.body.reason } });
    return res.json({ review: publicReview(review) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deleted: true, demo: true });
    await Review.findByIdAndDelete(req.params.id);
    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
