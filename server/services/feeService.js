// Fee engine shared by routes, offline admission, leave settlement and the daily job.
// All money is integer PKR; all business dates come from services/clock.js.
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const Counter = require("../models/Counter");
const clock = require("./clock");
const { effectivePolicy } = require("./policyService");
const { validateFeePayment, formatReceiptNo } = require("./hostelOpsRules");
const { computeFine, invoiceTotals, invoiceStatusFor, fineStatusFor, allocatePayment, checkWaiverAmount } = require("./policyRules");

class FeeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Fine for an invoice as of a date, from its snapshotted terms. */
function fineAsOf(inv, asOf = clock.now()) {
  if (inv.status === "void") return inv.fineAccrued || 0;
  return computeFine({
    dueDate: inv.dueDate,
    issuedAt: inv.issuedAt || inv.createdAt,
    paidInFullAt: inv.stopsWhenRentPaid === false ? null : inv.paidInFullAt,
    frozenAt: inv.fineFrozenAt,
    asOf,
    finePerDay: inv.finePerDay || 0,
    maxFine: inv.maxFine,
    graceDays: inv.graceDays || 0
  });
}

/** Totals + status fields an invoice should have as of `asOf` (pure; no write). */
function project(inv, asOf = clock.now()) {
  const fineAccrued = Math.max(fineAsOf(inv, asOf), inv.fineAccrued || 0);
  const totals = invoiceTotals({ ...inv, fineAccrued });
  const status = inv.status === "void" ? "void" : invoiceStatusFor(totals);
  const fineStatus = fineStatusFor({ fineAccrued, fineWaived: inv.fineWaived, finePaid: inv.finePaid, rentDue: totals.rentDue, frozenAt: inv.fineFrozenAt });
  return { fineAccrued, totals, status, fineStatus };
}

/** Plain object for API responses: invoice + live totals + tomorrow's amount. */
function present(inv, asOf = clock.now()) {
  const o = inv.toObject ? inv.toObject() : inv;
  const today = project(o, asOf);
  const tomorrow = project(o, clock.addDays(asOf, 1));
  return {
    ...o,
    id: String(o._id),
    fineAccrued: today.fineAccrued,
    fineStatus: today.fineStatus,
    status: today.status,
    ...today.totals,
    balance: today.totals.totalDue,
    payToday: today.totals.totalDue,
    payTomorrow: tomorrow.totals.totalDue,
    asOf: clock.dayKey(asOf)
  };
}

/**
 * Persist the recomputed fine if it changed. Guarded by the previous fineAccrued so a
 * concurrent writer wins cleanly; repeating it is a no-op (idempotent, self-healing).
 */
async function refreshInvoice(inv, asOf = clock.now()) {
  if (!inv || inv.status === "void") return inv;
  const p = project(inv, asOf);
  if (p.fineAccrued === (inv.fineAccrued || 0) && p.status === inv.status && p.fineStatus === inv.fineStatus) return inv;
  const updated = await FeeInvoice.findOneAndUpdate(
    { _id: inv._id, fineAccrued: inv.fineAccrued || 0, status: inv.status },
    { $set: { fineAccrued: p.fineAccrued, status: p.status, fineStatus: p.fineStatus, fineAsOf: asOf } },
    { returnDocument: "after" }
  );
  return updated || (await FeeInvoice.findById(inv._id));
}

/** Bulk lazy refresh for list screens / reports / the daily job. Returns the number changed. */
async function refreshOpenInvoices(filter, asOf = clock.now()) {
  const open = await FeeInvoice.find({ ...filter, status: { $in: ["unpaid", "partial", "paid"] } }).lean();
  const ops = [];
  for (const inv of open) {
    const p = project(inv, asOf);
    if (p.fineAccrued !== (inv.fineAccrued || 0) || p.status !== inv.status || p.fineStatus !== inv.fineStatus) {
      ops.push({ updateOne: { filter: { _id: inv._id, fineAccrued: inv.fineAccrued || 0, status: inv.status }, update: { $set: { fineAccrued: p.fineAccrued, status: p.status, fineStatus: p.fineStatus, fineAsOf: asOf } } } });
    }
  }
  if (ops.length) await FeeInvoice.bulkWrite(ops, { ordered: false });
  return { scanned: open.length, updated: ops.length };
}

/**
 * Create an invoice with the late-fee terms of the student's block snapshotted onto it.
 * Rent invoices for a "YYYY-MM" period default their due date to the policy due day.
 */
