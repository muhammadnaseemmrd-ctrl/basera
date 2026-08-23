const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { protect, authorize } = require("../middleware/auth");
const { sendRentReminders, processOverdue, processEscrowReleases, runDailyReminderJobs } = require("../services/reminderService");

const router = express.Router();

const requireCron = (req, res, next) => {
  if (!process.env.CRON_SECRET || req.headers["x-cron-secret"] === process.env.CRON_SECRET || req.user?.role === "admin") return next();
  return res.status(401).json({ message: "Invalid cron secret." });
};

const protectOrCron = (req, res, next) => {
  if (process.env.CRON_SECRET && req.headers["x-cron-secret"] === process.env.CRON_SECRET) {
    req.user = { id: "system-cron", role: "admin", system: true };
    return next();
  }
  return protect(req, res, next);
};

router.post("/rent", protectOrCron, authorize("admin", "finance"), requireCron, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ sent: 3, demo: true });
    return res.json(await sendRentReminders(req.body.days || req.query.days || 7));
  } catch (error) {
    return next(error);
  }
});

router.post("/overdue", protectOrCron, authorize("admin", "finance"), requireCron, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ overdueMarked: 1, lateFee: Number(process.env.LATE_FEE_PKR || 500), demo: true });
    return res.json(await processOverdue());
  } catch (error) {
    return next(error);
  }
});

router.post("/payout", protectOrCron, authorize("admin", "finance"), requireCron, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ processed: 2, demo: true });
    return res.json(await processEscrowReleases());
  } catch (error) {
    return next(error);
  }
});

router.post("/daily", protectOrCron, authorize("admin", "finance"), requireCron, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        sevenDay: { sent: 3 },
        oneDay: { sent: 1 },
        overdue: { overdueMarked: 1, lateFee: Number(process.env.LATE_FEE_PKR || 500) },
        payout: { processed: 2 },
        demo: true
      });
    }
    return res.json(await runDailyReminderJobs());
  } catch (error) {
    return next(error);
  }
});

router.post("/host/:bookingId", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ sent: true, bookingId: req.params.bookingId, demo: true });
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ sent: true, bookingId: booking._id, message: `Rent reminder sent for PKR ${booking.totalRent || booking.totalAmount}.` });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
