const express = require("express");
const mongoose = require("mongoose");
const FeeInvoice = require("../models/FeeInvoice");
const FineWaiverRequest = require("../models/FineWaiverRequest");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { waivableAmount } = require("../services/policyRules");
const { FeeError, refreshInvoice, refreshOpenInvoices, applyWaiver, revertWaiver } = require("../services/feeService");
const { emitWaiverDecision, emitToStaff } = require("../services/hostelEvents");
const { canManageHostel, staffScope, recordScope, wardenBlocks, parentStudentIds, isId, uid } = require("../services/hostelAccess");

// Fine waiver workflow: student (or a warden on their behalf) asks; the warden may
// recommend; ONLY head office decides (full / partial / reject) with a mandatory note.
const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};
const fail = (res, next, error) => (error instanceof FeeError ? res.status(error.code).json({ message: error.message }) : next(error));
const parseAmount = (v) => (v === "all" || v === undefined || v === null || v === "" ? "all" : Number(v));

const shape = (r, invoice) => {
  const o = r.toObject ? r.toObject() : r;
  return { ...o, id: String(o._id), ageDays: clock.daysBetween(o.requestedAt || o.createdAt, clock.now()), waivableNow: invoice ? waivableAmount(invoice) : undefined };
};

router.post("/", async (req, res, next) => {
  try {
    const { invoiceId, amount, reason, evidence = [] } = req.body;
    let invoice = isId(invoiceId) ? await FeeInvoice.findById(invoiceId) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    const role = canonicalRole(req.user.role);
    let onBehalf = false;
    if (String(invoice.student) === uid(req.user)) onBehalf = false;
    else if (role === "warden" && (await recordScope(req.user, { hostelId: invoice.hostel, blockId: invoice.block })) === "warden") onBehalf = true;
    else return res.status(403).json({ message: "Only the student (or the warden of their block on their behalf) can request a waiver." });
    if (!String(reason || "").trim()) return res.status(400).json({ message: "Please give a reason." });
    invoice = await refreshInvoice(invoice);
    const max = waivableAmount(invoice);
    if (max === 0) return res.status(409).json({ message: "There is no unpaid fine on this invoice." });
    const requested = parseAmount(amount);
    if (requested !== "all" && (!Number.isInteger(requested) || requested <= 0 || requested > max)) return res.status(400).json({ message: `Request a whole amount from 1 to ${max}, or "all".` });
    let request;
    try {
      request = await FineWaiverRequest.create({
        invoice: invoice._id,
        hostel: invoice.hostel,
        block: invoice.block,
        student: invoice.student,
        requestedAmount: requested === "all" ? null : requested,
        requestAll: requested === "all",
        reason: String(reason).trim(),
        requestedAt: clock.now(),
        evidence: (Array.isArray(evidence) ? evidence : []).filter((e) => typeof e === "string" && /^https?:\/\//i.test(e)).slice(0, 5),
        submittedBy: uid(req.user),
        submittedByRole: role,
        onBehalf
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "A waiver request for this invoice is already pending." });
      throw error;
    }
    await audit(req, { action: "fee.waiver.requested", entityType: "FineWaiverRequest", entityId: request._id, metadata: { invoice: String(invoice._id), requested, onBehalf } });
    await emitToStaff({ hostel: invoice.hostel, block: invoice.block, type: "waiver_requested", title: "Fine waiver requested", message: `${invoice.title}: ${requested === "all" ? `all (PKR ${max})` : `PKR ${requested}`} requested${onBehalf ? " by the warden on the student's behalf" : ""}.` });
    return res.status(201).json({ request: shape(request, invoice) });
  } catch (error) {
    return fail(res, next, error);
  }
});

router.get("/my", async (req, res, next) => {
  try {
    const query = canonicalRole(req.user.role) === "parent" ? { student: { $in: await parentStudentIds(req.user) } } : { student: uid(req.user) };
    const results = await FineWaiverRequest.find(query).populate("invoice", "title period").sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ results: results.map((r) => shape(r)) });
  } catch (error) {
    return next(error);
  }
});

