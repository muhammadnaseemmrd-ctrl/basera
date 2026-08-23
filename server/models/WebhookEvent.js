const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["jazzcash", "easypaisa", "stripe", "manual"], required: true },
    eventId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    bookingId: String,
    paymentRef: String,
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ["received", "processed", "duplicate", "failed"], default: "received" },
    hash: String,
    payload: mongoose.Schema.Types.Mixed,
    response: mongoose.Schema.Types.Mixed,
    processedAt: Date
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ bookingId: 1, provider: 1 });

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
