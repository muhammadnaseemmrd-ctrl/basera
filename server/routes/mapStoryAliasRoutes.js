const express = require("express");
const mongoose = require("mongoose");
const MapStory = require("../models/MapStory");
const { protect, authorize } = require("../middleware/auth");
const { demoMapStories } = require("../data/demoRuntime");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

router.get("/", async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoMapStories, demo: true });
    const results = await MapStory.find({ status: "published" }).sort({ createdAt: -1 }).limit(50);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const stops = (req.body.stops || []).slice(0, 5).map((stop, index) => ({ ...stop, order: index + 1 }));
    if (!stops.length) return res.status(400).json({ message: "At least one story stop is required." });
    const payload = {
      hostelRef: req.body.hostelRef || req.body.hostelId || "h1",
      hostelName: req.body.hostelName,
      title: req.body.title || "Neighbourhood Tour",
      createdBy: req.user._id || req.user.id,
      createdByName: req.user.name || req.user.email,
      status: "published",
      stops
    };
    if (!isDbReady()) {
      const story = { id: `story-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoMapStories.unshift(story);
      return res.status(201).json({ story, demo: true });
    }
    const story = await MapStory.create(payload);
    return res.status(201).json({ story });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
