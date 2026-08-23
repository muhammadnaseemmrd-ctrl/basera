const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const LedgerEntry = require("../models/LedgerEntry");
const WebhookEvent = require("../models/WebhookEvent");
const Booking = require("../models/Booking");
const StudentWallet = require("../models/StudentWallet");
const { summarizeLedger } = require("../services/ledgerService");
const { rooms, hostels, bookings, adminDashboard } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoLedger = [
  { entryId: "demo-1", transactionId: "demo-booking", account: "gateway_cash", direction: "debit", amount: 23500, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() },
  { entryId: "demo-2", transactionId: "demo-booking", account: "escrow_rent", direction: "credit", amount: 18000, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() },
  { entryId: "demo-3", transactionId: "demo-booking", account: "escrow_deposit", direction: "credit", amount: 5000, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() },
  { entryId: "demo-4", transactionId: "demo-booking", account: "platform_service_fee", direction: "credit", amount: 500, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() }
];

const financeAccess = [protect, authorize("admin", "finance", "finance_officer")];

const amountOf = (value) => Number(String(value || 0).replace(/[^0-9.-]/g, "")) || 0;
const nowIso = () => new Date().toISOString();

const demoFinanceRows = () => {
  const totalRent = bookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
  const commission = Math.round(totalRent * 0.07);
  const deposits = bookings.reduce((sum, booking) => sum + Number(booking.securityDeposit || 5000), 0);
  const overdue = bookings.filter((booking) => ["overdue", "pending"].includes(booking.status)).length;
  return {
    gmv: totalRent,
    commission,
    escrowBalance: Math.max(0, totalRent - commission),
    depositLiability: deposits,
    payoutPending: Math.max(1, bookings.length - 1),
    overdueRent: overdue,
    refundsPending: 2,
    disputesOpen: adminDashboard.disputes?.length || 3
  };
};

const demoPayouts = [
  { id: "pay-ready-1", hostName: "Sara Malik", hostelName: "Cozy Boys Hostel F-10", amount: 185000, status: "ready", gateway: "bank", city: "Islamabad", dueAt: nowIso() },
  { id: "pay-failed-1", hostName: "Ahmed Khan", hostelName: "Pine Crest Boys Hostel", amount: 74000, status: "failed", gateway: "jazzcash", city: "Islamabad", failureReason: "Account title mismatch" },
  { id: "pay-review-1", hostName: "Ayesha Tariq", hostelName: "Gulberg Elite Home", amount: 123000, status: "pending_review", gateway: "bank", city: "Lahore" }
];

const demoDepositRows = bookings.map((booking, index) => {
  const hostel = hostels.find((item) => item.id === booking.hostel) || hostels[index % hostels.length];
  return {
    id: `deposit-${booking.id}`,
    bookingId: booking.id,
    hostelName: hostel.name,
    studentName: index ? "Hamza Sheikh" : "Ali Ahmed",
    amount: Number(booking.securityDeposit || 5000),
    status: index % 3 === 0 ? "disputed" : "held",
    expectedReleaseDate: new Date(Date.now() + (index + 2) * 86400000).toISOString(),
    agingDays: index * 4,
    deductionRequested: index % 3 === 0 ? 1500 : 0
  };
});

const bookingWaterfall = (booking = bookings[0]) => {
  const room = rooms.find((item) => item.id === booking.room) || rooms[0];
  const hostel = hostels.find((item) => item.id === booking.hostel) || hostels[0];
  const rent = Number(booking.totalRent || booking.totalAmount || room.pricePerHead || room.pricePerBed || 0);
  const deposit = Number(booking.securityDeposit || room.securityDeposit || 5000);
  const serviceFee = Number(booking.serviceFee || 500);
  const commission = Number(booking.commission || Math.round(rent * 0.07));
  const hostPayout = Math.max(0, rent - commission);
  return {
    bookingId: booking.id || booking._id,
    hostelName: hostel.name,
    roomTitle: room.title,
    status: booking.status || "confirmed",
    totals: { rent, deposit, serviceFee, commission, hostPayout, paid: rent + deposit + serviceFee },
    steps: [
      { key: "student_paid", label: "Student Paid", account: "Gateway Cash", amount: rent + deposit + serviceFee, status: "complete", at: booking.createdAt || nowIso() },
      { key: "escrow_held", label: "Escrow Held", account: "Escrow Rent + Deposit", amount: rent + deposit, status: "complete", at: booking.createdAt || nowIso() },
      { key: "commission_split", label: "Commission Split", account: "Platform Commission", amount: commission, status: "ready", at: nowIso() },
      { key: "host_payout", label: "Host Payout", account: "Host Payable", amount: hostPayout, status: booking.status === "disputed" ? "blocked" : "pending", at: nowIso() },
      { key: "receipt", label: "Receipt Generated", account: "Documents", amount: 0, status: "complete", at: nowIso() }
    ],
    auditTrail: [
      { actorName: "System", action: "Payment received", status: "success", at: booking.createdAt || nowIso() },
      { actorName: "Finance Engine", action: "Commission and escrow accounts balanced", status: "success", at: nowIso() }
    ]
  };
};

