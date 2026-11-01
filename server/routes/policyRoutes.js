const express = require("express");
const HostelPolicy = require("../models/HostelPolicy");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const { protect } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const { resolvePolicy, validatePolicyInput, describePolicy, BLOCK_KEYS } = require("../services/policyRules");
const { canManageHostel, wardenBlocks, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};

const view = (policy, blocks) => {
  const hostel = resolvePolicy(policy, null);
  return {
    hostel: { ...hostel, preview: describePolicy(hostel.values, "A student") },
    blocks: blocks.map((b) => {
      const eff = resolvePolicy(policy, b._id);
      const override = (policy?.blockOverrides || []).find((o) => String(o.block) === String(b._id)) || null;
      return { id: String(b._id), name: b.name, override, ...eff, preview: describePolicy(eff.values, `A student in ${b.name}`) };
    })
  };
};

// Head office: full policy + effective values. Warden: effective values for own blocks only.
router.get("/:hostelId", async (req, res, next) => {
  try {
    const { hostelId } = req.params;
    if (!isId(hostelId)) return res.status(404).json({ message: "Hostel not found." });
    const policy = await HostelPolicy.findOne({ hostel: hostelId }).lean();
    if (await canManageHostel(req.user, hostelId)) {
      const blocks = await Block.find({ hostelId }).select("name").sort({ name: 1 }).lean();
      return res.json({ editable: true, policy: policy || null, ...view(policy, blocks) });
    }
    const own = (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId));
    if (!own.length) return res.status(403).json({ message: "No access to this hostel's policy." });
    const v = view(policy, own);
    return res.json({ editable: false, blocks: v.blocks.map(({ override, ...rest }) => rest) });
  } catch (error) {
    return next(error);
  }
});

const SECTIONS = {
  leaveNotice: ["days", "shortNoticeAction", "shortNoticeChargeDays", "wardenCanApprove"],
  lateFee: ["enabled", "dueDayOfMonth", "finePerDay", "graceDays", "maxFine", "stopsWhenRentPaid"],
  visitors: ["enabled", "start", "end", "curfew"]
};
const RESETTABLE = [...Object.entries(SECTIONS).flatMap(([s, keys]) => keys.map((k) => `${s}.${k}`)), "feeAllocation"];

/**
 * Head office only. Partial update: only sent keys change; `reset: ["lateFee.finePerDay"]`
 * reverts a key to the platform default; `blockOverrides` (when sent) replaces the list.
 * Applies to invoices/notices created after this point — issued ones keep their snapshot.
 */
router.put("/:hostelId", async (req, res, next) => {
  try {
    const { hostelId } = req.params;
    if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) return res.status(403).json({ message: "Only the head office can change this hostel's policy." });
    if (!(await Hostel.exists({ _id: hostelId }))) return res.status(404).json({ message: "Hostel not found." });
    const errors = validatePolicyInput(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    const $set = { updatedBy: uid(req.user) };
    const $unset = {};
    for (const [section, keys] of Object.entries(SECTIONS)) {
      for (const key of keys) {
        if (req.body[section] && req.body[section][key] !== undefined) $set[`${section}.${key}`] = req.body[section][key];
      }
    }
    if (req.body.feeAllocation !== undefined) $set.feeAllocation = req.body.feeAllocation;
    for (const path of Array.isArray(req.body.reset) ? req.body.reset : []) {
      if (!RESETTABLE.includes(path)) return res.status(400).json({ message: `Cannot reset "${path}".` });
      if ($set[path] !== undefined) return res.status(400).json({ message: `"${path}" is both set and reset.` });
      $unset[path] = 1;
    }
    if (Array.isArray(req.body.blockOverrides)) {
      const ids = req.body.blockOverrides.map((o) => String(o.block));
      if (ids.some((id) => !isId(id)) || new Set(ids).size !== ids.length) return res.status(400).json({ message: "Each block override needs a distinct, valid block." });
      const found = await Block.countDocuments({ _id: { $in: ids }, hostelId });
      if (found !== ids.length) return res.status(400).json({ message: "A block override refers to a block outside this hostel." });
      $set.blockOverrides = req.body.blockOverrides.map((o) => {
        const clean = { block: o.block };
        BLOCK_KEYS.forEach((k) => {
          if (o[k] !== undefined && o[k] !== null) clean[k] = o[k];
        });
        return clean;
      });
    }

    const before = await HostelPolicy.findOne({ hostel: hostelId }).lean();
    const update = { $set, $setOnInsert: { hostel: hostelId } };
    if (Object.keys($unset).length) update.$unset = $unset;
    const policy = await HostelPolicy.findOneAndUpdate({ hostel: hostelId }, update, { returnDocument: "after", upsert: true, runValidators: true }).lean();
    await audit(req, { action: "policy.updated", entityType: "HostelPolicy", entityId: policy._id, metadata: { hostelId, before: before || null, after: policy, reason: req.body.reason || null } });
    const blocks = await Block.find({ hostelId }).select("name").sort({ name: 1 }).lean();
    return res.json({ editable: true, policy, ...view(policy, blocks) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
