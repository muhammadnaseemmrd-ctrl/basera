const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const FamilyAccess = require("../models/FamilyAccess");
const { bookings, hostels, users } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const demoFamily = [];
const tokenFor = () => `HHF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const statusPayload = (access = {}) => {
  const booking = bookings.find((item) => item.student === (access.studentRef || "u-student")) || bookings[0];
  const hostel = hostels.find((item) => item.id === booking.hostel) || hostels[0];
  return {
    guardianName: access.guardianName || "Parent",
    studentName: access.studentName || users.find((user) => user.id === booking.student)?.name || "Student",
    today: {
      location: `${hostel.name}, ${hostel.area}, ${hostel.city}`,
      rentPaid: booking.paymentStatus === "paid",
      lastSafeCheckInAt: access.lastSafeCheckInAt || new Date(Date.now() - 2 * 3600000).toISOString(),
      status: "Safe"
    },
    booking: {
      id: booking.id,
      hostelName: hostel.name,
      address: hostel.address,
      monthlyRent: booking.totalRent || booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      status: booking.status
    },
    safety: {
      emergencyContact: "0300-HOSTELH",
      notifications: { rent: access.notifyOnRent !== false, sos: access.notifyOnSOS !== false }
    },
    history: [
      { at: new Date(Date.now() - 2 * 3600000).toISOString(), event: "Safe check-in confirmed" },
      { at: new Date(Date.now() - 86400000).toISOString(), event: "Rent receipt verified" }
    ]
  };
};

router.post("/invite", protect, async (req, res, next) => {
  try {
    const accessToken = tokenFor();
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      studentName: req.user.name,
      guardianPhone: req.body.guardianPhone,
      guardianName: req.body.guardianName,
      relation: req.body.relation || "parent",
      accessToken,
      isVerified: false,
      notifyOnRent: req.body.notifyOnRent !== false,
      notifyOnSOS: req.body.notifyOnSOS !== false,
      expiresAt: new Date(Date.now() + 180 * 86400000)
    };
    if (!isDbReady()) {
      const access = { id: `family-${Date.now()}`, ...payload };
      demoFamily.unshift(access);
      return res.status(201).json({ access, portalUrl: `/parent/${accessToken}`, smsQueued: true, demo: true });
    }
    const access = await FamilyAccess.create(payload);
    return res.status(201).json({ access, portalUrl: `/parent/${accessToken}`, smsQueued: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/student-status", async (req, res, next) => {
  try {
    const token = req.query.token || req.headers["x-family-token"];
    if (!token) return res.status(400).json({ message: "Family access token is required." });
    if (!isDbReady()) return res.json({ status: statusPayload(demoFamily.find((item) => item.accessToken === token) || { accessToken: token }), demo: true });
    const access = await FamilyAccess.findOne({ accessToken: token }).lean();
    if (!access) return res.status(404).json({ message: "Family access not found." });
    return res.json({ status: statusPayload(access) });
  } catch (error) {
    return next(error);
  }
});

router.post("/check-in-request", async (req, res, next) => {
  try {
    const token = req.body.token || req.headers["x-family-token"];
    if (!token) return res.status(400).json({ message: "Family access token is required." });
    if (!isDbReady()) return res.json({ requested: true, notification: "Student check-in nudge queued.", demo: true });
    const access = await FamilyAccess.findOneAndUpdate({ accessToken: token }, { lastCheckInRequestedAt: new Date() }, { new: true });
    if (!access) return res.status(404).json({ message: "Family access not found." });
    return res.json({ requested: true, access });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
