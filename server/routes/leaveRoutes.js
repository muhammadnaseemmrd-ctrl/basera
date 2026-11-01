const express = require("express");
const LeaveNotice = require("../models/LeaveNotice");
const Booking = require("../models/Booking");
const FeeInvoice = require("../models/FeeInvoice");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { noticeCheck, shortNoticeOutcome, shortNoticeCharge } = require("../services/policyRules");
const { effectivePolicy } = require("../services/policyService");
const { FeeError, createInvoice } = require("../services/feeService");
const { monthlyRentFor } = require("../services/leaveService");
const { emitLeaveEvent } = require("../services/hostelEvents");
const { canManageHostel, staffScope, recordScope, wardenBlocks, currentStay, parentStudentIds, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};
const shape = (n) => {
  const o = n.toObject ? n.toObject() : n;
  return { ...o, id: String(o._id), intendedLeaveDay: clock.dayKey(o.intendedLeaveDate), daysLeft: clock.daysBetween(clock.now(), o.intendedLeaveDate) };
};

/** Void an unpaid short-notice charge when its notice is withdrawn/rejected. */
async function dropCharge(notice, reason) {
  if (!notice.shortNoticeCharge?.invoice) return;
  await FeeInvoice.updateOne({ _id: notice.shortNoticeCharge.invoice, paidAmount: 0, finePaid: 0, status: { $ne: "void" } }, { status: "void", voidReason: reason });
}

// What the student will be held to: policy days, earliest compliant date, short-notice terms.
router.get("/policy", authorize("student"), async (req, res, next) => {
  try {
    const stay = await currentStay(uid(req.user));
    if (!stay) return res.status(404).json({ message: "You have no active stay." });
    const { values } = await effectivePolicy(stay.hostelId, stay.blockId);
    const monthlyRent = await monthlyRentFor(stay.booking);
    const today = clock.startOfDayKarachi(clock.now());
    return res.json({
      policyDays: values.leaveNoticeDays,
      shortNoticeAction: values.shortNoticeAction,
      shortNoticeChargeDays: values.shortNoticeChargeDays,
      monthlyRent,
      shortNoticeChargeIfShort: values.shortNoticeAction === "allow_with_charge" ? shortNoticeCharge({ chargeDays: values.shortNoticeChargeDays, monthlyRent }) : 0,
      today: clock.dayKey(today),
      earliestCompliantDate: clock.dayKey(clock.addDays(today, values.leaveNoticeDays)),
      joinDate: stay.booking.checkIn ? clock.dayKey(stay.booking.checkIn) : null
    });
  } catch (error) {
    return next(error);
  }
});

/** Student gives notice for their current stay. Policy is resolved now and snapshotted. */
router.post("/", authorize("student"), async (req, res, next) => {
  try {
    const stay = await currentStay(uid(req.user));
    if (!stay) return res.status(400).json({ message: "You need an active stay to give notice." });
    const intended = clock.parseDay(req.body.intendedLeaveDate);
    const { values } = await effectivePolicy(stay.hostelId, stay.blockId);
    const now = clock.now();
    const check = noticeCheck({ requestedAt: now, intendedLeaveDate: intended, policyDays: values.leaveNoticeDays, joinDate: stay.booking.checkIn });
    if (!check.ok) return res.status(check.code).json({ message: check.message });
    const monthlyRent = await monthlyRentFor(stay.booking);
    const outcome = shortNoticeOutcome({ compliant: check.compliant, action: values.shortNoticeAction, chargeDays: values.shortNoticeChargeDays, monthlyRent });
    if (!outcome.accept) {
      return res.status(422).json({ message: `This hostel needs ${values.leaveNoticeDays} days' notice. The earliest leave date you can choose is ${clock.dayKey(check.earliestCompliantDate)}.`, earliestCompliantDate: clock.dayKey(check.earliestCompliantDate), shortBy: check.shortBy });
    }
    let notice;
    try {
      notice = await LeaveNotice.create({
        hostel: stay.hostelId,
        block: stay.blockId,
        student: uid(req.user),
        booking: stay.booking._id,
        room: stay.room._id,
        bedIndex: stay.booking.bedIndex,
        requestedAt: now,
        intendedLeaveDate: intended,
        reason: String(req.body.reason || "").slice(0, 1000),
        policyDays: values.leaveNoticeDays,
        shortNoticeAction: values.shortNoticeAction,
        noticeDaysGiven: check.noticeDaysGiven,
        shortBy: check.shortBy,
        flagged: outcome.flagged,
        shortNoticeCharge: { amount: outcome.charge, chargeDays: outcome.charge ? values.shortNoticeChargeDays : 0 }
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "You already have an open leave notice for this stay." });
      throw error;
    }
    if (outcome.charge > 0) {
      try {
        const inv = await createInvoice({ hostel: stay.hostelId, block: stay.blockId, room: stay.room._id, bedIndex: stay.booking.bedIndex, student: uid(req.user), booking: stay.booking._id, title: `Short-notice charge (${values.shortNoticeChargeDays} days × rent/30)`, kind: "other", amount: outcome.charge, createdBy: uid(req.user) });
        notice = await LeaveNotice.findByIdAndUpdate(notice._id, { "shortNoticeCharge.invoice": inv._id }, { returnDocument: "after" });
      } catch (error) {
        await LeaveNotice.deleteOne({ _id: notice._id }); // never leave a notice without its charge
        throw error;
      }
    }
    await audit(req, { action: "leave.submitted", entityType: "LeaveNotice", entityId: notice._id, metadata: { intended: clock.dayKey(intended), policyDays: notice.policyDays, given: notice.noticeDaysGiven, shortBy: notice.shortBy, charge: outcome.charge } });
    await emitLeaveEvent(notice, "submitted");
    return res.status(201).json({ notice: shape(notice) });
  } catch (error) {
    if (error instanceof FeeError) return res.status(error.code).json({ message: error.message });
    return next(error);
  }
});

