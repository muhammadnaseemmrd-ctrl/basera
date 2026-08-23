const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String
    },
    userAgent: String,
    active: { type: Boolean, default: true },
    lastSentAt: Date
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1, active: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
