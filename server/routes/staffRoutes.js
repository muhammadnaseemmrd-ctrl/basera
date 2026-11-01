const express = require("express");
const { body } = require("express-validator");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const User = require("../models/User");
const StaffMember = require("../models/StaffMember");
const Notice = require("../models/Notice");
const ParentLink = require("../models/ParentLink");
const ParentAccess = require("../models/ParentAccess");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const clock = require("../services/clock");
const validate = require("../middleware/validate");
const { recordAudit } = require("../services/auditService");
const { buildTerminationNotice, toWhatsAppNumber } = require("../services/hostelOpsRules");
const { canManageHostel, residents, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, authorize("host", "admin"), requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};

const loadStaff = async (req, res) => {
  if (!isId(req.params.id)) {
    res.status(404).json({ message: "Staff member not found." });
    return null;
  }
  const staff = await StaffMember.findById(req.params.id);
  if (!staff) {
    res.status(404).json({ message: "Staff member not found." });
    return null;
  }
  if (!(await canManageHostel(req.user, staff.hostel))) {
    res.status(403).json({ message: "You do not manage this staff member's hostel." });
    return null;
  }
  return staff;
};

// Blocks must belong to the hostel — never trust client-supplied block ids.
const validBlocks = async (hostelId, blockIds = []) => {
  const ids = [...new Set(blockIds.map(String))].filter(isId);
  if (!ids.length) return [];
  return Block.find({ _id: { $in: ids }, hostelId }).lean();
};

