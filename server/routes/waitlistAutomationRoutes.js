const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const WaitlistRule = require("../models/WaitlistRule");
const { rooms } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoRules = [
  {
    id: "wl-1",
    title: "NUST shared room under 18k",
    city: "Islamabad",
    university: "NUST",
    maxBudget: 18000,
    roomType: "double",
    gender: "male",
    notifyChannels: ["app", "email"],
    status: "active",
    matches: []
  }
];

const normalizeRule = (rule = {}) => ({
  title: rule.title || `${rule.city || "Islamabad"} rooms under PKR ${rule.maxBudget || 20000}`,
  city: rule.city || "Islamabad",
  university: rule.university || "",
  maxBudget: Number(rule.maxBudget || 20000),
  roomType: rule.roomType || "",
  gender: rule.gender || "",
  notifyChannels: rule.notifyChannels?.length ? rule.notifyChannels : ["app"]
});

const matchRooms = (rule) =>
  rooms
    .filter((room) => !rule.city || room.city === rule.city)
    .filter((room) => !rule.university || String(room.nearestUniversity || "").toLowerCase().includes(String(rule.university).toLowerCase()))
    .filter((room) => !rule.maxBudget || Number(room.pricePerHead || room.pricePerBed || 0) <= Number(rule.maxBudget))
    .filter((room) => !rule.roomType || String(room.type || room.roomType || "").toLowerCase().includes(String(rule.roomType).toLowerCase()))
    .filter((room) => Number(room.availableBeds || 0) > 0)
    .slice(0, 5)
    .map((room) => ({
      roomId: room.id,
      title: room.title,
      pricePerHead: room.pricePerHead || room.pricePerBed,
      availableBeds: room.availableBeds,
      matchedAt: new Date().toISOString()
    }));

router.get("/rules", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoRules, demo: true });
    const results = await WaitlistRule.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/rules", protect, async (req, res, next) => {
  try {
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      ...normalizeRule(req.body),
      status: "active"
    };
    if (!isDbReady()) {
      const rule = { id: `wl-${Date.now()}`, ...payload, matches: [] };
      demoRules.unshift(rule);
      return res.status(201).json({ rule, demo: true });
    }
    const rule = await WaitlistRule.create(payload);
    return res.status(201).json({ rule });
  } catch (error) {
    return next(error);
  }
});

router.post("/rules/:id/run", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const rule = demoRules.find((item) => item.id === req.params.id) || demoRules[0];
      const matches = matchRooms(rule);
      Object.assign(rule, { matches, lastRunAt: new Date().toISOString(), status: matches.length ? "matched" : "active" });
      return res.json({ rule, matches, demo: true });
    }
    const rule = await WaitlistRule.findOne({ _id: req.params.id, student: req.user._id || req.user.id });
    if (!rule) return res.status(404).json({ message: "Waitlist rule not found." });
    const matches = matchRooms(rule);
    rule.matches = matches;
    rule.lastRunAt = new Date();
    rule.status = matches.length ? "matched" : "active";
    await rule.save();
    return res.json({ rule, matches });
  } catch (error) {
    return next(error);
  }
});

router.patch("/rules/:id", protect, async (req, res, next) => {
  try {
    const status = ["active", "paused", "matched"].includes(req.body.status) ? req.body.status : "active";
    if (!isDbReady()) {
      const rule = demoRules.find((item) => item.id === req.params.id) || demoRules[0];
      Object.assign(rule, { ...normalizeRule({ ...rule, ...req.body }), status });
      return res.json({ rule, demo: true });
    }
    const rule = await WaitlistRule.findOneAndUpdate(
      { _id: req.params.id, student: req.user._id || req.user.id },
      { ...normalizeRule(req.body), status },
      { new: true }
    );
    if (!rule) return res.status(404).json({ message: "Waitlist rule not found." });
    return res.json({ rule });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
