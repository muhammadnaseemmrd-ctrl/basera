const test = require("node:test");
const assert = require("node:assert/strict");
const clock = require("../services/clock");
const R = require("../services/policyRules");

const K = (y, m, d) => clock.karachiDate(y, m, d);
// Nov 2026 rent invoice, due the 5th, issued the 1st, default PKR 100/day
const fine = (asOf, extra = {}) => R.computeFine({ dueDate: K(2026, 11, 5), issuedAt: K(2026, 11, 1), asOf, finePerDay: 100, ...extra });

// ---------------------------------------------------------------- clock
test("clock: Karachi day rolls over at 19:00 UTC, not UTC midnight", () => {
  assert.equal(clock.dayKey(new Date("2026-11-05T18:59:59Z")), "2026-11-05");
  assert.equal(clock.dayKey(new Date("2026-11-05T19:00:00Z")), "2026-11-06");
  assert.equal(clock.startOfDayKarachi(new Date("2026-11-05T23:30:00Z")).toISOString(), "2026-11-05T19:00:00.000Z");
});

test("clock: parseDay reads YYYY-MM-DD as a Karachi day and rejects impossible dates", () => {
  assert.equal(clock.parseDay("2026-11-05").toISOString(), "2026-11-04T19:00:00.000Z");
  assert.equal(clock.parseDay("2026-02-31"), null);
  assert.equal(clock.parseDay("nonsense"), null);
});

test("clock: due dates clamp to month end, including leap years", () => {
  assert.equal(clock.dayKey(clock.dueDateFor("2028-02", 31)), "2028-02-29");
  assert.equal(clock.dayKey(clock.dueDateFor("2027-02", 31)), "2027-02-28");
  assert.equal(clock.dayKey(clock.dueDateFor("2026-11", 5)), "2026-11-05");
});

test("clock: offset shifts now() outside production only", () => {
  const before = clock.now().getTime();
  clock.setOffset({ days: 10 });
  assert.ok(clock.now().getTime() - before >= 10 * clock.DAY - 1000);
  clock.setOffset({ days: 0 });
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.throws(() => clock.setOffset({ days: 1 }));
  process.env.NODE_ENV = env;
});

// ---------------------------------------------------------------- policy resolution
test("policy: platform defaults when nothing is set (30 days / 5th / PKR 100)", () => {
  const { values, source } = R.resolvePolicy(null, null);
  assert.equal(values.leaveNoticeDays, 30);
  assert.equal(values.dueDayOfMonth, 5);
  assert.equal(values.finePerDay, 100);
  assert.equal(values.feeAllocation, "rent_first");
  assert.equal(source.leaveNoticeDays, "platform");
});

test("policy: block override beats hostel, hostel beats platform, and the source is reported", () => {
  const policy = { leaveNotice: { days: 45 }, lateFee: { finePerDay: 150, maxFine: null }, blockOverrides: [{ block: "B", leaveNoticeDays: 15 }] };
  const a = R.resolvePolicy(policy, "A");
  const b = R.resolvePolicy(policy, "B");
  assert.deepEqual([a.values.leaveNoticeDays, a.source.leaveNoticeDays], [45, "hostel"]);
  assert.deepEqual([b.values.leaveNoticeDays, b.source.leaveNoticeDays], [15, "block"]);
  assert.deepEqual([b.values.finePerDay, b.source.finePerDay], [150, "hostel"]);
  assert.deepEqual([b.values.maxFine, b.source.maxFine], [null, "hostel"]);
  assert.equal(b.source.dueDayOfMonth, "platform");
});

test("policy: invalid values are rejected with clear messages", () => {
  const errors = R.validatePolicyInput({ leaveNotice: { days: -1 }, lateFee: { finePerDay: 0.5, dueDayOfMonth: 40 } });
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => /Notice days/.test(e)));
  assert.deepEqual(R.validatePolicyInput({ leaveNotice: { days: 45, shortNoticeAction: "block" }, lateFee: { finePerDay: 150, maxFine: null } }), []);
});

