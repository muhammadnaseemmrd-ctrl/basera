const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true, trim: true },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    status: { type: String, enum: ["success", "failed", "pending"], default: "success" },
    metadata: mongoose.Schema.Types.Mixed,
    ip: String
  },
  { timestamps: true }
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
