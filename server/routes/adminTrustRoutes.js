const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const SafetyIncident = require("../models/SafetyIncident");
const PolicyRule = require("../models/PolicyRule");
const { hostels, adminDashboard } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const adminOnly = [protect, authorize("admin")];

const demoIncidents = [
  { id: "inc-1", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", category: "access", severity: "medium", status: "investigating", title: "Street access restriction", description: "Temporary access closure near main gate.", createdAt: new Date().toISOString() },
  { id: "inc-2", hostelName: "Gulberg Elite Home", city: "Lahore", category: "maintenance", severity: "low", status: "resolved", title: "Generator outage", description: "Resolved by Host within SLA.", createdAt: new Date(Date.now() - 86400000).toISOString() }
];

const demoPolicyRules = [
  { id: "rule-contact", ruleKey: "contact_leak_block", label: "Block contact leaks", description: "Reject phone/email/WhatsApp in listings and chat.", enabled: true, severity: "high", conditions: { contains: ["phone", "email", "url"] }, actions: { block: true, audit: true } },
  { id: "rule-payout", ruleKey: "payout_hold_dispute", label: "Hold payout on dispute", description: "Block Host payout while dispute is open.", enabled: true, severity: "critical", conditions: { bookingStatus: "disputed" }, actions: { holdPayout: true } },
  { id: "rule-late", ruleKey: "late_rent_escalation", label: "Escalate late rent", description: "Create reminder and late-fee review after configured days.", enabled: true, severity: "medium", conditions: { daysOverdue: 7 }, actions: { reminder: true, feeReview: true } }
];

router.get("/trust-queue", adminOnly, (req, res) => {
  const verificationRows = adminDashboard.verifications || adminDashboard.verificationQueue || [];
  return res.json({
    results: [
      ...verificationRows.map((item, index) => ({ id: `kyc-${index}`, type: "kyc", title: item.name, severity: "medium", status: "pending", reason: "Host verification documents need review." })),
      { id: "chat-flag-1", type: "chat", title: "Possible direct payment request", severity: "high", status: "pending", reason: "Chat contained off-platform wording." },
      { id: "listing-quality-1", type: "listing_quality", title: "Missing room photos", severity: "low", status: "pending", reason: "Listing has fewer than 3 photos." },
      { id: "off-platform-1", type: "off_platform_report", title: "Student report", severity: "critical", status: "pending", reason: "Host requested direct JazzCash transfer." }
    ],
    demo: !isDbReady()
  });
});

router.get("/safety/incidents", adminOnly, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoIncidents, demo: true });
    const query = {};
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    const results = await SafetyIncident.find(query).sort({ createdAt: -1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/safety/incidents", adminOnly, async (req, res, next) => {
  try {
    const payload = {
      hostelRef: req.body.hostelRef || "h1",
      hostelName: req.body.hostelName || "Cozy Boys Hostel F-10",
      city: req.body.city || "Islamabad",
      area: req.body.area,
      category: req.body.category || "general",
      severity: req.body.severity || "medium",
      title: req.body.title || "Safety incident",
      description: req.body.description,
      actions: [{ note: "Created by admin", actorName: req.user.name || req.user.email }]
    };
    if (!isDbReady()) {
      const incident = { id: `inc-${Date.now()}`, ...payload, status: "open", createdAt: new Date().toISOString() };
      demoIncidents.unshift(incident);
      return res.status(201).json({ incident, demo: true });
    }
    const incident = await SafetyIncident.create(payload);
    return res.status(201).json({ incident });
  } catch (error) {
    return next(error);
  }
});

router.post("/verification-visits", adminOnly, (req, res) => {
  const visits = (req.body.hostelIds || ["h1", "h2"]).map((id, index) => {
    const hostel = hostels.find((item) => item.id === id) || hostels[index % hostels.length];
    return {
      id: `field-${id}`,
      hostelId: hostel.id,
      hostelName: hostel.name,
      city: hostel.city,
      priorityScore: 88 - index * 7,
      routeOrder: index + 1,
      assignedTo: req.body.assignedTo || "Field Officer",
      scheduledDate: req.body.scheduledDate || new Date(Date.now() + (index + 1) * 86400000).toISOString()
    };
  });
  return res.status(201).json({ visits, demo: !isDbReady() });
});

router.get("/policy-rules", adminOnly, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoPolicyRules, demo: true });
    const results = await PolicyRule.find().sort({ updatedAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.patch("/policy-rules/:ruleKey", adminOnly, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const current = demoPolicyRules.find((rule) => rule.ruleKey === req.params.ruleKey) || demoPolicyRules[0];
      Object.assign(current, req.body, { updatedByName: req.user.name || req.user.email });
      return res.json({ rule: current, demo: true });
    }
    const rule = await PolicyRule.findOneAndUpdate(
      { ruleKey: req.params.ruleKey },
      { ...req.body, updatedBy: req.user._id || req.user.id, updatedByName: req.user.name || req.user.email },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ rule });
  } catch (error) {
    return next(error);
  }
});

router.get("/moderation/:id/explain", adminOnly, (req, res) => {
  return res.json({
    id: req.params.id,
    reasons: [
      { type: "contact_leak", evidence: "Detected phone-like pattern", confidence: 0.92 },
      { type: "payment_leak", evidence: "Contains direct transfer language", confidence: 0.81 }
    ],
    recommendedAction: "Reject or request edit before publishing.",
    sourceIds: [req.params.id],
    demo: !isDbReady()
  });
});

router.get("/city-scorecard", adminOnly, (req, res) => {
  const rows = ["Islamabad", "Lahore", "Karachi", "Peshawar"].map((city, index) => ({
    city,
    supplyScore: 86 - index * 8,
    demandScore: 82 - index * 5,
    universityCount: 8 - index,
    averageRent: 21000 - index * 1200,
    verifiedHostCoverage: 72 - index * 6,
    paidBookings: 160 - index * 35,
    launchReadiness: 84 - index * 7
  }));
  return res.json({ results: rows, demo: !isDbReady() });
});

module.exports = router;