test("policy: plain-language preview", () => {
  const { values } = R.resolvePolicy({ leaveNotice: { days: 45 } }, null);
  assert.equal(R.describePolicy(values, "A student in Block A"), "A student in Block A must give 45 days' notice before leaving; rent is due on day 5 of the month; fines start on day 6 at PKR 100/day.");
});

// ---------------------------------------------------------------- fines (§9)
test("fine: paid / checked on the 5th → 0", () => {
  assert.equal(fine(K(2026, 11, 4)), 0);
  assert.equal(fine(K(2026, 11, 5)), 0);
  assert.equal(fine(K(2026, 11, 12), { paidInFullAt: K(2026, 11, 5) }), 0);
});

test("fine: unpaid on the 6th → 100, on the 10th → 500", () => {
  assert.equal(fine(K(2026, 11, 6)), 100);
  assert.equal(fine(K(2026, 11, 10)), 500);
});

test("fine: rent paid on the 8th → 300, frozen afterwards", () => {
  assert.equal(fine(K(2026, 11, 8), { paidInFullAt: K(2026, 11, 8) }), 300);
  assert.equal(fine(K(2026, 11, 20), { paidInFullAt: K(2026, 11, 8) }), 300);
});

test("fine: invoice issued after its due date (admitted on the 20th) is not back-dated", () => {
  const late = (asOf) => R.computeFine({ dueDate: K(2026, 11, 5), issuedAt: K(2026, 11, 20), asOf, finePerDay: 100 });
  assert.equal(late(K(2026, 11, 20)), 0);
  assert.equal(late(K(2026, 11, 21)), 100);
});

test("fine: crosses month end and leap day correctly", () => {
  assert.equal(R.computeFine({ dueDate: K(2026, 1, 30), asOf: K(2026, 2, 2), finePerDay: 100 }), 300);
  assert.equal(R.computeFine({ dueDate: K(2028, 2, 28), asOf: K(2028, 3, 1), finePerDay: 100 }), 200); // 29 Feb + 1 Mar
});

test("fine: maxFine caps and graceDays delay", () => {
  assert.equal(fine(K(2026, 11, 10), { maxFine: 300 }), 300);
  assert.equal(fine(K(2026, 11, 7), { graceDays: 2 }), 0);
  assert.equal(fine(K(2026, 11, 8), { graceDays: 2 }), 100);
});

test("fine: Karachi midnight boundary (19:00 UTC = 00:00 PKT)", () => {
  assert.equal(fine(new Date("2026-11-05T18:59:00Z")), 0);
  assert.equal(fine(new Date("2026-11-05T19:00:00Z")), 100);
});

test("fine: disabled policy, zero rate and waive-and-freeze", () => {
  assert.equal(fine(K(2026, 11, 10), { enabled: false }), 0);
  assert.equal(fine(K(2026, 11, 10), { finePerDay: 0 }), 0);
  assert.equal(fine(K(2026, 11, 15), { frozenAt: K(2026, 11, 7) }), 200);
});

test("fine: recomputed from dates, so running it twice or late gives the same answer", () => {
  const asOf = K(2026, 11, 9);
  assert.equal(fine(asOf), fine(asOf));
  assert.equal(fine(asOf), 400);
});

test("totals, status and allocation (rent first / fine first)", () => {
  const t = R.invoiceTotals({ amount: 8000, discountTotal: 160, paidAmount: 0, fineAccrued: 500, fineWaived: 0, finePaid: 0 });
  assert.equal(t.rentDue, 7840);
  assert.equal(t.totalDue, 8340);
  assert.deepEqual(R.allocatePayment({ amount: 8000, rentDue: 7840, fineDue: 500 }), { rentPortion: 7840, finePortion: 160 });
  assert.deepEqual(R.allocatePayment({ amount: 600, rentDue: 7840, fineDue: 500, order: "fine_first" }), { finePortion: 500, rentPortion: 100 });
  assert.match(R.allocatePayment({ amount: 9000, rentDue: 7840, fineDue: 500 }).error, /exceeds/);
  assert.match(R.allocatePayment({ amount: 10.5, rentDue: 7840, fineDue: 500 }).error, /whole/);
  assert.equal(R.invoiceStatusFor(R.invoiceTotals({ amount: 8000, paidAmount: 8000, fineAccrued: 300, finePaid: 0 })), "partial");
  assert.equal(R.fineStatusFor({ fineAccrued: 300, rentDue: 0 }), "frozen");
  assert.equal(R.fineStatusFor({ fineAccrued: 300, rentDue: 100 }), "accruing");
  assert.equal(R.fineStatusFor({ fineAccrued: 300, fineWaived: 300, rentDue: 0 }), "waived");
});

