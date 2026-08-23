const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const ApiPartner = require("../models/ApiPartner");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const plans = [
  { tier: "FREE", price: 0, dailyLimit: 100, features: ["Read-only listings", "University widget"] },
  { tier: "DEVELOPER", price: 2999, dailyLimit: 10000, features: ["Listings API", "Availability API", "Partner analytics"] },
  { tier: "ENTERPRISE", price: null, dailyLimit: 100000, features: ["Custom integration", "Booking flow", "SLA support"] }
];

router.get("/plans", (req, res) => res.json({ results: plans }));

router.get("/admin/partners", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: [{ id: "api-demo", name: "NUST Housing Widget", tier: "DEVELOPER", dailyLimit: 10000, status: "active" }], demo: true });
    const results = await ApiPartner.find().sort({ createdAt: -1 }).lean();
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/partners", protect, authorize("admin"), async (req, res, next) => {
  try {
    const rawKey = `hh_${crypto.randomBytes(18).toString("hex")}`;
    const tier = req.body.tier || "FREE";
    const plan = plans.find((item) => item.tier === tier) || plans[0];
    const payload = {
      name: req.body.name,
      email: req.body.email,
      tier: plan.tier,
      dailyLimit: plan.dailyLimit,
      apiKeyHash: crypto.createHash("sha256").update(rawKey).digest("hex")
    };
    if (!isDbReady()) return res.status(201).json({ partner: { id: `api-${Date.now()}`, ...payload, apiKeyHash: undefined }, apiKey: rawKey, demo: true });
    const partner = await ApiPartner.create(payload);
    return res.status(201).json({ partner, apiKey: rawKey });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
