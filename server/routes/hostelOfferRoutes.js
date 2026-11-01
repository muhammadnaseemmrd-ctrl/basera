const express = require("express");
const mongoose = require("mongoose");
const HostelOffer = require("../models/HostelOffer");
const OfferRedemption = require("../models/OfferRedemption");
const FeeInvoice = require("../models/FeeInvoice");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { validateOfferInput } = require("../services/policyRules");
const { FeeError, present } = require("../services/feeService");
const { applyOffer, approveRedemption, rejectRedemption, reverseRedemption } = require("../services/offerService");
const { canManageHostel, staffScope, recordScope, wardenBlocks, currentStay, isId, uid } = require("../services/hostelAccess");

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

/** Effective status: an active offer past its end date reads as expired. */
const shape = (o, usage) => {
  const expired = o.validTo && clock.startOfDayKarachi(clock.now()) > clock.startOfDayKarachi(o.validTo);
  return { ...o, id: String(o._id), status: o.status === "active" && expired ? "expired" : o.status, usage: usage || { applied: 0, pending: 0, amount: 0 } };
};

const FIELDS = ["scope", "blocks", "name", "code", "type", "value", "appliesTo", "trigger", "condition", "validFrom", "validTo", "maxRedemptions", "perStudentLimit", "stackable", "requiresApproval"];
const LOCKED_AFTER_USE = ["type", "value", "trigger", "appliesTo"];

async function cleanBody(body, hostelId) {
  const errors = validateOfferInput(body);
  const out = {};
  FIELDS.forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });
  if (out.validFrom) out.validFrom = clock.parseDay(out.validFrom);
  if (out.validTo) out.validTo = clock.parseDay(out.validTo);
  if (out.code) out.code = String(out.code).trim().toUpperCase();
  if (out.scope === "block") {
    const ids = (out.blocks || []).map(String);
    if (!ids.length || ids.some((id) => !isId(id))) errors.push("Block-scoped offers need at least one block.");
    else if ((await mongoose.model("Block").countDocuments({ _id: { $in: ids }, hostelId })) !== ids.length) errors.push("A block does not belong to this hostel.");
  }
  return { errors, out };
}

router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId });
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    let offers = await HostelOffer.find({ hostel: hostelId }).sort({ createdAt: -1 }).lean();
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).map((b) => String(b._id));
      offers = offers.filter((o) => o.status !== "draft" && (o.scope === "hostel" || (o.blocks || []).some((b) => own.includes(String(b))))).map(({ code, ...o }) => o);
    }
    const usage = await OfferRedemption.aggregate([
      { $match: { offer: { $in: offers.map((o) => o._id) } } },
      { $group: { _id: { offer: "$offer", status: "$status" }, n: { $sum: 1 }, amount: { $sum: "$amountOff" } } }
    ]);
    const byOffer = {};
    usage.forEach((u) => {
      const k = String(u._id.offer);
      byOffer[k] = byOffer[k] || { applied: 0, pending: 0, reversed: 0, amount: 0 };
      if (u._id.status === "applied") {
        byOffer[k].applied += u.n;
        byOffer[k].amount += u.amount;
      } else if (u._id.status === "pending_approval") byOffer[k].pending += u.n;
      else if (u._id.status === "reversed") byOffer[k].reversed += u.n;
    });
    return res.json({ results: offers.map((o) => shape(o, byOffer[String(o._id)])) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId } = req.body;
    if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) return res.status(403).json({ message: "Only the head office manages offers." });
    const { errors, out } = await cleanBody(req.body, hostelId);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const status = ["draft", "active"].includes(req.body.status) ? req.body.status : "draft";
    const offer = await HostelOffer.create({ ...out, hostel: hostelId, status, createdBy: uid(req.user) });
    await audit(req, { action: "offer.created", entityType: "HostelOffer", entityId: offer._id, metadata: { ...out, status } });
    return res.status(201).json({ offer: shape(offer.toObject()) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Another offer in this hostel already uses that code." });
    return next(error);
  }
});

router.put("/:id", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const offer = isId(req.params.id) ? await HostelOffer.findById(req.params.id) : null;
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    if (!(await canManageHostel(req.user, offer.hostel))) return res.status(403).json({ message: "Only the head office manages offers." });
    const merged = { ...offer.toObject(), ...req.body };
    const { errors, out } = await cleanBody(merged, offer.hostel);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    if (offer.redemptionCount > 0 && LOCKED_AFTER_USE.some((k) => req.body[k] !== undefined && JSON.stringify(req.body[k]) !== JSON.stringify(offer[k]))) {
      return res.status(409).json({ message: "Type, value, trigger and what it applies to can't change after the offer has been used. Create a new offer instead." });
    }
    Object.assign(offer, out);
    await offer.save();
    await audit(req, { action: "offer.updated", entityType: "HostelOffer", entityId: offer._id, metadata: out });
    return res.json({ offer: shape(offer.toObject()) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Another offer in this hostel already uses that code." });
    return next(error);
  }
});

router.post("/:id/status", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const offer = isId(req.params.id) ? await HostelOffer.findById(req.params.id) : null;
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    if (!(await canManageHostel(req.user, offer.hostel))) return res.status(403).json({ message: "Only the head office manages offers." });
    const allowed = { draft: ["active"], active: ["paused", "expired"], paused: ["active", "expired"], expired: [] };
    const to = req.body.status;
    if (!(allowed[offer.status] || []).includes(to)) return res.status(409).json({ message: `An offer can't go from ${offer.status} to ${to}.` });
    const updated = await HostelOffer.findOneAndUpdate({ _id: offer._id, status: offer.status }, { status: to }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "The offer changed — refresh and try again." });
    await audit(req, { action: "offer.status", entityType: "HostelOffer", entityId: offer._id, metadata: { from: offer.status, to } });
    return res.json({ offer: shape(updated.toObject()) });
  } catch (error) {
    return next(error);
  }
});

