const mongoose = require("mongoose");

const aiAuditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userRef: String,
    userRole: String,
    feature: { type: String, required: true, index: true },
    inputHash: String,
    output: mongoose.Schema.Types.Mixed,
    sources: [{ type: String }],
    confidence: { type: Number, default: 0.7 },
    provider: { type: String, default: "template-fallback" },
    guardrails: [{ type: String }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIAuditLog", aiAuditLogSchema);
