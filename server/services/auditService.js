const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const { demoAuditLogs } = require("../data/demoRuntime");

const actorFromRequest = (req = {}) => ({
  actor: req.user?._id,
  actorName: req.user?.name || req.user?.email || "System",
  actorRole: req.user?.role || "system",
  ip: req.ip
});

const recordAudit = async (req, { action, entityType, entityId, status = "success", metadata = {} } = {}) => {
  if (!action) return null;

  const entry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...actorFromRequest(req),
    action,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    status,
    metadata,
    createdAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState !== 1) {
    demoAuditLogs.unshift(entry);
    return entry;
  }

  return AuditLog.create(entry);
};

module.exports = { recordAudit };