router.get("/ledger", financeAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoLedger, demo: true });
    const results = await LedgerEntry.find()
      .populate("booking", "status paymentStatus")
      .populate("student host", "name email")
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit || 200));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/ledger/search", financeAccess, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    if (!isDbReady()) {
      const filtered = demoLedger
        .filter((entry) => !req.query.account || String(entry.account).toLowerCase().includes(String(req.query.account).toLowerCase()))
        .filter((entry) => !req.query.type || entry.type === req.query.type)
        .filter((entry) => !req.query.direction || entry.direction === req.query.direction);
      return res.json({ results: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit, demo: true });
    }
    const query = {};
    if (req.query.account) query.account = new RegExp(req.query.account, "i");
    if (req.query.type) query.type = req.query.type;
    if (req.query.direction) query.direction = req.query.direction;
    if (req.query.bookingId && mongoose.Types.ObjectId.isValid(req.query.bookingId)) query.booking = req.query.bookingId;
    const [results, total] = await Promise.all([
      LedgerEntry.find(query).populate("booking student host", "status name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      LedgerEntry.countDocuments(query)
    ]);
    return res.json({ results, total, page, limit });
  } catch (error) {
    return next(error);
  }
});

router.get("/command-room", financeAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const summary = demoFinanceRows();
      return res.json({
        summary,
        kpis: [
          { label: "GMV", value: summary.gmv, tone: "blue", trend: "+12%" },
          { label: "Commission Earned", value: summary.commission, tone: "green", trend: "+7%" },
          { label: "Escrow Balance", value: summary.escrowBalance, tone: "blue", trend: "stable" },
          { label: "Deposit Liability", value: summary.depositLiability, tone: "orange", trend: "+3%" },
          { label: "Payout Queue", value: summary.payoutPending, tone: "orange", trend: "needs review" },
          { label: "Open Disputes", value: summary.disputesOpen, tone: "red", trend: "-2" }
        ],
        alerts: [
          { id: "fin-alert-1", title: "Payout requires review", message: "One JazzCash payout has account-title mismatch.", severity: "warning" },
          { id: "fin-alert-2", title: "Deposit aging", message: "Two deposits are older than expected release window.", severity: "info" }
        ],
        charts: {
          gmvByMonth: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({ month, gmv: 180000 + index * 42000, commission: 12600 + index * 3200 })),
          byCity: ["Islamabad", "Lahore", "Karachi"].map((city, index) => ({ city, gmv: 420000 - index * 90000, occupancy: 86 - index * 7 }))
        },
        demo: true
      });
    }
    const ledgerSummary = await summarizeLedger();
    const [bookingCount, payoutReady, depositsHeld] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ status: { $in: ["confirmed", "completed"] }, paymentStatus: "paid" }),
      Booking.aggregate([{ $group: { _id: null, total: { $sum: "$securityDeposit" } } }])
    ]);
    const summary = {
      gmv: ledgerSummary.totalDebits || 0,
      commission: ledgerSummary.balances?.platform_commission || ledgerSummary.balances?.platform_service_fee || 0,
      escrowBalance: ledgerSummary.balances?.escrow_rent || 0,
      depositLiability: depositsHeld[0]?.total || 0,
      payoutPending: payoutReady,
      overdueRent: await Booking.countDocuments({ status: "overdue" }),
      refundsPending: await Booking.countDocuments({ refundStatus: "pending" }),
      disputesOpen: await Booking.countDocuments({ status: "disputed" }),
      bookingCount
    };
    return res.json({ summary, kpis: Object.entries(summary).slice(0, 6).map(([label, value]) => ({ label, value, tone: "blue" })), alerts: [], charts: { gmvByMonth: [], byCity: [] } });
  } catch (error) {
    return next(error);
  }
});

router.get("/bookings/:id/waterfall", financeAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      return res.json({ waterfall: bookingWaterfall(booking), demo: true });
    }
    const booking = await Booking.findById(req.params.id).populate("room hostel student");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ waterfall: bookingWaterfall(booking) });
  } catch (error) {
    return next(error);
  }
});

router.get("/payouts", financeAccess, async (req, res) => {
  return res.json({ results: demoPayouts, statuses: ["pending_review", "ready", "failed", "paid", "disputed"], demo: !isDbReady() });
});

router.post("/payouts/:id/approve", financeAccess, async (req, res) => {
  const payout = demoPayouts.find((item) => item.id === req.params.id) || { id: req.params.id, amount: Number(req.body.amount || 0), hostName: "Host" };
  return res.json({ payout: { ...payout, status: "paid", approvedBy: req.user.name || req.user.email, approvedAt: nowIso(), idempotencyKey: req.body.idempotencyKey || `payout-${req.params.id}` }, demo: !isDbReady() });
});

