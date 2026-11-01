// Hostel offers applied to invoices as explicit negative lines (invoice.amount never changes).
// Capacity is reserved atomically on the offer (redemptionCount), a unique index stops the
// same offer being redeemed twice on one invoice, and per-student limits are re-checked after
// insert, so concurrent redemptions can never exceed a cap.
const Booking = require("../models/Booking");
const FeeInvoice = require("../models/FeeInvoice");
const HostelOffer = require("../models/HostelOffer");
const OfferRedemption = require("../models/OfferRedemption");
const clock = require("./clock");
const { evaluateOffer, bestCombination, monthsBetween, MANUAL_TRIGGERS } = require("./policyRules");
const { FeeError, project } = require("./feeService");

const LIVE = ["applied", "pending_approval"];
const AUTO_AT_PAYMENT = ["early_payment", "advance_months", "long_stay"];

const rentLeft = (inv) => Math.max(0, inv.amount - (inv.discountTotal || 0) - (inv.paidAmount || 0));

async function context(invoice, { code, manual = false } = {}) {
  const booking = invoice.booking ? await Booking.findById(invoice.booking).select("checkIn").lean() : null;
  return {
    today: clock.now(),
    hostelId: invoice.hostel,
    blockId: invoice.block,
    invoice: { kind: invoice.kind, amount: invoice.amount, discountTotal: invoice.discountTotal || 0, period: invoice.period, dueDate: invoice.dueDate },
    stayMonths: booking?.checkIn ? monthsBetween(booking.checkIn, clock.now()) : 0,
    code,
    manual
  };
}

const studentUses = (offerId, studentId) => OfferRedemption.countDocuments({ offer: offerId, student: studentId, status: { $in: LIVE } });

/** Evaluate offers for an invoice; amounts are capped at the rent still owed. */
async function evaluateAll(invoice, offers, opts) {
  const ctx = await context(invoice, opts);
  const cap = rentLeft(invoice);
  const out = [];
  for (const offer of offers) {
    const verdict = evaluateOffer(offer, { ...ctx, studentUses: await studentUses(offer._id, invoice.student) });
    if (verdict.eligible) out.push({ offer, amountOff: Math.min(verdict.amountOff, cap) });
  }
  return out.filter((c) => c.amountOff > 0);
}

async function reserveSlot(offer) {
  const filter = { _id: offer._id, status: "active" };
  if (offer.maxRedemptions) filter.redemptionCount = { $lt: offer.maxRedemptions };
  return Boolean(await HostelOffer.findOneAndUpdate(filter, { $inc: { redemptionCount: 1 } }));
}
const releaseSlot = (offerId) => HostelOffer.updateOne({ _id: offerId, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });

async function createRedemption({ offer, invoice, amountOff, actor, actorRole, status }) {
  if (!(await reserveSlot(offer))) throw new FeeError(409, "This offer has been fully redeemed.");
  let redemption;
  try {
    redemption = await OfferRedemption.create({ offer: offer._id, hostel: invoice.hostel, student: invoice.student, invoice: invoice._id, amountOff, appliedBy: actor._id || actor.id, appliedByRole: actorRole, appliedAt: clock.now(), status });
  } catch (error) {
    await releaseSlot(offer._id);
    if (error.code === 11000) throw new FeeError(409, "This offer is already applied to this invoice.");
    throw error;
  }
  if (offer.perStudentLimit && (await studentUses(offer._id, invoice.student)) > offer.perStudentLimit) {
    await OfferRedemption.deleteOne({ _id: redemption._id });
    await releaseSlot(offer._id);
    throw new FeeError(409, "This student has already used this offer.");
  }
  return redemption;
}

async function undoRedemption(redemption) {
  await OfferRedemption.deleteOne({ _id: redemption._id });
  await releaseSlot(redemption.offer);
}

/** Push discount lines onto an invoice, guarded by the figures read (no lost updates). */
async function addLines(invoice, lines) {
  const total = lines.reduce((s, l) => s + l.amountOff, 0);
  const after = { ...(invoice.toObject ? invoice.toObject() : invoice), discountTotal: (invoice.discountTotal || 0) + total };
  const p = project(after);
  const $set = { status: p.status, fineStatus: p.fineStatus };
  if (p.totals.rentDue === 0 && !invoice.paidInFullAt) $set.paidInFullAt = clock.now();
  return FeeInvoice.findOneAndUpdate(
    { _id: invoice._id, status: { $ne: "void" }, discountTotal: invoice.discountTotal || 0, paidAmount: invoice.paidAmount || 0 },
    { $push: { discounts: { $each: lines } }, $inc: { discountTotal: total }, $set },
    { returnDocument: "after" }
  );
}

