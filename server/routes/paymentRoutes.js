const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const validate = require("../middleware/validate");
const { protect, authorize } = require("../middleware/auth");
const { initiateJazzCash, initiateEasypaisa, createStripeIntent, generateHash } = require("../services/paymentService");
const { safeJson, stripeSignatureValid, jazzCashSignatureValid, registerWebhookEvent } = require("../services/webhookService");
const { createLedgerTransaction, recordBookingPaymentLedger, recordCommissionLedger } = require("../services/ledgerService");
const Booking = require("../models/Booking");

const router = express.Router();

router.post(
  "/jazzcash/initiate",
  protect,
  [body("amount").isNumeric(), body("mobileNo").optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      res.json(await initiateJazzCash(req.body));
    } catch (error) {
      next(error);
    }
  }
);

router.post("/jazzcash/callback", async (req, res, next) => {
  try {
    const verified = jazzCashSignatureValid(req.body);
    const paymentStatus = req.body.pp_ResponseCode === "000" ? "paid" : "failed";
    const eventId = req.body.pp_TxnRefNo || req.body.pp_RetreivalReferenceNo || `JC-${req.body.pp_BillReference || Date.now()}`;
    const webhook = await registerWebhookEvent({
      provider: "jazzcash",
      eventId,
      bookingId: req.body.pp_BillReference,
      paymentRef: req.body.pp_TxnRefNo,
      verified,
      hash: req.body.pp_SecureHash,
      payload: req.body
    });

    if (!verified) return res.status(400).json({ received: true, verified, paymentStatus, message: "Invalid JazzCash signature." });
    if (webhook.duplicate) return res.json({ received: true, duplicate: true, verified, paymentStatus });

    if (mongoose.connection.readyState === 1 && req.body.pp_BillReference) {
      const booking = await Booking.findByIdAndUpdate(req.body.pp_BillReference, {
        paymentStatus,
        paymentRef: req.body.pp_TxnRefNo,
        status: paymentStatus === "paid" ? "confirmed" : "pending",
        escrowStatus: paymentStatus === "paid" ? "held" : "not_created",
        hostContactReleasedAt: paymentStatus === "paid" ? new Date() : undefined
      }, { new: true });
      if (booking && paymentStatus === "paid") {
        await recordBookingPaymentLedger({ booking, gateway: "jazzcash", paymentRef: req.body.pp_TxnRefNo, idempotencyKey: `jazzcash-paid-${eventId}` });
        await recordCommissionLedger({ booking, idempotencyKey: `jazzcash-commission-${eventId}` });
      }
    }

    res.json({ received: true, verified, paymentStatus });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/easypaisa/initiate",
  protect,
  [body("amount").isNumeric(), body("mobileNo").optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      res.json(await initiateEasypaisa(req.body));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/stripe/intent",
  protect,
  [body("amount").isNumeric()],
  validate,
  async (req, res, next) => {
    try {
      res.json(await createStripeIntent(req.body));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/stripe/create-intent",
  protect,
  [body("amount").isNumeric()],
  validate,
  async (req, res, next) => {
    try {
      res.json(await createStripeIntent(req.body));
    } catch (error) {
      next(error);
    }
  }
);

router.post("/late-fee/:bookingId", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || process.env.LATE_FEE_PKR || 500);
    if (amount <= 0) return res.status(400).json({ message: "Late fee amount must be greater than zero." });

    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        bookingId: req.params.bookingId,
        lateFee: amount,
        status: "overdue",
        invoiceUrl: `/api/v1/documents/late-fee/${req.params.bookingId}`,
        demo: true
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { $inc: { lateFee: amount }, $set: { status: "overdue" } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const ledger = await createLedgerTransaction({
      type: "LATE_FEE",
      booking,
      lines: [
        { account: "student_receivable", direction: "debit", amount, memo: "Late fee charged to student" },
        { account: "platform_service_fee", direction: "credit", amount, memo: "Late fee invoice generated" }
      ],
      idempotencyKey: req.body.idempotencyKey || `late-fee-${booking._id}-${Date.now()}`,
      memo: "Late fee applied after overdue grace period"
    });

    return res.status(201).json({ booking, ledger, invoiceUrl: `/api/v1/documents/late-fee/${booking._id}` });
  } catch (error) {
    return next(error);
  }
});

router.post("/refund/:paymentId", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const reason = req.body.reason || "Admin refund";
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        refunded: true,
        paymentId: req.params.paymentId,
        reason,
        refundReference: `RF-${Date.now()}`,
        demo: true
      });
    }

    const query = mongoose.Types.ObjectId.isValid(req.params.paymentId)
      ? { $or: [{ _id: req.params.paymentId }, { paymentRef: req.params.paymentId }] }
      : { paymentRef: req.params.paymentId };
    const booking = await Booking.findOneAndUpdate(
      query,
      { paymentStatus: "refunded", escrowStatus: "refunded", status: "cancelled", cancelReason: reason },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: "Payment or booking not found." });

    return res.json({
      refunded: true,
      booking,
      amount: booking.totalAmount,
      refundReference: req.body.refundReference || `RF-${booking._id}-${Date.now()}`,
      reason
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/easypaisa/callback", async (req, res, next) => {
  try {
    const eventId = req.body.transactionId || req.body.orderId || `EP-${req.body.bookingId || Date.now()}`;
    const expected = req.body.signature ? generateHash({ amount: req.body.amount, mobileNo: req.body.mobileNo, bookingId: req.body.bookingId }, process.env.EASYPAISA_HASH_KEY) : null;
    const verified = !process.env.EASYPAISA_HASH_KEY || (req.body.signature && req.body.signature === expected);
    const paymentStatus = String(req.body.status || req.body.responseCode || "").toLowerCase().includes("success") ? "paid" : "failed";
    const webhook = await registerWebhookEvent({
      provider: "easypaisa",
      eventId,
      bookingId: req.body.bookingId,
      paymentRef: req.body.transactionId,
      verified,
      hash: req.body.signature,
      payload: req.body
    });

    if (!verified) return res.status(400).json({ received: true, verified, paymentStatus, message: "Invalid Easypaisa signature." });
    if (webhook.duplicate) return res.json({ received: true, duplicate: true, verified, paymentStatus });

    if (mongoose.connection.readyState === 1 && req.body.bookingId) {
      const booking = await Booking.findByIdAndUpdate(req.body.bookingId, {
        paymentStatus,
        paymentRef: req.body.transactionId,
        status: paymentStatus === "paid" ? "confirmed" : "pending",
        escrowStatus: paymentStatus === "paid" ? "held" : "not_created",
        hostContactReleasedAt: paymentStatus === "paid" ? new Date() : undefined
      }, { new: true });
      if (booking && paymentStatus === "paid") {
        await recordBookingPaymentLedger({ booking, gateway: "easypaisa", paymentRef: req.body.transactionId, idempotencyKey: `easypaisa-paid-${eventId}` });
        await recordCommissionLedger({ booking, idempotencyKey: `easypaisa-commission-${eventId}` });
      }
    }

    res.json({ received: true, verified, paymentStatus });
  } catch (error) {
    next(error);
  }
});

