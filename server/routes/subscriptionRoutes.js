const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const HostSubscriptionInvoice = require("../models/HostSubscriptionInvoice");
const { recordHostManagementFeeLedger } = require("../services/ledgerService");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const plans = [
  { tier: "STARTER", monthlyFee: 1000, commissionRate: 7, features: ["Management dashboard", "Basic listing", "Monthly statement"] },
  { tier: "PRO", monthlyFee: 2500, commissionRate: 5, features: ["Priority listing", "Growth coach", "Smart pricing"] },
  { tier: "PREMIUM", monthlyFee: 5000, commissionRate: 3, features: ["Dedicated support", "Featured ranking", "Advanced analytics"] }
];

const demoInvoices = [
  { id: "sub-demo-1", hostName: "Sara Malik", period: "2026-06", plan: "STARTER", amount: 1000, status: "issued", dueAt: new Date(Date.now() + 7 * 86400000).toISOString() },
  { id: "sub-demo-2", hostName: "Alex Rivera", period: "2026-06", plan: "PRO", amount: 2500, status: "paid", dueAt: new Date().toISOString() }
];

router.get("/plans", (req, res) => res.json({ results: plans }));

router.get("/host", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ plan: plans[0], invoices: demoInvoices, demo: true });
    const invoices = await HostSubscriptionInvoice.find({ host: req.user._id || req.user.id }).sort({ createdAt: -1 }).limit(24);
    return res.json({ plan: plans[0], invoices });
  } catch (error) {
    return next(error);
  }
});

router.post("/host/invoices", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const plan = plans.find((item) => item.tier === req.body.plan) || plans[0];
    const period = req.body.period || new Date().toISOString().slice(0, 7);
    const payload = {
      host: req.user._id,
      hostRef: req.user.id,
      hostName: req.user.name,
      plan: plan.tier,
      period,
      amount: Number(req.body.amount || plan.monthlyFee),
      dueAt: new Date(Date.now() + 7 * 86400000)
    };
    if (!isDbReady()) {
      const invoice = { id: `sub-${Date.now()}`, ...payload, status: "issued", dueAt: payload.dueAt.toISOString() };
      demoInvoices.unshift(invoice);
      return res.status(201).json({ invoice, demo: true });
    }
    const invoice = await HostSubscriptionInvoice.create(payload);
    const ledger = await recordHostManagementFeeLedger({ host: req.user, amount: invoice.amount, period });
    invoice.ledgerTransactionId = ledger.transactionId;
    await invoice.save();
    return res.status(201).json({ invoice, ledger });
  } catch (error) {
    return next(error);
  }
});

router.post("/host/invoices/:id/pay-manual", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const invoice = demoInvoices.find((item) => item.id === req.params.id) || demoInvoices[0];
      Object.assign(invoice, { status: "proof_submitted", manualPaymentRef: req.body.manualPaymentRef, proofUrl: req.body.proofUrl });
      return res.json({ invoice, demo: true });
    }
    const invoice = await HostSubscriptionInvoice.findOneAndUpdate(
      { _id: req.params.id, host: req.user._id || req.user.id },
      { status: "proof_submitted", manualPaymentRef: req.body.manualPaymentRef, proofUrl: req.body.proofUrl },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ invoice });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ plans, invoices: demoInvoices, demo: true });
    const invoices = await HostSubscriptionInvoice.find().populate("host").sort({ createdAt: -1 }).limit(200);
    return res.json({ plans, invoices });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
