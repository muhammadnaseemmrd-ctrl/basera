const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const PushSubscription = require("../models/PushSubscription");

const router = express.Router();

router.get("/", protect, (req, res) => {
  const baseNotifications = req.user.notifications || [];
  const smartNotifications = [
    { id: "n-rent", message: "Rent due in 7 days. Pay through Basera to keep escrow protection.", read: false, createdAt: new Date() },
    { id: "n-escrow", message: "Escrow payout will release 48 hours after move-in if no dispute is raised.", read: false, createdAt: new Date() },
    { id: "n-visit", type: "visit", message: "Your hostel visit is confirmed for Cozy Boys Hostel F-10.", read: false, actionPath: "/dashboard/student/community", createdAt: new Date() },
    { id: "n-poll", type: "poll", message: "New mess menu poll is open for your hostel.", read: false, actionPath: "/dashboard/student/community", createdAt: new Date() },
    { id: "n-movein", type: "move_in", message: "Complete your move-in checklist before arrival.", read: false, actionPath: "/dashboard/student/community", createdAt: new Date() }
  ];
  const notifications = baseNotifications.length ? [...baseNotifications, ...smartNotifications] : smartNotifications;
  res.json({ results: notifications });
});

router.put("/:id/read", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1 && req.user.notifications) {
      req.user.notifications = req.user.notifications.map((item) => (String(item._id || item.id) === req.params.id ? { ...item, read: true } : item));
      await req.user.save();
    }
    return res.json({ read: true, id: req.params.id, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/mark-all-read", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1 && req.user.notifications) {
      req.user.notifications = req.user.notifications.map((item) => ({ ...item, read: true }));
      await req.user.save();
    }
    return res.json({ read: true, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/push/subscribe", protect, async (req, res, next) => {
  try {
    const subscription = req.body.subscription || req.body;
    if (!subscription?.endpoint) return res.status(400).json({ message: "Push subscription endpoint is required." });

    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        subscribed: true,
        subscription: { id: `push-${Date.now()}`, endpoint: subscription.endpoint, active: true },
        demo: true
      });
    }

    const record = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        user: req.user._id || req.user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys || {},
        userAgent: req.headers["user-agent"],
        active: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ subscribed: true, subscription: record });
  } catch (error) {
    return next(error);
  }
});

router.delete("/push/:id", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await PushSubscription.findByIdAndUpdate(req.params.id, { active: false });
    }
    return res.json({ unsubscribed: true, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
