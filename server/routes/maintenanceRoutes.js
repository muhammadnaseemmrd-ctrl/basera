const express = require("express");
const mongoose = require("mongoose");
const MaintenanceTicket = require("../models/MaintenanceTicket");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const { recordAudit } = require("../services/auditService");
const { demoMaintenanceTickets } = require("../data/demoRuntime");
const { bookings, hostels, rooms, users } = require("../data/mockData");

const router = express.Router();

const isDbReady = () => mongoose.connection.readyState === 1;

const addHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);

const slaHours = (priority) => {
  if (priority === "urgent") return 6;
  if (priority === "high") return 12;
  if (priority === "low") return 72;
  return 24;
};

const publicTicket = (ticket) => {
  const source = ticket?.toObject ? ticket.toObject() : ticket;
  return {
    ...source,
    id: String(source._id || source.id),
    studentName: source.student?.name || source.studentName,
    hostName: source.host?.name || source.hostName,
    hostelName: source.hostel?.name || source.hostelName,
    roomNumber: source.room?.roomNumber || source.roomNumber
  };
};

const demoTicketPayload = (req) => {
  const booking = bookings.find((item) => item.id === req.body.booking) || bookings.find((item) => item.student === req.user.id) || bookings[0];
  const room = rooms.find((item) => item.id === (req.body.room || booking?.room)) || rooms[0];
  const hostel = hostels.find((item) => item.id === (req.body.hostel || booking?.hostel || room?.hostel)) || hostels[0];
  const host = users.find((user) => user.id === room?.listedBy || user.id === hostel?.owner) || users.find((user) => ["owner", "host", "landlord"].includes(user.role));
  const priority = req.body.priority || "medium";
  return {
    id: `MT-${Date.now()}`,
    student: req.user.id,
    studentName: req.user.name || "Student",
    host: host?.id,
    hostName: host?.name || "Host",
    hostel: hostel?.id,
    hostelName: hostel?.name,
    room: room?.id,
    roomNumber: room?.roomNumber,
    title: req.body.title,
    description: req.body.description,
    category: req.body.category || "other",
    priority,
    status: "open",
    evidence: req.body.evidence || [],
    slaDueAt: addHours(slaHours(priority)).toISOString(),
    updates: [],
    createdAt: new Date().toISOString()
  };
};

router.get("/my", protect, async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    if (!isDbReady()) {
      const results = demoMaintenanceTickets.filter((ticket) => {
        if (role === "student") return ticket.student === req.user.id;
        if (role === "admin") return true;
        return ticket.host === req.user.id || ["u-owner", "u-landlord"].includes(req.user.id);
      });
      return res.json({ results: results.map(publicTicket), demo: true });
    }

    const query = role === "student"
      ? { student: req.user._id || req.user.id }
      : role === "admin"
        ? {}
        : { host: req.user._id || req.user.id };
    const results = await MaintenanceTicket.find(query).populate("student host hostel room").sort({ createdAt: -1 });
    return res.json({ results: results.map(publicTicket) });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoMaintenanceTickets.map(publicTicket), demo: true });
    const results = await MaintenanceTicket.find().populate("student host hostel room").sort({ priority: -1, createdAt: -1 }).limit(200);
    return res.json({ results: results.map(publicTicket) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    if (!req.body.title || !req.body.description) return res.status(400).json({ message: "Ticket title and description are required." });
    if (!isDbReady()) {
      const ticket = demoTicketPayload(req);
      demoMaintenanceTickets.unshift(ticket);
      await recordAudit(req, { action: "maintenance.ticket.created", entityType: "MaintenanceTicket", entityId: ticket.id, metadata: { priority: ticket.priority, category: ticket.category } });
      return res.status(201).json({ ticket: publicTicket(ticket), demo: true });
    }

    const booking = req.body.booking ? await Booking.findById(req.body.booking).populate("room hostel") : null;
    const room = req.body.room ? await Room.findById(req.body.room) : booking?.room;
    const priority = req.body.priority || "medium";
    const ticket = await MaintenanceTicket.create({
      student: req.user._id || req.user.id,
      host: room?.listedBy || booking?.hostel?.owner,
      hostel: req.body.hostel || booking?.hostel?._id || room?.hostel,
      room: req.body.room || room?._id,
      booking: req.body.booking,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category || "other",
      priority,
      evidence: req.body.evidence || [],
      slaDueAt: addHours(slaHours(priority))
    });
    await recordAudit(req, { action: "maintenance.ticket.created", entityType: "MaintenanceTicket", entityId: ticket._id, metadata: { priority, category: ticket.category } });
    return res.status(201).json({ ticket: publicTicket(ticket) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/status", protect, async (req, res, next) => {
  try {
    const status = req.body.status || "in_progress";
    const note = req.body.note || `Marked ${status}`;
    if (!isDbReady()) {
      const ticket = demoMaintenanceTickets.find((item) => item.id === req.params.id) || demoMaintenanceTickets[0];
      Object.assign(ticket, { status, updatedAt: new Date().toISOString() });
      ticket.updates = ticket.updates || [];
      ticket.updates.unshift({
        byName: req.user.name || req.user.email || "User",
        byRole: req.user.role,
        status,
        note,
        createdAt: new Date().toISOString()
      });
      await recordAudit(req, { action: "maintenance.ticket.status_updated", entityType: "MaintenanceTicket", entityId: ticket.id, metadata: { status } });
      return res.json({ ticket: publicTicket(ticket), demo: true });
    }

    const ticket = await MaintenanceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Maintenance ticket not found." });
    ticket.status = status;
    ticket.updates.unshift({
      by: req.user._id || req.user.id,
      byName: req.user.name || req.user.email,
      byRole: req.user.role,
      status,
      note
    });
    await ticket.save();
    await recordAudit(req, { action: "maintenance.ticket.status_updated", entityType: "MaintenanceTicket", entityId: ticket._id, metadata: { status } });
    return res.json({ ticket: publicTicket(ticket) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/rating", protect, async (req, res, next) => {
  try {
    const rating = Math.min(5, Math.max(1, Number(req.body.rating || 5)));
    const satisfaction = { rating, comment: req.body.comment, submittedAt: new Date().toISOString() };
    if (!isDbReady()) {
      const ticket = demoMaintenanceTickets.find((item) => item.id === req.params.id) || demoMaintenanceTickets[0];
      ticket.satisfaction = satisfaction;
      await recordAudit(req, { action: "maintenance.ticket.rated", entityType: "MaintenanceTicket", entityId: ticket.id, metadata: { rating } });
      return res.status(201).json({ satisfaction, ticket: publicTicket(ticket), demo: true });
    }

    const ticket = await MaintenanceTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Maintenance ticket not found." });
    ticket.satisfaction = { rating, comment: req.body.comment, submittedAt: new Date() };
    await ticket.save();
    await recordAudit(req, { action: "maintenance.ticket.rated", entityType: "MaintenanceTicket", entityId: ticket._id, metadata: { rating } });
    return res.status(201).json({ satisfaction: ticket.satisfaction, ticket: publicTicket(ticket) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
