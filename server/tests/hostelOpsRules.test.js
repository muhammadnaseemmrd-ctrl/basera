const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveSeatStates,
  summarizeSeats,
  validateFeePayment,
  toWhatsAppNumber,
  formatReceiptNo,
  invoiceStatus,
  buildReceiptWhatsApp,
  checkComplaintTransition,
  buildTerminationNotice
} = require("../services/hostelOpsRules");

// ---------- UC1 / UC2 / UC3: seats ----------
test("UC1 empty room: every bed is free", () => {
  const seats = deriveSeatStates({ totalBeds: 3 });
  assert.deepEqual(seats.map((s) => s.status), ["free", "free", "free"]);
});

test("UC2 active booking = occupied, pending booking = reserved", () => {
  const seats = deriveSeatStates({
    totalBeds: 3,
    bookings: [
      { id: "b1", bedIndex: 0, status: "active", student: "s1" },
      { id: "b2", bedIndex: 2, status: "payment_pending", student: "s2" }
    ]
  });
  assert.equal(seats[0].status, "occupied");
  assert.equal(seats[1].status, "free");
  assert.equal(seats[2].status, "reserved");
});

test("cancelled / declined / completed bookings do not hold a seat", () => {
  const seats = deriveSeatStates({
    totalBeds: 2,
    bookings: [
      { bedIndex: 0, status: "cancelled" },
      { bedIndex: 1, status: "declined" },
      { bedIndex: 0, status: "completed" }
    ]
  });
  assert.deepEqual(seats.map((s) => s.status), ["free", "free"]);
});

test("UC3 bed blocks map to offline / maintenance / reserved", () => {
  const seats = deriveSeatStates({
    totalBeds: 4,
    bedBlocks: [
      { bedIndex: 0, reason: "booked_offline", note: "cash" },
      { bedIndex: 1, reason: "maintenance" },
      { bedIndex: 2, reason: "owner_hold" }
    ]
  });
  assert.deepEqual(seats.map((s) => s.status), ["booked_offline", "maintenance", "reserved", "free"]);
});

test("a booking overrides a hold on the same bed", () => {
  const seats = deriveSeatStates({
    totalBeds: 1,
    bedBlocks: [{ bedIndex: 0, reason: "maintenance" }],
    bookings: [{ bedIndex: 0, status: "active", student: "s1" }]
  });
  assert.equal(seats[0].status, "occupied");
});

test("legacy bookings without bedIndex take the lowest free bed", () => {
  const seats = deriveSeatStates({
    totalBeds: 3,
    bookings: [
      { id: "a", bedIndex: 0, status: "active" },
      { id: "b", status: "active" },
      { id: "c", status: "confirmed" }
    ]
  });
  assert.deepEqual(seats.map((s) => s.status), ["occupied", "occupied", "occupied"]);
});

test("two live bookings on one bed are flagged as a conflict", () => {
  const seats = deriveSeatStates({
    totalBeds: 1,
    bookings: [
      { id: "a", bedIndex: 0, status: "active" },
      { id: "b", bedIndex: 0, status: "active" }
    ]
  });
  assert.equal(seats[0].conflict, true);
});

test("summary adds up and counts offline bookings as occupancy", () => {
  const seats = deriveSeatStates({
    totalBeds: 4,
    bookings: [{ bedIndex: 0, status: "active" }],
    bedBlocks: [{ bedIndex: 1, reason: "booked_offline" }, { bedIndex: 2, reason: "maintenance" }]
  });
  const s = summarizeSeats(seats);
  assert.equal(s.total, 4);
  assert.equal(s.free + s.reserved + s.occupied + s.booked_offline + s.maintenance, 4);
  assert.equal(s.occupancyPct, 50);
});

// ---------- UC4 / UC5 / UC6: fee validation ----------
test("UC4 cash payment needs a receiver but no proof", () => {
  assert.equal(validateFeePayment({ amount: 5000, method: "cash", receivedBy: "w1", balance: 8000 }), null);
  assert.match(validateFeePayment({ amount: 5000, method: "cash", balance: 8000 }), /who received/);
});

test("UC5 bank / wallet payment without txn id or screenshot is rejected", () => {
  for (const method of ["bank_transfer", "jazzcash", "easypaisa", "cheque"]) {
    assert.match(validateFeePayment({ amount: 100, method, receivedBy: "w1", balance: 500 }), /transaction ID/);
  }
});

test("bank payment accepts a txn id OR a real hosted screenshot", () => {
  assert.equal(validateFeePayment({ amount: 100, method: "bank_transfer", transactionId: "TXN12345", receivedBy: "w", balance: 500 }), null);
  assert.equal(validateFeePayment({ amount: 100, method: "bank_transfer", screenshotUrl: "https://res.cloudinary.com/x/y.jpg", receivedBy: "w", balance: 500 }), null);
});

test("demo-upload placeholder and too-short txn ids are not proof", () => {
  assert.ok(validateFeePayment({ amount: 100, method: "bank_transfer", screenshotUrl: "demo-upload://x.png", receivedBy: "w", balance: 500 }));
  assert.ok(validateFeePayment({ amount: 100, method: "bank_transfer", transactionId: "12", receivedBy: "w", balance: 500 }));
});

test("amount must be positive, whole, and not above the balance", () => {
  assert.ok(validateFeePayment({ amount: 0, method: "cash", receivedBy: "w" }));
  assert.ok(validateFeePayment({ amount: -5, method: "cash", receivedBy: "w" }));
  assert.ok(validateFeePayment({ amount: 10.5, method: "cash", receivedBy: "w" }));
  assert.match(validateFeePayment({ amount: 9000, method: "cash", receivedBy: "w", balance: 8000 }), /exceeds/);
  assert.ok(validateFeePayment({ amount: 100, method: "bitcoin", receivedBy: "w" }));
});

