const express = require("express");
const Visitor = require("../models/Visitor");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { validateVisitor } = require("../services/reportRules");
const { withinVisitingHours } = require("../services/policyRules");
const { effectivePolicy } = require("../services/policyService");
const { emitToFamily, emitToStaff } = require("../services/hostelEvents");
const { staffScope, recordScope, wardenBlocks, currentStay, parentStudentIds, isId, uid } = require("../services/hostelAccess");

// Visitor management: a student pre-registers, or the block's warden / head office logs a
// walk-in; the warden approves or denies; check-in / check-out are recorded against the
// policy's visiting hours (outside them needs an explicit override note and is flagged).
const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};
const shape = (v) => ({ ...(v.toObject ? v.toObject() : v), id: String(v._id) });

router.post("/", async (req, res, next) => {
  try {
    const errors = validateVisitor(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const role = canonicalRole(req.user.role);
    let studentId;
    let stay;
    if (role === "student") {
      studentId = uid(req.user);
      stay = await currentStay(studentId);
      if (!stay) return res.status(400).json({ message: "You need an active stay to register a visitor." });
    } else {
      studentId = req.body.studentId;
      stay = isId(studentId) ? await currentStay(studentId) : null;
      if (!stay || !(await recordScope(req.user, { hostelId: stay.hostelId, blockId: stay.blockId }))) return res.status(403).json({ message: "That student is not a resident of your hostel/block." });
    }
    const { values } = await effectivePolicy(stay.hostelId, stay.blockId);
    if (!values.visitorsEnabled) return res.status(409).json({ message: "This hostel does not allow visitors." });
    const expectedAt = req.body.expectedAt ? new Date(req.body.expectedAt) : null;
    if (expectedAt && Number.isNaN(expectedAt.getTime())) return res.status(400).json({ message: "expectedAt is not a valid date-time." });
    const visitor = await Visitor.create({
      hostel: stay.hostelId,
      block: stay.blockId,
      student: studentId,
      visitorName: String(req.body.visitorName).trim(),
      cnicLast4: String(req.body.cnicLast4),
      relation: req.body.relation,
      purpose: String(req.body.purpose).trim(),
      expectedAt,
      // staff logging a walk-in at the gate approves it at the same time
      status: role === "student" ? "pending" : "approved",
      createdBy: uid(req.user),
      createdByRole: role
    });
    await audit(req, { action: "visitor.registered", entityType: "Visitor", entityId: visitor._id, metadata: { by: role } });
    if (role === "student") await emitToStaff({ hostel: stay.hostelId, block: stay.blockId, type: "visitor_registered", title: "Visitor pre-registered", message: `${req.user.name} expects ${visitor.visitorName} (${visitor.purpose}).` });
    return res.status(201).json({ visitor: shape(visitor), visitingHours: { start: values.visitingStart, end: values.visitingEnd } });
  } catch (error) {
    return next(error);
  }
});

router.get("/my", async (req, res, next) => {
  try {
    const query = canonicalRole(req.user.role) === "parent" ? { student: { $in: await parentStudentIds(req.user) } } : { student: uid(req.user) };
    const results = await Visitor.find(query).populate("student", "name").sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

// Visitor log per block (warden: own blocks only).
router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId, status, date } = req.query;
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
    if (date) {
      const day = clock.parseDay(date);
      if (!day) return res.status(400).json({ message: "date must be YYYY-MM-DD." });
      query.createdAt = { $gte: day, $lt: clock.addDays(day, 1) };
    }
    const results = await Visitor.find(query).populate("student", "name").sort({ createdAt: -1 }).limit(300).lean();
    return res.json({ results: results.map(shape) });
  } catch (error) {
    return next(error);
  }
});

async function loadForStaff(req, res) {
  const visitor = isId(req.params.id) ? await Visitor.findById(req.params.id) : null;
  if (!visitor) {
    res.status(404).json({ message: "Visitor not found." });
    return null;
  }
  if (!(await recordScope(req.user, { hostelId: visitor.hostel, blockId: visitor.block }))) {
    res.status(403).json({ message: "Not your block." });
    return null;
  }
  return visitor;
}

router.post("/:id/decide", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const visitor = await loadForStaff(req, res);
    if (!visitor) return undefined;
    const approve = req.body.decision === "approve";
    if (!["approve", "deny"].includes(req.body.decision)) return res.status(400).json({ message: 'decision must be "approve" or "deny".' });
    const updated = await Visitor.findOneAndUpdate({ _id: visitor._id, status: "pending" }, { status: approve ? "approved" : "denied", decidedBy: uid(req.user), decisionNote: String(req.body.note || "").slice(0, 300) }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Only a pending visitor can be approved or denied." });
    await audit(req, { action: `visitor.${approve ? "approved" : "denied"}`, entityType: "Visitor", entityId: visitor._id });
    await emitToFamily({ student: visitor.student, hostel: visitor.hostel, type: "visitor_decision", title: "Visitor update", message: `${visitor.visitorName}'s visit was ${approve ? "approved" : "denied"}.${updated.decisionNote ? ` ${updated.decisionNote}` : ""}` });
    return res.json({ visitor: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/check-in", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const visitor = await loadForStaff(req, res);
    if (!visitor) return undefined;
    const now = clock.now();
    const { values } = await effectivePolicy(visitor.hostel, visitor.block);
    const inside = withinVisitingHours(now, values.visitingStart, values.visitingEnd);
    const overrideNote = String(req.body.overrideNote || "").trim();
    if (!inside && !overrideNote) return res.status(409).json({ message: `Visiting hours are ${values.visitingStart}–${values.visitingEnd}. Add an override note to let this visitor in.` });
    const updated = await Visitor.findOneAndUpdate({ _id: visitor._id, status: "approved" }, { status: "checked_in", checkInAt: now, outsideHours: !inside, overrideNote: inside ? undefined : overrideNote }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Only an approved visitor can check in." });
    await audit(req, { action: "visitor.checked_in", entityType: "Visitor", entityId: visitor._id, metadata: { outsideHours: !inside, overrideNote } });
    return res.json({ visitor: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/check-out", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const visitor = await loadForStaff(req, res);
    if (!visitor) return undefined;
    const updated = await Visitor.findOneAndUpdate({ _id: visitor._id, status: "checked_in" }, { status: "checked_out", checkOutAt: clock.now() }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Only a checked-in visitor can check out." });
    return res.json({ visitor: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const visitor = isId(req.params.id) ? await Visitor.findById(req.params.id) : null;
    if (!visitor) return res.status(404).json({ message: "Visitor not found." });
    if (String(visitor.student) !== uid(req.user)) return res.status(403).json({ message: "Only the student who registered this visitor can cancel it." });
    const updated = await Visitor.findOneAndUpdate({ _id: visitor._id, status: { $in: ["pending", "approved"] } }, { status: "cancelled" }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "This visit can no longer be cancelled." });
    return res.json({ visitor: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