async function createInvoice({ hostel, block = null, room, bedIndex, student, booking, title, kind = "rent", period, amount, dueDate, createdBy }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new FeeError(400, "Amount must be a positive whole number of rupees.");
  const { values } = await effectivePolicy(hostel, block);
  const now = clock.now();
  let due = dueDate ? clock.parseDay(dueDate) : null;
  if (dueDate && !due) throw new FeeError(400, "dueDate is not a valid date.");
  if (!due && kind === "rent" && period) due = clock.dueDateFor(period, values.dueDayOfMonth);
  const fines = kind === "rent" && values.lateFeeEnabled;
  try {
    return await FeeInvoice.create({
      hostel,
      block,
      room,
      bedIndex,
      student,
      booking,
      title,
      kind,
      period,
      amount,
      dueDate: due || undefined,
      issuedAt: now,
      finePerDay: fines ? values.finePerDay : 0,
      maxFine: fines ? values.maxFine : null,
      graceDays: fines ? values.graceDays : 0,
      stopsWhenRentPaid: values.stopsWhenRentPaid,
      createdBy
    });
  } catch (error) {
    if (error.code === 11000) throw new FeeError(409, "This student already has an invoice of that kind for that period.");
    throw error;
  }
}

/**
 * Record a payment: refresh the fine, validate proof rules, split rent/fine by policy,
 * issue a sequential receipt, then move the balance atomically (guarded by the exact
 * amounts read, so concurrent payments or a void in between make this one 409).
 * `beforeAllocate(invoice, totals)` may return { discount, redemptions } (early-payment offers).
 */
async function recordPayment({ invoiceId, actor, actorRole, amount, method, transactionId, screenshotUrl, bankName, note, paidAt, beforeAllocate, internal = false }) {
  let invoice = await FeeInvoice.findById(invoiceId);
  if (!invoice) throw new FeeError(404, "Invoice not found.");
  if (invoice.status === "void") throw new FeeError(409, "This invoice is void.");
  invoice = await refreshInvoice(invoice);

  let discount = { amount: 0, lines: [], redemptions: [] };
  if (beforeAllocate) discount = (await beforeAllocate(invoice)) || discount;
  const totalsBefore = invoiceTotals({ ...invoice.toObject(), discountTotal: (invoice.discountTotal || 0) + discount.amount });

  // internal deposit adjustments skip the cash/bank proof rules (no money changes hands)
  const problem = internal && method === "deposit_adjustment"
    ? Number.isInteger(amount) && amount > 0 && amount <= totalsBefore.totalDue ? null : "Invalid deposit adjustment."
    : validateFeePayment({ amount, method, transactionId, screenshotUrl, receivedBy: String(actor._id || actor.id), balance: totalsBefore.totalDue });
  if (problem) {
    if (discount.release) await discount.release();
    throw new FeeError(400, problem);
  }
  const amt = Number(amount);
  const { values } = await effectivePolicy(invoice.hostel, invoice.block);
  const split = allocatePayment({ amount: amt, rentDue: totalsBefore.rentDue, fineDue: totalsBefore.fineDue, order: values.feeAllocation });
  if (split.error) {
    if (discount.release) await discount.release();
    throw new FeeError(400, split.error);
  }

  const now = clock.now();
  const year = clock.karachiParts(now).y;
  const receiptNo = formatReceiptNo(year, await Counter.next(`receipt-${year}`));
  let payment;
  try {
    payment = await FeePayment.create({
      invoice: invoice._id,
      hostel: invoice.hostel,
      block: invoice.block,
      student: invoice.student,
      amount: amt,
      rentPortion: split.rentPortion,
      finePortion: split.finePortion,
      discountApplied: discount.amount,
      redemptions: discount.redemptions,
      method,
      bankName,
      transactionId: transactionId ? String(transactionId).trim() : undefined,
      screenshotUrl,
      receivedBy: actor._id || actor.id,
      receivedByName: actor.name,
      receivedByRole: actorRole,
      receiptNo,
      note,
      paidAt: paidAt ? new Date(paidAt) : now
    });
  } catch (error) {
    if (discount.release) await discount.release();
    if (error.code === 11000) throw new FeeError(409, "That transaction ID has already been used for another receipt.");
    throw error;
  }

  const after = { ...invoice.toObject(), paidAmount: invoice.paidAmount + split.rentPortion, finePaid: (invoice.finePaid || 0) + split.finePortion, discountTotal: (invoice.discountTotal || 0) + discount.amount };
  const rentCleared = invoiceTotals(after).rentDue === 0;
  if (rentCleared && !invoice.paidInFullAt) after.paidInFullAt = now;
  const p = project(after, now);
  const $set = { status: p.status, fineStatus: p.fineStatus, fineAccrued: p.fineAccrued, fineAsOf: now };
  if (after.paidInFullAt && !invoice.paidInFullAt) $set.paidInFullAt = after.paidInFullAt;
  const update = { $inc: { paidAmount: split.rentPortion, finePaid: split.finePortion, discountTotal: discount.amount }, $set };
  if (discount.lines.length) update.$push = { discounts: { $each: discount.lines } };

  const updated = await FeeInvoice.findOneAndUpdate(
    { _id: invoice._id, status: { $ne: "void" }, paidAmount: invoice.paidAmount, finePaid: invoice.finePaid || 0, discountTotal: invoice.discountTotal || 0, fineWaived: invoice.fineWaived || 0 },
    update,
    { returnDocument: "after" }
  );
  if (!updated) {
    await FeePayment.deleteOne({ _id: payment._id });
    if (discount.release) await discount.release();
    throw new FeeError(409, "The balance changed while recording this payment — refresh and try again.");
  }
  return { payment, invoice: updated };
}