const lineFor = (offer, redemption, amountOff) => ({ offer: offer._id, redemption: redemption._id, name: offer.name, amountOff, stackable: Boolean(offer.stackable) });

/**
 * Payment-time hook (early payment / advance / long stay). Only when this payment clears the
 * remaining rent. Returns { amount, lines, redemptions, release } for feeService.recordPayment.
 */
async function reserveAutoOffers(invoice, { amount, actor }) {
  const offers = await HostelOffer.find({ hostel: invoice.hostel, status: "active", trigger: { $in: AUTO_AT_PAYMENT } }).lean();
  if (!offers.length) return null;
  const candidates = await evaluateAll(invoice, offers, { manual: false });
  const { chosen, total } = bestCombination(candidates, { base: rentLeft(invoice), existing: invoice.discounts || [] });
  if (!total || !Number.isInteger(amount) || amount < rentLeft(invoice) - total) return null;
  const made = [];
  for (const c of chosen) {
    try {
      const redemption = await createRedemption({ offer: c.offer, invoice, amountOff: c.amountOff, actor, actorRole: "auto", status: "applied" });
      made.push({ redemption, line: lineFor(c.offer, redemption, c.amountOff) });
    } catch (error) {
      if (!(error instanceof FeeError)) throw error; // capacity just ran out — skip that offer
    }
  }
  if (!made.length) return null;
  return {
    amount: made.reduce((s, m) => s + m.line.amountOff, 0),
    lines: made.map((m) => m.line),
    redemptions: made.map((m) => m.redemption._id),
    release: async () => {
      for (const m of made) await undoRedemption(m.redemption);
    }
  };
}

/** After a payment is voided: its payment-time redemptions are reversed and caps restored. */
async function reverseRedemptionsForPayment(payment, { actor, reason }) {
  const ids = payment.redemptions || [];
  if (!ids.length) return 0;
  const live = await OfferRedemption.find({ _id: { $in: ids }, status: "applied" }).lean();
  for (const r of live) {
    const done = await OfferRedemption.updateOne({ _id: r._id, status: "applied" }, { status: "reversed", reversedReason: reason, reversedBy: actor._id || actor.id, reversedAt: clock.now() });
    if (done.modifiedCount) await releaseSlot(r.offer);
  }
  return live.length;
}

/** Offers a student could use on an invoice right now (for the payment screen). */
async function eligibleOffersFor(invoice) {
  const offers = await HostelOffer.find({ hostel: invoice.hostel, status: "active", trigger: { $nin: MANUAL_TRIGGERS } }).lean();
  const list = await evaluateAll(invoice, offers.filter((o) => o.trigger !== "coupon"), { manual: false });
  return list.map((c) => ({ id: String(c.offer._id), name: c.offer.name, trigger: c.offer.trigger, amountOff: c.amountOff, stackable: c.offer.stackable, atPayment: AUTO_AT_PAYMENT.includes(c.offer.trigger) }));
}

/**
 * Apply an offer to an invoice outside a payment (coupon, scholarship, referral, ...).
 * role: "head_office" (applies immediately unless the offer is draft), "warden" (always
 * pending head-office approval), "student" (coupon / auto-type offers on own invoice).
 */
async function applyOffer({ invoice, offer, code, actor, role }) {
  if (offer.trigger === "early_payment") throw new FeeError(400, "Early-payment offers are applied automatically when the payment is recorded.");
  if (role === "student" && MANUAL_TRIGGERS.includes(offer.trigger)) throw new FeeError(403, "This offer is applied by the hostel office.");
  const ctx = await context(invoice, { code: code || (role !== "student" ? offer.code : undefined), manual: role !== "student" });
  const verdict = evaluateOffer(offer, { ...ctx, studentUses: await studentUses(offer._id, invoice.student) });
  if (!verdict.eligible) throw new FeeError(400, verdict.reason);
  const amountOff = Math.min(verdict.amountOff, rentLeft(invoice));
  if (amountOff <= 0) throw new FeeError(409, "There is no rent left on this invoice to discount.");
  const combo = bestCombination([{ offer, amountOff }], { base: rentLeft(invoice), existing: invoice.discounts || [] });
  if (!combo.total) throw new FeeError(409, "This offer can't be combined with the discount already on this invoice.");
  const pending = role === "warden" || (offer.requiresApproval && role !== "head_office");
  const redemption = await createRedemption({ offer, invoice, amountOff: combo.total, actor, actorRole: role, status: pending ? "pending_approval" : "applied" });
  if (pending) return { redemption, invoice };
  const updated = await addLines(invoice, [lineFor(offer, redemption, combo.total)]);
  if (!updated) {
    await undoRedemption(redemption);
    throw new FeeError(409, "The invoice changed while applying the offer — refresh and try again.");
  }
  return { redemption, invoice: updated };
}

