// Leave notice helpers: reminders (for the daily job) and checkout with deposit settlement.
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const FeeInvoice = require("../models/FeeInvoice");
const LeaveNotice = require("../models/LeaveNotice");
const clock = require("./clock");
const { settlement } = require("./policyRules");
const { FeeError, present, refreshOpenInvoices, recordPayment } = require("./feeService");
const { emitLeaveEvent } = require("./hostelEvents");

/** Monthly rent used for short-notice charges: the stay's rent, else the room's bed price. */
async function monthlyRentFor(booking) {
  if (Number.isInteger(booking.totalRent) && booking.totalRent > 0) return booking.totalRent;
  const room = await Room.findById(booking.room).select("pricePerBed pricePerHead").lean();
  return Math.round(room?.pricePerBed || room?.pricePerHead || 0);
}

/**
 * 7-day and 1-day reminders before the leave date. Windows (2–7 days, 0–1 day) instead of
 * exact days so a missed run still sends; HostelEventLog keys stop duplicates.
 */
async function sendReminders() {
  const today = clock.startOfDayKarachi(clock.now());
  const notices = await LeaveNotice.find({ status: { $in: ["submitted", "approved"] }, intendedLeaveDate: { $gte: today, $lte: clock.addDays(today, 7) } }).lean();
  let sent = 0;
  for (const n of notices) {
    const days = clock.daysBetween(today, n.intendedLeaveDate);
    const kind = days <= 1 ? "reminder1" : "reminder7";
    const r = await emitLeaveEvent(n, kind);
    if (r?.sent) sent += 1;
  }
  return { processed: notices.length, remindersSent: sent };
}

/**
 * Check a resident out. Rules:
 *  - with an approved leave notice, only on/after the leave date (unless `early`);
 *  - blocked while any RENT is unpaid (fines/other charges may be settled from the deposit);
 *  - settlement = deposit − dues − damages; dues are cleared from the deposit with internal
 *    "deposit_adjustment" receipts so reports stay exact; any shortfall stays payable.
 * Atomic on the booking status so a double click can't check out (or refund) twice.
 */
async function checkout({ hostelId, bookingId, actor, actorRole, damages = [], early = false }) {
  const booking = await Booking.findOne({ _id: bookingId, hostel: hostelId, status: { $in: ["confirmed", "active", "overdue"] } }).lean();
  if (!booking) throw new FeeError(409, "No active stay with that id in this hostel.");
  const notice = await LeaveNotice.findOne({ booking: booking._id, status: { $in: ["submitted", "approved"] } }).lean();
  const today = clock.startOfDayKarachi(clock.now());
  if (notice?.status === "approved" && today < clock.startOfDayKarachi(notice.intendedLeaveDate) && !early) {
    throw new FeeError(409, `The approved leave date is ${clock.dayKey(notice.intendedLeaveDate)}. Check out on/after that date, or pass early=true.`);
  }

  await refreshOpenInvoices({ hostel: hostelId, student: booking.student });
  const invoices = (await FeeInvoice.find({ hostel: hostelId, student: booking.student, status: { $ne: "void" } }).lean()).map((i) => present(i));
  const unpaidRent = invoices.filter((i) => i.kind === "rent" && i.rentDue > 0);
  if (unpaidRent.length) {
    const err = new FeeError(409, `Unpaid rent must be cleared before checkout: ${unpaidRent.map((i) => `${i.title} (PKR ${i.rentDue})`).join(", ")}.`);
    err.dues = unpaidRent.map((i) => ({ invoice: i.id, label: i.title, rentDue: i.rentDue, fineDue: i.fineDue }));
    throw err;
  }
  const depositInvoices = invoices.filter((i) => i.kind === "security_deposit");
  const deposit = depositInvoices.length ? depositInvoices.reduce((s, i) => s + i.paidAmount, 0) : booking.securityDeposit || 0;
  const dues = invoices.filter((i) => i.kind !== "security_deposit" && i.totalDue > 0).map((i) => ({ label: i.fineDue && !i.rentDue ? `${i.title} — late fine` : i.title, amount: i.totalDue, invoice: i.id }));
  const cleanDamages = (Array.isArray(damages) ? damages : []).map((d) => ({ label: String(d.label || "Damage").slice(0, 120), amount: Number(d.amount) }));
  const result = settlement({ deposit, dues, damages: cleanDamages });
  if (result.error) throw new FeeError(400, result.error);

  const now = clock.now();
  const closed = await Booking.findOneAndUpdate({ _id: booking._id, status: { $in: ["confirmed", "active", "overdue"] } }, { status: "completed", checkOut: now, moveOutDate: now }, { returnDocument: "after" });
  if (!closed) throw new FeeError(409, "This stay was already checked out.");
  await Room.updateOne({ _id: booking.room }, { $inc: { availableBeds: 1 }, status: "ACTIVE" });

  // clear dues from the held deposit, oldest first, as far as the deposit goes
  let left = deposit;
  const adjustments = [];
  for (const d of dues) {
    const take = Math.min(left, d.amount);
    if (take <= 0) break;
    const { payment } = await recordPayment({ invoiceId: d.invoice, actor, actorRole, amount: take, method: "deposit_adjustment", note: "Settled from security deposit at checkout", internal: true });
    adjustments.push(payment.receiptNo);
    left -= take;
  }
  // an uncollected deposit invoice has nothing to refund — close it
  await FeeInvoice.updateMany({ _id: { $in: depositInvoices.filter((i) => i.paidAmount === 0).map((i) => i.id) }, paidAmount: 0 }, { status: "void", voidReason: "Not collected; stay checked out." });

  const depositSettlement = { ...result, settledAt: now, settledBy: actor._id || actor.id };
  let completedNotice = null;
  if (notice) {
    completedNotice = await LeaveNotice.findOneAndUpdate({ _id: notice._id }, { status: "completed", completedAt: now, depositSettlement }, { returnDocument: "after" });
    await emitLeaveEvent(completedNotice, "completed", result.refund ? `Deposit refund due: PKR ${result.refund}.` : result.payable ? `Amount still payable: PKR ${result.payable}.` : "");
  }
  return { checkedOut: true, settlement: depositSettlement, adjustments, notice: completedNotice ? String(completedNotice._id) : null, outstandingBalance: result.payable };
}

module.exports = { monthlyRentFor, sendReminders, checkout };
