const express = require("express");
const mongoose = require("mongoose");
const GlobalAlert = require("../models/GlobalAlert");
const AlertAcknowledgement = require("../models/AlertAcknowledgement");
const PlatformSetting = require("../models/PlatformSetting");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const { recordAudit } = require("../services/auditService");
const { demoGlobalAlerts, demoPlatformSettings, demoAlertAcknowledgements, hoursFromNow } = require("../data/demoRuntime");

const router = express.Router();

const isDbReady = () => mongoose.connection.readyState === 1;

const activeFilter = (alert) =>
  alert.status === "published" &&
  (!alert.expiresAt || new Date(alert.expiresAt).getTime() > Date.now());

const publicAlert = (alert) => {
  const source = alert.toObject ? alert.toObject() : alert;
  return {
    ...source,
    id: String(source._id || source.id),
    submittedByName: source.submittedByName || source.submittedBy?.name || "Basera community"
  };
};

const matchesTarget = (alert, query = {}) => {
  const audience = query.audience || "students";
  const audienceMatches = alert.audience === "all" || alert.audience === audience || (audience === "hosts" && alert.audience === "hosts");
  const cityMatches = !alert.city || (query.city && String(alert.city).toLowerCase() === String(query.city).toLowerCase());
  const universityMatches = !alert.university || (query.university && String(alert.university).toLowerCase() === String(query.university).toLowerCase());
  const hostelMatches = !alert.hostel || (query.hostelId && String(alert.hostel) === String(query.hostelId));
  return audienceMatches && cityMatches && universityMatches && hostelMatches;
};

const optionalTargetCondition = (field, value) => {
  const empty = [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }];
  return value ? { $or: [...empty, { [field]: new RegExp(`^${String(value)}$`, "i") }] } : { $or: empty };
};

const publishFields = (hours = demoPlatformSettings.alertDisplayHours) => ({
  status: "published",
  publishedAt: new Date(),
  expiresAt: new Date(Date.now() + Number(hours || 48) * 60 * 60 * 1000)
});

const getAlertDisplayHours = async () => {
  if (!isDbReady()) return demoPlatformSettings.alertDisplayHours;
  const record = await PlatformSetting.findOne({ key: "platformControls" });
  return Number(record?.value?.alertDisplayHours || demoPlatformSettings.alertDisplayHours || 48);
};

const sanitizePayload = (body = {}) => ({
  title: String(body.title || "").trim(),
  message: String(body.message || "").trim(),
  category: body.category || "general",
  severity: body.severity || "warning",
  audience: body.audience || "all",
  hostelName: body.hostelName,
  hostel: body.hostel || body.hostelId || undefined,
  city: body.city ? String(body.city).trim() : undefined,
  university: body.university ? String(body.university).trim() : undefined,
  targetTags: Array.isArray(body.targetTags) ? body.targetTags.filter(Boolean) : [],
  ackRequired: Boolean(body.ackRequired)
});

