const express = require("express");
const SeatTransfer = require("../models/SeatTransfer");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const FeeInvoice = require("../models/FeeInvoice");
const LeaveNotice = require("../models/LeaveNotice");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { emitToFamily } = require("../services/hostelEvents");
const { buildSeatMap } = require("../services/seatMapService");
const { canManageHostel, staffScope, recordScope, wardenBlocks, currentStay, LIVE_BOOKING, isId, uid } = require("../services/hostelAccess");

// Room/seat transfer inside one hostel: request → approve → atomic move.
// Open invoices move to the new block (so its warden can collect); amounts are unchanged
// ("fee plan carries over"); an optional newMonthlyRent applies to future billing.
const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};
const shape = (t) => ({ ...(t.toObject ? t.toObject() : t), id: String(t._id) });

async function seatTaken(roomId, bedIndex, exceptBooking) {
  return Booking.exists({ room: roomId, bedIndex, status: { $in: LIVE_BOOKING }, _id: { $ne: exceptBooking } });
}

router.post("/", async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    const studentId = role === "student" ? uid(req.user) : req.body.studentId;
    const stay = isId(studentId) ? await currentStay(studentId) : null;
    if (!stay) return res.status(400).json({ message: "No active stay to transfer." });
    if (role !== "student" && !(await recordScope(req.user, { hostelId: stay.hostelId, blockId: stay.blockId }))) return res.status(403).json({ message: "That student is not a resident of your hostel/block." });
    const toRoom = isId(req.body.toRoomId) ? await Room.findOne({ _id: req.body.toRoomId, $or: [{ hostel: stay.hostelId }, { hostProperty: stay.hostelId }] }).lean() : null;
    if (!toRoom) return res.status(404).json({ message: "Target room not found in this hostel." });
    const toBed = Number(req.body.toBedIndex);
    if (!Number.isInteger(toBed) || toBed < 0 || toBed >= toRoom.totalBeds) return res.status(400).json({ message: `Room ${toRoom.roomNumber} has beds 1–${toRoom.totalBeds}.` });
    if (String(toRoom._id) === String(stay.room._id) && toBed === stay.booking.bedIndex) return res.status(400).json({ message: "That is the current seat." });
    if (await seatTaken(toRoom._id, toBed, stay.booking._id)) return res.status(409).json({ message: "That seat is not free." });
    const newRent = req.body.newMonthlyRent === undefined || req.body.newMonthlyRent === "" ? undefined : Number(req.body.newMonthlyRent);
    if (newRent !== undefined && (!Number.isInteger(newRent) || newRent < 0)) return res.status(400).json({ message: "newMonthlyRent must be a whole number." });
    let transfer;
    try {
      transfer = await SeatTransfer.create({
        hostel: stay.hostelId,
        student: studentId,
        booking: stay.booking._id,
        fromRoom: stay.room._id,
        fromBed: stay.booking.bedIndex,
        fromBlock: stay.blockId,
        toRoom: toRoom._id,
        toBed,
        toBlock: toRoom.blockId || null,
        reason: String(req.body.reason || "").slice(0, 500),
        newMonthlyRent: newRent,
        requestedBy: uid(req.user),
        requestedByRole: role,
        requestedAt: clock.now()
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "A transfer request for this stay is already open." });
      throw error;
    }
    await audit(req, { action: "transfer.requested", entityType: "SeatTransfer", entityId: transfer._id, metadata: { to: `${toRoom.roomNumber}#${toBed + 1}` } });
    return res.status(201).json({ transfer: shape(transfer) });
  } catch (error) {
    return next(error);
  }
});

// Student: free seats they can ask to move to (room/block/bed only — never who sits where).
router.get("/options", authorize("student"), async (req, res, next) => {
  try {
    const stay = await currentStay(uid(req.user));
    if (!stay) return res.json({ results: [] });
    const map = await buildSeatMap({ hostelId: stay.hostelId, includeStudents: false });
    const results = map.blocks.flatMap((b) => b.rooms.flatMap((r) => r.seats.filter((x) => x.status === "free").map((x) => ({ roomId: r.id, roomNumber: r.roomNumber, block: b.name, bedIndex: x.bedIndex, pricePerBed: r.pricePerBed }))));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/my", async (req, res, next) => {
  try {
    const results = await SeatTransfer.find({ student: uid(req.user) }).populate("fromRoom toRoom", "roomNumber").sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, status } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId });
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    const query = { hostel: hostelId };
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).map((b) => b._id);
      query.$or = [{ fromBlock: { $in: own } }, { toBlock: { $in: own } }];
    }
    if (status) query.status = status;
    const results = await SeatTransfer.find(query).populate("student", "name").populate("fromRoom toRoom", "roomNumber").sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

