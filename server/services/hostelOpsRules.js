// Pure (database-free) business rules for hostel/block operations so they can be
// unit-tested with `node --test` without MongoDB. Routes call these and then
// persist; they never reach into mongoose themselves.

// ---------- Seats ----------
const OCCUPIED_BOOKING = ["active", "confirmed", "overdue"];
const RESERVED_BOOKING = ["pending", "payment_pending"];
const MAINTENANCE_REASONS = ["maintenance", "deep_cleaning"];
const RESERVED_REASONS = ["reserved", "owner_hold"];

/**
 * Derive the state of every bed in a room.
 * @param {{totalBeds:number, bookings:Array<{bedIndex?:number,status:string,student?:any,id?:any}>, bedBlocks:Array<{bedIndex:number,reason:string,note?:string,id?:any}>}} input
 * @returns {Array<{bedIndex:number,status:"free"|"reserved"|"occupied"|"booked_offline"|"maintenance",studentId?:any,bookingId?:any,note?:string,conflict?:boolean}>}
 */
function deriveSeatStates({ totalBeds, bookings = [], bedBlocks = [] }) {
  const total = Math.max(0, Number(totalBeds) || 0);
  const seats = Array.from({ length: total }, (_, bedIndex) => ({ bedIndex, status: "free" }));
  const rank = { free: 0, maintenance: 1, booked_offline: 2, reserved: 3, occupied: 4 };
  const set = (seat, next) => {
    if (rank[next.status] > rank[seat.status]) Object.assign(seat, next);
  };

  // Bed blocks first (lowest priority), then bookings override them.
  for (const block of bedBlocks) {
    const seat = seats[block.bedIndex];
    if (!seat) continue;
    if (block.reason === "booked_offline") set(seat, { status: "booked_offline", note: block.note, blockId: block.id });
    else if (RESERVED_REASONS.includes(block.reason)) set(seat, { status: "reserved", note: block.note || block.reason, blockId: block.id });
    else if (MAINTENANCE_REASONS.includes(block.reason)) set(seat, { status: "maintenance", note: block.note || block.reason, blockId: block.id });
  }

  const live = bookings.filter((b) => OCCUPIED_BOOKING.includes(b.status) || RESERVED_BOOKING.includes(b.status));
  const used = new Set();
  const withIndex = live.filter((b) => Number.isInteger(b.bedIndex) && b.bedIndex >= 0 && b.bedIndex < total);
  const withoutIndex = live.filter((b) => !withIndex.includes(b));

  const place = (booking, bedIndex) => {
    const seat = seats[bedIndex];
    const status = OCCUPIED_BOOKING.includes(booking.status) ? "occupied" : "reserved";
    if (used.has(bedIndex)) {
      // Two live bookings on one bed = data inconsistency: surface it, keep the stronger status.
      seat.conflict = true;
      if (rank[status] > rank[seat.status]) Object.assign(seat, { status, studentId: booking.student, bookingId: booking.id });
      return;
    }
    used.add(bedIndex);
    Object.assign(seat, { status, studentId: booking.student, bookingId: booking.id });
    delete seat.note;
  };

  withIndex.forEach((b) => place(b, b.bedIndex));
  // Legacy bookings without a bedIndex take the lowest free, unused bed so totals stay honest.
  withoutIndex.forEach((b) => {
    const free = seats.find((s) => !used.has(s.bedIndex));
    if (free) place(b, free.bedIndex);
  });
  return seats;
}

function summarizeSeats(seats) {
  // "leaving" = occupied with an approved leave notice; still counts as occupied until the date
  const out = { total: seats.length, free: 0, reserved: 0, occupied: 0, leaving: 0, booked_offline: 0, maintenance: 0 };
  seats.forEach((s) => {
    out[s.status] = (out[s.status] || 0) + 1;
  });
  out.occupancyPct = out.total ? Math.round(((out.occupied + out.leaving + out.booked_offline) / out.total) * 100) : 0;
  return out;
}

/** Mark occupied seats whose booking has an approved leave notice as "leaving on <date>". */
function applyLeaving(seats, leavingByBooking) {
  return seats.map((seat) => {
    const date = seat.bookingId ? leavingByBooking[String(seat.bookingId)] : null;
    if (!date || seat.status !== "occupied") return seat;
    return { ...seat, status: "leaving", leavingOn: date, availableFrom: date };
  });
}

// ---------- Fees ----------
const FEE_METHODS = ["cash", "bank_transfer", "jazzcash", "easypaisa", "cheque"];
const PROOF_REQUIRED = ["bank_transfer", "jazzcash", "easypaisa", "cheque"];

/** Returns null if OK, otherwise an error message. */
function validateFeePayment({ amount, method, transactionId, screenshotUrl, receivedBy, balance }) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return "Amount must be greater than zero.";
  if (!Number.isInteger(amt)) return "Amount must be a whole number of rupees.";
  if (!FEE_METHODS.includes(method)) return `Method must be one of: ${FEE_METHODS.join(", ")}.`;
  if (balance !== undefined && amt > Number(balance)) return `Amount exceeds outstanding balance (PKR ${balance}).`;
  if (PROOF_REQUIRED.includes(method)) {
    const hasTxn = typeof transactionId === "string" && transactionId.trim().length >= 4;
    // Only real hosted URLs count: the upload endpoint returns "demo-upload://..." when
    // cloud storage isn't configured, which is not proof of anything.
    const hasShot = typeof screenshotUrl === "string" && /^https?:\/\//i.test(screenshotUrl.trim());
    if (!hasTxn && !hasShot) return "Bank/wallet payments need a transaction ID (min 4 chars) or an uploaded screenshot.";
  }
  if (method === "cash" && !receivedBy) return "Cash payments must record who received the cash.";
  return null;
}