router.get("/active", async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        results: demoGlobalAlerts.filter(activeFilter).filter((alert) => matchesTarget(alert, req.query)).map(publicAlert),
        demo: true
      });
    }

    const results = await GlobalAlert.find({
      status: "published",
      $and: [
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
        { $or: [{ audience: "all" }, { audience: req.query.audience || "students" }] },
        optionalTargetCondition("city", req.query.city),
        optionalTargetCondition("university", req.query.university)
      ],
      ...(req.query.hostelId ? { $or: [{ hostel: { $exists: false } }, { hostel: null }, { hostel: req.query.hostelId }] } : {})
    })
      .sort({ severity: -1, publishedAt: -1 })
      .limit(5);
    return res.json({ results: results.map(publicAlert) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    if (!payload.title || !payload.message) return res.status(400).json({ message: "Alert title and message are required." });
    const role = canonicalRole(req.user.role);
    const submittedBy = {
      submittedBy: req.user._id || req.user.id,
      submittedByName: req.user.name || req.user.email || "Community member",
      submittedByRole: role
    };
    const adminPublishing = role === "admin";
    const displayHours = await getAlertDisplayHours();

    if (!isDbReady()) {
      const alert = {
        id: `alert-${Date.now()}`,
        ...payload,
        ...submittedBy,
        status: adminPublishing ? "published" : "pending",
        publishedAt: adminPublishing ? new Date().toISOString() : undefined,
        expiresAt: adminPublishing ? hoursFromNow(displayHours) : undefined,
        createdAt: new Date().toISOString()
      };
      demoGlobalAlerts.unshift(alert);
      await recordAudit(req, { action: adminPublishing ? "alert.published" : "alert.submitted", entityType: "GlobalAlert", entityId: alert.id, metadata: { audience: alert.audience, city: alert.city, university: alert.university } });
      return res.status(201).json({ alert: publicAlert(alert), requiresApproval: !adminPublishing, demo: true });
    }

    const alert = await GlobalAlert.create({
      ...payload,
      ...submittedBy,
      ...(adminPublishing ? publishFields(displayHours) : { status: "pending" })
    });
    await recordAudit(req, { action: adminPublishing ? "alert.published" : "alert.submitted", entityType: "GlobalAlert", entityId: alert._id, metadata: { audience: alert.audience, city: alert.city, university: alert.university } });
    return res.status(201).json({ alert: publicAlert(alert), requiresApproval: !adminPublishing });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        results: demoGlobalAlerts
          .filter((alert) => alert.status !== "expired")
          .map(publicAlert),
        demo: true
      });
    }

    const results = await GlobalAlert.find({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }, { status: "pending" }]
    })
      .populate("submittedBy approvedBy", "name email role")
      .sort({ status: 1, createdAt: -1 })
      .limit(100);
    return res.json({ results: results.map(publicAlert) });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin", protect, authorize("admin"), async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    if (!payload.title || !payload.message) return res.status(400).json({ message: "Alert title and message are required." });
    const displayHours = await getAlertDisplayHours();
    if (!isDbReady()) {
      const alert = {
        id: `alert-admin-${Date.now()}`,
        ...payload,
        submittedBy: req.user.id,
        submittedByName: req.user.name || "Super Admin",
        submittedByRole: "admin",
        status: "published",
        publishedAt: new Date().toISOString(),
        expiresAt: hoursFromNow(displayHours),
        createdAt: new Date().toISOString()
      };
      demoGlobalAlerts.unshift(alert);
      await recordAudit(req, { action: "alert.published", entityType: "GlobalAlert", entityId: alert.id, metadata: { source: "admin" } });
      return res.status(201).json({ alert: publicAlert(alert), demo: true });
    }

    const alert = await GlobalAlert.create({
      ...payload,
      submittedBy: req.user._id || req.user.id,
      submittedByName: req.user.name,
      submittedByRole: "admin",
      ...publishFields(displayHours)
    });
    await recordAudit(req, { action: "alert.published", entityType: "GlobalAlert", entityId: alert._id, metadata: { source: "admin" } });
    return res.status(201).json({ alert: publicAlert(alert) });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/:id/approve", protect, authorize("admin"), async (req, res, next) => {
  try {
    const hours = Number(req.body.displayHours || (await getAlertDisplayHours()));
    if (!isDbReady()) {
      const alert = demoGlobalAlerts.find((item) => item.id === req.params.id) || demoGlobalAlerts[0];
      Object.assign(alert, {
        status: "published",
        adminNote: req.body.adminNote,
        approvedBy: req.user.id,
        publishedAt: new Date().toISOString(),
        expiresAt: hoursFromNow(hours)
      });
      await recordAudit(req, { action: "alert.approved", entityType: "GlobalAlert", entityId: alert.id, metadata: { displayHours: hours } });
      return res.json({ alert: publicAlert(alert), demo: true });
    }

    const alert = await GlobalAlert.findByIdAndUpdate(
      req.params.id,
      {
        ...publishFields(hours),
        approvedBy: req.user._id || req.user.id,
        adminNote: req.body.adminNote
      },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found." });
    await recordAudit(req, { action: "alert.approved", entityType: "GlobalAlert", entityId: alert._id, metadata: { displayHours: hours } });
    return res.json({ alert: publicAlert(alert) });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/:id/reject", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const alert = demoGlobalAlerts.find((item) => item.id === req.params.id) || demoGlobalAlerts[0];
      Object.assign(alert, { status: "rejected", adminNote: req.body.adminNote, approvedBy: req.user.id });
      await recordAudit(req, { action: "alert.rejected", entityType: "GlobalAlert", entityId: alert.id });
      return res.json({ alert: publicAlert(alert), demo: true });
    }

    const alert = await GlobalAlert.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", adminNote: req.body.adminNote, approvedBy: req.user._id || req.user.id },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found." });
    await recordAudit(req, { action: "alert.rejected", entityType: "GlobalAlert", entityId: alert._id });
    return res.json({ alert: publicAlert(alert) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/ack", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const exists = demoAlertAcknowledgements.find((item) => item.alert === req.params.id && item.user === req.user.id);
      const acknowledgement = exists || {
        id: `ack-${Date.now()}`,
        alert: req.params.id,
        user: req.user.id,
        channel: req.body.channel || "dashboard",
        acknowledgedAt: new Date().toISOString()
      };
      if (!exists) demoAlertAcknowledgements.push(acknowledgement);
      await recordAudit(req, { action: "alert.acknowledged", entityType: "GlobalAlert", entityId: req.params.id });
      return res.json({ acknowledged: true, acknowledgement, demo: true });
    }

    const acknowledgement = await AlertAcknowledgement.findOneAndUpdate(
      { alert: req.params.id, user: req.user._id || req.user.id },
      { channel: req.body.channel || "dashboard", acknowledgedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await recordAudit(req, { action: "alert.acknowledged", entityType: "GlobalAlert", entityId: req.params.id });
    return res.json({ acknowledged: true, acknowledgement });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
