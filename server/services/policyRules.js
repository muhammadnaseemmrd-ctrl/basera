// Pure (database-free) Phase 2 business rules: per-hostel policy resolution, notice
// periods, late fines, payment allocation, waivers, offers and checkout settlement.
// Routes load documents, call these, then persist. Every amount is integer PKR.
// Dates are business dates from services/clock.js (Asia/Karachi calendar days).

const clock = require("./clock");

const isInt = (n) => Number.isInteger(n);
const nonNegInt = (n) => isInt(n) && n >= 0;

// ---------------------------------------------------------------- policy
const PLATFORM_DEFAULTS = Object.freeze({
  leaveNoticeDays: 30,
  shortNoticeAction: "allow_flag_only",
  shortNoticeChargeDays: 0,
  wardenCanApprove: false,
  lateFeeEnabled: true,
  dueDayOfMonth: 5,
  finePerDay: 100,
  graceDays: 0,
  maxFine: null,
  stopsWhenRentPaid: true,
  feeAllocation: "rent_first",
  visitorsEnabled: true,
  visitingStart: "09:00",
  visitingEnd: "20:00",
  curfew: "22:00"
});

const SHORT_NOTICE_ACTIONS = ["allow_with_charge", "allow_flag_only", "block"];
const FEE_ALLOCATIONS = ["rent_first", "fine_first"];

// effective key → where it lives on the HostelPolicy document
const HOSTEL_PATHS = {
  leaveNoticeDays: ["leaveNotice", "days"],
  shortNoticeAction: ["leaveNotice", "shortNoticeAction"],
  shortNoticeChargeDays: ["leaveNotice", "shortNoticeChargeDays"],
  wardenCanApprove: ["leaveNotice", "wardenCanApprove"],
  lateFeeEnabled: ["lateFee", "enabled"],
  dueDayOfMonth: ["lateFee", "dueDayOfMonth"],
  finePerDay: ["lateFee", "finePerDay"],
  graceDays: ["lateFee", "graceDays"],
  maxFine: ["lateFee", "maxFine"],
  stopsWhenRentPaid: ["lateFee", "stopsWhenRentPaid"],
  feeAllocation: ["feeAllocation"],
  visitorsEnabled: ["visitors", "enabled"],
  visitingStart: ["visitors", "start"],
  visitingEnd: ["visitors", "end"],
  curfew: ["visitors", "curfew"]
};
const BLOCK_KEYS = ["leaveNoticeDays", "dueDayOfMonth", "finePerDay", "maxFine"];

const dig = (obj, path) => path.reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);

/**
 * Resolve the effective policy: block override → hostel policy → platform default.
 * A value counts as "set" when it is not undefined. For the hostel `maxFine`, an explicit
 * null means "no cap" and is a hostel-level choice; for block overrides null = inherit.
 * @returns {{ values: object, source: Record<string,"block"|"hostel"|"platform"> }}
 */
