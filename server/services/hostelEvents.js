// Notification centre for hostel operations. One fan-out:
//   in-app  → User.notifications (always)
//   email   → emailService, only when an SMTP/Gmail/SendGrid transport is configured
//   WhatsApp→ never sent automatically; staff-initiated broadcasts get wa.me links instead
// Scheduled events pass a dedupeKey so a job that runs twice never notifies twice.
const User = require("../models/User");
const Block = require("../models/Block");
const Hostel = require("../models/Hostel");
const HostelGroup = require("../models/HostelGroup");
const ParentLink = require("../models/ParentLink");
const HostelEventLog = require("../models/HostelEventLog");
const clock = require("./clock");
const { sendEmail } = require("./emailService");

const money = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const emailConfigured = () => Boolean(process.env.SMTP_HOST || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.SENDGRID_API_KEY);
const uniq = (ids) => [...new Set(ids.filter(Boolean).map(String))];

/**
 * @param {{type:string, users:Array, title:string, message:string, hostel?:any, dedupeKey?:string}} event
 * @returns {Promise<{sent:number, skipped?:boolean}>}
 */
async function emitHostelEvent({ type, users, title, message, hostel, dedupeKey }) {
  const ids = uniq(users || []);
  if (!ids.length) return { sent: 0 };
  if (dedupeKey) {
    try {
      await HostelEventLog.create({ key: dedupeKey, type, hostel, recipients: ids.length });
    } catch (error) {
      if (error.code === 11000) return { sent: 0, skipped: true };
      throw error;
    }
  }
  await User.updateMany({ _id: { $in: ids } }, { $push: { notifications: { type, title, message: `${title}: ${message}`, read: false, createdAt: clock.now() } } });
  if (emailConfigured()) {
    // real addresses only — managed residents have a placeholder email until they claim a login
    const recipients = await User.find({ _id: { $in: ids }, email: { $not: /@resident\.basera\.invalid$/ } }).select("email").lean();
    await Promise.allSettled(recipients.map((u) => sendEmail({ to: u.email, template: "HOSTEL_EVENT", data: { title, message } })));
  }
  return { sent: ids.length };
}

/** The student plus every active linked parent account. */
async function studentAndParents(studentId) {
  const links = await ParentLink.find({ student: studentId, status: "active", parent: { $ne: null } }).select("parent").lean();
  return uniq([studentId, ...links.map((l) => l.parent)]);
}

/** Warden of the block (if any) + hostel owner + group owner. */
async function staffFor(hostelId, blockId) {
  const [hostel, block] = await Promise.all([Hostel.findById(hostelId).select("owner groupId").lean(), blockId ? Block.findById(blockId).select("wardenId").lean() : null]);
  const group = hostel?.groupId ? await HostelGroup.findById(hostel.groupId).select("ownerId").lean() : null;
  return uniq([hostel?.owner, group?.ownerId, block?.wardenId]);
}

const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`[hostelEvents] ${fn.name} failed: ${error.message}`);
    return { sent: 0, error: error.message };
  }
};

// ---- typed events (all failure-tolerant: a notification must never break a money flow)
const emitInvoiceIssued = safe(async function emitInvoiceIssued(invoice) {
  const due = invoice.dueDate ? ` due ${clock.dayKey(invoice.dueDate)}` : "";
  return emitHostelEvent({ type: "invoice_issued", hostel: invoice.hostel, users: await studentAndParents(invoice.student), title: "New invoice", message: `${invoice.title}: ${money(invoice.amount)}${due}.` });
});

const emitPaymentReceived = safe(async function emitPaymentReceived(payment, view) {
  const parts = [`${money(payment.amount)} received (receipt ${payment.receiptNo})`];
  if (payment.finePortion) parts.push(`incl. ${money(payment.finePortion)} fine`);
  if (payment.discountApplied) parts.push(`discount ${money(payment.discountApplied)}`);
  return emitHostelEvent({ type: "payment_received", hostel: payment.hostel, users: await studentAndParents(payment.student), title: "Payment received", message: `${parts.join(", ")}. Remaining: ${money(view.totalDue)}.` });
});

