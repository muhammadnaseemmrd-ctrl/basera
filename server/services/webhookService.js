const crypto = require("crypto");
const mongoose = require("mongoose");
const WebhookEvent = require("../models/WebhookEvent");
const { generateHash } = require("./paymentService");

const safeJson = (value) => {
  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString("utf8"));
    } catch {
      return {};
    }
  }
  return value || {};
};

const stripeSignatureValid = ({ rawBody, signature, secret }) => {
  if (!secret) return true;
  if (!signature || !rawBody) return false;
  const parts = Object.fromEntries(String(signature).split(",").map((part) => part.split("=")));
  if (!parts.t || !parts.v1) return false;
  const payload = `${parts.t}.${Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : JSON.stringify(rawBody)}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== parts.v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
};

const jazzCashSignatureValid = (payload) => {
  const secureHash = payload.pp_SecureHash;
  const clone = { ...payload };
  delete clone.pp_SecureHash;
  if (!process.env.JAZZCASH_INTEGRITY_SALT) return true;
  if (!secureHash) return false;
  return secureHash === generateHash(clone, process.env.JAZZCASH_INTEGRITY_SALT);
};

const eventKey = ({ provider, eventId }) => `${provider}:${eventId}`;

const registerWebhookEvent = async ({ provider, eventId, bookingId, paymentRef, verified, payload, hash }) => {
  const idempotencyKey = eventKey({ provider, eventId });
  if (mongoose.connection.readyState !== 1) {
    return { event: { provider, eventId, idempotencyKey, bookingId, paymentRef, verified, status: "processed", payload }, duplicate: false, demo: true };
  }

  try {
    const event = await WebhookEvent.create({
      provider,
      eventId,
      idempotencyKey,
      bookingId,
      paymentRef,
      verified,
      hash,
      payload,
      status: verified ? "processed" : "failed",
      processedAt: verified ? new Date() : undefined
    });
    return { event, duplicate: false };
  } catch (error) {
    if (error.code === 11000) {
      const event = await WebhookEvent.findOne({ idempotencyKey });
      return { event, duplicate: true };
    }
    throw error;
  }
};

module.exports = {
  safeJson,
  stripeSignatureValid,
  jazzCashSignatureValid,
  registerWebhookEvent
};
