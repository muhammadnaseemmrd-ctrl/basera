const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const Room = require("../models/Room");
const { rooms, hostels } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const toId = (value) => String(value?._id || value?.id || value || "");
const priceFor = (room) => Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);

const hostelFor = (room) => hostels.find((hostel) => hostel.id === toId(room.hostel)) || hostels[0];

const roomScore = (room, prefs = {}) => {
  const price = priceFor(room);
  let score = 45;
  if (prefs.city && String(room.city).toLowerCase() === String(prefs.city).toLowerCase()) score += 12;
  if (prefs.university && String(room.nearestUniversity || "").toLowerCase().includes(String(prefs.university).toLowerCase())) score += 16;
  if (prefs.maxBudget && price <= Number(prefs.maxBudget)) score += 14;
  if (prefs.gender && String(room.genderPolicy || "").toLowerCase().includes(String(prefs.gender).toLowerCase())) score += 8;
  if (prefs.meals && ["FULL_BOARD", "TWO_MEALS", "BREAKFAST"].includes(room.mealPlan)) score += 6;
  if (prefs.safetyPriority && (room.amenities || []).some((item) => /security|cctv/i.test(item))) score += 8;
  if (room.instantBooking) score += 4;
  return Math.min(98, score);
};

const shapeRoom = (room, prefs = {}) => {
  const hostel = hostelFor(room);
  const price = priceFor(room);
  const deposit = Number(room.securityDeposit || 5000);
  const mealCost = Number(room.mealCost || 0);
  const commuteMinutes = Number(room.distanceToUniversity || 15);
  const safety = Math.min(100, 65 + (hostel.isVerified ? 18 : 0) + ((room.amenities || []).some((item) => /security|cctv/i.test(item)) ? 12 : 0));
  return {
    id: toId(room),
    title: room.title || `${room.roomType || room.type} room`,
    hostelName: hostel.name,
    city: room.city || hostel.city,
    area: room.area || hostel.area,
    roomType: room.roomType || String(room.type || "").toUpperCase(),
    genderPolicy: room.genderPolicy,
    pricePerHead: price,
    securityDeposit: deposit,
    mealCost,
    totalMonthlyCost: price + mealCost + Math.round(commuteMinutes * 28),
    totalMoveInCost: price + deposit + mealCost,
    nearestUniversity: room.nearestUniversity,
    commuteMinutes,
    availableBeds: room.availableBeds,
    image: room.photos?.[0] || room.images?.[0] || hostel.images?.[0],
    scores: {
      match: roomScore(room, prefs),
      value: Math.max(35, Math.round(100 - price / 700)),
      commute: Math.max(30, 100 - commuteMinutes * 3),
      safety,
      amenities: Math.min(100, (room.amenities || []).length * 10)
    },
    rankingReasons: [
      prefs.university ? `Near ${prefs.university}` : "Campus proximity considered",
      price <= Number(prefs.maxBudget || 999999) ? "Fits budget" : "Above preferred budget",
      safety >= 80 ? "Strong safety signals" : "Standard safety profile"
    ]
  };
};

router.post("/match-quiz", protect, async (req, res, next) => {
  try {
    const prefs = req.body || {};
    if (!isDbReady()) {
      const results = rooms.map((room) => shapeRoom(room, prefs)).sort((a, b) => b.scores.match - a.scores.match).slice(0, 8);
      return res.json({ results, explanation: "Ranked by budget, commute, safety, gender preference, meals, and availability.", sourceIds: results.map((room) => room.id), confidence: 0.82, demo: true });
    }
    const query = {};
    if (prefs.city) query.city = new RegExp(`^${prefs.city}$`, "i");
    if (prefs.maxBudget) query.pricePerHead = { $lte: Number(prefs.maxBudget) };
    if (prefs.university) query.nearestUniversity = new RegExp(prefs.university, "i");
    const rows = await Room.find(query).limit(24);
    const results = rows.map((room) => shapeRoom(room, prefs)).sort((a, b) => b.scores.match - a.scores.match).slice(0, 8);
    return res.json({ results, explanation: "Ranked by verified listing data and quiz preferences.", sourceIds: results.map((room) => room.id), confidence: 0.84 });
  } catch (error) {
    return next(error);
  }
});

router.get("/similar/:roomId", async (req, res) => {
  const current = rooms.find((room) => room.id === req.params.roomId) || rooms[0];
  const results = rooms
    .filter((room) => room.id !== current.id && (room.city === current.city || room.roomType === current.roomType))
    .slice(0, 6)
    .map((room) => shapeRoom(room, { city: current.city, university: current.nearestUniversity, maxBudget: current.pricePerHead + 8000 }));
  return res.json({ results, demo: !isDbReady() });
});

router.get("/explain/:roomId", async (req, res) => {
  const room = rooms.find((item) => item.id === req.params.roomId) || rooms[0];
  return res.json({
    roomId: req.params.roomId,
    factors: [
      { label: "Budget fit", value: priceFor(room) <= 25000 ? 88 : 62 },
      { label: "Commute", value: Math.max(40, 100 - Number(room.distanceToUniversity || 15) * 3) },
      { label: "Safety", value: (room.amenities || []).some((item) => /security|cctv/i.test(item)) ? 86 : 70 },
      { label: "Availability", value: Number(room.availableBeds || 0) > 0 ? 90 : 20 }
    ],
    confidence: 0.8,
    demo: !isDbReady()
  });
});

module.exports = router;
