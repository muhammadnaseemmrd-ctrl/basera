const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const BedBlock = require("../models/BedBlock");
const User = require("../models/User");
const ParentLink = require("../models/ParentLink");
const { deriveSeatStates, phoneKey } = require("../services/hostelOpsRules");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const Complaint = require("../models/Complaint");
const StaffMember = require("../models/StaffMember");
const Notice = require("../models/Notice");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { buildSeatMap } = require("../services/seatMapService");
const { canManageHostel, managedHostelIds, residents, isId } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, authorize("host", "admin"), requireDb);

const guard = async (req, res) => {
  if (!isId(req.params.id) || !(await canManageHostel(req.user, req.params.id))) {
    res.status(403).json({ message: "You do not manage this hostel." });
    return false;
  }
  return true;
};

router.get("/hostels", async (req, res, next) => {
  try {
    const ids = await managedHostelIds(req.user);
    const hostels = await Hostel.find({ _id: { $in: ids } }).select("name city area type status").sort({ name: 1 }).lean();
    const blockCounts = await Block.aggregate([{ $match: { hostelId: { $in: hostels.map((h) => h._id) } } }, { $group: { _id: "$hostelId", n: { $sum: 1 } } }]);
    const counts = Object.fromEntries(blockCounts.map((c) => [String(c._id), c.n]));
    res.json({ results: hostels.map((h) => ({ ...h, id: String(h._id), blocks: counts[String(h._id)] || 0 })) });
  } catch (error) {
    next(error);
  }
});

router.get("/hostels/:id/seats", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const blockId = req.query.blockId && isId(req.query.blockId) ? req.query.blockId : null;
    res.json(await buildSeatMap({ hostelId: req.params.id, blockId }));
  } catch (error) {
    next(error);
  }
});

router.get("/hostels/:id/students", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const rows = await residents({ hostelId: req.params.id, blockId: req.query.blockId && isId(req.query.blockId) ? req.query.blockId : undefined });
    const invoices = await FeeInvoice.aggregate([
      { $match: { hostel: new mongoose.Types.ObjectId(req.params.id), status: { $in: ["unpaid", "partial"] } } },
      { $group: { _id: "$student", due: { $sum: { $subtract: ["$amount", "$paidAmount"] } } } }
    ]);
    const due = Object.fromEntries(invoices.map((i) => [String(i._id), i.due]));
    res.json({
      results: rows
        .filter((b) => b.student)
        .map((b) => ({
          studentId: String(b.student._id),
          name: b.student.name,
          phone: b.student.phone,
          bookingId: String(b._id),
          roomNumber: b.room?.roomNumber,
          roomId: b.room ? String(b.room._id) : null,
          blockId: b.room?.blockId ? String(b.room.blockId) : null,
          bedIndex: b.bedIndex ?? null,
          balanceDue: due[String(b.student._id)] || 0
        }))
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Structure & onboarding: blocks → rooms → seats → residents (head office only)
// ---------------------------------------------------------------------------

router.get("/hostels/:id/rooms", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const rooms = await Room.find({ $or: [{ hostel: req.params.id }, { hostProperty: req.params.id }] }).sort({ roomNumber: 1 }).select("roomNumber blockId totalBeds availableBeds pricePerBed floor status").lean();
    res.json({ results: rooms.map((r) => ({ ...r, id: String(r._id) })) });
  } catch (error) {
    next(error);
  }
});

const roomTypeForBeds = (beds) => (beds === 1 ? ["single", "SINGLE"] : beds === 2 ? ["double", "DOUBLE"] : beds === 3 ? ["triple", "TRIPLE"] : beds === 4 ? ["quad", "QUAD"] : ["dorm", "BUNK_DORM"]);
const genderFor = (type) => (type === "girls" ? "GIRLS_ONLY" : type === "mixed" ? "CO_ED" : "BOYS_ONLY");

// Create many rooms at once, e.g. rooms 101–120 with 3 beds in Block A.
router.post("/hostels/:id/rooms/bulk", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const { blockId, from, to, prefix = "", beds, pricePerBed, floor } = req.body;
    const a = Number(from);
    const b = Number(to);
    const bedCount = Number(beds);
    const price = Number(pricePerBed);
    if (![a, b, bedCount, price].every(Number.isInteger) || a > b || b - a >= 200 || bedCount < 1 || bedCount > 12 || price < 0) {
      return res.status(400).json({ message: "from/to (max 200 rooms), beds (1–12) and pricePerBed must be whole numbers." });
    }
    const hostel = await Hostel.findById(req.params.id).lean();
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    if (blockId) {
      const block = isId(blockId) ? await Block.findOne({ _id: blockId, hostelId: hostel._id }).lean() : null;
      if (!block) return res.status(400).json({ message: "That block does not belong to this hostel." });
    }
    const numbers = Array.from({ length: b - a + 1 }, (_, i) => `${String(prefix).slice(0, 6)}${a + i}`);
    const existing = await Room.find({ $or: [{ hostel: hostel._id }, { hostProperty: hostel._id }], roomNumber: { $in: numbers } }).select("roomNumber").lean();
    if (existing.length) return res.status(409).json({ message: `Rooms already exist: ${existing.slice(0, 8).map((r) => r.roomNumber).join(", ")}${existing.length > 8 ? "…" : ""}` });
    const [type, roomType] = roomTypeForBeds(bedCount);
    const docs = await Room.insertMany(
      numbers.map((roomNumber) => ({
        hostel: hostel._id,
        listedBy: hostel.owner,
        blockId: blockId || null,
        roomNumber,
        title: `Room ${roomNumber} – ${hostel.name}`,
        city: hostel.city,
        area: hostel.area,
        address: hostel.address,
        type,
        roomType,
        genderPolicy: genderFor(hostel.type),
        totalBeds: bedCount,
        availableBeds: bedCount,
        pricePerBed: price,
        pricePerHead: price,
        floor: Number.isInteger(Number(floor)) ? Number(floor) : undefined,
        status: "ACTIVE"
      }))
    );
    res.status(201).json({ created: docs.length });
  } catch (error) {
    next(error);
  }
});

