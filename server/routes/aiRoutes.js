const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const AIAuditLog = require("../models/AIAuditLog");
const { rooms, bookings } = require("../data/mockData");
const { askStudentConcierge, generateListingDescription, detectFinanceAnomaly, summarizeDispute, classifyReview } = require("../services/aiService");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const hashInput = (value) => crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex").slice(0, 16);

const audit = async (req, feature, input, output, sources = [], confidence = 0.76, providerOverride) => {
  const payload = {
    user: req.user?._id,
    userRef: req.user?.id,
    userRole: req.user?.role,
    feature,
    inputHash: hashInput(input),
    output,
    sources,
    confidence,
    provider: providerOverride || process.env.AI_PROVIDER || (process.env.AI_API_KEY ? "provider-ready" : "template-fallback"),
    guardrails: ["contact-gating", "human-review-required", "source-ids-returned"]
  };
  if (isDbReady()) await AIAuditLog.create(payload);
  return payload;
};

router.post("/student-concierge", protect, async (req, res, next) => {
  try {
    const question = String(req.body.question || "").toLowerCase();
    const matchedRooms = rooms
      .filter((room) => !req.body.city || room.city === req.body.city)
      .slice(0, 3);

    // Template-based reply is always computed first so behavior is never worse than
    // before if the real Claude API is unavailable, unconfigured, or times out.
    let answer = question.includes("contact")
      ? "Host phone, email and WhatsApp stay hidden until a paid confirmed booking. You can still chat safely inside Basera."
      : `I found ${matchedRooms.length} relevant rooms. Compare rent, deposit, commute, meals and safety before booking. For parents, use the parent share shortlist.`;
    let provider = "template-fallback";

    const claudeAnswer = await askStudentConcierge(req.body.question || "How does Basera work?");
    if (claudeAnswer) {
      answer = claudeAnswer;
      provider = "claude";
    }

    const output = { answer, recommendations: matchedRooms.map((room) => ({ id: room.id, title: room.title, pricePerHead: room.pricePerHead || room.pricePerBed })), nextActions: ["Open map search", "Compare rooms", "Share shortlist"] };
    const log = await audit(req, "student_concierge", req.body, output, matchedRooms.map((room) => room.id), 0.78, provider);
    return res.json({ ...output, confidence: log.confidence, provider: log.provider, auditId: log.inputHash, demo: log.provider !== "claude" });
  } catch (error) {
    return next(error);
  }
});

router.post("/listing-description", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const amenities = (req.body.amenities || ["WiFi", "secure entry", "study desk"]).join(", ");

    // Template-based description is always computed first so behavior is never worse
    // than before if the real Claude API is unavailable, unconfigured, or times out.
    let output = {
      english: `${req.body.title || "This verified room"} in ${req.body.area || "a student area"} is designed for practical student living with ${amenities}. Pricing, deposit and booking protection are handled transparently through Basera.`,
      urdu: `یہ کمرہ طلبہ کے لئے محفوظ اور عملی رہائش فراہم کرتا ہے۔ سہولیات میں ${amenities} شامل ہیں اور بکنگ Basera کے ذریعے شفاف طریقے سے ہوتی ہے۔`,
      contactLeakRemoved: true
    };
    let provider = "template-fallback";

    const listingDetails = [
      `Room title: ${req.body.title || "Untitled room"}`,
      `Area: ${req.body.area || "Unknown"}`,
      `Amenities: ${amenities}`,
      `Room type: ${req.body.roomType || "shared room"}`,
      `Price per head (PKR): ${req.body.pricePerHead || "not specified"}`
    ].join("\n");

    const claudeDescription = await generateListingDescription(listingDetails);
    if (claudeDescription) {
      output = { ...claudeDescription, contactLeakRemoved: true };
      provider = "claude";
    }

    const log = await audit(req, "listing_description", req.body, output, [req.body.roomId || "draft-room"], 0.82, provider);
    return res.json({ ...output, provider: log.provider, confidence: log.confidence, sourceIds: log.sources, demo: log.provider !== "claude" });
  } catch (error) {
    return next(error);
  }
});

