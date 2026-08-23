const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const FieldVerificationVisit = require("../models/FieldVerificationVisit");
const { hostels } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const fieldAccess = [protect, authorize("admin")];

const checklistTemplate = [
  { key: "gps_match", label: "GPS matches listed address", passed: false },
  { key: "room_photos", label: "Room photos match listing", passed: false },
  { key: "safety", label: "CCTV/fire/extinguisher/safe entry checked", passed: false },
  { key: "documents", label: "Owner CNIC/property proof verified", passed: false },
  { key: "agreement", label: "Basera Host agreement signed", passed: false }
];

const demoVisits = [
  { id: "fv-1", hostelRef: "h1", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", assignedTo: "Field Officer", scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: "scheduled", checklist: checklistTemplate, qualityScore: 0 },
  { id: "fv-2", hostelRef: "h2", hostelName: "Pine Crest Boys Hostel", city: "Islamabad", assignedTo: "Field Officer", scheduledAt: new Date().toISOString(), status: "submitted", checklist: checklistTemplate.map((item) => ({ ...item, passed: true })), qualityScore: 92 }
];

const scoreChecklist = (items = []) => {
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.passed).length / items.length) * 100);
};

router.get("/visits", fieldAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoVisits, demo: true });
    const results = await FieldVerificationVisit.find(req.query.status ? { status: req.query.status } : {}).sort({ scheduledAt: 1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/visits", fieldAccess, async (req, res, next) => {
  try {
    const hostel = hostels.find((item) => item.id === req.body.hostelId) || hostels[0];
    const payload = {
      hostelRef: hostel.id,
      hostelName: req.body.hostelName || hostel.name,
      city: req.body.city || hostel.city,
      assignedTo: req.body.assignedTo || "Field Officer",
      scheduledAt: req.body.scheduledAt || new Date(Date.now() + 86400000),
      checklist: checklistTemplate
    };
    if (!isDbReady()) {
      const visit = { id: `fv-${Date.now()}`, ...payload, status: "scheduled", qualityScore: 0 };
      demoVisits.unshift(visit);
      return res.status(201).json({ visit, demo: true });
    }
    const visit = await FieldVerificationVisit.create(payload);
    return res.status(201).json({ visit });
  } catch (error) {
    return next(error);
  }
});

router.patch("/visits/:id/checklist", fieldAccess, async (req, res, next) => {
  try {
    const checklist = req.body.checklist || checklistTemplate;
    const qualityScore = scoreChecklist(checklist);
    if (!isDbReady()) {
      const visit = demoVisits.find((item) => item.id === req.params.id) || demoVisits[0];
      Object.assign(visit, { checklist, qualityScore, status: "in_progress" });
      return res.json({ visit, demo: true });
    }
    const visit = await FieldVerificationVisit.findByIdAndUpdate(req.params.id, { checklist, qualityScore, status: "in_progress" }, { new: true });
    if (!visit) return res.status(404).json({ message: "Visit not found." });
    return res.json({ visit });
  } catch (error) {
    return next(error);
  }
});

router.post("/visits/:id/submit", fieldAccess, async (req, res, next) => {
  try {
    const checklist = req.body.checklist || checklistTemplate.map((item) => ({ ...item, passed: true }));
    const qualityScore = scoreChecklist(checklist);
    const patch = {
      checklist,
      qualityScore,
      gps: req.body.gps || { lat: 33.6938, lng: 73.0139 },
      photos: req.body.photos || [],
      signature: req.body.signature,
      status: "submitted",
      submittedAt: new Date()
    };
    if (!isDbReady()) {
      const visit = demoVisits.find((item) => item.id === req.params.id) || demoVisits[0];
      Object.assign(visit, { ...patch, submittedAt: patch.submittedAt.toISOString() });
      return res.json({ visit, demo: true });
    }
    const visit = await FieldVerificationVisit.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!visit) return res.status(404).json({ message: "Visit not found." });
    return res.json({ visit });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
