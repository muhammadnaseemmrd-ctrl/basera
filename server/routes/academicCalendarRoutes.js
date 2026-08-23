const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const AcademicEvent = require("../models/AcademicEvent");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoEvents = [
  { id: "acad-aug", university: "NUST", city: "Islamabad", eventType: "semester_start", title: "Semester Start Campaign", startDate: "2026-08-01", endDate: "2026-08-31", autoActions: ["Activate semester discount", "Boost near-campus rooms"] },
  { id: "acad-exam", university: "NUST", city: "Islamabad", eventType: "exam_season", title: "Exam Season Quiet Hostels", startDate: "2026-11-01", endDate: "2026-11-30", autoActions: ["Promote study lounge hostels", "Reduce activity nudges"] }
];

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.university) filter.university = req.query.university;
    if (req.query.city) filter.city = req.query.city;
    if (!isDbReady()) {
      return res.json({
        results: demoEvents.filter((event) => (!filter.university || event.university === filter.university) && (!filter.city || event.city === filter.city)),
        demo: true
      });
    }
    const results = await AcademicEvent.find({ ...filter, isActive: true }).sort({ startDate: 1 }).lean();
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.put("/", protect, authorize("admin"), async (req, res, next) => {
  try {
    const payload = {
      university: req.body.university || "NUST",
      city: req.body.city || "Islamabad",
      eventType: req.body.eventType || "custom",
      title: req.body.title || "Custom academic event",
      startDate: req.body.startDate || new Date(),
      endDate: req.body.endDate || new Date(Date.now() + 7 * 86400000),
      autoActions: req.body.autoActions || ["Manual admin action"],
      isActive: req.body.isActive !== false
    };
    if (!isDbReady()) {
      const event = { id: req.body.id || `acad-${Date.now()}`, ...payload };
      const index = demoEvents.findIndex((item) => item.id === event.id);
      if (index >= 0) demoEvents[index] = event;
      else demoEvents.unshift(event);
      return res.json({ event, demo: true });
    }
    const event = req.body.id
      ? await AcademicEvent.findByIdAndUpdate(req.body.id, payload, { new: true, upsert: true })
      : await AcademicEvent.create(payload);
    return res.json({ event });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
