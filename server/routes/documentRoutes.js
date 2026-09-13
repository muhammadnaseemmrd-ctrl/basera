const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Dispute = require("../models/Dispute");
const DepositCase = require("../models/DepositCase");
const LedgerEntry = require("../models/LedgerEntry");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { bookings, users } = require("../data/mockData");
const { buildPdf, documentRows, formatCurrency, receiptIdFor } = require("../services/pdfService");
const { buildPLPdf } = require("../services/financeIntelligenceService");
const { getDnaScore } = require("../services/dnaScoreService");

const router = express.Router();

const demoBooking = (id) => bookings.find((booking) => booking.id === id) || bookings[0];
const cleanDocumentId = (value = "") => String(value || "").replace(/^HHV-/i, "").replace(/^BASERA-/i, "").replace(/^HH-RCT-\d{4}-/i, "");
const bookingReference = (booking) => booking?._id || booking?.id || "demo";
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};
const demoHost = () => users.find((user) => ["host", "owner", "landlord"].includes(user.role)) || users[0];

const sendPdf = (res, buffer, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  return res.send(buffer);
};

const loadBooking = async (id) => {
  if (mongoose.connection.readyState !== 1) return demoBooking(id);
  const cleanId = cleanDocumentId(id);
  const query = mongoose.Types.ObjectId.isValid(cleanId)
    ? { $or: [{ _id: cleanId }, { paymentRef: id }, { receiptUrl: id }] }
    : { $or: [{ paymentRef: id }, { receiptUrl: id }] };
  return Booking.findOne(query).populate("room hostel student");
};

const publicBookingVerification = (booking, receiptId) => ({
  valid: Boolean(booking),
  receiptId,
  verificationId: `HHV-${booking?._id || booking?.id || receiptId}`,
  bookingId: booking?._id || booking?.id,
  status: booking?.status || "unknown",
  paymentStatus: booking?.paymentStatus || "unknown",
  currency: "PKR",
  financialDetailsRedacted: true,
  issuedBy: "Basera Pakistan",
  issuedAt: booking?.updatedAt || booking?.createdAt || new Date().toISOString(),
  property: booking?.hostel?.name || booking?.room?.title || booking?.hostelName || "Basera verified booking"
});

const bookingRowsWithStudent = (booking) => [
  ...documentRows(booking),
  ["Student", booking?.student?.name || booking?.studentName || "Verified student"],
  ["Property", booking?.hostel?.name || booking?.room?.title || booking?.hostelName || "Basera property"],
  ["Move-in", formatDate(booking?.moveInDate || booking?.checkIn)]
];

const buildBookingDocument = async ({ booking, title, subtitle, extraRows = [], prefix = "HH-RCT" }) =>
  buildPdf({
    title,
    subtitle,
    rows: [...bookingRowsWithStudent(booking), ...extraRows],
    receiptId: receiptIdFor(prefix, bookingReference(booking))
  });

const sendBookingDocument = async (req, res, { title, subtitle, filenamePrefix, extraRows = [], prefix }) => {
  const booking = await loadBooking(req.params.id || req.params.bookingId || req.params.paymentId);
  if (!booking) return res.status(404).json({ message: "Booking not found." });
  const buffer = await buildBookingDocument({ booking, title, subtitle, extraRows, prefix });
  return sendPdf(res, buffer, `${filenamePrefix}-${req.params.id || req.params.bookingId || req.params.paymentId}.pdf`);
};

router.get("/verify/:receiptId", async (req, res, next) => {
  try {
    const receiptId = String(req.params.receiptId || "").trim();
    if (!receiptId) return res.status(400).json({ message: "Receipt ID is required." });

    if (mongoose.connection.readyState !== 1) {
      const cleanId = receiptId.replace(/^HHV-/i, "").replace(/^basera-/i, "");
      const booking = demoBooking(cleanId === "demo" ? "b1" : cleanId);
      return res.json({ verification: publicBookingVerification(booking, receiptId), demo: true });
    }

    const cleanId = receiptId.replace(/^HHV-/i, "").replace(/^basera-/i, "");
    const query = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { receiptUrl: receiptId }] }
      : { receiptUrl: receiptId };
    const booking = await Booking.findOne(query).populate("room", "title").populate("hostel", "name");
    if (!booking) return res.status(404).json({ verification: publicBookingVerification(null, receiptId), message: "Receipt not found." });
    return res.json({ verification: publicBookingVerification(booking, receiptId) });
  } catch (error) {
    return next(error);
  }
});