router.get("/my", async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    const query = role === "parent" ? { student: { $in: await parentStudentIds(req.user) } } : { student: uid(req.user) };
    const results = await LeaveNotice.find(query).sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/withdraw", authorize("student"), async (req, res, next) => {
  try {
    const notice = isId(req.params.id) ? await LeaveNotice.findById(req.params.id) : null;
    if (!notice) return res.status(404).json({ message: "Notice not found." });
    if (String(notice.student) !== uid(req.user)) return res.status(403).json({ message: "This is not your notice." });
    const updated = await LeaveNotice.findOneAndUpdate({ _id: notice._id, status: "submitted" }, { status: "withdrawn" }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Only a notice that hasn't been decided can be withdrawn." });
    await dropCharge(updated, "Leave notice withdrawn");
    await audit(req, { action: "leave.withdrawn", entityType: "LeaveNotice", entityId: notice._id });
    await emitLeaveEvent(updated, "withdrawn");
    return res.json({ notice: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

// Staff list: head office (all), warden (own blocks).
router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, status, blockId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
    if (!scope) return res.status(403).json({ message: "No access to this hostel/block." });
    const query = { hostel: hostelId };
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => b._id);
      if (blockId && isId(blockId) && !own.some((b) => String(b) === String(blockId))) return res.status(403).json({ message: "Not your block." });
      query.block = blockId && isId(blockId) ? blockId : { $in: own };
    } else if (blockId && isId(blockId)) query.block = blockId;
    if (status) query.status = status;
    const results = await LeaveNotice.find(query).populate("student", "name").populate("room", "roomNumber").sort({ intendedLeaveDate: 1 }).limit(300).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

/** Approve / reject. Head office; the block's warden only if policy.wardenCanApprove. */
router.post("/:id/decide", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const notice = isId(req.params.id) ? await LeaveNotice.findById(req.params.id) : null;
    if (!notice) return res.status(404).json({ message: "Notice not found." });
    let role = (await canManageHostel(req.user, notice.hostel)) ? "head_office" : null;
    if (!role && (await recordScope(req.user, { hostelId: notice.hostel, blockId: notice.block })) === "warden") {
      const { values } = await effectivePolicy(notice.hostel, notice.block);
      if (values.wardenCanApprove) role = "warden";
      else return res.status(403).json({ message: "Only the head office decides leave notices in this hostel." });
    }
    if (!role) return res.status(403).json({ message: "You cannot decide this notice." });
    const decision = req.body.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: 'decision must be "approve" or "reject".' });
    const note = String(req.body.note || "").trim();
    if (decision === "reject" && !note) return res.status(400).json({ message: "A note is required when rejecting." });
    const updated = await LeaveNotice.findOneAndUpdate(
      { _id: notice._id, status: "submitted" },
      { status: decision === "approve" ? "approved" : "rejected", decidedBy: uid(req.user), decidedByRole: role, decidedAt: clock.now(), decisionNote: note },
      { returnDocument: "after" }
    );
    if (!updated) return res.status(409).json({ message: "This notice has already been decided or withdrawn." });
    if (decision === "approve") await Booking.updateOne({ _id: updated.booking }, { plannedMoveOutDate: updated.intendedLeaveDate });
    else await dropCharge(updated, "Leave notice rejected");
    await audit(req, { action: `leave.${decision === "approve" ? "approved" : "rejected"}`, entityType: "LeaveNotice", entityId: notice._id, metadata: { note, role } });
    await emitLeaveEvent(updated, decision === "approve" ? "approved" : "rejected", note);
    return res.json({ notice: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