const emitDueSoon = safe(async function emitDueSoon(invoice, dayKey) {
  return emitHostelEvent({ type: "due_soon", hostel: invoice.hostel, dedupeKey: `due-soon:${invoice._id}`, users: await studentAndParents(invoice.student), title: "Rent due soon", message: `${invoice.title} (${money(invoice.amount - (invoice.discountTotal || 0) - invoice.paidAmount)}) is due on ${clock.dayKey(invoice.dueDate)}. Late fines start the day after (${dayKey}).` });
});

const emitFineStarted = safe(async function emitFineStarted(invoice) {
  return emitHostelEvent({ type: "fine_started", hostel: invoice.hostel, dedupeKey: `fine-started:${invoice._id}`, users: await studentAndParents(invoice.student), title: "Late fine started", message: `${invoice.title} is overdue. A fine of ${money(invoice.finePerDay)} per day now applies until the rent is paid.` });
});

const emitWaiverDecision = safe(async function emitWaiverDecision(request, invoice) {
  const outcome = request.status === "rejected" ? "was rejected" : `approved: ${money(request.approvedAmount)} waived`;
  return emitHostelEvent({ type: "waiver_decision", hostel: invoice.hostel, users: await studentAndParents(request.student), title: "Fine waiver decision", message: `Your waiver request for "${invoice.title}" ${outcome}. Note: ${request.decisionNote}` });
});

const emitLeaveEvent = safe(async function emitLeaveEvent(notice, kind, extra = "") {
  const leave = clock.dayKey(notice.intendedLeaveDate);
  const map = {
    submitted: ["Leave notice submitted", `Leave notice for ${leave} submitted (${notice.noticeDaysGiven} days' notice; policy ${notice.policyDays}).${notice.shortBy ? ` Short by ${notice.shortBy} day(s).` : ""}`],
    approved: ["Leave notice approved", `Leave on ${leave} approved. ${extra}`.trim()],
    rejected: ["Leave notice rejected", `Leave on ${leave} was rejected. ${extra}`.trim()],
    withdrawn: ["Leave notice withdrawn", `The leave notice for ${leave} was withdrawn.`],
    reminder7: ["Leaving in 7 days", `Reminder: your leave date is ${leave}. Clear any dues before checkout.`],
    reminder1: ["Leaving tomorrow", `Reminder: your leave date is tomorrow (${leave}). Clear any dues before checkout.`],
    completed: ["Checked out", `Checkout completed. ${extra}`.trim()]
  };
  const [title, message] = map[kind];
  const family = await studentAndParents(notice.student);
  const staff = ["submitted", "reminder7", "reminder1"].includes(kind) ? await staffFor(notice.hostel, notice.block) : [];
  const dedupeKey = kind.startsWith("reminder") ? `leave-${kind}:${notice._id}` : undefined;
  return emitHostelEvent({ type: `leave_${kind}`, hostel: notice.hostel, dedupeKey, users: [...family, ...staff], title, message });
});

const emitComplaintStatus = safe(async function emitComplaintStatus(complaint, status) {
  return emitHostelEvent({ type: "complaint_status", hostel: complaint.hostel, users: await studentAndParents(complaint.student), title: "Complaint update", message: `"${complaint.title}" is now ${String(status).replace(/_/g, " ")}.` });
});

const emitToStaff = safe(async function emitToStaff({ hostel, block, type, title, message, dedupeKey }) {
  return emitHostelEvent({ type, hostel, dedupeKey, users: await staffFor(hostel, block), title, message });
});

const emitToFamily = safe(async function emitToFamily({ student, hostel, type, title, message, dedupeKey }) {
  return emitHostelEvent({ type, hostel, dedupeKey, users: await studentAndParents(student), title, message });
});

module.exports = {
  emitHostelEvent,
  studentAndParents,
  staffFor,
  emitInvoiceIssued,
  emitPaymentReceived,
  emitDueSoon,
  emitFineStarted,
  emitWaiverDecision,
  emitLeaveEvent,
  emitComplaintStatus,
  emitToStaff,
  emitToFamily
};