/** Head office approves a pending redemption: applied once, capped at the rent still owed. */
async function approveRedemption({ redemptionId, actor }) {
  const r = await OfferRedemption.findById(redemptionId);
  if (!r) throw new FeeError(404, "Redemption not found.");
  const [invoice, offer] = await Promise.all([FeeInvoice.findById(r.invoice), HostelOffer.findById(r.offer)]);
  const amountOff = Math.min(r.amountOff, rentLeft(invoice));
  const claimed = await OfferRedemption.findOneAndUpdate({ _id: r._id, status: "pending_approval" }, { status: "applied", approvedBy: actor._id || actor.id, amountOff, appliedAt: clock.now() }, { returnDocument: "after" });
  if (!claimed) throw new FeeError(409, "This redemption is not pending.");
  const updated = amountOff > 0 ? await addLines(invoice, [lineFor(offer, claimed, amountOff)]) : invoice;
  if (!updated) {
    await OfferRedemption.updateOne({ _id: r._id }, { status: "pending_approval", $unset: { approvedBy: 1 } });
    throw new FeeError(409, "The invoice changed while approving — refresh and try again.");
  }
  return { redemption: claimed, invoice: updated };
}

async function rejectRedemption({ redemptionId, actor, reason }) {
  const r = await OfferRedemption.findOneAndUpdate({ _id: redemptionId, status: "pending_approval" }, { status: "rejected", reversedReason: reason, reversedBy: actor._id || actor.id, reversedAt: clock.now() }, { returnDocument: "after" });
  if (!r) throw new FeeError(409, "This redemption is not pending.");
  await releaseSlot(r.offer);
  return r;
}

/** Reverse a manually applied discount (not one granted with a payment — void that payment instead). */
async function reverseRedemption({ redemptionId, actor, reason }) {
  const r = await OfferRedemption.findById(redemptionId);
  if (!r) throw new FeeError(404, "Redemption not found.");
  if (r.payment) throw new FeeError(409, "This discount came with a payment; void that payment to reverse it.");
  const invoice = await FeeInvoice.findById(r.invoice);
  const claimed = await OfferRedemption.findOneAndUpdate({ _id: r._id, status: "applied" }, { status: "reversed", reversedReason: reason, reversedBy: actor._id || actor.id, reversedAt: clock.now() }, { returnDocument: "after" });
  if (!claimed) throw new FeeError(409, "Only an applied discount can be reversed.");
  const after = { ...invoice.toObject(), discountTotal: Math.max(0, (invoice.discountTotal || 0) - r.amountOff) };
  const rentCleared = Math.max(0, after.amount - after.discountTotal - after.paidAmount) === 0;
  const p = project({ ...after, paidInFullAt: rentCleared ? invoice.paidInFullAt : null });
  const updated = await FeeInvoice.findOneAndUpdate(
    { _id: invoice._id, discountTotal: invoice.discountTotal || 0 },
    { $pull: { discounts: { redemption: r._id } }, $inc: { discountTotal: -r.amountOff }, $set: { status: invoice.status === "void" ? "void" : p.status, fineStatus: p.fineStatus, paidInFullAt: rentCleared ? invoice.paidInFullAt : null } },
    { returnDocument: "after" }
  );
  if (!updated) {
    await OfferRedemption.updateOne({ _id: r._id }, { status: "applied", $unset: { reversedReason: 1, reversedBy: 1, reversedAt: 1 } });
    throw new FeeError(409, "The invoice changed while reversing — refresh and try again.");
  }
  await releaseSlot(r.offer);
  return { redemption: claimed, invoice: updated };
}

module.exports = { reserveAutoOffers, reverseRedemptionsForPayment, eligibleOffersFor, applyOffer, approveRedemption, rejectRedemption, reverseRedemption, rentLeft };
