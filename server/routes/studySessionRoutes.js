const express = require("express");
const mongoose = require("mongoose");
const StudySession = require("../models/StudySession");
const { protect } = require("../middleware/auth");
const { demoStudySessions } = require("../data/demoRuntime");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const toId = (value) => String(value?._id || value?.id || value || "");

const publicSession = (session) => {
  const source = session?.toObject ? session.toObject() : session;
  return {
    ...source,
    id: toId(source),
    attendeeCount: source.attendees?.length || 0
  };
};

const matches = (session, query) => {
  if (query.city && String(session.city || "").toLowerCase() !== String(query.city).toLowerCase()) return false;
  if (query.university && !String(session.university || "").toLowerCase().includes(String(query.university).toLowerCase())) return false;
  if (query.hostelId && String(session.hostelRef || session.hostel || "") !== String(query.hostelId)) return false;
  return true;
};

router.get("/", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoStudySessions.filter((session) => matches(session, req.query)).map(publicSession), demo: true });
    const query = {};
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    if (req.query.university) query.university = new RegExp(req.query.university, "i");
    if (req.query.hostelId) query.$or = [{ hostel: req.query.hostelId }, { hostelRef: req.query.hostelId }];
    const results = await StudySession.find(query).populate("organizer hostel", "name city area").sort({ scheduledAt: 1 }).limit(100);
    return res.json({ results: results.map(publicSession) });
  } catch (error) {
    return next(error);
  }
});

router.get("/hostel/:hostelId", protect, async (req, res, next) => {
  try {
    req.query.hostelId = req.params.hostelId;
    if (!isDbReady()) return res.json({ results: demoStudySessions.filter((session) => matches(session, req.query)).map(publicSession), demo: true });
    const results = await StudySession.find({ $or: [{ hostel: req.params.hostelId }, { hostelRef: req.params.hostelId }] }).sort({ scheduledAt: 1 });
    return res.json({ results: results.map(publicSession) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    if (!req.body.subject || !req.body.scheduledAt) return res.status(400).json({ message: "Subject and scheduledAt are required." });
    const payload = {
      hostel: req.body.hostel,
      hostelRef: req.body.hostelRef || req.body.hostelId || "h1",
      hostelName: req.body.hostelName || "Cozy Boys Hostel F-10",
      university: req.body.university || req.user.university || "NUST",
      city: req.body.city || req.user.city || "Islamabad",
      subject: req.body.subject,
      location: req.body.location || "Common Room",
      scheduledAt: req.body.scheduledAt,
      maxParticipants: Number(req.body.maxParticipants || 6),
      notes: req.body.notes,
      sharedNotesUrl: req.body.sharedNotesUrl,
      organizer: req.user._id || req.user.id,
      organizerName: req.user.name || req.user.email,
      attendees: [{ student: req.user._id || req.user.id, id: req.user.id, name: req.user.name || "Organizer", joinedAt: new Date() }],
      status: "open"
    };
    if (!isDbReady()) {
      const session = { id: `study-${Date.now()}`, ...payload, scheduledAt: new Date(payload.scheduledAt).toISOString(), createdAt: new Date().toISOString() };
      demoStudySessions.unshift(session);
      return res.status(201).json({ session: publicSession(session), demo: true });
    }
    const session = await StudySession.create(payload);
    return res.status(201).json({ session: publicSession(session) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/join", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const session = demoStudySessions.find((item) => item.id === req.params.id) || demoStudySessions[0];
      session.attendees = session.attendees || [];
      if (!session.attendees.some((attendee) => attendee.id === req.user.id)) {
        session.attendees.push({ id: req.user.id, name: req.user.name || "Student", joinedAt: new Date().toISOString() });
      }
      if (session.attendees.length >= Number(session.maxParticipants || 6)) session.status = "full";
      return res.json({ session: publicSession(session), demo: true });
    }
    const session = await StudySession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Study session not found." });
    if (!session.attendees.some((attendee) => toId(attendee.student) === toId(req.user._id || req.user.id))) {
      session.attendees.push({ student: req.user._id || req.user.id, name: req.user.name || req.user.email, joinedAt: new Date() });
    }
    if (session.attendees.length >= session.maxParticipants) session.status = "full";
    await session.save();
    return res.json({ session: publicSession(session) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/complete", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const session = demoStudySessions.find((item) => item.id === req.params.id) || demoStudySessions[0];
      session.status = "completed";
      session.sharedNotesUrl = req.body.sharedNotesUrl || session.sharedNotesUrl;
      session.loyaltyAwarded = (session.attendees || []).length >= 3;
      return res.json({ session: publicSession(session), pointsAwarded: session.loyaltyAwarded ? 50 : 0, demo: true });
    }
    const session = await StudySession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Study session not found." });
    session.status = "completed";
    session.sharedNotesUrl = req.body.sharedNotesUrl || session.sharedNotesUrl;
    session.loyaltyAwarded = session.attendees.length >= 3;
    await session.save();
    return res.json({ session: publicSession(session), pointsAwarded: session.loyaltyAwarded ? 50 : 0 });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
