const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const GroupBooking = require("../models/GroupBooking");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const demoGroups = [];

router.post("/", protect, async (req, res, next) => {
  try {
    const invites = (req.body.invites || []).map((invite) => ({ email: invite.email || invite, name: invite.name, status: "invited" }));
    const payload = {
      leadStudent: req.user._id,
      leadStudentRef: req.user.id,
      leadStudentName: req.user.name,
      roomRefs: req.body.roomIds || ["r1", "r4", "r5"],
      invites,
      discountApplied: invites.length >= 2 ? 5 : 0,
      status: "holding",
      expiresAt: new Date(Date.now() + 48 * 3600000)
    };
    if (!isDbReady()) {
      const group = { id: `grp-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoGroups.unshift(group);
      return res.status(201).json({ group, demo: true });
    }
    const group = await GroupBooking.create(payload);
    return res.status(201).json({ group });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ group: demoGroups.find((item) => item.id === req.params.id) || demoGroups[0] || null, demo: true });
    const group = await GroupBooking.findById(req.params.id).populate("leadStudent bookingIds").lean();
    if (!group) return res.status(404).json({ message: "Group booking not found." });
    return res.json({ group });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/join", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const group = demoGroups.find((item) => item.id === req.params.id) || demoGroups[0];
      if (!group) return res.status(404).json({ message: "Group booking not found." });
      const invite = group.invites.find((item) => item.email === req.user.email) || group.invites[0];
      Object.assign(invite, { status: "joined", student: req.user.id, joinedAt: new Date().toISOString() });
      return res.json({ group, joined: true, demo: true });
    }
    const group = await GroupBooking.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group booking not found." });
    const invite = group.invites.find((item) => item.email === req.user.email) || group.invites[0];
    if (invite) Object.assign(invite, { status: "joined", student: req.user._id || req.user.id, joinedAt: new Date() });
    await group.save();
    return res.json({ group, joined: true });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/confirm", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const group = demoGroups.find((item) => item.id === req.params.id) || demoGroups[0];
      if (!group) return res.status(404).json({ message: "Group booking not found." });
      group.status = "confirmed";
      return res.json({ group, demo: true });
    }
    const group = await GroupBooking.findByIdAndUpdate(req.params.id, { status: "confirmed" }, { new: true });
    if (!group) return res.status(404).json({ message: "Group booking not found." });
    return res.json({ group });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