// Head office queue (all blocks) / warden (own blocks, to recommend). Oldest pending first.
router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, status } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId });
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    const query = { hostel: hostelId };
    if (scope === "warden") query.block = { $in: (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => b._id) };
    if (status) query.status = status;
    await refreshOpenInvoices({ hostel: hostelId });
    const results = await FineWaiverRequest.find(query).populate("student", "name").populate("invoice").sort({ status: 1, requestedAt: 1, createdAt: 1 }).limit(300).lean();
    return res.json({
      results: results.map((r) => ({ ...shape(r, r.invoice), invoice: r.invoice ? { id: String(r.invoice._id), title: r.invoice.title, period: r.invoice.period, fineAccrued: r.invoice.fineAccrued, fineWaived: r.invoice.fineWaived, finePaid: r.invoice.finePaid } : null }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/recommend", authorize("warden", "host", "admin"), async (req, res, next) => {
  try {
    const request = isId(req.params.id) ? await FineWaiverRequest.findById(req.params.id) : null;
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (!(await recordScope(req.user, { hostelId: request.hostel, blockId: request.block }))) return res.status(403).json({ message: "Not your block." });
    if (!String(req.body.note || "").trim()) return res.status(400).json({ message: "A note is required." });
    const updated = await FineWaiverRequest.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      { $push: { recommendations: { by: uid(req.user), byName: req.user.name, note: String(req.body.note).slice(0, 500), at: clock.now() } } },
      { returnDocument: "after" }
    );
    if (!updated) return res.status(409).json({ message: "This request is no longer pending." });
    await audit(req, { action: "fee.waiver.recommended", entityType: "FineWaiverRequest", entityId: request._id, metadata: { note: req.body.note } });
    return res.json({ request: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

/**
 * Head office decision. Order matters for races: the request is claimed first (guarded by
 * status "pending"), then the invoice is changed (guarded by its fine figures); if the
 * invoice write fails, the claim is released so nothing is half-applied.
 */
router.post("/:id/decide", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const request = isId(req.params.id) ? await FineWaiverRequest.findById(req.params.id) : null;
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (!(await canManageHostel(req.user, request.hostel))) return res.status(403).json({ message: "Only the head office can decide waiver requests." });
    const note = String(req.body.note || "").trim();
    if (!note) return res.status(400).json({ message: "A decision note is required." });
    const decision = req.body.decision;
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: 'decision must be "approve" or "reject".' });

    if (decision === "reject") {
      const rejected = await FineWaiverRequest.findOneAndUpdate({ _id: request._id, status: "pending" }, { status: "rejected", decidedBy: uid(req.user), decidedAt: clock.now(), decisionNote: note }, { returnDocument: "after" });
      if (!rejected) return res.status(409).json({ message: "This request has already been decided or cancelled." });
      const invoice = await FeeInvoice.findById(request.invoice).lean();
      await audit(req, { action: "fee.waiver.rejected", entityType: "FineWaiverRequest", entityId: request._id, metadata: { note } });
      await emitWaiverDecision(rejected, invoice);
      return res.json({ request: shape(rejected) });
    }

    const amount = parseAmount(req.body.amount ?? (request.requestAll ? "all" : request.requestedAmount));
    const claimed = await FineWaiverRequest.findOneAndUpdate({ _id: request._id, status: "pending" }, { status: "approved", decidedBy: uid(req.user), decidedAt: clock.now(), decisionNote: note, freeze: Boolean(req.body.freeze) }, { returnDocument: "after" });
    if (!claimed) return res.status(409).json({ message: "This request has already been decided or cancelled." });
    let applied;
    try {
      applied = await applyWaiver({ invoiceId: request.invoice, amount, freeze: Boolean(req.body.freeze) });
    } catch (error) {
      await FineWaiverRequest.updateOne({ _id: request._id, status: "approved" }, { status: "pending", $unset: { decidedBy: 1, decidedAt: 1, decisionNote: 1 } });
      throw error;
    }
    const full = request.requestAll ? amount === "all" : applied.amount >= (request.requestedAmount || 0);
    const final = await FineWaiverRequest.findOneAndUpdate({ _id: request._id, status: "approved" }, { status: full ? "approved" : "partial", approvedAmount: applied.amount }, { returnDocument: "after" });
    if (!final) {
      await revertWaiver(request.invoice, applied.amount);
      return res.status(409).json({ message: "This request changed while deciding — refresh and try again." });
    }
    await audit(req, { action: "fee.waiver.approved", entityType: "FineWaiverRequest", entityId: request._id, metadata: { amount: applied.amount, partial: !full, freeze: Boolean(req.body.freeze), note } });
    await emitWaiverDecision(final, applied.invoice);
    return res.json({ request: shape(final, applied.invoice) });
  } catch (error) {
    return fail(res, next, error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const request = isId(req.params.id) ? await FineWaiverRequest.findById(req.params.id) : null;
    if (!request) return res.status(404).json({ message: "Request not found." });
    const mine = String(request.student) === uid(req.user) || String(request.submittedBy) === uid(req.user);
    if (!mine) return res.status(403).json({ message: "Only the person who asked can cancel this request." });
    const cancelled = await FineWaiverRequest.findOneAndUpdate({ _id: request._id, status: "pending" }, { status: "cancelled" }, { returnDocument: "after" });
    if (!cancelled) return res.status(409).json({ message: "Only a pending request can be cancelled." });
    await audit(req, { action: "fee.waiver.cancelled", entityType: "FineWaiverRequest", entityId: request._id });
    return res.json({ request: shape(cancelled) });
  } catch (error) {
    return next(error);
  }
});

// Monthly "fines charged vs waived" (by the month the rent fell due). Wardens: own blocks.
router.get("/report", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId });
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    await refreshOpenInvoices({ hostel: hostelId });
    const match = { hostel: new mongoose.Types.ObjectId(hostelId), status: { $ne: "void" }, fineAccrued: { $gt: 0 } };
    if (scope === "warden") match.block = { $in: (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => b._id) };
    const rows = await FeeInvoice.aggregate([
      { $match: match },
      // Karachi month of the due date (UTC+5)
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$dueDate", timezone: "+05:00" } }, charged: { $sum: "$fineAccrued" }, waived: { $sum: "$fineWaived" }, paid: { $sum: "$finePaid" }, invoices: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);
    return res.json({ results: rows.map((r) => ({ month: r._id, charged: r.charged, waived: r.waived, paid: r.paid, outstanding: r.charged - r.waived - r.paid, invoices: r.invoices })) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
