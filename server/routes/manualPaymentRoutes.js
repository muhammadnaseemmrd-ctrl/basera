const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const ManualPayment = require("../models/ManualPayment");
const Booking = require("../models/Booking");
const { createLedgerTransaction } = require("../services/ledgerService");
const { bookings } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const refFor = () => `HH-MAN-${Date.now().toString(36).toUpperCase()}`;

const demoRows = [
  { id: "mp-demo-1", reference: "HH-MAN-DEMO1", bookingRef: "b1", studentName: "Ali Ahmed", amount: 23500, method: "bank_transfer", status: "proof_submitted", dueAt: new Date(Date.now() + 86400000).toISOString() },
  { id: "mp-demo-2", reference: "HH-MAN-DEMO2", bookingRef: "b2", studentName: "Hamza Sheikh", amount: 18000, method: "jazzcash_manual", status: "approved", dueAt: new Date().toISOString() }
];

const paymentLookup = (id) => {
  const clauses = [{ reference: id }];
  if (mongoose.Types.ObjectId.isValid(id)) clauses.unshift({ _id: id });
  return { $or: clauses };
};

const bankInstructions = () => ({
  accountTitle: "Basera Escrow",
  accountNumber: process.env.BASERA_ESCROW_ACCOUNT || "PK00-HH-DEMO-ESCROW",
  bank: process.env.BASERA_BANK_ACCOUNT ? "Configured Bank" : "Demo Bank",
  note: "Upload proof after transfer. Admin approval posts the payment to ledger."
});

router.post("/challan", protect, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero." });
    const reference = refFor();
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      studentName: req.user.name,
      booking: mongoose.Types.ObjectId.isValid(req.body.bookingId) ? req.body.bookingId : undefined,
      bookingRef: req.body.bookingId || "b1",
      amount,
      method: req.body.method || "bank_transfer",
      reference,
      dueAt: new Date(Date.now() + 48 * 3600000)
    };
    if (!isDbReady()) {
      const challan = { id: `mp-${Date.now()}`, ...payload, dueAt: payload.dueAt.toISOString(), status: "challan_issued" };
      demoRows.unshift(challan);
      return res.status(201).json({ challan, instructions: bankInstructions(), demo: true });
    }
    const challan = await ManualPayment.create(payload);
    return res.status(201).json({ challan, instructions: bankInstructions() });
  } catch (error) {
    return next(error);
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoRows.filter((row) => !row.studentRef || row.studentRef === req.user.id || req.user.role === "admin"), demo: true });
    const results = await ManualPayment.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/proof", protect, async (req, res, next) => {
  try {
    const patch = {
      proofUrl: req.body.proofUrl,
      proofReference: req.body.proofReference,
      payerName: req.body.payerName || req.user.name,
      status: "proof_submitted"
    };
    if (!isDbReady()) {
      const current = demoRows.find((row) => row.id === req.params.id || row.reference === req.params.id) || demoRows[0];
      Object.assign(current, patch);
      return res.json({ payment: current, demo: true });
    }
    const payment = await ManualPayment.findOneAndUpdate(
      { ...paymentLookup(req.params.id), student: req.user._id || req.user.id },
      patch,
      { new: true }
    );
    if (!payment) return res.status(404).json({ message: "Manual payment not found." });
    return res.json({ payment });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoRows, demo: true });
    const results = await ManualPayment.find().populate("student booking").sort({ createdAt: -1 }).limit(200);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/review", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const status = req.body.status === "rejected" ? "rejected" : "approved";
    if (!isDbReady()) {
      const current = demoRows.find((row) => row.id === req.params.id || row.reference === req.params.id) || demoRows[0];
      Object.assign(current, { status, adminNote: req.body.adminNote, reviewedByName: req.user.name, reviewedAt: new Date().toISOString() });
      return res.json({ payment: current, ledger: status === "approved" ? { transactionId: `manual-${current.reference}`, demo: true } : null, demo: true });
    }
    const payment = await ManualPayment.findOne(paymentLookup(req.params.id));
    if (!payment) return res.status(404).json({ message: "Manual payment not found." });
    let ledger = null;
    if (status === "approved") {
      const booking = payment.booking ? await Booking.findById(payment.booking) : bookings.find((item) => item.id === payment.bookingRef);
      ledger = await createLedgerTransaction({
        type: "MANUAL_PAYMENT_APPROVED",
        booking,
        lines: [
          { account: "gateway_cash", direction: "debit", amount: payment.amount, memo: "Manual payment verified" },
          // "manual_payment_clearing" was never a valid `account` enum value either
          // (see LedgerEntry.js) -- same crash, found in the same request. Crediting
          // student_receivable correctly reflects that the student's outstanding
          // balance goes down by the verified amount, consistent with how the
          // gateway-payment ledger lines (bookingPaymentLines) already model cash in.
          { account: "student_receivable", direction: "credit", amount: payment.amount, memo: "Manual payment cleared by admin" }
        ],
        paymentRef: payment.reference,
        idempotencyKey: `manual-payment-${payment.reference}`
      });
      payment.ledgerTransactionId = ledger.transactionId;
    }
    payment.status = status;
    payment.adminNote = req.body.adminNote;
    payment.reviewedByName = req.user.name || req.user.email;
    payment.reviewedAt = new Date();
    await payment.save();
    return res.json({ payment, ledger });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