router.post("/stripe/webhook", async (req, res, next) => {
  try {
    const event = safeJson(req.body);
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const verified = stripeSignatureValid({ rawBody, signature: req.headers["stripe-signature"], secret: process.env.STRIPE_WEBHOOK_SECRET });
    const intent = event.data?.object;
    const eventId = event.id || intent?.id || `ST-${Date.now()}`;
    const webhook = await registerWebhookEvent({
      provider: "stripe",
      eventId,
      bookingId: intent?.metadata?.bookingId,
      paymentRef: intent?.id,
      verified,
      payload: event
    });

    if (!verified) return res.status(400).json({ received: true, verified, message: "Invalid Stripe signature." });
    if (webhook.duplicate) return res.json({ received: true, duplicate: true, verified });

    if (mongoose.connection.readyState === 1 && event.type === "payment_intent.succeeded" && intent?.metadata?.bookingId) {
      const booking = await Booking.findByIdAndUpdate(intent.metadata.bookingId, {
        paymentStatus: "paid",
        paymentRef: intent.id,
        status: "confirmed",
        escrowStatus: "held",
        hostContactReleasedAt: new Date()
      }, { new: true });
      if (booking) {
        await recordBookingPaymentLedger({ booking, gateway: "stripe", paymentRef: intent.id, idempotencyKey: `stripe-paid-${eventId}` });
        await recordCommissionLedger({ booking, idempotencyKey: `stripe-commission-${eventId}` });
      }
    }
    res.json({ received: true, verified, mode: process.env.STRIPE_SECRET_KEY ? "live-ready" : "demo" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
