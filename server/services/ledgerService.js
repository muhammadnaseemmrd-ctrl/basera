const crypto = require("crypto");
const mongoose = require("mongoose");
const LedgerEntry = require("../models/LedgerEntry");

const entryIdFor = (transactionId, account, direction, index) =>
  `${transactionId}:${index}:${account}:${direction}`.replace(/[^a-zA-Z0-9:_-]/g, "-");

const sum = (items, predicate) => items.filter(predicate).reduce((total, item) => total + Number(item.amount || 0), 0);

const ensureBalanced = (lines) => {
  const debit = sum(lines, (line) => line.direction === "debit");
  const credit = sum(lines, (line) => line.direction === "credit");
  if (Math.round(debit) !== Math.round(credit)) {
    const error = new Error(`Ledger transaction is not balanced. Debit ${debit}, credit ${credit}.`);
    error.statusCode = 422;
    throw error;
  }
};

const createLedgerTransaction = async ({ type, booking, lines, gateway, paymentRef, idempotencyKey, memo, metadata = {} }) => {
  const transactionId = idempotencyKey || `LED-${crypto.randomUUID()}`;
  const normalizedLines = lines
    .filter((line) => Number(line.amount || 0) > 0)
    .map((line, index) => ({
      transactionId,
      entryId: entryIdFor(transactionId, line.account, line.direction, index),
      booking: booking?._id || booking?.id || booking,
      student: booking?.student,
      host: booking?.host || booking?.listedBy,
      type,
      account: line.account,
      direction: line.direction,
      amount: Math.round(Number(line.amount || 0)),
      gateway,
      paymentRef,
      idempotencyKey,
      memo: line.memo || memo,
      metadata: { ...metadata, ...(line.metadata || {}) }
    }));

  ensureBalanced(normalizedLines);

  if (mongoose.connection.readyState !== 1) {
    return { transactionId, entries: normalizedLines, demo: true };
  }

  try {
    const entries = await LedgerEntry.insertMany(normalizedLines, { ordered: true });
    return { transactionId, entries };
  } catch (error) {
    if (error.code === 11000) {
      const entries = await LedgerEntry.find({ transactionId }).sort({ createdAt: 1 });
      return { transactionId, entries, duplicate: true };
    }
    throw error;
  }
};

const bookingPaymentLines = (booking) => {
  const rent = Number(booking.totalRent || booking.totalAmount || 0);
  const deposit = Number(booking.securityDeposit || 0);
  const serviceFee = Number(booking.serviceFee || 0);
  const discount = Number(booking.discountAmount || 0);
  const total = Number(booking.totalAmount || Math.max(0, rent + deposit + serviceFee - discount));
  return [
    { account: "gateway_cash", direction: "debit", amount: total, memo: "Payment collected by gateway" },
    { account: "platform_discount", direction: "debit", amount: discount, memo: "Platform-funded discount" },
    { account: "escrow_rent", direction: "credit", amount: rent, memo: "Rent held in escrow" },
    { account: "escrow_deposit", direction: "credit", amount: deposit, memo: "Security deposit held separately" },
    { account: "platform_service_fee", direction: "credit", amount: serviceFee, memo: "Student service fee" }
  ];
};

const commissionRecognitionLines = (booking) => {
  const rent = Number(booking.totalRent || 0);
  const commission = Number(booking.commission || 0);
  const hostPayout = Number(booking.ownerReceives || Math.max(0, rent - commission));
  return [
    { account: "escrow_rent", direction: "debit", amount: rent, memo: "Rent released from escrow accounting" },
    { account: "platform_commission", direction: "credit", amount: commission, memo: "Basera commission" },
    { account: "host_payable", direction: "credit", amount: hostPayout, memo: "Host payout payable" }
  ];
};

const hostPayoutLines = (booking, amount = booking.ownerReceives) => [
  { account: "host_payable", direction: "debit", amount, memo: "Host payable cleared" },
  { account: "gateway_cash", direction: "credit", amount, memo: "Payout sent to Host" }
];

const depositRefundLines = (booking, amount, deduction = 0) => {
  const refund = Math.max(0, Number(amount || 0));
  const deducted = Math.max(0, Number(deduction || 0));
  return [
    { account: "escrow_deposit", direction: "debit", amount: refund + deducted, memo: "Security deposit released from escrow" },
    { account: "student_payable", direction: "credit", amount: refund, memo: "Deposit refund to student" },
    { account: "host_payable", direction: "credit", amount: deducted, memo: "Approved deposit deduction to Host" }
  ];
};

const recordBookingPaymentLedger = ({ booking, gateway, paymentRef, idempotencyKey }) =>
  createLedgerTransaction({
    type: "BOOKING_PAYMENT",
    booking,
    lines: bookingPaymentLines(booking),
    gateway,
    paymentRef,
    idempotencyKey: idempotencyKey || `booking-paid-${booking._id || booking.id || paymentRef}`,
    memo: "Student booking payment collected"
  });

