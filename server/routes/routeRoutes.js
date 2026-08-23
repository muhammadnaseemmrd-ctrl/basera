const express = require("express");
const { protect } = require("../middleware/auth");
const { rooms } = require("../data/mockData");

const router = express.Router();

const coordsOf = (item = {}) => item.coordinates || (item.location?.coordinates ? { lat: item.location.coordinates[1], lng: item.location.coordinates[0] } : { lat: 33.6844, lng: 73.0479 });
const rad = (value) => (Number(value) * Math.PI) / 180;
const distanceKm = (from, to) => {
  const radius = 6371;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

router.post("/move-in", protect, (req, res) => {
  const room = rooms.find((item) => item.id === req.body.roomId) || rooms[0];
  const destination = coordsOf(room);
  const origin = req.body.origin || { label: "Bus Terminal", lat: 33.6389, lng: 73.0551 };
  const stops = [
    origin,
    { label: "CNIC photocopy / print stop", lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 },
    { label: room.title, ...destination }
  ];
  const km = distanceKm(origin, destination);
  return res.status(201).json({
    route: {
      title: `Move-in route to ${room.title}`,
      roomId: room.id,
      totalDistanceKm: Number(km.toFixed(2)),
      totalDurationMin: Math.max(8, Math.round((km / 22) * 60)),
      fareEstimate: Math.round(km * Number(process.env.RICKSHAW_FARE_PER_KM || 28)),
      stops,
      checklistStops: [
        { label: "Carry CNIC/student ID", completed: false },
        { label: "Confirm balance payment status", completed: false },
        { label: "Save Basera receipt QR", completed: false },
        { label: "Reach hostel during approved check-in window", completed: false }
      ]
    },
    demo: true
  });
});

router.get("/saved", protect, (req, res) => {
  return res.json({ results: [], demo: true });
});

module.exports = router;
