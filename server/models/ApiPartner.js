const mongoose = require("mongoose");

const apiPartnerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    tier: { type: String, enum: ["FREE", "DEVELOPER", "ENTERPRISE"], default: "FREE" },
    apiKeyHash: String,
    dailyLimit: { type: Number, default: 100 },
    status: { type: String, enum: ["active", "paused", "revoked"], default: "active" },
    lastUsedAt: Date
  },
  { timestamps: true }
);

apiPartnerSchema.index({ email: 1 });
apiPartnerSchema.index({ status: 1, tier: 1 });

module.exports = mongoose.model("ApiPartner", apiPartnerSchema);