router.post("/finance/anomaly", protect, authorize("admin", "finance", "finance_officer"), async (req, res, next) => {
  try {
    const anomalies = [
      { id: "anomaly-duplicate", severity: "medium", title: "Possible duplicate payment", amount: 23500, recommendation: "Check webhook idempotency before payout." },
      { id: "anomaly-payout", severity: "high", title: "Payout mismatch", amount: 74000, recommendation: "Hold payout until account title is verified." }
    ];

    // Template-based anomaly list is always computed first so behavior is never worse
    // than before if the real Claude API is unavailable, unconfigured, or times out.
    let output = { anomalies, humanApprovalRequired: true };
    let provider = "template-fallback";

    const financeContext = JSON.stringify(req.body?.transactions || req.body || {}, null, 2);
    const claudeAnomalies = await detectFinanceAnomaly(financeContext);
    if (claudeAnomalies) {
      output = { anomalies: claudeAnomalies.anomalies, humanApprovalRequired: true };
      provider = "claude";
    }

    const log = await audit(req, "finance_anomaly", req.body, output, output.anomalies.map((item) => item.id), 0.73, provider);
    return res.json({ ...output, provider: log.provider, confidence: log.confidence, demo: log.provider !== "claude" });
  } catch (error) {
    return next(error);
  }
});

router.post("/disputes/:id/summary", protect, authorize("admin"), async (req, res, next) => {
  try {
    const booking = bookings[0];

    // Template-based summary is always computed first so behavior is never worse than
    // before if the real Claude API is unavailable, unconfigured, or times out.
    let output = {
      disputeId: req.params.id,
      brief: "Student reported a possible off-platform payment request. Payment history shows booking was paid through Basera and escrow release should remain blocked until admin review.",
      evidence: ["booking_payment", "chat_flag", "student_report"],
      recommendedDecision: "Request Host response and keep payout on hold.",
      finalDecisionByHuman: true,
      bookingId: booking.id
    };
    let provider = "template-fallback";

    const disputeContext = [
      `Dispute ID: ${req.params.id}`,
      `Booking ID: ${booking.id}`,
      `Booking status: ${booking.status || "unknown"}`,
      req.body?.description ? `Reported description: ${req.body.description}` : null
    ].filter(Boolean).join("\n");

    const claudeSummary = await summarizeDispute(disputeContext);
    if (claudeSummary) {
      output = { disputeId: req.params.id, ...claudeSummary, finalDecisionByHuman: true, bookingId: booking.id };
      provider = "claude";
    }

    const log = await audit(req, "dispute_summary", { id: req.params.id }, output, output.evidence, 0.79, provider);
    return res.json({ summary: output, confidence: log.confidence, provider: log.provider, demo: log.provider !== "claude" });
  } catch (error) {
    return next(error);
  }
});

router.post("/reviews/classify", protect, authorize("admin"), async (req, res, next) => {
  try {
    const text = String(req.body.text || "");

    // Template-based classification is always computed first so behavior is never
    // worse than before if the real Claude API is unavailable, unconfigured, or times out.
    let output = {
      classification: /fake|scam|abuse/i.test(text) ? "needs_review" : "likely_valid",
      reasons: text.length < 20 ? ["Too short for high confidence"] : ["Contains stay-specific details"],
      confidence: text.length < 20 ? 0.58 : 0.81,
      moderationAction: text.length < 20 ? "request_more_context" : "approve"
    };
    let provider = "template-fallback";

    const claudeClassification = await classifyReview(text || "No review text provided.");
    if (claudeClassification) {
      output = claudeClassification;
      provider = "claude";
    }

    const log = await audit(req, "review_classifier", req.body, output, [req.body.reviewId || "review-draft"], output.confidence, provider);
    return res.json({ ...output, provider: log.provider, demo: log.provider !== "claude" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
