const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const RentOffer = require("../models/RentOffer");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoOffers = [
  {
    id: "offer-demo-1",
    roomRef: "r5",
    roomTitle: "Executive Triple Sharing",
    studentName: "Ali Ahmed",
    listedPrice: 18000,
    offeredPrice: 16000,
    duration: "Monthly",
    status: "pending",
    trustScore: 87,
    rounds: [{ by: "student", price: 16000, message: "Final-year student, can pay on time.", createdAt: new Date().toISOString() }]
  }
];

const updateDemoOffer = (id, patch) => {
  const offer = demoOffers.find((item) => item.id === id || item._id === id) || demoOffers[0];
  Object.assign(offer, patch);
  return offer;
};

router.get("/my", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoOffers, demo: true });
    const role = req.user.role;
    const query = ["host", "owner", "landlord", "admin"].includes(role) ? { host: req.user._id || req.user.id } : { student: req.user._id || req.user.id };
    const results = await RentOffer.find(query).populate("room student host").sort({ createdAt: -1 }).lean();
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/accept", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ offer: updateDemoOffer(req.params.id, { status: "accepted", acceptedAt: new Date().toISOString() }), demo: true });
    const offer = await RentOffer.findByIdAndUpdate(req.params.id, { status: "accepted", $push: { rounds: { by: "host", price: req.body.price, message: req.body.message || "Offer accepted." } } }, { new: true });
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    return res.json({ offer, negotiatedPrice: offer.offeredPrice });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/counter", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const price = Number(req.body.price || req.body.counterPrice || 0);
    if (price <= 0) return res.status(400).json({ message: "Counter price is required." });
    if (!isDbReady()) {
      const offer = updateDemoOffer(req.params.id, { status: "countered", offeredPrice: price });
      offer.rounds.push({ by: "host", price, message: req.body.message || "Can you do this price?", createdAt: new Date().toISOString() });
      return res.json({ offer, demo: true });
    }
    const offer = await RentOffer.findByIdAndUpdate(req.params.id, { status: "countered", offeredPrice: price, $push: { rounds: { by: "host", price, message: req.body.message } } }, { new: true });
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    return res.json({ offer });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/decline", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ offer: updateDemoOffer(req.params.id, { status: "declined", declineReason: req.body.reason }), demo: true });
    const offer = await RentOffer.findByIdAndUpdate(req.params.id, { status: "declined", $push: { rounds: { by: "host", message: req.body.reason || "Declined." } } }, { new: true });
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    return res.json({ offer });
  } catch (error) {
    return next(error);
  }
});

module.exports = { router, demoOffers };