// Move rooms into (or out of) a block. Rooms must belong to the same hostel as the block.
router.post("/hostels/:id/blocks/:blockId/assign-rooms", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const ids = (Array.isArray(req.body.roomIds) ? req.body.roomIds : []).filter(isId);
    if (!ids.length) return res.status(400).json({ message: "roomIds is required." });
    const unassign = req.params.blockId === "none";
    if (!unassign) {
      const block = isId(req.params.blockId) ? await Block.findOne({ _id: req.params.blockId, hostelId: req.params.id }).lean() : null;
      if (!block) return res.status(404).json({ message: "Block not found in this hostel." });
    }
    const result = await Room.updateMany(
      { _id: { $in: ids }, $or: [{ hostel: req.params.id }, { hostProperty: req.params.id }] },
      { blockId: unassign ? null : req.params.blockId }
    );
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// Admit a resident who is already living there (or paid offline) into a specific seat.
router.post("/hostels/:id/residents", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    const { name, phone, email, roomId, bedIndex, monthlyRent, checkIn, guardianName, guardianPhone } = req.body;
    const bed = Number(bedIndex);
    const rent = Number(monthlyRent);
    if (!String(name || "").trim() || !String(phone || "").trim()) return res.status(400).json({ message: "Student name and phone are required." });
    if (!isId(roomId) || !Number.isInteger(bed) || bed < 0) return res.status(400).json({ message: "roomId and a valid bedIndex are required." });
    if (!Number.isInteger(rent) || rent < 0) return res.status(400).json({ message: "monthlyRent must be a whole number." });

    const room = await Room.findOne({ _id: roomId, $or: [{ hostel: req.params.id }, { hostProperty: req.params.id }] });
    if (!room) return res.status(404).json({ message: "Room not found in this hostel." });
    if (bed >= room.totalBeds) return res.status(400).json({ message: `Room ${room.roomNumber} has only ${room.totalBeds} bed(s).` });

    // Seat must be genuinely free (no live booking, no hold) — same rules the seat map uses.
    const now = new Date();
    const [liveBookings, holds] = await Promise.all([
      Booking.find({ room: room._id, status: { $in: ["pending", "payment_pending", "confirmed", "active", "overdue"] } }).lean(),
      BedBlock.find({ room: room._id, status: "active", from: { $lte: now }, to: { $gte: now } }).lean()
    ]);
    const seat = deriveSeatStates({ totalBeds: room.totalBeds, bookings: liveBookings.map((x) => ({ id: x._id, bedIndex: x.bedIndex, status: x.status, student: x.student })), bedBlocks: holds.map((h) => ({ id: h._id, bedIndex: h.bedIndex, reason: h.reason, note: h.note })) })[bed];
    if (seat.status !== "free") return res.status(409).json({ message: `Seat ${bed + 1} in room ${room.roomNumber} is not free (${seat.status.replace("_", " ")}).` });

    // Find or create the student login.
    let student = await User.findOne({ $or: [{ phone: String(phone).trim() }, ...(email ? [{ email: String(email).toLowerCase().trim() }] : [])] });
    let tempPassword = null;
    if (student && student.role !== "student") return res.status(409).json({ message: "That phone/email belongs to a non-student account." });
    if (!student) {
      tempPassword = crypto.randomBytes(5).toString("hex");
      const digits = String(phone).replace(/\D/g, "");
      student = await User.create({
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: email ? String(email).toLowerCase().trim() : `${digits}@resident.basera.invalid`,
        password: tempPassword,
        role: "student",
        isVerified: true,
        emergencyContact: guardianPhone ? { name: guardianName, relationship: "guardian", phone: guardianPhone } : undefined
      });
    }
    const existingStay = await Booking.exists({ student: student._id, status: { $in: ["confirmed", "active", "overdue", "pending", "payment_pending"] } });
    if (existingStay) {
      return res.status(409).json({ message: "This student already has an active or pending booking. Check them out first." });
    }

    // Take the bed from the marketplace atomically so it cannot also be booked online.
    const taken = await Room.findOneAndUpdate({ _id: room._id, availableBeds: { $gt: 0 } }, { $inc: { availableBeds: -1 } }, { new: true });
    if (!taken) {
      if (tempPassword) await User.deleteOne({ _id: student._id }); // don't leave an orphan login behind
      return res.status(409).json({ message: "The room already shows no free beds online. Fix the room's bed count first." });
    }
    if (taken.availableBeds === 0) await Room.updateOne({ _id: room._id }, { status: "FULL" });

    let booking;
    try {
      booking = await Booking.create({
        student: student._id,
        hostel: req.params.id,
        room: room._id,
        bedIndex: bed,
        checkIn: checkIn ? new Date(checkIn) : now,
        moveInDate: checkIn ? new Date(checkIn) : now,
        duration: "monthly",
        bookingType: "MONTHLY",
        totalRent: rent,
        totalAmount: rent,
        commission: 0,
        ownerReceives: rent,
        securityDeposit: 0,
        paymentMethod: "cash",
        paymentStatus: "paid",
        status: "active",
        specialRequests: "Admitted by hostel office (offline resident)."
      });
    } catch (err) {
      // roll back the bed (and the login we just made) if the stay could not be saved
      await Room.updateOne({ _id: room._id }, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
      if (tempPassword) await User.deleteOne({ _id: student._id });
      throw err;
    }

    let guardian = null;
    if (guardianPhone && phoneKey(guardianPhone).length >= 10) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      try {
        await ParentLink.create({ student: student._id, hostel: req.params.id, parentName: guardianName, parentPhone: guardianPhone, phoneKey: phoneKey(guardianPhone), status: "pending", inviteCode: code, inviteExpiresAt: new Date(Date.now() + 14 * 86400000), createdBy: req.user._id, source: "staff" });
        guardian = { inviteCode: code };
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    res.status(201).json({
      booking: { id: String(booking._id), room: room.roomNumber, bed: bed + 1 },
      student: { id: String(student._id), name: student.name, phone: student.phone, email: tempPassword ? student.email : undefined },
      // shown once, so the office can hand it to the student; the student should change it
      tempPassword,
      guardian
    });
  } catch (error) {
    next(error);
  }
});

// Check a resident out: frees the seat and returns the bed to the marketplace.
router.post("/hostels/:id/residents/:bookingId/checkout", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    if (!isId(req.params.bookingId)) return res.status(404).json({ message: "Booking not found." });
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.bookingId, hostel: req.params.id, status: { $in: ["confirmed", "active", "overdue"] } },
      { status: "completed", checkOut: new Date(), moveOutDate: new Date() },
      { new: true }
    );
    if (!booking) return res.status(409).json({ message: "No active stay with that id in this hostel." });
    await Room.updateOne({ _id: booking.room }, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
    const owing = await FeeInvoice.aggregate([{ $match: { student: booking.student, hostel: booking.hostel, status: { $in: ["unpaid", "partial"] } } }, { $group: { _id: null, due: { $sum: { $subtract: ["$amount", "$paidAmount"] } } } }]);
    res.json({ checkedOut: true, outstandingBalance: owing[0]?.due || 0 });
  } catch (error) {
    next(error);
  }
});

