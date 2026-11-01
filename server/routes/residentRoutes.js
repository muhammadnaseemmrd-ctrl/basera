const express = require("express");
const Hostel = require("../models/Hostel");
const User = require("../models/User");
const { protect, authorize, canonicalRole, generateToken } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { authLimiter } = require("../middleware/rateLimit");
const { recordAudit } = require("../services/auditService");
const { toWhatsAppNumber } = require("../services/hostelOpsRules");
const { validateResident, CSV_TEMPLATE } = require("../services/residentRules");
const { admitResident, previewImport, commitImport, issueClaimCode, claimResident, AdmitError } = require("../services/residentService");
const { createInvoice, FeeError } = require("../services/feeService");
const { recordScope, staffScope, currentStay, isId, uid } = require("../services/hostelAccess");
const clock = require("../services/clock");

const router = express.Router();
const appUrl = () => (process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};

const sendError = (res, next, error) => {
  if (error instanceof AdmitError || error instanceof FeeError) return res.status(error.code).json({ message: error.message });
  return next(error);
};

// ---- public: a managed resident claims their login with the office's code ----
router.post("/claim", authLimiter, requireDb, async (req, res, next) => {
  try {
    const user = await claimResident(req.body);
    await recordAudit({ ...req, user }, { action: "resident.claimed", entityType: "User", entityId: user._id }).catch(() => {});
    return res.json({ token: generateToken(user), user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return sendError(res, next, error);
  }
});

router.use(protect, authorize("host", "admin", "warden"), requireDb);

// head office: any block of a hostel they manage; warden: rooms in their own block only
const roomAuthorizer = (req, hostelId) => (room) => recordScope(req.user, { hostelId, blockId: room.blockId || null });

router.get("/import/template.csv", (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="basera-residents-template.csv"');
  res.send(CSV_TEMPLATE);
});

/** Register one offline resident (full profile). Login optional — see design note D1. */
router.post("/", async (req, res, next) => {
  try {
    const { hostelId } = req.body;
    if (!isId(hostelId) || !(await Hostel.exists({ _id: hostelId }))) return res.status(404).json({ message: "Hostel not found." });
    if (!(await staffScope(req.user, { hostelId }))) return res.status(403).json({ message: "You do not manage this hostel." });
    const { value, errors } = validateResident(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const { result, blockId } = await admitResident({ hostelId, value, actor: req.user, actorRole: canonicalRole(req.user.role), authorizeRoom: roomAuthorizer(req, hostelId) });

    // optional first rent invoice (e.g. the current month)
    if (req.body.firstInvoice?.period) {
      const amount = Number.isInteger(req.body.firstInvoice.amount) ? req.body.firstInvoice.amount : value.monthlyRent;
      if (amount > 0) {
        const inv = await createInvoice({ hostel: hostelId, block: blockId, room: result.booking.roomId, bedIndex: value.bedIndex, student: result.student.id, booking: result.booking.id, title: `Rent ${req.body.firstInvoice.period}`, kind: "rent", period: req.body.firstInvoice.period, amount, createdBy: uid(req.user) });
        result.firstInvoice = { id: String(inv._id), amount: inv.amount, dueDate: inv.dueDate };
      }
    }
    await audit(req, { action: "resident.admitted", entityType: "Booking", entityId: result.booking.id, metadata: { hostelId, source: "offline", room: result.booking.room, bed: result.booking.bed, login: Boolean(result.tempPassword) } });
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, next, error);
  }
});

router.post("/import/preview", async (req, res, next) => {
  try {
    const { hostelId, csv } = req.body;
    if (!isId(hostelId) || !(await Hostel.exists({ _id: hostelId }))) return res.status(404).json({ message: "Hostel not found." });
    if (!(await staffScope(req.user, { hostelId }))) return res.status(403).json({ message: "You do not manage this hostel." });
    const out = await previewImport({ hostelId, csv, authorizeRoom: roomAuthorizer(req, hostelId) });
    if (out.error) return res.status(400).json({ message: out.error });
    // a warden with no rows they may import gets a 403, not a list of someone else's rooms
    if (canonicalRole(req.user.role) === "warden" && out.rows.length && out.rows.every((r) => r.errors.some((e) => /own block/.test(e)))) return res.status(403).json({ message: "You can only import students into your own block." });
    return res.json({ summary: out.summary, rows: out.rows.map(({ value, ...r }) => r) });
  } catch (error) {
    return next(error);
  }
});

router.post("/import/commit", async (req, res, next) => {
  try {
    const { hostelId, csv } = req.body;
    if (!isId(hostelId) || !(await Hostel.exists({ _id: hostelId }))) return res.status(404).json({ message: "Hostel not found." });
    if (!(await staffScope(req.user, { hostelId }))) return res.status(403).json({ message: "You do not manage this hostel." });
    const out = await commitImport({ hostelId, csv, actor: req.user, actorRole: canonicalRole(req.user.role), authorizeRoom: roomAuthorizer(req, hostelId) });
    if (out.status === 201) await audit(req, { action: "resident.imported", entityType: "Hostel", entityId: hostelId, metadata: { imported: out.body.imported, duplicatesSkipped: out.body.duplicatesSkipped } });
    return res.status(out.status).json(out.body);
  } catch (error) {
    return next(error);
  }
});

/** (Re)issue a login invite for a managed resident: code + WhatsApp link. */
router.post("/:studentId/invite", async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!isId(studentId)) return res.status(404).json({ message: "Student not found." });
    const stay = await currentStay(studentId);
    if (!stay || !(await recordScope(req.user, { hostelId: stay.hostelId, blockId: stay.blockId }))) return res.status(403).json({ message: "This student is not a resident of your hostel/block." });
    const student = await User.findById(studentId).select("name phone loginEnabled").lean();
    if (student.loginEnabled !== false) return res.status(409).json({ message: "This student already has a working login." });
    const issued = await issueClaimCode(studentId);
    const hostel = await Hostel.findById(stay.hostelId).select("name").lean();
    const text = `Assalam o Alaikum ${student.name}. ${hostel?.name || "Your hostel"} has set up your Basera account.\n1) Open ${appUrl()}/claim\n2) Enter your phone number and this code: ${issued.code} (valid 14 days)\n3) Choose a password.`;
    const number = toWhatsAppNumber(student.phone);
    await audit(req, { action: "resident.invited", entityType: "User", entityId: studentId });
    return res.json({ code: issued.code, expiresAt: clock.addDays(clock.now(), 14), whatsapp: number ? { number, text, link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` } : null });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
