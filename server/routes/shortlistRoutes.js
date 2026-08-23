const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const Shortlist = require("../models/Shortlist");
const { rooms, hostels } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const demoShortlists = [];

const tokenFor = () => `HHSL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const shapeRoom = (room) => {
  const hostel = hostels.find((item) => item.id === room.hostel) || hostels[0];
  return {
    id: room.id,
    title: room.title,
    hostelName: hostel.name,
    city: room.city,
    area: room.area,
    pricePerHead: room.pricePerHead || room.pricePerBed,
    securityDeposit: room.securityDeposit,
    image: room.photos?.[0] || room.images?.[0] || hostel.images?.[0],
    safetySummary: hostel.isVerified ? "Verified property with safety controls" : "Host identity checked",
    parentNotes: ["Contact gated until paid booking", "Deposit policy visible before payment", "Receipts are QR verifiable"]
  };
};

router.get("/", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoShortlists, demo: true });
    const results = await Shortlist.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/share", protect, async (req, res, next) => {
  try {
    const roomIds = (req.body.roomIds || []).slice(0, 5);
    const shareToken = tokenFor();
    const payload = {
      title: req.body.title || "Parent shortlist",
      roomIds,
      parentEmail: req.body.parentEmail,
      note: req.body.note,
      shareToken,
      parentViewEnabled: true,
      expiresAt: new Date(Date.now() + 14 * 86400000).toISOString()
    };
    if (!isDbReady()) {
      const shortlist = { id: `short-${Date.now()}`, studentRef: req.user.id, ...payload, rooms: rooms.filter((room) => roomIds.includes(room.id)).map(shapeRoom) };
      demoShortlists.unshift(shortlist);
      return res.status(201).json({ shortlist, shareUrl: `/shortlists/${shareToken}`, demo: true });
    }
    const shortlist = await Shortlist.create({ ...payload, student: req.user._id || req.user.id, studentRef: req.user.id });
    return res.status(201).json({ shortlist, shareUrl: `/shortlists/${shareToken}` });
  } catch (error) {
    return next(error);
  }
});

router.get("/:token", async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const shortlist = demoShortlists.find((item) => item.shareToken === req.params.token) || {
        id: "short-demo",
        title: "Parent shortlist demo",
        shareToken: req.params.token,
        rooms: rooms.slice(0, 3).map(shapeRoom),
        parentViewEnabled: true,
        note: "Read-only trusted summary for parents."
      };
      return res.json({ shortlist, demo: true });
    }
    const shortlist = await Shortlist.findOne({ shareToken: req.params.token, parentViewEnabled: true });
    if (!shortlist) return res.status(404).json({ message: "Shortlist not found." });
    return res.json({ shortlist });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const index = demoShortlists.findIndex((item) => item.id === req.params.id);
      if (index >= 0) demoShortlists.splice(index, 1);
      return res.json({ deleted: true, demo: true });
    }
    await Shortlist.findOneAndDelete({ _id: req.params.id, student: req.user._id || req.user.id });
    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