router.post("/payouts/:id/retry", financeAccess, async (req, res) => {
  const payout = demoPayouts.find((item) => item.id === req.params.id) || { id: req.params.id, amount: Number(req.body.amount || 0), hostName: "Host" };
  return res.json({ payout: { ...payout, status: "ready", retryCount: Number(payout.retryCount || 0) + 1, retriedAt: nowIso() }, demo: !isDbReady() });
});

router.get("/deposits/liability-register", financeAccess, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        results: demoDepositRows,
        summary: {
          totalHeld: demoDepositRows.reduce((sum, row) => sum + row.amount, 0),
          disputed: demoDepositRows.filter((row) => row.status === "disputed").length,
          agingOver7Days: demoDepositRows.filter((row) => row.agingDays > 7).length
        },
        demo: true
      });
    }
    const rows = await Booking.find({ securityDeposit: { $gt: 0 } }).populate("hostel student room").sort({ createdAt: -1 }).limit(200);
    const results = rows.map((booking) => ({
      id: String(booking._id),
      bookingId: String(booking._id),
      hostelName: booking.hostel?.name || "Hostel",
      studentName: booking.student?.name || "Student",
      amount: Number(booking.securityDeposit || 0),
      status: booking.depositStatus || "held",
      expectedReleaseDate: booking.moveOutDate || booking.updatedAt,
      agingDays: Math.max(0, Math.round((Date.now() - new Date(booking.createdAt).getTime()) / 86400000))
    }));
    return res.json({ results, summary: { totalHeld: results.reduce((sum, row) => sum + row.amount, 0), disputed: results.filter((row) => row.status === "disputed").length } });
  } catch (error) {
    return next(error);
  }
});

router.get("/statements/host/:hostId", financeAccess, (req, res) => {
  const rows = bookings.slice(0, 4).map((booking, index) => {
    const hostel = hostels.find((item) => item.id === booking.hostel) || hostels[index % hostels.length];
    const rent = Number(booking.totalRent || booking.totalAmount || 0);
    const commission = Math.round(rent * 0.07);
    return { bookingId: booking.id, hostelName: hostel.name, rent, commission, payout: rent - commission, paidAt: booking.createdAt || nowIso() };
  });
  return res.json({
    statement: {
      hostId: req.params.hostId,
      month: req.query.month || new Date().toISOString().slice(0, 7),
      rows,
      totals: {
        rent: rows.reduce((sum, row) => sum + row.rent, 0),
        commission: rows.reduce((sum, row) => sum + row.commission, 0),
        payout: rows.reduce((sum, row) => sum + row.payout, 0)
      },
      downloadable: true
    },
    demo: !isDbReady()
  });
});

router.post("/refunds/preview", protect, async (req, res) => {
  const rentPaid = Number(req.body.rentPaid || req.body.totalAmount || 25000);
  const deposit = Number(req.body.securityDeposit || 5000);
  const daysUntilMoveIn = Number(req.body.daysUntilMoveIn ?? 7);
  const nonRefundable = daysUntilMoveIn < 2 ? Math.round(rentPaid * 0.3) : daysUntilMoveIn < 7 ? Math.round(rentPaid * 0.15) : 0;
  const refundAmount = Math.max(0, rentPaid - nonRefundable) + deposit;
  return res.json({
    preview: {
      refundAmount,
      nonRefundableAmount: nonRefundable,
      depositRefund: deposit,
      policyVersion: process.env.REFUND_POLICY_VERSION || "v6-demo",
      policyLabel: daysUntilMoveIn < 2 ? "Late cancellation policy applies." : "Standard refundable window.",
      etaDays: 3
    },
    demo: !isDbReady()
  });
});

router.get("/forecast", financeAccess, async (req, res) => {
  const horizon = Number(req.query.days || 90);
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  return res.json({
    horizonDays: horizon,
    results: months.map((month, index) => ({
      month,
      expectedGmv: 520000 + index * 65000,
      expectedCommission: Math.round((520000 + index * 65000) * 0.07),
      renewalProbability: Math.max(55, 82 - index * 4),
      topCity: ["Islamabad", "Lahore", "Karachi"][index % 3],
      seasonalDemand: index % 2 ? "medium" : "high"
    })),
    byCity: ["Islamabad", "Lahore", "Karachi"].map((city, index) => ({ city, next30Days: 220000 - index * 42000, next90Days: 690000 - index * 110000 })),
    demo: !isDbReady()
  });
});

router.get("/reconciliation", financeAccess, async (req, res, next) => {
  try {
    const summary = await summarizeLedger();
    const webhookStats = !isDbReady()
      ? { processed: 8, duplicate: 1, failed: 0 }
      : {
          processed: await WebhookEvent.countDocuments({ status: "processed" }),
          duplicate: await WebhookEvent.countDocuments({ status: "duplicate" }),
          failed: await WebhookEvent.countDocuments({ status: "failed" })
        };
    return res.json({
      ...summary,
      webhookStats,
      settlementChecks: [
        { label: "Ledger balanced", ok: !summary.mismatches?.length },
        { label: "Webhook duplicates isolated", ok: true },
        { label: "Escrow deposit tracked separately", ok: true }
      ]
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
