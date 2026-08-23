const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const Room = require("../models/Room");
const HostReputationScore = require("../models/HostReputationScore");
const { computePricingSuggestion } = require("../services/pricingService");
const { rooms, hostels, bookings, users } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const hostAccess = [protect, authorize("host", "owner", "landlord", "admin")];

const ownedRooms = (user) => rooms.filter((room) => room.listedBy === (user.id || user._id) || ["u-owner", "u-landlord"].includes(user.id));
const priceFor = (room) => Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);

router.get("/growth-coach", hostAccess, (req, res) => {
  const rows = ownedRooms(req.user);
  const avgPhotoCount = rows.length ? rows.reduce((sum, room) => sum + Number(room.photos?.length || room.images?.length || 1), 0) / rows.length : 1;
  return res.json({
    score: Math.round(72 + Math.min(18, avgPhotoCount * 2)),
    recommendations: [
      { title: "Add 360 tour media", impact: "High", action: "Upload virtualTourUrl or panoramaUrl for top rooms.", metric: "+8% conversion" },
      { title: "Improve listing descriptions", impact: "Medium", action: "Use the AI description generator and remove vague rules.", metric: "+5% trust" },
      { title: "Tighten response time", impact: "High", action: "Use reply templates for visits and payment queries.", metric: "Target under 20 min" },
      { title: "Price within area range", impact: "Medium", action: "Review suggested rent against nearby rooms.", metric: "Reduce vacancy" }
    ],
    listingHealth: rows.map((room) => ({ id: room.id, title: room.title, photos: room.photos?.length || 1, score: 70 + Math.min(20, (room.amenities || []).length * 2) })),
    demo: !isDbReady()
  });
});

router.get("/pricing/suggestions", hostAccess, async (req, res, next) => {
  try {
    const suggestion = await computePricingSuggestion({
      city: req.query.city || "Islamabad",
      roomType: req.query.roomType || "DOUBLE",
      roomId: req.query.roomId
    });
    return res.json(suggestion);
  } catch (error) {
    return next(error);
  }
});

router.get("/availability-calendar", hostAccess, (req, res) => {
  const base = new Date();
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(base.getTime() + index * 86400000);
    return {
      date: date.toISOString().slice(0, 10),
      occupied: 32 + (index % 6),
      vacant: 8 - (index % 3),
      held: index % 5 === 0 ? 2 : 1,
      repairBlocked: index % 7 === 0 ? 1 : 0,
      moveOuts: index % 9 === 0 ? 1 : 0
    };
  });
  return res.json({ days, legend: ["occupied", "vacant", "held", "repairBlocked", "moveOuts"], demo: !isDbReady() });
});

router.patch("/rooms/bulk", hostAccess, async (req, res, next) => {
  try {
    const roomIds = (req.body.roomIds || []).slice(0, 50);
    const patch = {};
    ["pricePerHead", "pricePerRoom", "availableBeds", "mealPlan", "curfewTime"].forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== "") patch[field] = ["pricePerHead", "pricePerRoom", "availableBeds"].includes(field) ? Number(req.body[field]) : req.body[field];
    });
    if (!isDbReady()) {
      return res.json({ updated: roomIds.length || ownedRooms(req.user).length, patch, demo: true });
    }
    const result = await Room.updateMany({ _id: { $in: roomIds } }, { $set: patch });
    return res.json({ updated: result.modifiedCount, patch });
  } catch (error) {
    return next(error);
  }
});

router.get("/tenants/:id/profile", hostAccess, (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
  const student = users.find((user) => user.id === booking.student) || users.find((user) => user.role === "student") || users[0];
  const room = rooms.find((item) => item.id === booking.room) || rooms[0];
  return res.json({
    profile: {
      bookingId: booking.id,
      tenant: student,
      room,
      rentStatus: booking.status === "overdue" ? "overdue" : "current",
      documents: [{ label: "Booking receipt", status: "available" }, { label: "Move-in checklist", status: "available" }],
      disputes: [{ id: "dispute-demo", status: "none", summary: "No active disputes." }],
      reminders: [{ title: "Next rent due", dueAt: booking.nextRentDueDate || new Date(Date.now() + 7 * 86400000).toISOString() }]
    },
    demo: !isDbReady()
  });
});

router.get("/reply-templates", hostAccess, (req, res) => {
  return res.json({
    results: [
      { id: "visit", category: "visit", title: "Visit confirmation", body: "Your visit request is received. Please select a time slot from Basera so we can confirm safely." },
      { id: "rules", category: "rules", title: "House rules", body: "Rules are visible in the listing. Payments and confirmations must stay inside Basera." },
      { id: "checkin", category: "check-in", title: "Check-in instructions", body: "After confirmed payment, Basera will unlock contact and move-in details." }
    ],
    demo: !isDbReady()
  });
});

router.get("/reputation", hostAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        reputation: {
          score: 86,
          responseTime: 22,
          cancellationRate: 2,
          disputeRate: 1,
          reviewScore: 4.7,
          factors: [
            { label: "Response time", value: 88, tone: "green" },
            { label: "Verified documents", value: 92, tone: "green" },
            { label: "Dispute rate", value: 84, tone: "blue" },
            { label: "Review quality", value: 90, tone: "green" }
          ],
          recommendations: [{ title: "Keep response under 20 minutes", impact: "Improves rank", action: "Use reply templates." }]
        },
        demo: true
      });
    }
    const reputation = await HostReputationScore.findOne({ host: req.user._id || req.user.id }) || await HostReputationScore.create({ host: req.user._id || req.user.id, hostName: req.user.name });
    return res.json({ reputation });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