const recordCommissionLedger = ({ booking, idempotencyKey }) =>
  createLedgerTransaction({
    type: "COMMISSION_RECOGNITION",
    booking,
    lines: commissionRecognitionLines(booking),
    idempotencyKey: idempotencyKey || `commission-${booking._id || booking.id}`,
    memo: "Commission and Host payable recognized"
  });

const recordHostPayoutLedger = ({ booking, amount, paymentRef, idempotencyKey }) =>
  createLedgerTransaction({
    type: "HOST_PAYOUT",
    booking,
    lines: hostPayoutLines(booking, amount),
    paymentRef,
    idempotencyKey: idempotencyKey || `host-payout-${booking._id || booking.id}-${paymentRef || "manual"}`,
    memo: "Host payout transfer"
  });

const recordDepositResolutionLedger = ({ booking, refundAmount, deductionAmount, idempotencyKey }) =>
  createLedgerTransaction({
    type: Number(deductionAmount || 0) > 0 ? "DEPOSIT_DEDUCTION" : "DEPOSIT_REFUND",
    booking,
    lines: depositRefundLines(booking, refundAmount, deductionAmount),
    idempotencyKey: idempotencyKey || `deposit-resolution-${booking._id || booking.id}`,
    memo: "Security deposit resolution"
  });

const recordActivityContributionLedger = ({ activity, student, amount, paymentMethod, paymentRef, idempotencyKey }) =>
  createLedgerTransaction({
    type: "ACTIVITY_CONTRIBUTION",
    booking: null,
    lines: [
      { account: "gateway_cash", direction: "debit", amount, memo: "Student activity contribution collected" },
      { account: "activity_pool", direction: "credit", amount, memo: "Activity contribution pool" }
    ],
    gateway: paymentMethod,
    paymentRef,
    idempotencyKey: idempotencyKey || `activity-contribution-${activity?._id || activity?.id || "demo"}-${student?._id || student?.id || "student"}-${paymentRef || Date.now()}`,
    memo: "Outdoor activity contribution collected",
    metadata: {
      activityId: activity?._id || activity?.id,
      activityTitle: activity?.title,
      student: student?._id || student?.id
    }
  });

const recordHostManagementFeeLedger = ({ host, amount, period, paymentRef, idempotencyKey }) =>
  createLedgerTransaction({
    type: "HOST_MANAGEMENT_FEE",
    booking: null,
    lines: [
      { account: "host_receivable", direction: "debit", amount, memo: "Monthly hostel management fee invoiced" },
      { account: "platform_management_fee", direction: "credit", amount, memo: "Platform management subscription revenue" }
    ],
    paymentRef,
    idempotencyKey: idempotencyKey || `host-management-fee-${host?._id || host?.id || "host"}-${period || new Date().toISOString().slice(0, 7)}`,
    memo: "Hostel management monthly fee",
    metadata: {
      host: host?._id || host?.id,
      hostName: host?.name,
      period
    }
  });

const recordStudentMonthlyFeeLedger = ({ student, booking, amount, period, paymentRef, idempotencyKey }) =>
  createLedgerTransaction({
    type: "STUDENT_MONTHLY_FEE",
    booking,
    lines: [
      { account: "student_receivable", direction: "debit", amount, memo: "Monthly student platform fee invoiced" },
      { account: "platform_student_fee", direction: "credit", amount, memo: "Recurring student platform fee revenue" }
    ],
    paymentRef,
    idempotencyKey: idempotencyKey || `student-monthly-fee-${booking?._id || booking?.id}-${period || new Date().toISOString().slice(0, 7)}`,
    memo: "Recurring monthly student platform fee",
    metadata: {
      student: student?._id || student?.id,
      period
    }
  });

const summarizeLedger = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      balances: {
        gateway_cash: 214000,
        escrow_rent: 168000,
        escrow_deposit: 47000,
        platform_commission: 87360,
        platform_service_fee: 16800,
        platform_management_fee: -1000,
        host_receivable: 1000,
        host_payable: 109740,
        student_receivable: 400,
        platform_student_fee: 400
      },
      mismatches: [],
      demo: true
    };
  }

  const entries = await LedgerEntry.find().lean();
  const accounts = {};
  entries.forEach((entry) => {
    accounts[entry.account] = accounts[entry.account] || 0;
    accounts[entry.account] += entry.direction === "debit" ? Number(entry.amount || 0) : -Number(entry.amount || 0);
  });

  const byTransaction = new Map();
  entries.forEach((entry) => {
    const current = byTransaction.get(entry.transactionId) || { debit: 0, credit: 0 };
    current[entry.direction] += Number(entry.amount || 0);
    byTransaction.set(entry.transactionId, current);
  });

  const mismatches = Array.from(byTransaction.entries())
    .filter(([, value]) => Math.round(value.debit) !== Math.round(value.credit))
    .map(([transactionId, value]) => ({ transactionId, ...value }));

  return { balances: accounts, mismatches };
};

module.exports = {
  createLedgerTransaction,
  recordBookingPaymentLedger,
  recordCommissionLedger,
  recordHostPayoutLedger,
  recordDepositResolutionLedger,
  recordActivityContributionLedger,
  recordHostManagementFeeLedger,
  recordStudentMonthlyFeeLedger,
  summarizeLedger
};