router.get("/", async (req, res, next) => {
  try {
    if (!isId(req.query.hostelId) || !(await canManageHostel(req.user, req.query.hostelId))) {
      return res.status(403).json({ message: "You do not manage this hostel." });
    }
    const query = { hostel: req.query.hostelId };
    if (req.query.status) query.status = req.query.status;
    const results = await StaffMember.find(query).populate("blocks", "name").populate("user", "email").sort({ status: 1, name: 1 }).lean();
    return res.json({ results: results.map((s) => ({ ...s, id: String(s._id) })) });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  [
    body("hostelId").notEmpty(),
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("phone").trim().notEmpty().withMessage("Phone is required."),
    body("login.email").optional().isEmail(),
    body("login.password").optional().isLength({ min: 8 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const { hostelId, name, phone, cnic, role = "warden", login } = req.body;
      const blockIds = Array.isArray(req.body.blockIds) ? req.body.blockIds : [];
      if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) {
        return res.status(403).json({ message: "You do not manage this hostel." });
      }
      const blocks = await validBlocks(hostelId, blockIds);
      if (blocks.length !== [...new Set(blockIds.map(String))].length) {
        return res.status(400).json({ message: "One or more blocks do not belong to this hostel." });
      }

      let user = null;
      if (login?.email) {
        if (role !== "warden" && role !== "assistant_warden") {
          return res.status(400).json({ message: "Only wardens can be given a login." });
        }
        const exists = await User.findOne({ $or: [{ email: login.email }, { phone }] });
        if (exists) return res.status(409).json({ message: "Email or phone already registered." });
        user = await User.create({ name, email: login.email, phone, password: login.password, role: "warden", isVerified: true });
      }

      if (user && blocks.length) {
        const taken = blocks.find((b) => b.wardenId && String(b.wardenId) !== String(user._id));
        if (taken) {
          await User.deleteOne({ _id: user._id });
          return res.status(409).json({ message: `Block "${taken.name}" already has a warden. Terminate or reassign them first.` });
        }
        await Block.updateMany({ _id: { $in: blocks.map((b) => b._id) }, hostelId }, { wardenId: user._id });
      }

      const staff = await StaffMember.create({
        hostel: hostelId,
        blocks: blocks.map((b) => b._id),
        user: user ? user._id : null,
        name,
        phone,
        cnic,
        role,
        createdBy: uid(req.user)
      });
      await audit(req, { action: "staff.created", entityType: "StaffMember", entityId: staff._id, metadata: { role, hostelId } });
      return res.status(201).json({ staff });
    } catch (error) {
      return next(error);
    }
  }
);

router.put("/:id", async (req, res, next) => {
  try {
    const staff = await loadStaff(req, res);
    if (!staff) return;
    if (staff.status === "terminated") return res.status(409).json({ message: "A terminated staff record cannot be edited." });
    ["name", "phone", "cnic", "role"].forEach((f) => {
      if (req.body[f] !== undefined) staff[f] = req.body[f];
    });
    if (Array.isArray(req.body.blockIds)) {
      const blocks = await validBlocks(staff.hostel, req.body.blockIds);
      if (blocks.length !== [...new Set(req.body.blockIds.map(String))].length) {
        return res.status(400).json({ message: "One or more blocks do not belong to this hostel." });
      }
      if (staff.user) {
        const taken = blocks.find((b) => b.wardenId && String(b.wardenId) !== String(staff.user));
        if (taken) return res.status(409).json({ message: `Block "${taken.name}" already has a warden.` });
        await Block.updateMany({ hostelId: staff.hostel, wardenId: staff.user }, { wardenId: null });
        await Block.updateMany({ _id: { $in: blocks.map((b) => b._id) }, hostelId: staff.hostel }, { wardenId: staff.user });
      }
      staff.blocks = blocks.map((b) => b._id);
    }
    await staff.save();
    return res.json({ staff });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/suspend", async (req, res, next) => {
  try {
    const staff = await loadStaff(req, res);
    if (!staff) return;
    if (!String(req.body.reason || "").trim()) return res.status(400).json({ message: "A reason is required." });
    const updated = await StaffMember.findOneAndUpdate(
      { _id: staff._id, status: "active" },
      { status: "suspended", suspendedAt: clock.now(), suspensionReason: req.body.reason },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: "Only active staff can be suspended." });
    await audit(req, { action: "staff.suspended", entityType: "StaffMember", entityId: staff._id, metadata: { reason: req.body.reason } });
    return res.json({ staff: updated });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/reinstate", async (req, res, next) => {
  try {
    const staff = await loadStaff(req, res);
    if (!staff) return;
    const updated = await StaffMember.findOneAndUpdate(
      { _id: staff._id, status: "suspended" },
      { status: "active", $unset: { suspendedAt: 1, suspensionReason: 1 } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: "Only suspended staff can be reinstated." });
    await audit(req, { action: "staff.reinstated", entityType: "StaffMember", entityId: staff._id });
    return res.json({ staff: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * Terminate a staff member and warn every resident (and their parents) not to
 * pay or deal with them. Atomic on the status transition so a double-click or
 * concurrent request cannot send the notice twice.
 */
router.post("/:id/terminate", async (req, res, next) => {
  try {
    const staff = await loadStaff(req, res);
    if (!staff) return;
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A termination reason is required." });

    const now = clock.now();
    const terminated = await StaffMember.findOneAndUpdate(
      { _id: staff._id, status: { $ne: "terminated" } },
      { status: "terminated", terminatedAt: now, terminationReason: reason, terminatedBy: uid(req.user) },
      { new: true }
    );
    if (!terminated) return res.status(409).json({ message: "This staff member is already terminated." });

    // 1. Revoke access: unassign blocks; disable the login unless they still work somewhere else.
    if (terminated.user) {
      await Block.updateMany({ hostelId: terminated.hostel, wardenId: terminated.user }, { wardenId: null });
      const stillEmployed = await StaffMember.exists({ user: terminated.user, status: { $in: ["active", "suspended"] }, _id: { $ne: terminated._id } });
      if (!stillEmployed) await User.updateOne({ _id: terminated.user }, { isBanned: true });
    }

    // 2. Decide who must be warned.
    const hostel = await Hostel.findById(terminated.hostel).select("name contactPhone").lean();
    const blocks = terminated.blocks?.length ? await Block.find({ _id: { $in: terminated.blocks } }).lean() : [];
    const scope = req.body.scope === "hostel" || !blocks.length ? "hostel" : "block";
    const targets = scope === "block" ? blocks.map((b) => ({ block: b._id, blockName: b.name })) : [{ block: null, blockName: null }];

    const notices = [];
    const warnedStudents = new Map();
    for (const target of targets) {
      const rows = await residents({ hostelId: terminated.hostel, blockId: target.block || undefined });
      rows.filter((r) => r.student).forEach((r) => warnedStudents.set(String(r.student._id), r.student));

      const { title, message } = buildTerminationNotice({
        staffName: terminated.name,
        staffRole: terminated.role,
        hostelName: hostel?.name || "the hostel",
        blockName: target.blockName,
        terminatedAt: now,
        reason: req.body.shareReason === false ? "" : reason,
        contactPhone: hostel?.contactPhone
      });
      const notice = await Notice.create({
        hostel: terminated.hostel,
        block: target.block,
        type: "staff_termination",
        title,
        message,
        staff: terminated._id,
        audience: ["students", "parents", "staff"],
        pinned: true,
        createdBy: uid(req.user),
        createdByName: req.user.name,
        studentRecipients: rows.length
      });
      notices.push(notice);
    }
    await StaffMember.updateOne({ _id: terminated._id }, { terminationNotice: notices[0]?._id });

    // 3. Parents of the warned students (linked accounts + share-link guardians + emergency contacts).
    const studentIds = [...warnedStudents.keys()];
    const links = studentIds.length ? await ParentLink.find({ student: { $in: studentIds }, status: { $in: ["active", "pending"] } }).lean() : [];
    const accesses = studentIds.length ? await ParentAccess.find({ student: { $in: studentIds }, status: "active" }).select("student parentName parentPhone").lean() : [];
    const studentUsers = studentIds.length ? await User.find({ _id: { $in: studentIds } }).select("name phone emergencyContact").lean() : [];

    const parentUserIds = links.filter((l) => l.parent).map((l) => l.parent);
    const headline = notices[0];
    const push = [...studentIds, ...parentUserIds.map(String)];
    if (push.length) {
      await User.updateMany({ _id: { $in: push } }, { $push: { notifications: { message: headline.title, read: false, createdAt: now } } });
    }

    // 4. WhatsApp broadcast list for the head office to send in one click each (no WhatsApp API needed).
    const text = `${headline.title}\n\n${headline.message}`;
    const seen = new Set();
    const whatsapp = [];
    const add = (audience, name, phone) => {
      const number = toWhatsAppNumber(phone);
      if (!number || seen.has(number)) return;
      seen.add(number);
      whatsapp.push({ audience, name, phone, link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` });
    };
    studentUsers.forEach((s) => {
      add("student", s.name, s.phone);
      if (s.emergencyContact?.phone) add("parent", s.emergencyContact.name || `Guardian of ${s.name}`, s.emergencyContact.phone);
    });
    links.forEach((l) => add("parent", l.parentName || "Parent", l.parentPhone));
    accesses.forEach((a) => add("parent", a.parentName || "Parent", a.parentPhone));

    const parentRecipients = whatsapp.filter((w) => w.audience === "parent").length;
    await Notice.updateMany({ _id: { $in: notices.map((n) => n._id) } }, { parentRecipients: Math.ceil(parentRecipients / notices.length) });

    await audit(req, {
      action: "staff.terminated",
      entityType: "StaffMember",
      entityId: terminated._id,
      metadata: { reason, scope, students: studentIds.length, parents: parentRecipients }
    });

    return res.json({
      staff: terminated,
      notices,
      recipients: { students: studentIds.length, parents: parentRecipients, inAppNotified: push.length },
      whatsapp: whatsapp.slice(0, 500)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
