const express = require("express");
const Notice = require("../models/Notice");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { staffScope, wardenBlocks, currentStay, parentStudentIds, canManageHostel, blockInHostel, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, requireDb);

const shape = (n, userId) => {
  const o = n.toObject ? n.toObject() : n;
  const { readBy, ...rest } = o;
  return { ...rest, id: String(o._id), read: (readBy || []).some((id) => String(id) === String(userId)) };
};

/** Notices visible for one stay (hostel-wide + that block), newest/pinned first. */
async function noticesForStay(stay, audience) {
  if (!stay?.hostelId) return [];
  const blockClause = stay.blockId ? { $in: [null, stay.blockId] } : null;
  return Notice.find({ hostel: stay.hostelId, block: blockClause, audience })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(50);
}

router.get("/my", async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    let notices = [];
    if (role === "student") {
      notices = await noticesForStay(await currentStay(uid(req.user)), "students");
    } else if (role === "parent") {
      const kids = await parentStudentIds(req.user);
      const stays = await Promise.all(kids.map((id) => currentStay(id)));
      const lists = await Promise.all(stays.map((s) => noticesForStay(s, "parents")));
      const seen = new Set();
      notices = lists.flat().filter((n) => (seen.has(String(n._id)) ? false : seen.add(String(n._id))));
    } else if (role === "warden") {
      const blocks = await wardenBlocks(req.user);
      if (blocks.length) {
        // staff-addressed notices for their blocks, plus anything this warden posted themselves
        notices = await Notice.find({
          $and: [
            { $or: blocks.map((b) => ({ hostel: b.hostelId, block: { $in: [null, b._id] } })) },
            { $or: [{ audience: "staff" }, { createdBy: uid(req.user) }] }
          ]
        })
          .sort({ pinned: -1, createdAt: -1 })
          .limit(50);
      }
    } else if (role === "host" || role === "admin") {
      if (!isId(req.query.hostelId) || !(await canManageHostel(req.user, req.query.hostelId))) {
        return res.status(403).json({ message: "Pass a hostelId you manage." });
      }
      notices = await Notice.find({ hostel: req.query.hostelId }).sort({ pinned: -1, createdAt: -1 }).limit(100);
    }
    return res.json({ results: notices.map((n) => shape(n, uid(req.user))), unread: notices.filter((n) => !(n.readBy || []).some((id) => String(id) === uid(req.user))).length });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "Notice not found." });
    await Notice.updateOne({ _id: req.params.id }, { $addToSet: { readBy: uid(req.user) } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// Head office (any scope) or a warden (own block only) posts a general notice.
router.post("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId, title, message, type = "general", pinned = false } = req.body;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    if (!String(title || "").trim() || !String(message || "").trim()) return res.status(400).json({ message: "Title and message are required." });
    if (!["general", "fee_reminder", "safety"].includes(type)) return res.status(400).json({ message: "Unsupported notice type." });
    if (blockId && !(await blockInHostel(blockId, hostelId))) return res.status(400).json({ message: "That block does not belong to this hostel." });
    const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
    if (!scope) return res.status(403).json({ message: "No access to this hostel/block." });
    // A warden can only post to a block they run (never hostel-wide).
    if (scope === "warden" && !(blockId && isId(blockId))) return res.status(403).json({ message: "Wardens can only post notices to their own block." });
    const notice = await Notice.create({
      hostel: hostelId,
      block: blockId && isId(blockId) ? blockId : null,
      type,
      title: String(title).trim(),
      message: String(message).trim(),
      pinned: Boolean(pinned) && scope === "head_office",
      createdBy: uid(req.user),
      createdByName: req.user.name
    });
    return res.status(201).json({ notice: shape(notice, uid(req.user)) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
