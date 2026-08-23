const express = require("express");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Review = require("../models/Review");
const MaintenanceTicket = require("../models/MaintenanceTicket");
const GlobalAlert = require("../models/GlobalAlert");
const LedgerEntry = require("../models/LedgerEntry");
const JobLog = require("../models/JobLog");
const { protect, authorize } = require("../middleware/auth");
const { calculateListingQuality } = require("../services/listingQualityService");
const { recordAudit } = require("../services/auditService");
const { extractDocumentText, containsCnicPattern, isProviderConfigured } = require("../services/ocrService");
const { users, hostels, rooms, reviews } = require("../data/mockData");
const { demoAuditLogs, demoMaintenanceTickets, demoGlobalAlerts } = require("../data/demoRuntime");

const router = express.Router();

const isDbReady = () => mongoose.connection.readyState === 1;

// Identity-style document types worth running OCR/CNIC sanity checks against.
// Property/license proofs don't carry a CNIC number so we skip OCR for those.
const ID_DOCUMENT_TYPES = new Set(["cnic", "cnic_front", "cnic_back", "identity", "identityDocument"]);

/**
 * Builds the metadata-only document check result (unchanged from before),
 * then -- only when OCR_API_KEY is configured -- additionally runs real OCR
 * text extraction against the document image and layers on an extractedText
 * field plus a CNIC-pattern sanity flag. When OCR isn't configured this
 * resolves synchronously-equivalent (no network calls) and the returned
 * shape is identical to the pre-OCR behaviour aside from ocrProvider being
 * left at its previous "scan_passed"/"manual_review" heuristic.
 */
const documentScan = async (document = {}, owner = {}) => {
  const base = {
    id: `${owner.id || owner._id || owner.email || "doc"}-${document.type || "document"}`,
    ownerId: owner.id || String(owner._id || ""),
    ownerName: owner.name || owner.email || "Unknown user",
    ownerRole: owner.role || "host",
    type: document.type || document.label || "document",
    originalName: document.originalName || document.url || "Uploaded document",
    url: document.url,
    status: document.status || "pending",
    ocrStatus: document.url ? "scan_passed" : "manual_review",
    confidence: document.url ? 92 : 72,
    flags: document.url ? [] : ["Document URL missing"],
    ocrProvider: isProviderConfigured() ? (process.env.OCR_PROVIDER || "google-vision") : "metadata-only"
  };

  if (!isProviderConfigured() || !document.url || !ID_DOCUMENT_TYPES.has(base.type)) {
    return base;
  }

  const extractedText = await extractDocumentText(document.url);
  if (extractedText === null) {
    // OCR unavailable/failed for this document -- keep metadata-only result unchanged.
    return base;
  }

  const cnicDetected = containsCnicPattern(extractedText);
  return {
    ...base,
    ocrExtractedText: extractedText.slice(0, 500),
    cnicPatternDetected: cnicDetected,
    flags: cnicDetected ? base.flags : [...base.flags, "OCR text does not contain a recognizable CNIC pattern -- verify manually."]
  };
};

const demoDocumentChecks = async () => {
  const userDocs = await Promise.all(users.flatMap((user) => (user.verificationDocuments || []).map((document) => documentScan(document, user))));
  const hostDocs = await Promise.all(
    hostels.flatMap((hostel) => {
      const verification = hostel.ownerVerification || {};
      const owner = users.find((user) => user.id === hostel.owner) || users[1];
      return ["identityDocument", "propertyDocument", "licenseDocument"].filter((key) => verification[key]).map((key) => documentScan({ ...verification[key], type: key }, owner));
    })
  );
  const fallback = await Promise.all([
    documentScan({ type: "cnic_front", originalName: "ali-cnic-front.pdf", url: "/uploads/demo/ali-cnic-front.pdf" }, users[0]),
    documentScan({ type: "property_proof", originalName: "cozy-f10-property.pdf", url: "/uploads/demo/cozy-f10-property.pdf" }, users[1])
  ]);
  return [...userDocs, ...hostDocs, ...fallback];
};