// Student: offers for you (current stay's hostel/block) + what you've saved.
router.get("/my", authorize("student"), async (req, res, next) => {
  try {
    const stay = await currentStay(uid(req.user));
    const saved = await OfferRedemption.find({ student: uid(req.user), status: "applied" }).populate("offer", "name").sort({ appliedAt: -1 }).lean();
    if (!stay) return res.json({ results: [], savings: { total: 0, items: [] } });
    const today = clock.startOfDayKarachi(clock.now());
    const offers = (await HostelOffer.find({ hostel: stay.hostelId, status: "active", trigger: { $nin: ["manual", "referral", "sibling", "scholarship"] } }).lean())
      .filter((o) => (o.scope === "hostel" || (o.blocks || []).some((b) => String(b) === String(stay.blockId))) && (!o.validTo || today <= clock.startOfDayKarachi(o.validTo)) && (!o.validFrom || today >= clock.startOfDayKarachi(o.validFrom)))
      // never reveal coupon codes in a listing
      .map(({ code, redemptionCount, maxRedemptions, createdBy, ...o }) => ({ ...o, id: String(o._id), needsCode: o.trigger === "coupon" }));
    return res.json({
      results: offers,
      savings: { total: saved.reduce((s, r) => s + r.amountOff, 0), items: saved.map((r) => ({ id: String(r._id), offer: r.offer?.name, amountOff: r.amountOff, appliedAt: r.appliedAt, invoice: String(r.invoice) })) }
    });
  } catch (error) {
    return next(error);
  }
});

/** Apply an offer (by id or coupon code) to an invoice. */
router.post("/apply", async (req, res, next) => {
  try {
    const { invoiceId, offerId, code } = req.body;
    const invoice = isId(invoiceId) ? await FeeInvoice.findById(invoiceId) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (invoice.status === "void") return res.status(409).json({ message: "This invoice is void." });
    let role;
    if (String(invoice.student) === uid(req.user) && canonicalRole(req.user.role) === "student") role = "student";
    else role = await recordScope(req.user, { hostelId: invoice.hostel, blockId: invoice.block });
    if (!role) return res.status(403).json({ message: "No access to this invoice." });
    let offer = null;
    if (offerId && isId(offerId)) offer = await HostelOffer.findOne({ _id: offerId, hostel: invoice.hostel });
    else if (code) offer = await HostelOffer.findOne({ hostel: invoice.hostel, code: String(code).trim().toUpperCase() });
    if (!offer) return res.status(404).json({ message: "Offer not found for this hostel." });
    const out = await applyOffer({ invoice, offer, code, actor: req.user, role });
    await audit(req, { action: out.redemption.status === "applied" ? "offer.applied" : "offer.requested", entityType: "OfferRedemption", entityId: out.redemption._id, metadata: { offer: String(offer._id), invoice: String(invoice._id), amountOff: out.redemption.amountOff, role } });
    return res.status(201).json({ redemption: { ...out.redemption.toObject(), id: String(out.redemption._id) }, invoice: present(out.invoice) });
  } catch (error) {
    return fail(res, next, error);
  }
});

router.get("/redemptions", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, status } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId });
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    const query = { hostel: hostelId };
    if (status) query.status = status;
    let rows = await OfferRedemption.find(query).populate("offer", "name").populate("student", "name").populate("invoice", "title block").sort({ createdAt: -1 }).limit(300).lean();
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).map((b) => String(b._id));
      rows = rows.filter((r) => r.invoice?.block && own.includes(String(r.invoice.block)));
    }
    return res.json({ results: rows.map((r) => ({ ...r, id: String(r._id) })) });
  } catch (error) {
    return next(error);
  }
});

const headOfficeFor = async (req, res) => {
  const r = isId(req.params.id) ? await OfferRedemption.findById(req.params.id).lean() : null;
  if (!r) {
    res.status(404).json({ message: "Redemption not found." });
    return null;
  }
  if (!(await canManageHostel(req.user, r.hostel))) {
    res.status(403).json({ message: "Only the head office can do this." });
    return null;
  }
  return r;
};

router.post("/redemptions/:id/approve", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    if (!(await headOfficeFor(req, res))) return undefined;
    const out = await approveRedemption({ redemptionId: req.params.id, actor: req.user });
    await audit(req, { action: "offer.redemption.approved", entityType: "OfferRedemption", entityId: req.params.id, metadata: { amountOff: out.redemption.amountOff } });
    return res.json({ redemption: out.redemption, invoice: present(out.invoice) });
  } catch (error) {
    return fail(res, next, error);
  }
});

router.post("/redemptions/:id/reject", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    if (!(await headOfficeFor(req, res))) return undefined;
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required." });
    const r = await rejectRedemption({ redemptionId: req.params.id, actor: req.user, reason });
    await audit(req, { action: "offer.redemption.rejected", entityType: "OfferRedemption", entityId: req.params.id, metadata: { reason } });
    return res.json({ redemption: r });
  } catch (error) {
    return fail(res, next, error);
  }
});

router.post("/redemptions/:id/reverse", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    if (!(await headOfficeFor(req, res))) return undefined;
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required." });
    const out = await reverseRedemption({ redemptionId: req.params.id, actor: req.user, reason });
    await audit(req, { action: "offer.redemption.reversed", entityType: "OfferRedemption", entityId: req.params.id, metadata: { reason } });
    return res.json({ redemption: out.redemption, invoice: present(out.invoice) });
  } catch (error) {
    return fail(res, next, error);
  }
});

module.exports = router;