// ---------- UC7: receipt + WhatsApp ----------
test("receipt numbers are sequential and padded", () => {
  assert.equal(formatReceiptNo(2026, 7), "BSR-2026-000007");
  assert.equal(formatReceiptNo(2026, 123456), "BSR-2026-123456");
});

test("Pakistani numbers normalise for wa.me", () => {
  assert.equal(toWhatsAppNumber("0300-1234567"), "923001234567");
  assert.equal(toWhatsAppNumber("+92 300 1234567"), "923001234567");
  assert.equal(toWhatsAppNumber("3001234567"), "923001234567");
  assert.equal(toWhatsAppNumber(""), "");
});

test("UC7 WhatsApp share link carries receipt, amount, balance and verify URL", () => {
  const w = buildReceiptWhatsApp({ studentPhone: "03001234567", studentName: "Ali", hostelName: "QA Hostel", receiptNo: "BSR-2026-000001", amount: 5000, balance: 3000, verifyUrl: "https://api.x/verify/BSR-2026-000001" });
  assert.ok(w.link.startsWith("https://wa.me/923001234567?text="));
  const text = decodeURIComponent(w.link.split("text=")[1]);
  assert.match(text, /BSR-2026-000001/);
  assert.match(text, /5,000/);
  assert.match(text, /3,000/);
  assert.match(text, /verify/);
});

test("invoice status follows paid amount", () => {
  assert.equal(invoiceStatus(1000, 0), "unpaid");
  assert.equal(invoiceStatus(1000, 400), "partial");
  assert.equal(invoiceStatus(1000, 1000), "paid");
});

// ---------- UC11 / UC12 / UC13: complaint flow ----------
const go = (from, to, actorRole, note = "ok") => checkComplaintTransition({ from, to, actorRole, note });

test("UC11 the happy path works in order", () => {
  assert.ok(go("raised", "under_review", "warden").ok);
  assert.ok(go("under_review", "in_progress", "warden").ok);
  assert.ok(go("in_progress", "fixed", "warden").ok);
  assert.ok(go("fixed", "resolved", "student").ok);
});

test("UC12 only the student can resolve; warden cannot", () => {
  assert.equal(go("fixed", "resolved", "warden").code, 403);
  assert.equal(go("fixed", "resolved", "head_office").code, 403);
});

test("UC12 student cannot mark fixed / review / escalate", () => {
  assert.equal(go("in_progress", "fixed", "student").code, 403);
  assert.equal(go("raised", "under_review", "student").code, 403);
  assert.equal(go("raised", "escalated", "student").code, 403);
});

test("UC13 student can reopen a fixed complaint (note required)", () => {
  assert.ok(go("fixed", "reopened", "student", "still leaking").ok);
  assert.equal(go("fixed", "reopened", "student", "").code, 400);
  assert.ok(go("reopened", "in_progress", "warden").ok);
});

test("cannot skip steps or touch a resolved complaint", () => {
  assert.equal(go("raised", "fixed", "warden").code, 409);
  assert.equal(go("raised", "resolved", "student").code, 409);
  assert.equal(go("resolved", "reopened", "student").code, 409);
  assert.equal(go("resolved", "in_progress", "head_office").code, 409);
});

test("fixing and escalating require a note", () => {
  assert.equal(go("in_progress", "fixed", "warden", " ").code, 400);
  assert.equal(go("under_review", "escalated", "head_office", "").code, 400);
});

test("only head office can escalate; a warden cannot", () => {
  for (const from of ["raised", "under_review", "in_progress", "reopened"]) {
    assert.equal(go(from, "escalated", "warden").code, 403, from);
    assert.ok(go(from, "escalated", "head_office").ok, from);
  }
});

test("escalated complaints are driven by head office, not the warden", () => {
  assert.equal(go("escalated", "in_progress", "warden").code, 403);
  assert.ok(go("escalated", "in_progress", "head_office").ok);
});

test("unknown status is a 400", () => {
  assert.equal(go("raised", "banana", "warden").code, 400);
});

// ---------- UC9: termination notice ----------
test("UC9 termination notice warns not to pay, names the person and the place", () => {
  const n = buildTerminationNotice({ staffName: "Rashid Khan", staffRole: "assistant_warden", hostelName: "Royal Hostel", blockName: "Block A", terminatedAt: "2026-11-01", reason: "Collecting fees off-system", contactPhone: "0300-1111111" });
  assert.match(n.title, /Rashid Khan/);
  assert.match(n.title, /Block A/);
  assert.match(n.message, /Do NOT pay/);
  assert.match(n.message, /receipt/);
  assert.match(n.message, /0300-1111111/);
  assert.match(n.message, /assistant warden/);
});

test("hostel-wide notice omits the block and optional reason/phone", () => {
  const n = buildTerminationNotice({ staffName: "A", staffRole: "cook", hostelName: "H", terminatedAt: new Date() });
  assert.doesNotMatch(n.title, /\(/);
  assert.doesNotMatch(n.message, /Reason on record/);
});

test("leaving: an approved leave marks the occupied seat leaving, still counted in occupancy", () => {
  const { applyLeaving } = require("../services/hostelOpsRules");
  const seats = deriveSeatStates({ totalBeds: 2, bookings: [{ id: "b1", bedIndex: 0, status: "active" }], bedBlocks: [] });
  const marked = applyLeaving(seats, { b1: "2026-12-16" });
  assert.equal(marked[0].status, "leaving");
  assert.equal(marked[0].availableFrom, "2026-12-16");
  assert.equal(marked[1].status, "free");
  const sum = summarizeSeats(marked);
  assert.equal(sum.leaving, 1);
  assert.equal(sum.occupancyPct, 50);
});