/** Approve (atomic move) or reject. Head office; a warden only if both seats are in their blocks. */
router.post("/:id/decide", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const t = isId(req.params.id) ? await SeatTransfer.findById(req.params.id) : null;
    if (!t) return res.status(404).json({ message: "Transfer not found." });
    const head = await canManageHostel(req.user, t.hostel);
    const wardenBoth = !head && (await recordScope(req.user, { hostelId: t.hostel, blockId: t.fromBlock })) && (await recordScope(req.user, { hostelId: t.hostel, blockId: t.toBlock }));
    if (!head && !wardenBoth) return res.status(403).json({ message: "Only the head office (or the warden of both blocks) can decide this transfer." });
    const decision = req.body.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: 'decision must be "approve" or "reject".' });
    const note = String(req.body.note || "").trim();

    if (decision === "reject") {
      const rejected = await SeatTransfer.findOneAndUpdate({ _id: t._id, status: "requested" }, { status: "rejected", decidedBy: uid(req.user), decisionNote: note, decidedAt: clock.now() }, { returnDocument: "after" });
      if (!rejected) return res.status(409).json({ message: "This transfer was already decided or cancelled." });
      await emitToFamily({ student: t.student, hostel: t.hostel, type: "transfer_decision", title: "Room transfer", message: `Your room transfer request was rejected.${note ? ` ${note}` : ""}` });
      return res.json({ transfer: shape(rejected) });
    }

    // claim the request first so two approvals can't both move the student
    const claimed = await SeatTransfer.findOneAndUpdate({ _id: t._id, status: "requested" }, { status: "approved", decidedBy: uid(req.user), decisionNote: note, decidedAt: clock.now() }, { returnDocument: "after" });
    if (!claimed) return res.status(409).json({ message: "This transfer was already decided or cancelled." });
    const release = () => SeatTransfer.updateOne({ _id: t._id }, { status: "requested", $unset: { decidedBy: 1, decisionNote: 1, decidedAt: 1 } });
    if (await seatTaken(t.toRoom, t.toBed, t.booking)) {
      await release();
      return res.status(409).json({ message: "The target seat was taken in the meantime." });
    }
    const set = { room: t.toRoom, bedIndex: t.toBed };
    if (Number.isInteger(t.newMonthlyRent)) set.totalRent = t.newMonthlyRent;
    const moved = await Booking.findOneAndUpdate({ _id: t.booking, room: t.fromRoom, bedIndex: t.fromBed, status: { $in: LIVE_BOOKING } }, set, { returnDocument: "after" });
    if (!moved) {
      await release();
      return res.status(409).json({ message: "The stay changed since the request (moved or checked out)." });
    }
    // a concurrent move into the same seat loses here and is undone
    if (await seatTaken(t.toRoom, t.toBed, t.booking)) {
      await Booking.updateOne({ _id: t.booking }, { room: t.fromRoom, bedIndex: t.fromBed });
      await release();
      return res.status(409).json({ message: "The target seat was taken in the meantime." });
    }
    if (String(t.fromRoom) !== String(t.toRoom)) {
      await Room.updateOne({ _id: t.fromRoom }, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
      await Room.updateOne({ _id: t.toRoom, availableBeds: { $gt: 0 } }, { $inc: { availableBeds: -1 } });
    }
    // fee plan carries over: open invoices follow the student to the new block / seat
    await FeeInvoice.updateMany({ booking: t.booking, status: { $in: ["unpaid", "partial"] } }, { block: t.toBlock, room: t.toRoom, bedIndex: t.toBed });
    await LeaveNotice.updateMany({ booking: t.booking, status: { $in: ["submitted", "approved"] } }, { block: t.toBlock, room: t.toRoom, bedIndex: t.toBed });
    await audit(req, { action: "transfer.approved", entityType: "SeatTransfer", entityId: t._id, metadata: { from: `${t.fromRoom}#${t.fromBed}`, to: `${t.toRoom}#${t.toBed}`, newMonthlyRent: t.newMonthlyRent } });
    const toRoom = await Room.findById(t.toRoom).select("roomNumber").lean();
    await emitToFamily({ student: t.student, hostel: t.hostel, type: "transfer_decision", title: "Room transfer approved", message: `You have moved to room ${toRoom?.roomNumber}, seat ${t.toBed + 1}.` });
    return res.json({ transfer: shape(claimed) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const t = isId(req.params.id) ? await SeatTransfer.findById(req.params.id) : null;
    if (!t) return res.status(404).json({ message: "Transfer not found." });
    if (String(t.requestedBy) !== uid(req.user) && String(t.student) !== uid(req.user)) return res.status(403).json({ message: "Only the requester can cancel." });
    const updated = await SeatTransfer.findOneAndUpdate({ _id: t._id, status: "requested" }, { status: "cancelled" }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Only an open request can be cancelled." });
    return res.json({ transfer: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
