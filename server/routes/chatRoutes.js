const express = require("express");
const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { filterChatMessage } = require("../services/chatFilter");
const { users, hostels } = require("../data/mockData");

const router = express.Router();

// Platform business rule: customers should reach Admin/Support first, not a
// specific property owner directly. This resolves the fixed "Basera Support"
// recipient that the student-facing chat entry point routes to by default.
// See StudentChat.jsx / ChatPanel.jsx (lockToSupport) for the client side.
const FALLBACK_SUPPORT_CONTACT = { id: "u-admin", name: "Basera Support Team", role: "admin" };

router.get("/support-contact", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const demoAdmin = users.find((candidate) => candidate.role === "admin");
      return res.json({
        contact: demoAdmin ? { id: demoAdmin.id, name: demoAdmin.name || "Basera Support Team", role: "admin" } : FALLBACK_SUPPORT_CONTACT,
        demo: true
      });
    }

    const admin = await User.findOne({ role: "admin" }).select("name role").sort({ createdAt: 1 });
    if (!admin) {
      // No admin/support account provisioned yet in this environment. Surface this
      // clearly instead of silently routing messages to a made-up id that no inbox
      // reads from.
      return res.status(503).json({ message: "Support routing is not configured yet. Please contact the platform administrator." });
    }
    return res.json({ contact: { id: admin._id, name: admin.name || "Basera Support Team", role: "admin" } });
  } catch (error) {
    return next(error);
  }
});

const demoThreads = [
  {
    id: "thread-owner",
    hostelId: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    participant: users.find((user) => ["host", "owner", "landlord"].includes(user.role)),
    lastMessage: "Your visit slot is available tomorrow at 5 PM.",
    unread: 1
  }
];

const demoMessages = [
  {
    id: "msg-1",
    senderRole: "student",
    message: "Hi, is the double room still available?",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: "msg-2",
    senderRole: "host",
    message: "Yes, one bed is available. You can book or schedule a visit.",
    createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString()
  }
];

router.get("/threads", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: demoThreads });

    const messages = await ChatMessage.find({
      $or: [{ sender: req.user._id || req.user.id }, { receiver: req.user._id || req.user.id }]
    })
      .populate("hostel", "name")
      .populate("sender receiver", "name role avatar")
      .sort({ createdAt: -1 })
      .limit(50);

    const byReceiver = new Map();
    messages.forEach((message) => {
      const other = String(message.sender?._id) === String(req.user._id || req.user.id) ? message.receiver : message.sender;
      const key = `${other?._id}-${message.hostel?._id || "general"}`;
      if (!byReceiver.has(key)) {
        byReceiver.set(key, {
          id: key,
          hostelId: message.hostel?._id,
          hostelName: message.hostel?.name || "Basera Chat",
          participant: other,
          lastMessage: message.message,
          unread: message.readAt ? 0 : 1
        });
      }
    });

    return res.json({ results: Array.from(byReceiver.values()) });
  } catch (error) {
    return next(error);
  }
});

router.get("/messages", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: demoMessages });

    const receiverId = req.query.receiverId;
    const hostelId = req.query.hostelId;
    const query = {
      $or: [
        { sender: req.user._id || req.user.id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id || req.user.id }
      ]
    };
    if (hostelId) query.hostel = hostelId;

    const results = await ChatMessage.find(query).sort({ createdAt: 1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/messages", protect, async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ message: "Message is required." });
    const filtered = filterChatMessage(message);

    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        message: {
          id: `msg-${Date.now()}`,
          senderRole: req.user.role,
          message: filtered.message,
          originalMessage: filtered.originalMessage,
          isFlagged: filtered.isFlagged,
          flagReason: filtered.flagReason,
          hostelId: req.body.hostelId || hostels[0].id,
          createdAt: new Date().toISOString()
        },
        demo: true
      });
    }

    const chatMessage = await ChatMessage.create({
      sender: req.user._id || req.user.id,
      receiver: req.body.receiverId,
      hostel: req.body.hostelId,
      booking: req.body.bookingId,
      message: filtered.message,
      originalMessage: filtered.isFlagged ? filtered.originalMessage : undefined,
      isFlagged: filtered.isFlagged,
      flagReason: filtered.flagReason
    });

    return res.status(201).json({ message: chatMessage });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
