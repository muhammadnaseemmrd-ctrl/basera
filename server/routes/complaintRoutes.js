const express = require("express");
const Complaint = require("../models/Complaint");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const { checkComplaintTransition } = require("../services/hostelOpsRules");
const { staffScope, recordScope, wardenBlocks, currentStay, parentStudentIds, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* never break the operation */
  }
};

const shape = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return { ...o, id: String(o._id) };
};

const CATEGORIES = ["plumbing", "electricity", "cleaning", "food", "wifi", "security", "furniture", "staff_conduct", "payment", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

// Student raises a complaint — routed automatically to the warden of their own block.
router.post("/", authorize("student"), async (req, res, next) => {
  try {
    const { title, description, category = "other", priority = "medium", evidence = [] } = req.body;
    if (!String(title || "").trim() || !String(description || "").trim()) return res.status(400).json({ message: "Title and description are required." });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ message: "Unknown category." });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: "Unknown priority." });
    const stay = await currentStay(uid(req.user));
    if (!stay || !stay.hostelId) return res.status(400).json({ message: "You need an active stay in a hostel to raise a complaint." });

    const complaint = await Complaint.create({
      student: uid(req.user),
      hostel: stay.hostelId,
      block: stay.blockId,
      room: stay.room._id,
      booking: stay.booking._id,
      category,
      priority,
      title: String(title).trim(),
      description: String(description).trim(),
      evidence: Array.isArray(evidence) ? evidence.filter((e) => typeof e === "string").slice(0, 5) : [],
      timeline: [{ status: "raised", by: uid(req.user), byName: req.user.name, byRole: "student", note: "Complaint raised." }]
    });
    await audit(req, { action: "complaint.raised", entityType: "Complaint", entityId: complaint._id, metadata: { category, priority } });
    return res.status(201).json({ complaint: shape(complaint) });
  } catch (error) {
    return next(error);
  }
});

router.get("/my", authorize("student"), async (req, res, next) => {
  try {
    const results = await Complaint.find({ student: uid(req.user) }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ results: results.map((c) => ({ ...c, id: String(c._id) })) });
  } catch (error) {
    return next(error);
  }
});

// Staff queue. Wardens only ever receive their own blocks.
router.get("/", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId, status } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
    if (!scope) return res.status(403).json({ message: "No access to this hostel/block." });
    const query = { hostel: hostelId };
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => b._id);
      if (blockId && isId(blockId) && !own.some((b) => String(b) === String(blockId))) return res.status(403).json({ message: "Not your block." });
      query.block = blockId && isId(blockId) ? blockId : { $in: own };
    } else if (blockId && isId(blockId)) {
      query.block = blockId;
    }
    if (status) query.status = status;
    const results = await Complaint.find(query).populate("student", "name").populate("room", "roomNumber").sort({ createdAt: -1 }).limit(300).lean();
    return res.json({ results: results.map((c) => ({ ...c, id: String(c._id) })) });
  } catch (error) {
    return next(error);
  }
});

// Work out who the caller is *for this complaint*.
async function actorRoleFor(req, complaint) {
  if (canonicalRole(req.user.role) === "student") return String(complaint.student) === uid(req.user) ? "student" : null;
  if (canonicalRole(req.user.role) === "parent") {
    return (await parentStudentIds(req.user)).includes(String(complaint.student)) ? "parent" : null;
  }
  // strict: a warden must run the complaint's own block; block-less complaints are head office only
  return recordScope(req.user, { hostelId: complaint.hostel, blockId: complaint.block });
}

router.get("/:id", async (req, res, next) => {
  try {
    const complaint = isId(req.params.id) ? await Complaint.findById(req.params.id).populate("student", "name") : null;
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    const role = await actorRoleFor(req, { student: complaint.student._id, hostel: complaint.hostel, block: complaint.block });
    if (!role) return res.status(403).json({ message: "No access to this complaint." });
    return res.json({ complaint: shape(complaint), viewerRole: role });
  } catch (error) {
    return next(error);
  }
});

/**
 * Single transition endpoint enforcing the flow:
 *   raised → under_review → in_progress → fixed → (student) resolved | reopened
 *   any open state → escalated (head office only)
 * The write is guarded by the *expected current status*, so two concurrent
 * updates can never both succeed.
 */
router.post("/:id/status", async (req, res, next) => {
  try {
    const complaint = isId(req.params.id) ? await Complaint.findById(req.params.id) : null;
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    const actorRole = await actorRoleFor(req, complaint);
    if (!actorRole || actorRole === "parent") return res.status(403).json({ message: "You cannot update this complaint." });

    const to = req.body.status;
    const verdict = checkComplaintTransition({ from: complaint.status, to, actorRole, note: req.body.note });
    if (!verdict.ok) return res.status(verdict.code).json({ message: verdict.message });

    const now = new Date();
    const set = { status: to };
    const inc = {};
    if (to === "under_review") set.reviewedAt = now;
    if (to === "fixed") set.fixedAt = now;
    if (to === "resolved") {
      set.resolvedAt = now;
      const rating = Number(req.body.rating);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        set.rating = rating;
        if (req.body.ratingComment) set.ratingComment = String(req.body.ratingComment).slice(0, 500);
      }
    }
    if (to === "escalated") set.escalatedAt = now;
    if (to === "reopened") inc.reopenCount = 1;
    // assigning work to a person/vendor is a head-office decision
    if (req.body.assignedTo && actorRole === "head_office") set.assignedTo = String(req.body.assignedTo).slice(0, 80);

    const update = {
      $set: set,
      $push: { timeline: { status: to, by: uid(req.user), byName: req.user.name, byRole: actorRole, note: String(req.body.note || "").slice(0, 1000), at: now } }
    };
    if (inc.reopenCount) update.$inc = inc;

    const updated = await Complaint.findOneAndUpdate({ _id: complaint._id, status: complaint.status }, update, { new: true });
    if (!updated) return res.status(409).json({ message: "This complaint was just updated by someone else. Refresh and try again." });
    await audit(req, { action: "complaint.status", entityType: "Complaint", entityId: complaint._id, metadata: { from: complaint.status, to, actorRole } });
    return res.json({ complaint: shape(updated) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
