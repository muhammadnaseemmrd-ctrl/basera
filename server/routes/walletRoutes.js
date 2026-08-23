const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const StudentWallet = require("../models/StudentWallet");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoWallet = {
  id: "wallet-demo",
  balance: 3500,
  loyaltyPoints: 4200,
  credits: [
    { id: "credit-ref", type: "referral", amount: 0, points: 1000, source: "Referral", note: "Hamza joined Basera.", createdAt: new Date().toISOString() },
    { id: "credit-report", type: "protection_credit", amount: 500, points: 0, source: "Off-platform report", note: "Protection credit issued.", createdAt: new Date().toISOString() },
    { id: "credit-refund", type: "refund_credit", amount: 3000, points: 0, source: "Deposit refund", note: "Available for next booking.", createdAt: new Date().toISOString() }
  ],
  debits: [{ id: "debit-booking", type: "booking_discount", amount: 500, source: "Booking HH-demo", note: "Applied wallet credit.", createdAt: new Date().toISOString() }]
};

router.get("/credits", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ wallet: demoWallet, demo: true });
    let wallet = await StudentWallet.findOne({ student: req.user._id || req.user.id });
    if (!wallet) wallet = await StudentWallet.create({ student: req.user._id || req.user.id, studentRef: req.user.id, credits: [], debits: [] });
    return res.json({ wallet });
  } catch (error) {
    return next(error);
  }
});

router.post("/credits/apply", protect, async (req, res) => {
  const amount = Math.max(0, Number(req.body.amount || 0));
  return res.json({
    applied: Math.min(amount, demoWallet.balance),
    remainingBalance: Math.max(0, demoWallet.balance - amount),
    bookingId: req.body.bookingId,
    demo: !isDbReady()
  });
});

module.exports = router;