function resolvePolicy(policy, blockId = null) {
  const values = {};
  const source = {};
  const override = blockId && policy?.blockOverrides ? policy.blockOverrides.find((o) => String(o.block) === String(blockId)) : null;
  for (const key of Object.keys(PLATFORM_DEFAULTS)) {
    const blockVal = override && BLOCK_KEYS.includes(key) ? override[key] : undefined;
    const hostelVal = policy ? dig(policy, HOSTEL_PATHS[key]) : undefined;
    if (blockVal !== undefined && blockVal !== null) {
      values[key] = blockVal;
      source[key] = "block";
    } else if (hostelVal !== undefined) {
      values[key] = hostelVal;
      source[key] = "hostel";
    } else {
      values[key] = PLATFORM_DEFAULTS[key];
      source[key] = "platform";
    }
  }
  return { values, source };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validate a policy update body. Returns a list of human-readable errors (empty = OK). */
function validatePolicyInput(body = {}) {
  const errors = [];
  const checkInt = (label, v, min, max) => {
    if (v === undefined) return;
    if (!isInt(v) || v < min || v > max) errors.push(`${label} must be a whole number from ${min} to ${max}.`);
  };
  const ln = body.leaveNotice || {};
  checkInt("Notice days", ln.days, 0, 365);
  checkInt("Short-notice charge days", ln.shortNoticeChargeDays, 0, 90);
  if (ln.shortNoticeAction !== undefined && !SHORT_NOTICE_ACTIONS.includes(ln.shortNoticeAction)) errors.push(`Short-notice action must be one of: ${SHORT_NOTICE_ACTIONS.join(", ")}.`);
  if (ln.wardenCanApprove !== undefined && typeof ln.wardenCanApprove !== "boolean") errors.push("wardenCanApprove must be true or false.");
  const lf = body.lateFee || {};
  checkInt("Due day of month", lf.dueDayOfMonth, 1, 31);
  checkInt("Fine per day (PKR)", lf.finePerDay, 0, 100000);
  checkInt("Grace days", lf.graceDays, 0, 31);
  if (lf.maxFine !== undefined && lf.maxFine !== null) checkInt("Maximum fine (PKR)", lf.maxFine, 0, 10000000);
  ["enabled", "stopsWhenRentPaid"].forEach((k) => {
    if (lf[k] !== undefined && typeof lf[k] !== "boolean") errors.push(`lateFee.${k} must be true or false.`);
  });
  if (body.feeAllocation !== undefined && !FEE_ALLOCATIONS.includes(body.feeAllocation)) errors.push(`Fee allocation must be one of: ${FEE_ALLOCATIONS.join(", ")}.`);
  const v = body.visitors || {};
  ["start", "end", "curfew"].forEach((k) => {
    if (v[k] !== undefined && !TIME.test(String(v[k]))) errors.push(`Visitors ${k} must be HH:MM (24h).`);
  });
  (body.blockOverrides || []).forEach((o, i) => {
    checkInt(`Block override #${i + 1} notice days`, o.leaveNoticeDays ?? undefined, 0, 365);
    checkInt(`Block override #${i + 1} due day`, o.dueDayOfMonth ?? undefined, 1, 31);
    checkInt(`Block override #${i + 1} fine per day`, o.finePerDay ?? undefined, 0, 100000);
    if (o.maxFine !== undefined && o.maxFine !== null) checkInt(`Block override #${i + 1} max fine`, o.maxFine, 0, 10000000);
  });
  return errors;
}

/** Plain-language summary of an effective policy for the UI preview. */
function describePolicy(values, label = "A student") {
  const parts = [`${label} must give ${values.leaveNoticeDays} days' notice before leaving`];
  if (values.lateFeeEnabled && values.finePerDay > 0) {
    const firstFineDay = values.dueDayOfMonth + values.graceDays + 1;
    parts.push(`rent is due on day ${values.dueDayOfMonth} of the month; fines start on day ${firstFineDay} at PKR ${values.finePerDay}/day${values.maxFine !== null ? ` (capped at PKR ${values.maxFine})` : ""}`);
  } else {
    parts.push(`rent is due on day ${values.dueDayOfMonth} of the month; no late fines`);
  }
  return `${parts.join("; ")}.`;
}

// ---------------------------------------------------------------- leave notice
/**
 * Check a leave-notice request against a snapshotted policy.
 * @returns {{ok:false, code:number, message:string} | {ok:true, noticeDaysGiven:number, shortBy:number, compliant:boolean, earliestCompliantDate:Date}}
 */
function noticeCheck({ requestedAt, intendedLeaveDate, policyDays, joinDate }) {
  if (!intendedLeaveDate) return { ok: false, code: 400, message: "Choose the date you intend to leave." };
  const today = clock.startOfDayKarachi(requestedAt);
  const leave = clock.startOfDayKarachi(intendedLeaveDate);
  if (leave < today) return { ok: false, code: 400, message: "The leave date cannot be in the past." };
  if (joinDate && leave < clock.startOfDayKarachi(joinDate)) return { ok: false, code: 400, message: "The leave date cannot be before your join date." };
  const noticeDaysGiven = clock.daysBetween(today, leave);
  const shortBy = Math.max(0, policyDays - noticeDaysGiven);
  return { ok: true, noticeDaysGiven, shortBy, compliant: shortBy === 0, earliestCompliantDate: clock.addDays(today, policyDays) };
}

/** Short-notice charge: chargeDays × monthlyRent / 30, rounded to whole PKR. */
function shortNoticeCharge({ chargeDays, monthlyRent }) {
  if (!nonNegInt(chargeDays) || !nonNegInt(monthlyRent)) return 0;
  return Math.round((chargeDays * monthlyRent) / 30);
}

/** What happens to a short notice under the policy action. */
function shortNoticeOutcome({ compliant, action, chargeDays, monthlyRent }) {
  if (compliant) return { accept: true, flagged: false, charge: 0 };
  if (action === "block") return { accept: false, flagged: true, charge: 0 };
  if (action === "allow_with_charge") return { accept: true, flagged: true, charge: shortNoticeCharge({ chargeDays, monthlyRent }) };
  return { accept: true, flagged: true, charge: 0 };
}

// ---------------------------------------------------------------- late fines
/**
 * Fine for one invoice, recomputed from dates (never incremented), so a missed or
 * repeated daily run always converges to the same number.
 *  - fines count from max(due day, issue day) — never back-dated before issue;
 *  - grace days after that are free;
 *  - stops on the day rent is paid in full (that day still counts) or a "waive & freeze";
 *  - capped at maxFine when set.
 */
function computeFine({ dueDate, issuedAt, paidInFullAt, frozenAt, asOf, finePerDay, maxFine = null, graceDays = 0, enabled = true }) {
  if (!enabled || !dueDate || !nonNegInt(finePerDay) || finePerDay === 0) return 0;
  const due = clock.startOfDayKarachi(dueDate);
  const issued = issuedAt ? clock.startOfDayKarachi(issuedAt) : due;
  const start = issued > due ? issued : due;
  const ends = [asOf, paidInFullAt, frozenAt].filter(Boolean).map((d) => clock.startOfDayKarachi(d).getTime());
  const end = new Date(Math.min(...ends));
  const fineDays = Math.max(0, clock.daysBetween(start, end) - (Number(graceDays) || 0));
  const fine = fineDays * finePerDay;
  return maxFine !== null && maxFine !== undefined && nonNegInt(maxFine) ? Math.min(fine, maxFine) : fine;
}

/** Money position of an invoice. `fineAccrued` must already be recomputed. */
function invoiceTotals(inv) {
  const discountTotal = inv.discountTotal || 0;
  const rentDue = Math.max(0, inv.amount - discountTotal - (inv.paidAmount || 0));
  const fineDue = Math.max(0, (inv.fineAccrued || 0) - (inv.fineWaived || 0) - (inv.finePaid || 0));
  return { amount: inv.amount, discountTotal, paidAmount: inv.paidAmount || 0, rentDue, fineAccrued: inv.fineAccrued || 0, fineWaived: inv.fineWaived || 0, finePaid: inv.finePaid || 0, fineDue, totalDue: rentDue + fineDue };
}

function invoiceStatusFor(totals) {
  if (totals.totalDue === 0) return "paid";
  if (totals.paidAmount === 0 && totals.finePaid === 0) return "unpaid";
  return "partial";
}

function fineStatusFor({ fineAccrued = 0, fineWaived = 0, finePaid = 0, rentDue, frozenAt }) {
  if (fineAccrued === 0) return "none";
  const fineDue = fineAccrued - fineWaived - finePaid;
  if (fineDue <= 0) return finePaid > 0 ? "paid" : "waived";
  if (rentDue === 0 || frozenAt) return "frozen";
  return "accruing";
}

/** Split a payment between rent and fine according to the hostel's allocation order. */
function allocatePayment({ amount, rentDue, fineDue, order = "rent_first" }) {
  if (!isInt(amount) || amount <= 0) return { error: "Amount must be a positive whole number of rupees." };
  if (amount > rentDue + fineDue) return { error: `Amount exceeds the outstanding balance (PKR ${rentDue + fineDue}).` };
  if (order === "fine_first") {
    const finePortion = Math.min(amount, fineDue);
    return { finePortion, rentPortion: amount - finePortion };
  }
  const rentPortion = Math.min(amount, rentDue);
  return { rentPortion, finePortion: amount - rentPortion };
}

// ---------------------------------------------------------------- waivers
/** Most that can still be waived: accrued − already waived − already paid. */
function waivableAmount({ fineAccrued = 0, fineWaived = 0, finePaid = 0 }) {
  return Math.max(0, fineAccrued - fineWaived - finePaid);
}

/**
 * Validate an approval amount against what is waivable right now.
 * @returns {{ok:true, amount:number} | {ok:false, code:number, message:string}}
 */
function checkWaiverAmount({ requested, fineAccrued, fineWaived, finePaid }) {
  const max = waivableAmount({ fineAccrued, fineWaived, finePaid });
  if (max === 0) return { ok: false, code: 409, message: "There is no unpaid fine left to waive on this invoice." };
  if (requested === "all") return { ok: true, amount: max };
  if (!isInt(requested) || requested <= 0) return { ok: false, code: 400, message: "Waiver amount must be a positive whole number of rupees, or \"all\"." };
  if (requested > max) return { ok: false, code: 400, message: `Only PKR ${max} of fine can be waived on this invoice.` };
  return { ok: true, amount: requested };
}

// ---------------------------------------------------------------- offers
const OFFER_TYPES = ["percent", "flat", "free_days"];
const OFFER_TRIGGERS = ["manual", "early_payment", "advance_months", "long_stay", "referral", "sibling", "scholarship", "coupon"];
const MANUAL_TRIGGERS = ["manual", "referral", "sibling", "scholarship"];

function monthIndex(y, m) {
  return y * 12 + (m - 1);
}

/** Validate an offer body (create/update). Returns errors. */
function validateOfferInput(o = {}) {
  const errors = [];
  if (!String(o.name || "").trim()) errors.push("Name is required.");
  if (!OFFER_TYPES.includes(o.type)) errors.push(`Type must be one of: ${OFFER_TYPES.join(", ")}.`);
  if (!isInt(o.value) || o.value <= 0) errors.push("Value must be a positive whole number.");
  if (o.type === "percent" && isInt(o.value) && o.value > 100) errors.push("A percentage cannot exceed 100.");
  if (o.type === "free_days" && isInt(o.value) && o.value > 31) errors.push("Free days cannot exceed 31.");
  if (!OFFER_TRIGGERS.includes(o.trigger || "manual")) errors.push(`Trigger must be one of: ${OFFER_TRIGGERS.join(", ")}.`);
  if (o.trigger === "coupon" && !String(o.code || "").trim()) errors.push("Coupon offers need a code.");
  if (o.trigger === "early_payment" && (!isInt(o.condition?.payBeforeDay) || o.condition.payBeforeDay < 1 || o.condition.payBeforeDay > 31)) errors.push("Early-payment offers need condition.payBeforeDay (1–31).");
  if (o.trigger === "advance_months" && (!isInt(o.condition?.minAdvanceMonths) || o.condition.minAdvanceMonths < 1)) errors.push("Advance offers need condition.minAdvanceMonths (≥ 1).");
  if (o.trigger === "long_stay" && (!isInt(o.condition?.minStayMonths) || o.condition.minStayMonths < 1)) errors.push("Long-stay offers need condition.minStayMonths (≥ 1).");
  ["maxRedemptions", "perStudentLimit"].forEach((k) => {
    if (o[k] !== undefined && o[k] !== null && (!isInt(o[k]) || o[k] < 1)) errors.push(`${k} must be a whole number ≥ 1 (or empty for unlimited).`);
  });
  if (o.validFrom && o.validTo && clock.parseDay(o.validTo) < clock.parseDay(o.validFrom)) errors.push("validTo cannot be before validFrom.");
  return errors;
}

/** Discount value for a base amount, capped at the base (never negative). */
function offerAmount(offer, base) {
  if (!nonNegInt(base) || base === 0) return 0;
  let off = 0;
  if (offer.type === "percent") off = Math.round((base * offer.value) / 100);
  else if (offer.type === "flat") off = offer.value;
  else if (offer.type === "free_days") off = Math.round((base * offer.value) / 30);
  return Math.max(0, Math.min(base, off));
}

/**
 * Is an offer usable on an invoice right now?
 * ctx: { today, hostelId, blockId, invoice:{kind, amount, discountTotal, period, dueDate}, studentUses, stayMonths, code, manual }
 * @returns {{eligible:boolean, reason?:string, amountOff?:number}}
 */
function evaluateOffer(offer, ctx) {
  const today = clock.startOfDayKarachi(ctx.today);
  const no = (reason) => ({ eligible: false, reason });
  if (offer.status !== "active") return no("Offer is not active.");
  if (String(offer.hostel) !== String(ctx.hostelId)) return no("Offer belongs to another hostel.");
  if (offer.scope === "block" && !(offer.blocks || []).some((b) => String(b) === String(ctx.blockId))) return no("Offer is not available in this block.");
  if (offer.validFrom && today < clock.startOfDayKarachi(offer.validFrom)) return no("Offer has not started yet.");
  if (offer.validTo && today > clock.startOfDayKarachi(offer.validTo)) return no("Offer has expired.");
  const kind = ctx.invoice.kind || "rent";
  if (offer.appliesTo === "rent" && kind !== "rent") return no("Offer applies to rent only.");
  if (Array.isArray(offer.appliesTo) && !offer.appliesTo.includes(kind)) return no(`Offer does not apply to ${kind} invoices.`);
  if (offer.maxRedemptions && (offer.redemptionCount || 0) >= offer.maxRedemptions) return no("Offer has been fully redeemed.");
  if (offer.perStudentLimit && (ctx.studentUses || 0) >= offer.perStudentLimit) return no("You have already used this offer.");

  const trigger = offer.trigger || "manual";
  const c = offer.condition || {};
  if (trigger === "early_payment") {
    if (!ctx.invoice.dueDate) return no("Invoice has no due date.");
    const due = clock.startOfDayKarachi(ctx.invoice.dueDate);
    const { y, m } = clock.karachiParts(due);
    if (today > due) return no("Early-payment offers never apply to a late invoice.");
    if (today > clock.karachiDate(y, m, c.payBeforeDay)) return no(`Pay by day ${c.payBeforeDay} to get this offer.`);
  } else if (trigger === "advance_months") {
    const p = /^(\d{4})-(\d{2})$/.exec(String(ctx.invoice.period || ""));
    if (!p) return no("Advance offers need a monthly period on the invoice.");
    const t = clock.karachiParts(today);
    if (monthIndex(Number(p[1]), Number(p[2])) - monthIndex(t.y, t.m) < c.minAdvanceMonths) return no(`Pay at least ${c.minAdvanceMonths} month(s) in advance.`);
  } else if (trigger === "long_stay") {
    if ((ctx.stayMonths || 0) < c.minStayMonths) return no(`Needs a stay of ${c.minStayMonths}+ months.`);
  } else if (trigger === "coupon") {
    if (String(ctx.code || "").trim().toUpperCase() !== String(offer.code || "").trim().toUpperCase()) return no("Coupon code does not match.");
  } else if (MANUAL_TRIGGERS.includes(trigger) && !ctx.manual) {
    return no("This offer is applied by the hostel office.");
  }

  const base = Math.max(0, ctx.invoice.amount - (ctx.invoice.discountTotal || 0));
  const amountOff = offerAmount(offer, base);
  if (amountOff === 0) return no("Nothing left to discount on this invoice.");
  return { eligible: true, amountOff };
}

/**
 * Pick the best set of offers for one invoice line.
 * Rules: at most one non-stackable offer, and never together with others; stackable
 * offers add up. An invoice that already carries a non-stackable discount takes nothing
 * more; one that carries stackables can only take more stackables. Total ≤ base.
 * @param {Array<{offer, amountOff}>} candidates eligible offers
 * @param {{base:number, existing:Array<{stackable:boolean}>}} line
 */
function bestCombination(candidates, { base, existing = [] }) {
  if (existing.some((d) => !d.stackable)) return { chosen: [], total: 0 };
  const stackables = candidates.filter((c) => c.offer.stackable);
  const singles = existing.length ? [] : candidates.filter((c) => !c.offer.stackable);
  const capTo = (list) => {
    let left = base;
    return list
      .slice()
      .sort((a, b) => b.amountOff - a.amountOff)
      .map((c) => {
        const amountOff = Math.min(c.amountOff, left);
        left -= amountOff;
        return { ...c, amountOff };
      })
      .filter((c) => c.amountOff > 0);
  };
  const stackSet = capTo(stackables);
  const stackTotal = stackSet.reduce((s, c) => s + c.amountOff, 0);
  const bestSingle = singles.map((c) => ({ ...c, amountOff: Math.min(c.amountOff, base) })).sort((a, b) => b.amountOff - a.amountOff)[0];
  if (bestSingle && bestSingle.amountOff > stackTotal) return { chosen: [bestSingle], total: bestSingle.amountOff };
  return { chosen: stackSet, total: stackTotal };
}

// ---------------------------------------------------------------- checkout settlement
/** deposit − dues − damages = refund (if positive) or payable (if negative). */
function settlement({ deposit = 0, dues = [], damages = [] }) {
  const sum = (list) => list.reduce((s, x) => s + x.amount, 0);
  for (const x of [...dues, ...damages]) {
    if (!nonNegInt(x.amount)) return { error: `"${x.label}" must be a whole, non-negative amount.` };
  }
  if (!nonNegInt(deposit)) return { error: "Deposit must be a whole, non-negative amount." };
  const duesTotal = sum(dues);
  const damagesTotal = sum(damages);
  const net = deposit - duesTotal - damagesTotal;
  return { deposit, dues, damages, duesTotal, damagesTotal, net, refund: Math.max(0, net), payable: Math.max(0, -net) };
}

// ---------------------------------------------------------------- stay source
/**
 * Money terms of a stay by source. Offline stays (admitted by the hostel office) carry
 * no platform commission, no escrow and no platform payout; the hostel keeps the rent.
 */
function stayFinancials({ source = "online", rent, commissionRatePct = 0 }) {
  if (source === "offline") return { commission: 0, ownerReceives: rent, escrowStatus: "not_created", paymentMethod: "cash" };
  const commission = Math.round((rent * commissionRatePct) / 100);
  return { commission, ownerReceives: rent - commission };
}

// ---------------------------------------------------------------- SaaS plan limits
const PLAN_SEAT_LIMITS = Object.freeze({ STARTER: 50, PRO: 300, PREMIUM: Infinity });

function checkSeatLimit({ tier = "STARTER", currentSeats, addingSeats }) {
  const limit = PLAN_SEAT_LIMITS[tier] ?? PLAN_SEAT_LIMITS.STARTER;
  if (currentSeats + addingSeats <= limit) return { ok: true, limit };
  const next = tier === "STARTER" ? "PRO (300 seats)" : "PREMIUM (unlimited seats)";
  return { ok: false, limit, message: `Your ${tier} plan allows ${limit} seats; you have ${currentSeats} and are adding ${addingSeats}. Upgrade to ${next} to add more. Nothing was changed.` };
}

// ---------------------------------------------------------------- visitors & reports
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

/** Is a Karachi wall-clock time (Date) inside the visiting window? */
function withinVisitingHours(date, start, end) {
  const s = new Date(new Date(date).getTime() + 5 * 3600000);
  const minutes = s.getUTCHours() * 60 + s.getUTCMinutes();
  return minutes >= toMinutes(start) && minutes <= toMinutes(end);
}

/** Ageing bucket for an overdue invoice. */
function ageBucket(daysOverdue) {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 7) return "0-7";
  if (daysOverdue <= 30) return "8-30";
  return "30+";
}

/** Whole calendar months between two dates (for long-stay offers). */
function monthsBetween(from, to) {
  const a = clock.karachiParts(from);
  const b = clock.karachiParts(to);
  return Math.max(0, monthIndex(b.y, b.m) - monthIndex(a.y, a.m) - (b.d < a.d ? 1 : 0));
}

module.exports = {
  PLATFORM_DEFAULTS,
  SHORT_NOTICE_ACTIONS,
  FEE_ALLOCATIONS,
  BLOCK_KEYS,
  resolvePolicy,
  validatePolicyInput,
  describePolicy,
  noticeCheck,
  shortNoticeCharge,
  shortNoticeOutcome,
  computeFine,
  invoiceTotals,
  invoiceStatusFor,
  fineStatusFor,
  allocatePayment,
  waivableAmount,
  checkWaiverAmount,
  OFFER_TYPES,
  OFFER_TRIGGERS,
  MANUAL_TRIGGERS,
  validateOfferInput,
  offerAmount,
  evaluateOffer,
  bestCombination,
  settlement,
  stayFinancials,
  PLAN_SEAT_LIMITS,
  checkSeatLimit,
  withinVisitingHours,
  ageBucket,
  monthsBetween
};