/** Seats, fee collection vs pending, complaints by status, staff and latest notices for one hostel. */
async function hostelOverview(id) {
  const hostelId = new mongoose.Types.ObjectId(String(id));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [seatMap, invoiceAgg, collectedMonth, complaintAgg, staffAgg, notices, residentRows] = await Promise.all([
    buildSeatMap({ hostelId: id, includeStudents: false }),
    FeeInvoice.aggregate([
      { $match: { hostel: hostelId, status: { $ne: "void" } } },
      { $group: { _id: null, billed: { $sum: "$amount" }, collected: { $sum: "$paidAmount" }, unpaid: { $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] } }, partial: { $sum: { $cond: [{ $eq: ["$status", "partial"] }, 1, 0] } }, paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } } } }
    ]),
    FeePayment.aggregate([{ $match: { hostel: hostelId, status: "confirmed", paidAt: { $gte: monthStart } } }, { $group: { _id: "$method", total: { $sum: "$amount" }, n: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: { hostel: hostelId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    StaffMember.aggregate([{ $match: { hostel: hostelId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Notice.find({ hostel: hostelId }).sort({ createdAt: -1 }).limit(5).select("title type createdAt block").lean(),
    residents({ hostelId: id })
  ]);

  const inv = invoiceAgg[0] || { billed: 0, collected: 0, unpaid: 0, partial: 0, paid: 0 };
  const stale = new Date(Date.now() - 3 * 86400000);
  const overdueComplaints = await Complaint.countDocuments({ hostel: hostelId, status: { $in: ["raised", "under_review", "in_progress", "reopened", "escalated"] }, createdAt: { $lt: stale } });
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

  return {
    hostelId: String(id),
    residents: residentRows.length,
    seats: { ...seatMap.summary, blocks: seatMap.blocks.map((b) => ({ id: b.id, name: b.name, warden: b.warden, ...b.summary })) },
    fees: {
      billed: inv.billed,
      collected: inv.collected,
      outstanding: inv.billed - inv.collected,
      invoices: { unpaid: inv.unpaid, partial: inv.partial, paid: inv.paid },
      collectedThisMonth: Object.fromEntries(collectedMonth.map((c) => [c._id, c.total])),
      collectedThisMonthTotal: collectedMonth.reduce((s, c) => s + c.total, 0)
    },
    complaints: { byStatus: toMap(complaintAgg), openOverThreeDays: overdueComplaints },
    staff: toMap(staffAgg),
    notices
  };
}

router.get("/hostels/:id/overview", async (req, res, next) => {
  try {
    if (!(await guard(req, res))) return;
    res.json(await hostelOverview(req.params.id));
  } catch (error) {
    next(error);
  }
});

const OVERVIEW_LIMIT = 50;
const addCounts = (into, from = {}) => {
  Object.entries(from).forEach(([k, v]) => {
    if (typeof v === "number") into[k] = (into[k] || 0) + v;
  });
  return into;
};

// Head office landing view: every hostel the caller manages (or ?hostelId= for one), plus totals.
router.get("/overview", async (req, res, next) => {
  try {
    let ids;
    if (req.query.hostelId) {
      if (!isId(req.query.hostelId) || !(await canManageHostel(req.user, req.query.hostelId))) return res.status(403).json({ message: "You do not manage this hostel." });
      ids = [String(req.query.hostelId)];
    } else {
      ids = await managedHostelIds(req.user);
    }
    const truncated = ids.length > OVERVIEW_LIMIT;
    const hostels = await Hostel.find({ _id: { $in: ids.slice(0, OVERVIEW_LIMIT) } }).select("name city").sort({ name: 1 }).lean();
    const rows = await Promise.all(hostels.map(async (h) => ({ name: h.name, city: h.city, ...(await hostelOverview(h._id)) })));

    const totals = { residents: 0, seats: {}, fees: { billed: 0, collected: 0, outstanding: 0, collectedThisMonthTotal: 0 }, complaints: { byStatus: {}, openOverThreeDays: 0 }, staff: {} };
    rows.forEach((r) => {
      totals.residents += r.residents;
      addCounts(totals.seats, r.seats);
      ["billed", "collected", "outstanding", "collectedThisMonthTotal"].forEach((k) => {
        totals.fees[k] += r.fees[k];
      });
      addCounts(totals.complaints.byStatus, r.complaints.byStatus);
      totals.complaints.openOverThreeDays += r.complaints.openOverThreeDays;
      addCounts(totals.staff, r.staff);
    });
    // occupancy is a ratio, so recompute it from the summed seats instead of summing percentages
    totals.seats.occupancyPct = totals.seats.total ? Math.round((((totals.seats.occupied || 0) + (totals.seats.booked_offline || 0)) / totals.seats.total) * 100) : 0;
    const latestNotices = rows
      .flatMap((r) => r.notices.map((n) => ({ ...n, hostelId: r.hostelId, hostelName: r.name })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.json({ totals, hostels: rows.map(({ notices, ...rest }) => rest), latestNotices, truncated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