router.get("/health", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        status: "demo",
        checks: [
          { key: "database", label: "MongoDB", status: "demo", detail: "MONGO_URI not configured; demo data is active." },
          { key: "email", label: "Email Provider", status: process.env.SMTP_HOST ? "ok" : "missing", detail: process.env.SMTP_HOST ? "SMTP configured" : "SMTP_HOST is not set." },
          { key: "payments", label: "Payment Gateways", status: process.env.STRIPE_SECRET_KEY ? "ok" : "demo", detail: "JazzCash/Easypaisa/Stripe can run in demo until credentials are added." },
          { key: "alerts", label: "Active Alerts", status: "ok", detail: `${demoGlobalAlerts.filter((item) => item.status === "published").length} published alerts` },
          { key: "maintenance", label: "Maintenance Queue", status: "ok", detail: `${demoMaintenanceTickets.filter((item) => item.status !== "closed").length} open tickets` }
        ],
        demo: true
      });
    }

    const [pendingAlerts, openTickets, pendingReviews, ledgerCount] = await Promise.all([
      GlobalAlert.countDocuments({ status: "pending" }),
      MaintenanceTicket.countDocuments({ status: { $nin: ["closed", "resolved"] } }),
      Review.countDocuments({ moderationStatus: { $in: ["pending", "flagged"] } }),
      LedgerEntry.countDocuments()
    ]);
    return res.json({
      status: "ok",
      checks: [
        { key: "database", label: "MongoDB", status: "ok", detail: "Connected" },
        { key: "email", label: "Email Provider", status: process.env.SMTP_HOST ? "ok" : "missing", detail: process.env.SMTP_HOST ? "SMTP configured" : "SMTP_HOST is not set." },
        { key: "alerts", label: "Pending Alerts", status: pendingAlerts ? "review" : "ok", detail: `${pendingAlerts} pending` },
        { key: "maintenance", label: "Maintenance Queue", status: openTickets ? "review" : "ok", detail: `${openTickets} open tickets` },
        { key: "reviews", label: "Review Moderation", status: pendingReviews ? "review" : "ok", detail: `${pendingReviews} pending/flagged` },
        { key: "ledger", label: "Ledger Events", status: ledgerCount ? "ok" : "review", detail: `${ledgerCount} ledger entries` }
      ]
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/audit-logs", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoAuditLogs.slice(0, 100), demo: true });
    const results = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/job-logs", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        results: [
          { id: "job-demo-1", name: "rent-reminders", status: "success", processed: 42, startedAt: new Date(Date.now() - 2 * 3600000).toISOString(), finishedAt: new Date(Date.now() - 2 * 3600000 + 4200).toISOString() },
          { id: "job-demo-2", name: "escrow-release", status: "success", processed: 6, startedAt: new Date(Date.now() - 86400000).toISOString(), finishedAt: new Date(Date.now() - 86400000 + 3400).toISOString() }
        ],
        demo: true
      });
    }
    const results = await JobLog.find().sort({ startedAt: -1 }).limit(80).lean();
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/document-checks", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: await demoDocumentChecks(), demo: true });
    const usersWithDocs = await User.find({ "verificationDocuments.0": { $exists: true } }).select("name email role verificationDocuments").limit(100);
    const results = await Promise.all(usersWithDocs.flatMap((user) => user.verificationDocuments.map((document) => documentScan(document, user))));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/document-checks/:id/review", protect, authorize("admin"), async (req, res, next) => {
  try {
    const status = req.body.status || "approved";
    const separatorIndex = req.params.id.indexOf("-");
    const ownerId = separatorIndex > 0 ? req.params.id.slice(0, separatorIndex) : null;
    const documentType = separatorIndex > 0 ? req.params.id.slice(separatorIndex + 1) : null;
    if (isDbReady() && ownerId && documentType) {
      await User.updateOne(
        { _id: ownerId, "verificationDocuments.type": documentType },
        { $set: { "verificationDocuments.$.status": status } }
      );
    }
    await recordAudit(req, {
      action: `document.${status}`,
      entityType: "VerificationDocument",
      entityId: req.params.id,
      metadata: { note: req.body.note }
    });
    return res.json({
      document: { id: req.params.id, status, reviewedAt: new Date().toISOString(), adminNote: req.body.note },
      demo: !isDbReady()
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/listing-quality", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const results = hostels.map((hostel) => ({
        id: hostel.id,
        name: hostel.name,
        city: hostel.city,
        ...calculateListingQuality({
          hostel,
          rooms: rooms.filter((room) => room.hostel === hostel.id),
          reviews: reviews.filter((review) => review.hostel === hostel.id)
        })
      }));
      return res.json({ results, demo: true });
    }

    const hostelDocs = await Hostel.find().limit(100);
    const [roomDocs, reviewDocs] = await Promise.all([Room.find().select("hostel"), Review.find().select("hostel moderationStatus")]);
    const results = hostelDocs.map((hostel) => ({
      id: String(hostel._id),
      name: hostel.name,
      city: hostel.city,
      ...calculateListingQuality({
        hostel,
        rooms: roomDocs.filter((room) => String(room.hostel) === String(hostel._id)),
        reviews: reviewDocs.filter((review) => String(review.hostel) === String(hostel._id) && ["approved", undefined].includes(review.moderationStatus))
      })
    }));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
