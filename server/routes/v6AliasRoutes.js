const express = require("express");
const { protect } = require("../middleware/auth");
const { rooms, hostels } = require("../data/mockData");

const router = express.Router();

router.post("/roommates/score", protect, (req, res) => {
  const preferences = req.body || {};
  const candidates = rooms.slice(0, 5).map((room, index) => ({
    roomId: room.id,
    title: room.title,
    compatibilityScore: Math.min(98, 72 + index * 4 + (preferences.studyStyle === "silent" && room.roomType === "SINGLE" ? 6 : 0)),
    reasons: ["Budget compatibility", "Study schedule fit", "Food preference fit"],
    suggestedRoommateRequestId: `rr-${room.id}`
  }));
  return res.json({ results: candidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore), demo: true });
});

router.post("/search-alerts", protect, (req, res) => {
  return res.status(201).json({
    search: {
      id: `sa-${Date.now()}`,
      title: req.body.title || "Saved search alert",
      filters: req.body.filters || req.body,
      trigger: req.body.trigger || "under_budget_or_near_university",
      isActive: true
    },
    matches: rooms.slice(0, 3),
    demo: true
  });
});

router.get("/campus-groups", protect, (req, res) => {
  return res.json({
    results: [
      { id: "cg-nust", name: "NUST Housing Circle", university: "NUST", city: "Islamabad", members: 1240, verified: true, topics: ["roommates", "alerts", "rides"] },
      { id: "cg-lums", name: "LUMS Basera Group", university: "LUMS", city: "Lahore", members: 860, verified: true, topics: ["PG rooms", "visits", "marketplace"] },
      { id: "cg-iba", name: "IBA Karachi Housing", university: "IBA", city: "Karachi", members: 640, verified: true, topics: ["female-only", "commute", "safety"] }
    ],
    demo: true
  });
});

router.post("/visits", protect, (req, res) => {
  const hostel = hostels.find((item) => item.id === req.body.hostelId) || hostels[0];
  return res.status(201).json({
    visit: {
      id: `visit-${Date.now()}`,
      hostelId: hostel.id,
      hostelName: hostel.name,
      visitType: req.body.visitType || "physical",
      preferredDate: req.body.preferredDate,
      preferredTime: req.body.preferredTime,
      status: "pending_host_approval"
    },
    demo: true
  });
});

router.get("/move-in/checklist", protect, (req, res) => {
  return res.json({
    checklist: {
      bookingId: req.query.bookingId || "b1",
      items: [
        { key: "pay-balance", label: "Pay any remaining balance", completed: false },
        { key: "upload-id", label: "Upload CNIC/student ID", completed: false },
        { key: "pack", label: "Pack bedding, lock, chargers and toiletries", completed: false },
        { key: "route", label: "Save move-in route and Host check-in window", completed: false },
        { key: "receipt", label: "Download QR receipt", completed: false }
      ]
    },
    demo: true
  });
});

module.exports = router;