router.get("/bookings/:id/receipt", protect, async (req, res, next) => {
  try {
    return sendBookingDocument(req, res, {
      title: "Rent Payment Receipt",
      subtitle: "Basera escrow payment record",
      filenamePrefix: "basera-receipt",
      prefix: "HH-RCT"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/bookings/:id/confirmation", protect, async (req, res, next) => {
  try {
    return sendBookingDocument(req, res, {
      title: "Booking Confirmation Letter",
      subtitle: "Host contact is valid only for paid confirmed bookings",
      filenamePrefix: "basera-confirmation",
      prefix: "HH-CNF",
      extraRows: [
        ["Host Contact", "Released only after paid confirmation inside the authenticated booking screen"],
        ["What to bring", "Original CNIC, one CNIC copy, two passport photos, and this confirmation letter"]
      ]
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/bookings/:id/rent-ledger", protect, async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const rows = (booking.instalments || []).map((item, index) => [`Instalment ${index + 1}`, `${formatCurrency(item.amount)} - ${item.status} - ${formatDate(item.dueDate)}`]);
    const buffer = await buildPdf({ title: "Rent Ledger", subtitle: "Student payment schedule", rows: rows.length ? rows : bookingRowsWithStudent(booking), receiptId: receiptIdFor("HH-LED", bookingReference(booking)) });
    return sendPdf(res, buffer, `basera-ledger-${req.params.id}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/confirmation/:bookingId", protect, async (req, res, next) => {
  try {
    return sendBookingDocument(req, res, {
      title: "Booking Confirmation Letter",
      subtitle: "V3 document endpoint",
      filenamePrefix: "basera-confirmation",
      prefix: "HH-CNF",
      extraRows: [["Move-in checklist", "Original CNIC, CNIC photocopy, two passport photos"]]
    });
  } catch (error) {
    return next(error);
  }
});

router.get(["/receipt/:paymentId", "/receipt/:paymentId/download"], protect, async (req, res, next) => {
  try {
    return sendBookingDocument(req, res, {
      title: "Rent Payment Receipt",
      subtitle: "V3 receipt endpoint",
      filenamePrefix: "basera-rent-receipt",
      prefix: "HH-RCT"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/ledger/:studentId", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const rows = bookings.map((booking) => [
        booking.id,
        `${formatDate(booking.checkIn)} - ${booking.status} - ${formatCurrency(booking.totalAmount)}`
      ]);
      const buffer = await buildPdf({ title: "Student Rent Ledger", subtitle: "All demo rent payments", rows, receiptId: receiptIdFor("HH-LED", req.params.studentId) });
      return sendPdf(res, buffer, `basera-student-ledger-${req.params.studentId}.pdf`);
    }

    const rows = await LedgerEntry.find({ student: req.params.studentId }).sort({ createdAt: -1 }).limit(80);
    const pdfRows = rows.map((entry) => [entry.entryId, `${entry.type} - ${entry.account} - ${entry.direction} - ${formatCurrency(entry.amount)}`]);
    const buffer = await buildPdf({ title: "Student Rent Ledger", subtitle: `Student ${req.params.studentId}`, rows: pdfRows, receiptId: receiptIdFor("HH-LED", req.params.studentId) });
    return sendPdf(res, buffer, `basera-student-ledger-${req.params.studentId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/certificate/:studentId", protect, async (req, res, next) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const studentBookings = mongoose.connection.readyState !== 1
      ? bookings.filter((booking) => booking.student === req.params.studentId || req.params.studentId === "demo" || req.params.studentId === "u-student")
      : await Booking.find({ student: req.params.studentId, paymentStatus: "paid" }).populate("student hostel room");
    const total = studentBookings.reduce((sum, booking) => sum + Number(booking.totalRent || booking.totalAmount || 0), 0);
    const studentName = studentBookings[0]?.student?.name || users.find((user) => user.id === req.params.studentId)?.name || "Verified student";
    const rows = [
      ["Certificate Year", year],
      ["Student", studentName],
      ["Total Rent Paid", formatCurrency(total)],
      ["Bookings Included", studentBookings.length],
      ["Purpose", "Annual hostel rent record for student/parent/accounting use"]
    ];
    const buffer = await buildPdf({ title: "Annual Rent Certificate", subtitle: "Basera verified rent summary", rows, receiptId: receiptIdFor("HH-CERT", `${req.params.studentId}-${year}`) });
    return sendPdf(res, buffer, `basera-rent-certificate-${req.params.studentId}-${year}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get(["/payout/:payoutId", "/payout/:payoutId/download"], protect, authorize("host", "admin", "finance"), async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.payoutId);
    // Found during live QA (same class as the bookingRoutes.js confirm/accept/
    // decline/deposit IDOR fixes): "host" alone let ANY host download ANY OTHER
    // host's payout statement by guessing/enumerating a booking/payout id.
    if (booking && req.user.role !== "admin" && req.user.role !== "finance") {
      const hostId = booking.room?.listedBy || booking.hostel?.owner;
      if (String(hostId) !== String(req.user._id || req.user.id)) {
        return res.status(403).json({ message: "You can only view your own payout statements." });
      }
    }
    const rows = booking
      ? [
          ["Payout ID", req.params.payoutId],
          ["Booking", bookingReference(booking)],
          ["Gross Rent", formatCurrency(booking.totalRent)],
          ["Commission", formatCurrency(booking.commission)],
          ["Net Payout", formatCurrency(booking.ownerReceives)],
          ["Payout Status", booking.ownerPaidOut ? "Released" : "Pending"]
        ]
      : [["Payout ID", req.params.payoutId], ["Gross Rent", "PKR 42,000"], ["Commission", "PKR 2,940"], ["Net Payout", "PKR 39,060"], ["Payout Status", "Pending"]];
    const buffer = await buildPdf({ title: "Host Payout Statement", subtitle: "Commission and settlement record", rows, receiptId: receiptIdFor("HH-PAY", req.params.payoutId) });
    return sendPdf(res, buffer, `basera-payout-${req.params.payoutId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/earnings/:hostId", protect, authorize("host", "admin", "finance"), async (req, res, next) => {
  try {
    // Found during live QA: this previously (a) never checked that :hostId
    // belonged to the requester, and (b) queried ALL paid bookings platform-wide
    // with no host filter at all -- so any host account could pull a PDF
    // mislabeled with their own hostId that actually contained the ENTIRE
    // platform's gross rent/commission/payout totals, a real financial data leak.
    if (req.user.role !== "admin" && req.user.role !== "finance" && String(req.params.hostId) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ message: "You can only view your own earnings." });
    }
    const month = req.query.month || new Date().toLocaleString("en-US", { month: "long" });
    const year = req.query.year || new Date().getFullYear();
    let hostBookings;
    if (mongoose.connection.readyState !== 1) {
      hostBookings = bookings;
    } else {
      const hostRoomIds = await Room.find({ listedBy: req.params.hostId }).select("_id");
      hostBookings = await Booking.find({ paymentStatus: "paid", room: { $in: hostRoomIds.map((room) => room._id) } }).populate("room");
    }
    const gross = hostBookings.reduce((sum, booking) => sum + Number(booking.totalRent || 0), 0);
    const commission = hostBookings.reduce((sum, booking) => sum + Number(booking.commission || 0), 0);
    const payout = hostBookings.reduce((sum, booking) => sum + Number(booking.ownerReceives || 0), 0);
    const rows = [
      ["Host ID", req.params.hostId],
      ["Period", `${month} ${year}`],
      ["Gross rent collected", formatCurrency(gross)],
      ["Basera commission", formatCurrency(commission)],
      ["Net payout", formatCurrency(payout)]
    ];
    const buffer = await buildPdf({ title: "Host Monthly Earnings Summary", subtitle: "V3 earnings endpoint", rows, receiptId: receiptIdFor("HH-EARN", `${req.params.hostId}-${month}-${year}`) });
    return sendPdf(res, buffer, `basera-earnings-${req.params.hostId}-${month}-${year}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/late-fee/:feeId", protect, async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.feeId);
    const lateFee = Number(booking?.lateFee || process.env.LATE_FEE_PKR || 500);
    const rows = [
      ["Late Fee ID", req.params.feeId],
      ["Booking", bookingReference(booking)],
      ["Student", booking?.student?.name || "Verified student"],
      ["Fee Amount", formatCurrency(lateFee)],
      ["Reason", "Rent payment was not received before the configured grace period"],
      ["Generated On", today()]
    ];
    const buffer = await buildPdf({ title: "Late Fee Invoice", subtitle: "Overdue rent fee", rows, receiptId: receiptIdFor("HH-LATE", req.params.feeId) });
    return sendPdf(res, buffer, `basera-late-fee-${req.params.feeId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/deposit/:bookingId/receipt", protect, async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const rows = [
      ["Booking", bookingReference(booking)],
      ["Student", booking?.student?.name || "Verified student"],
      ["Deposit Amount", formatCurrency(booking.securityDeposit)],
      ["Escrow Status", booking.escrowStatus || "held"],
      ["Refund Window", "Student may dispute deductions within 14 days of move-out"]
    ];
    const buffer = await buildPdf({ title: "Security Deposit Receipt", subtitle: "Deposit held in Basera escrow", rows, receiptId: receiptIdFor("HH-DEP", bookingReference(booking)) });
    return sendPdf(res, buffer, `basera-deposit-receipt-${req.params.bookingId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/deposit/:bookingId/refund-notice", protect, async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const deposit = mongoose.connection.readyState === 1 ? await DepositCase.findOne({ booking: booking._id }) : null;
    const refundAmount = deposit?.refundAmount ?? booking.securityDeposit ?? 0;
    const deductionAmount = deposit?.deductionAmount ?? 0;
    const rows = [
      ["Booking", bookingReference(booking)],
      ["Deposit Status", deposit?.status || "REFUNDED"],
      ["Refund Amount", formatCurrency(refundAmount)],
      ["Deduction Amount", formatCurrency(deductionAmount)],
      ["Resolution Note", deposit?.adminNote || deposit?.reason || "No deduction recorded"]
    ];
    const buffer = await buildPdf({ title: "Security Deposit Refund Notice", subtitle: "Deposit release decision", rows, receiptId: receiptIdFor("HH-DEP-REF", bookingReference(booking)) });
    return sendPdf(res, buffer, `basera-deposit-refund-${req.params.bookingId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/hosts/monthly-summary", protect, async (req, res, next) => {
  try {
    const buffer = await buildPdf({
      title: "Host Monthly Earnings Summary",
      subtitle: "Commission and payout statement",
      rows: [["Gross rent collected", "PKR 118,000"], ["Basera commission", "PKR 8,260"], ["Net payout", "PKR 109,740"]],
      receiptId: receiptIdFor("HH-EARN", req.user.id || req.user._id || "demo-host")
    });
    return sendPdf(res, buffer, "basera-host-monthly-summary.pdf");
  } catch (error) {
    return next(error);
  }
});

router.get("/hosts/agreement", protect, async (req, res, next) => {
  try {
    const buffer = await buildPdf({
      title: "Basera Host Agreement",
      subtitle: "Off-platform collection is prohibited",
      rows: [["Host", req.user.name], ["Commission", `${process.env.COMMISSION_RATE_DEFAULT || 7}% standard rate`], ["Policy", "All confirmed tenants must pay through Basera for the booking duration."]],
      receiptId: receiptIdFor("HH-AGR", req.user.id || req.user._id || "demo-host")
    });
    return sendPdf(res, buffer, "basera-host-agreement.pdf");
  } catch (error) {
    return next(error);
  }
});

router.get("/hosts/:id/pl-statement", protect, authorize("host", "owner", "landlord", "admin", "finance"), async (req, res, next) => {
  try {
    const buffer = await buildPLPdf({
      hostId: req.params.id,
      month: req.query.month,
      year: req.query.year
    });
    return sendPdf(res, buffer, `basera-pl-statement-${req.params.id}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/hosts/:id/report-card-certificate", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const score = await getDnaScore(req.params.id);
    const overallScore = Number(score.overallScore || 0);
    const rows = [
      ["Hostel ID", req.params.id],
      ["Overall DNA Score", `${overallScore}/100`],
      ["Certificate Grade", overallScore >= 85 ? "A" : overallScore >= 75 ? "B" : "Improvement Required"],
      ...((score.dimensions || []).slice(0, 8).map((item) => [item.name, `${item.score}/100 - ${item.basis || "Measured by Basera quality signals"}`])),
      ["Issued At", today()],
      ["Validity", "30 days from issue date"]
    ];
    const buffer = await buildPdf({
      title: "Basera Verified Report Card",
      subtitle: "Quality certificate based on DNA score, operations, reviews, and trust controls",
      rows,
      receiptId: receiptIdFor("HH-RC", req.params.id)
    });
    return sendPdf(res, buffer, `basera-report-card-${req.params.id}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/hosts/:hostId/approval-letter", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const host = mongoose.connection.readyState === 1
      ? await User.findById(req.params.hostId).select("name email phone hostProfile landlordProfile")
      : demoHost();
    if (!host) return res.status(404).json({ message: "Host not found." });
    const rows = [
      ["Host", host.name],
      ["Email", host.email],
      ["Verification Tier", host.hostProfile?.verificationTier || host.landlordProfile?.verificationTier || "property_verified"],
      ["Approval Date", today()],
      ["Listing Policy", "Host must keep availability accurate and collect confirmed payments through Basera"]
    ];
    const buffer = await buildPdf({ title: "Verification Approval Letter", subtitle: "Host listing approval", rows, receiptId: receiptIdFor("HH-APP", req.params.hostId) });
    return sendPdf(res, buffer, `basera-verification-approval-${req.params.hostId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/disputes/:id/resolution", protect, async (req, res, next) => {
  try {
    const dispute = mongoose.connection.readyState === 1 ? await Dispute.findById(req.params.id) : { caseId: req.params.id, status: "resolved", outcome: "SPLIT", resolutionNote: "Demo resolution." };
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });
    const buffer = await buildPdf({
      title: "Dispute Resolution Letter",
      subtitle: dispute.caseId || req.params.id,
      rows: [["Status", dispute.status], ["Outcome", dispute.outcome || "-"], ["Resolution note", dispute.resolutionNote || dispute.adminNote || "-"]],
      receiptId: receiptIdFor("HH-DSP", req.params.id)
    });
    return sendPdf(res, buffer, `basera-dispute-${req.params.id}.pdf`);
  } catch (error) {
    return next(error);
  }
});

router.get("/dispute/:disputeId", protect, async (req, res, next) => {
  try {
    const dispute = mongoose.connection.readyState === 1 ? await Dispute.findById(req.params.disputeId) : { caseId: req.params.disputeId, status: "resolved", outcome: "SPLIT", resolutionNote: "Demo resolution." };
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });
    const buffer = await buildPdf({
      title: "Dispute Resolution Letter",
      subtitle: dispute.caseId || req.params.disputeId,
      rows: [["Status", dispute.status], ["Outcome", dispute.outcome || "-"], ["Resolution note", dispute.resolutionNote || dispute.adminNote || "-"]],
      receiptId: receiptIdFor("HH-DSP", req.params.disputeId)
    });
    return sendPdf(res, buffer, `basera-dispute-${req.params.disputeId}.pdf`);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