/** Pakistan-aware phone → wa.me digits (e.g. 0300-1234567 → 923001234567). */
function toWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
}

/** Last 10 digits, used to match parent phone numbers regardless of formatting. */
function phoneKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-10);
}

function formatReceiptNo(year, seq) {
  return `BSR-${year}-${String(seq).padStart(6, "0")}`;
}

function invoiceStatus(amount, paidAmount) {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= amount) return "paid";
  return "partial";
}

function buildReceiptWhatsApp({ studentPhone, studentName, hostelName, receiptNo, amount, balance, verifyUrl }) {
  const text = [
    `Assalam o Alaikum ${studentName || ""},`.trim(),
    `Payment received at ${hostelName}.`,
    `Receipt: ${receiptNo}`,
    `Amount: PKR ${Number(amount).toLocaleString("en-PK")}`,
    `Remaining balance: PKR ${Number(balance).toLocaleString("en-PK")}`,
    `Verify: ${verifyUrl}`
  ].join("\n");
  const number = toWhatsAppNumber(studentPhone);
  return { number, text, link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` };
}

// ---------- Complaints ----------
const COMPLAINT_STATUSES = ["raised", "under_review", "in_progress", "fixed", "resolved", "reopened", "escalated"];
const STAFF_ROLES = ["warden", "head_office"];

// from → [{to, roles}] ; roles: who may perform the transition.
// Wardens only review / start / fix; escalation is a head-office decision.
const COMPLAINT_FLOW = {
  raised: [
    { to: "under_review", roles: ["warden", "head_office"] },
    { to: "escalated", roles: ["head_office"] }
  ],
  under_review: [
    { to: "in_progress", roles: ["warden", "head_office"] },
    { to: "fixed", roles: ["warden", "head_office"] },
    { to: "escalated", roles: ["head_office"] }
  ],
  in_progress: [
    { to: "fixed", roles: ["warden", "head_office"] },
    { to: "escalated", roles: ["head_office"] }
  ],
  fixed: [
    { to: "resolved", roles: ["student"] },
    { to: "reopened", roles: ["student"] }
  ],
  reopened: [
    { to: "under_review", roles: ["warden", "head_office"] },
    { to: "in_progress", roles: ["warden", "head_office"] },
    { to: "escalated", roles: ["head_office"] }
  ],
  escalated: [
    { to: "in_progress", roles: ["head_office"] },
    { to: "fixed", roles: ["head_office"] }
  ],
  resolved: []
};

/** @returns {{ok:true}|{ok:false,code:number,message:string}} */
function checkComplaintTransition({ from, to, actorRole, note }) {
  if (!COMPLAINT_STATUSES.includes(to)) return { ok: false, code: 400, message: "Unknown status." };
  const options = COMPLAINT_FLOW[from] || [];
  const rule = options.find((o) => o.to === to);
  if (!rule) return { ok: false, code: 409, message: `Cannot move a complaint from "${from}" to "${to}".` };
  if (!rule.roles.includes(actorRole)) return { ok: false, code: 403, message: `A ${actorRole} cannot mark a complaint "${to}".` };
  if (["fixed", "reopened", "escalated"].includes(to) && !String(note || "").trim()) {
    return { ok: false, code: 400, message: `A note is required when marking a complaint "${to}".` };
  }
  return { ok: true };
}

// ---------- Staff termination notice ----------
function buildTerminationNotice({ staffName, staffRole, hostelName, blockName, terminatedAt, reason, contactPhone }) {
  const where = blockName ? `${hostelName} (${blockName})` : hostelName;
  const date = new Date(terminatedAt).toLocaleDateString("en-GB");
  const title = `Notice: ${staffName} is no longer employed at ${where}`;
  const message = [
    `${staffName} (${String(staffRole).replace(/_/g, " ")}) has been terminated from ${where} with effect from ${date}.`,
    `Do NOT pay any money, fees, deposits or hand over documents or keys to this person.`,
    `Pay only through the official hostel office and always collect the system-generated receipt (it carries a receipt number and QR code).`,
    reason ? `Reason on record: ${reason}.` : "",
    contactPhone ? `Questions? Contact the head office: ${contactPhone}.` : "Questions? Contact the head office."
  ]
    .filter(Boolean)
    .join(" ");
  return { title, message };
}

module.exports = {
  deriveSeatStates,
  summarizeSeats,
  applyLeaving,
  FEE_METHODS,
  PROOF_REQUIRED,
  validateFeePayment,
  toWhatsAppNumber,
  phoneKey,
  formatReceiptNo,
  invoiceStatus,
  buildReceiptWhatsApp,
  COMPLAINT_STATUSES,
  COMPLAINT_FLOW,
  STAFF_ROLES,
  checkComplaintTransition,
  buildTerminationNotice
};
