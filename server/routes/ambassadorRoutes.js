const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const CampusAmbassador = require("../models/CampusAmbassador");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoAmbassadors = [
  {
    id: "amb-1",
    name: "Ayesha Khan",
    email: "ayesha@nust.edu.pk",
    university: "NUST",
    city: "Islamabad",
    strengths: ["hostel tours", "student onboarding", "safety checks"],
    status: "approved",
    trustScore: 92,
    tasksCompleted: 18
  },
  {
    id: "amb-2",
    name: "Bilal Raza",
    email: "bilal@lums.edu.pk",
    university: "LUMS",
    city: "Lahore",
    strengths: ["campus events", "roommate intros", "referrals"],
    status: "approved",
    trustScore: 88,
    tasksCompleted: 11
  }
];

router.get("/", async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoAmbassadors.filter((item) => item.status === "approved"), demo: true });
    const results = await CampusAmbassador.find({ status: "approved" }).sort({ trustScore: -1, tasksCompleted: -1 }).limit(40);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/apply", protect, async (req, res, next) => {
  try {
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      name: req.body.name || req.user.name,
      email: req.body.email || req.user.email,
      university: req.body.university || req.user.university || "NUST",
      city: req.body.city || req.user.city || "Islamabad",
      strengths: req.body.strengths || ["referrals", "student support"]
    };
    if (!isDbReady()) {
      const application = { id: `amb-${Date.now()}`, ...payload, status: "applied", trustScore: 70, tasksCompleted: 0 };
      demoAmbassadors.unshift(application);
      return res.status(201).json({ application, demo: true });
    }
    const application = await CampusAmbassador.create(payload);
    return res.status(201).json({ application });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoAmbassadors, demo: true });
    const results = await CampusAmbassador.find().populate("student").sort({ createdAt: -1 }).limit(200);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    const status = ["approved", "rejected", "paused"].includes(req.body.status) ? req.body.status : "approved";
    const patch = {
      status,
      reviewedByName: req.user.name || req.user.email,
      approvedAt: status === "approved" ? new Date() : undefined,
      trustScore: req.body.trustScore
    };
    if (!isDbReady()) {
      const current = demoAmbassadors.find((item) => item.id === req.params.id) || demoAmbassadors[0];
      Object.assign(current, patch);
      return res.json({ ambassador: current, demo: true });
    }
    const ambassador = await CampusAmbassador.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!ambassador) return res.status(404).json({ message: "Ambassador application not found." });
    return res.json({ ambassador });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