/** Undo a confirmed payment's effect on its invoice (portions, early-payment discount). */
async function reversePaymentOnInvoice(payment) {
  const inv = await FeeInvoice.findById(payment.invoice);
  if (!inv) return null;
  const redemptionIds = (payment.redemptions || []).map(String);
  const keptDiscounts = (inv.discounts || []).filter((d) => !redemptionIds.includes(String(d.redemption)));
  const after = {
    ...inv.toObject(),
    paidAmount: Math.max(0, inv.paidAmount - (payment.rentPortion ?? payment.amount)),
    finePaid: Math.max(0, (inv.finePaid || 0) - (payment.finePortion || 0)),
    discountTotal: Math.max(0, (inv.discountTotal || 0) - (payment.discountApplied || 0)),
    discounts: keptDiscounts
  };
  const rentStillCleared = invoiceTotals(after).rentDue === 0;
  if (!rentStillCleared) after.paidInFullAt = null;
  const p = project(after);
  return FeeInvoice.findOneAndUpdate(
    { _id: inv._id, paidAmount: inv.paidAmount, finePaid: inv.finePaid || 0 },
    {
      $set: { paidAmount: after.paidAmount, finePaid: after.finePaid, discountTotal: after.discountTotal, discounts: keptDiscounts, paidInFullAt: after.paidInFullAt || null, status: inv.status === "void" ? "void" : p.status, fineStatus: p.fineStatus, fineAccrued: p.fineAccrued }
    },
    { returnDocument: "after" }
  );
}

/**
 * Waive part or all of an invoice's unpaid fine. Never more than is waivable *now*
 * (accrued − waived − paid, after a fresh recompute). With `freeze`, accrual stops today.
 * Guarded by the exact fine figures read, so two approvals can't both land.
 */
async function applyWaiver({ invoiceId, amount, freeze = false }) {
  let invoice = await FeeInvoice.findById(invoiceId);
  if (!invoice) throw new FeeError(404, "Invoice not found.");
  if (invoice.status === "void") throw new FeeError(409, "This invoice is void.");
  invoice = await refreshInvoice(invoice);
  const verdict = checkWaiverAmount({ requested: amount, fineAccrued: invoice.fineAccrued, fineWaived: invoice.fineWaived, finePaid: invoice.finePaid });
  if (!verdict.ok) throw new FeeError(verdict.code, verdict.message);
  const now = clock.now();
  const after = { ...invoice.toObject(), fineWaived: (invoice.fineWaived || 0) + verdict.amount, fineFrozenAt: freeze ? now : invoice.fineFrozenAt };
  const p = project(after, now);
  const $set = { status: p.status, fineStatus: p.fineStatus, fineAsOf: now };
  if (freeze && !invoice.fineFrozenAt) $set.fineFrozenAt = now;
  const updated = await FeeInvoice.findOneAndUpdate(
    { _id: invoice._id, status: { $ne: "void" }, fineAccrued: invoice.fineAccrued, fineWaived: invoice.fineWaived || 0, finePaid: invoice.finePaid || 0 },
    { $inc: { fineWaived: verdict.amount }, $set },
    { returnDocument: "after" }
  );
  if (!updated) throw new FeeError(409, "The fine changed while waiving — refresh and try again.");
  return { invoice: updated, amount: verdict.amount };
}

/** Undo a waiver (used only to roll back a decision that could not be recorded). */
async function revertWaiver(invoiceId, amount) {
  return FeeInvoice.updateOne({ _id: invoiceId, fineWaived: { $gte: amount } }, { $inc: { fineWaived: -amount } });
}

/** Mongo expression: outstanding = rent left + fine left (uses stored, refreshed values). */
const DUE_EXPR = {
  $add: [
    { $max: [0, { $subtract: [{ $subtract: ["$amount", { $ifNull: ["$discountTotal", 0] }] }, "$paidAmount"] }] },
    { $max: [0, { $subtract: [{ $subtract: [{ $ifNull: ["$fineAccrued", 0] }, { $ifNull: ["$fineWaived", 0] }] }, { $ifNull: ["$finePaid", 0] }] }] }
  ]
};

module.exports = { FeeError, fineAsOf, project, present, refreshInvoice, refreshOpenInvoices, createInvoice, recordPayment, reversePaymentOnInvoice, applyWaiver, revertWaiver, DUE_EXPR };