// ---------------------------------------------------------------- waivers (§9)
test("waiver: partial approval within what is accrued", () => {
  assert.deepEqual(R.checkWaiverAmount({ requested: 300, fineAccrued: 500, fineWaived: 0, finePaid: 0 }), { ok: true, amount: 300 });
  assert.deepEqual(R.checkWaiverAmount({ requested: "all", fineAccrued: 500, fineWaived: 300, finePaid: 0 }), { ok: true, amount: 200 });
});

test("waiver: approving more than is waivable is rejected, never clamped silently", () => {
  const r = R.checkWaiverAmount({ requested: 9999, fineAccrued: 500, fineWaived: 0, finePaid: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 400);
});

test("waiver: after the fine is fully paid there is nothing left to waive (409)", () => {
  assert.equal(R.checkWaiverAmount({ requested: "all", fineAccrued: 500, fineWaived: 0, finePaid: 500 }).code, 409);
});

test("waiver: accrual continues after a waiver unless frozen", () => {
  const accruedLater = fine(K(2026, 11, 12)); // 700
  const t = R.invoiceTotals({ amount: 8000, paidAmount: 0, fineAccrued: accruedLater, fineWaived: 300, finePaid: 0 });
  assert.equal(t.fineDue, 400);
});

// ---------------------------------------------------------------- leave notice (§9)
const req = K(2026, 11, 1);
test("leave: exactly policyDays is compliant; one short is flagged", () => {
  const ok = R.noticeCheck({ requestedAt: req, intendedLeaveDate: clock.addDays(req, 45), policyDays: 45 });
  assert.equal(ok.compliant, true);
  assert.equal(ok.noticeDaysGiven, 45);
  const short = R.noticeCheck({ requestedAt: req, intendedLeaveDate: clock.addDays(req, 44), policyDays: 45 });
  assert.equal(short.compliant, false);
  assert.equal(short.shortBy, 1);
  assert.equal(clock.dayKey(short.earliestCompliantDate), "2026-12-16");
});

test("leave: short-notice action — block / flag / charge", () => {
  assert.deepEqual(R.shortNoticeOutcome({ compliant: false, action: "block" }), { accept: false, flagged: true, charge: 0 });
  assert.deepEqual(R.shortNoticeOutcome({ compliant: false, action: "allow_flag_only" }), { accept: true, flagged: true, charge: 0 });
  assert.deepEqual(R.shortNoticeOutcome({ compliant: false, action: "allow_with_charge", chargeDays: 3, monthlyRent: 8000 }), { accept: true, flagged: true, charge: 800 });
  assert.equal(R.shortNoticeCharge({ chargeDays: 1, monthlyRent: 7000 }), 233); // 233.33 → whole PKR
  assert.deepEqual(R.shortNoticeOutcome({ compliant: true, action: "block" }), { accept: true, flagged: false, charge: 0 });
});

test("leave: past date and date before join date are rejected", () => {
  assert.equal(R.noticeCheck({ requestedAt: req, intendedLeaveDate: K(2026, 10, 31), policyDays: 30 }).code, 400);
  assert.match(R.noticeCheck({ requestedAt: req, intendedLeaveDate: K(2026, 11, 10), policyDays: 0, joinDate: K(2026, 11, 20) }).message, /join date/);
});

test("leave: block override beats hostel default; a later policy change does not alter the snapshot", () => {
  const policy = { leaveNotice: { days: 45 }, blockOverrides: [{ block: "B", leaveNoticeDays: 15 }] };
  const snapshot = R.resolvePolicy(policy, "B").values.leaveNoticeDays;
  assert.equal(R.noticeCheck({ requestedAt: req, intendedLeaveDate: clock.addDays(req, 16), policyDays: snapshot }).compliant, true);
  policy.blockOverrides[0].leaveNoticeDays = 60; // head office changes policy afterwards
  assert.equal(snapshot, 15);
  assert.equal(R.noticeCheck({ requestedAt: req, intendedLeaveDate: clock.addDays(req, 16), policyDays: snapshot }).compliant, true);
});

test("settlement: deposit − dues − damages, refund or payable", () => {
  const s = R.settlement({ deposit: 10000, dues: [{ label: "Fine", amount: 200 }], damages: [{ label: "Broken chair", amount: 1500 }] });
  assert.deepEqual([s.net, s.refund, s.payable], [8300, 8300, 0]);
  const owe = R.settlement({ deposit: 1000, damages: [{ label: "Door", amount: 3000 }] });
  assert.deepEqual([owe.refund, owe.payable], [0, 2000]);
  assert.match(R.settlement({ deposit: 1000, damages: [{ label: "x", amount: 1.5 }] }).error, /whole/);
});

// ---------------------------------------------------------------- offers (§9)
const offer = (o) => ({ status: "active", hostel: "H", scope: "hostel", appliesTo: "rent", trigger: "manual", stackable: false, ...o });
const ctx = (o = {}) => ({ today: K(2026, 11, 2), hostelId: "H", blockId: "A", manual: true, invoice: { kind: "rent", amount: 8000, discountTotal: 0, period: "2026-11", dueDate: K(2026, 11, 5) }, ...o });

test("offers: early payment 2% by the 3rd — applies on the 2nd, not the 4th, never on a late invoice", () => {
  const early = offer({ type: "percent", value: 2, trigger: "early_payment", condition: { payBeforeDay: 3 } });
  assert.deepEqual(R.evaluateOffer(early, ctx()), { eligible: true, amountOff: 160 });
  assert.equal(R.evaluateOffer(early, ctx({ today: K(2026, 11, 4) })).eligible, false);
  assert.match(R.evaluateOffer(early, ctx({ today: K(2026, 11, 6) })).reason, /late/);
});

test("offers: validity end date is inclusive; paused and other-hostel/other-block offers are not eligible", () => {
  const o = offer({ type: "flat", value: 500, validFrom: K(2026, 11, 1), validTo: K(2026, 11, 2) });
  assert.equal(R.evaluateOffer(o, ctx()).eligible, true);
  assert.equal(R.evaluateOffer(o, ctx({ today: K(2026, 11, 3) })).eligible, false);
  assert.equal(R.evaluateOffer({ ...o, status: "paused" }, ctx()).eligible, false);
  assert.equal(R.evaluateOffer(o, ctx({ hostelId: "OTHER" })).eligible, false);
  assert.equal(R.evaluateOffer(offer({ type: "flat", value: 500, scope: "block", blocks: ["A"] }), ctx({ blockId: "B" })).eligible, false);
});

test("offers: max redemptions and per-student limit", () => {
  const o = offer({ type: "flat", value: 500, maxRedemptions: 2, redemptionCount: 2 });
  assert.match(R.evaluateOffer(o, ctx()).reason, /fully redeemed/);
  assert.match(R.evaluateOffer({ ...o, redemptionCount: 0, perStudentLimit: 1 }, ctx({ studentUses: 1 })).reason, /already used/);
});

test("offers: discount larger than the line is capped; never negative; fines never discounted", () => {
  assert.equal(R.evaluateOffer(offer({ type: "flat", value: 99999 }), ctx()).amountOff, 8000);
  assert.equal(R.offerAmount({ type: "flat", value: 500 }, 0), 0);
  // the base is the rent line only — an 8,000 invoice with a 500 fine still discounts at most 8,000
  assert.equal(R.evaluateOffer(offer({ type: "percent", value: 100 }), ctx()).amountOff, 8000);
  assert.equal(R.evaluateOffer(offer({ type: "flat", value: 500 }), ctx({ invoice: { kind: "rent", amount: 8000, discountTotal: 8000 } })).eligible, false);
});

test("offers: coupon code, manual-only triggers and kind restrictions", () => {
  const c = offer({ type: "flat", value: 300, trigger: "coupon", code: "WELCOME" });
  assert.equal(R.evaluateOffer(c, ctx({ code: "welcome", manual: false })).eligible, true);
  assert.equal(R.evaluateOffer(c, ctx({ code: "nope", manual: false })).eligible, false);
  assert.equal(R.evaluateOffer(offer({ type: "flat", value: 300, trigger: "scholarship" }), ctx({ manual: false })).eligible, false);
  assert.equal(R.evaluateOffer(offer({ type: "flat", value: 300 }), ctx({ invoice: { kind: "mess", amount: 3000 } })).eligible, false);
});

test("offers: stackable vs non-stackable — best valid combination only", () => {
  const A = { offer: { stackable: false }, amountOff: 500 };
  const B = { offer: { stackable: true }, amountOff: 300 };
  const C = { offer: { stackable: true }, amountOff: 400 };
  assert.equal(R.bestCombination([A, B, C], { base: 8000 }).total, 700); // 300 + 400 beats 500
  assert.deepEqual(R.bestCombination([{ offer: { stackable: false }, amountOff: 900 }, B, C], { base: 8000 }).chosen.length, 1);
  assert.equal(R.bestCombination([B, C], { base: 500 }).total, 500); // capped at the line
  assert.equal(R.bestCombination([A, B], { base: 8000, existing: [{ stackable: false }] }).total, 0);
  assert.equal(R.bestCombination([A, B], { base: 8000, existing: [{ stackable: true }] }).total, 300);
});

test("offers: input validation", () => {
  assert.deepEqual(R.validateOfferInput({ name: "Early", type: "percent", value: 2, trigger: "early_payment", condition: { payBeforeDay: 3 } }), []);
  assert.ok(R.validateOfferInput({ name: "", type: "percent", value: 150 }).length >= 2);
  assert.ok(R.validateOfferInput({ name: "x", type: "flat", value: 2.5 }).some((e) => /whole/.test(e)));
});

// ---------------------------------------------------------------- offline source, plans, misc
test("offline stays: commission 0, no escrow; online keep commission", () => {
  assert.deepEqual(R.stayFinancials({ source: "offline", rent: 8000, commissionRatePct: 7 }), { commission: 0, ownerReceives: 8000, escrowStatus: "not_created", paymentMethod: "cash" });
  assert.deepEqual(R.stayFinancials({ source: "online", rent: 8000, commissionRatePct: 7 }), { commission: 560, ownerReceives: 7440 });
});

test("plan seat limits give an upgrade message and never partially apply", () => {
  assert.equal(R.checkSeatLimit({ tier: "STARTER", currentSeats: 40, addingSeats: 10 }).ok, true);
  const no = R.checkSeatLimit({ tier: "STARTER", currentSeats: 45, addingSeats: 10 });
  assert.equal(no.ok, false);
  assert.match(no.message, /Upgrade to PRO/);
  assert.equal(R.checkSeatLimit({ tier: "PREMIUM", currentSeats: 5000, addingSeats: 500 }).ok, true);
});

test("visiting hours, ageing buckets and stay months", () => {
  assert.equal(R.withinVisitingHours(new Date("2026-11-05T05:00:00Z"), "09:00", "20:00"), true); // 10:00 PKT
  assert.equal(R.withinVisitingHours(new Date("2026-11-05T16:00:00Z"), "09:00", "20:00"), false); // 21:00 PKT
  assert.deepEqual([0, 3, 15, 45].map(R.ageBucket), ["current", "0-7", "8-30", "30+"]);
  assert.equal(R.monthsBetween(K(2026, 1, 15), K(2026, 7, 14)), 5);
  assert.equal(R.monthsBetween(K(2026, 1, 15), K(2026, 7, 15)), 6);
});
