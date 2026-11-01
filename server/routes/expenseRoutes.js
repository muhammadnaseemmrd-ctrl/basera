const express = require("express");
const HostelExpense = require("../models/HostelExpense");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const clock = require("../services/clock");
const { validateExpense, reportRange } = require("../services/reportRules");
const { canManageHostel, blockInHostel, isId, uid } = require("../services/hostelAccess");

// Simple expense book per hostel (head office only). Profit lives in /ops-reports/profit.
const router = express.Router();
router.use(protect, authorize("host", "admin", "warden"), requireDb);

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* audit must never break the operation */
  }
};

router.get("/", async (req, res, next) => {
  try {
    const { hostelId, from, to, category } = req.query;
    if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) return res.status(403).json({ message: "Only the head office can see expenses." });
    const range = reportRange(from, to);
    if (range.error) return res.status(400).json({ message: range.error });
    const query = { hostel: hostelId, spentOn: { $gte: range.from, $lt: range.toExclusive } };
    if (category) query.category = category;
    const results = await HostelExpense.find(query).sort({ spentOn: -1 }).limit(500).lean();
    const active = results.filter((e) => e.status === "active");
    const byCategory = {};
    active.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    return res.json({ range: { from: range.fromKey, to: range.toKey }, total: active.reduce((s, e) => s + e.amount, 0), byCategory, results: results.map((e) => ({ ...e, id: String(e._id) })) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { hostelId, blockId } = req.body;
    if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) return res.status(403).json({ message: "Only the head office can record expenses." });
    const errors = validateExpense(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    if (blockId && !(await blockInHostel(blockId, hostelId))) return res.status(400).json({ message: "That block does not belong to this hostel." });
    const expense = await HostelExpense.create({
      hostel: hostelId,
      block: blockId || null,
      category: req.body.category,
      amount: req.body.amount,
      spentOn: req.body.spentOn ? clock.parseDay(req.body.spentOn) : clock.startOfDayKarachi(clock.now()),
      note: String(req.body.note || req.body.description).trim(),
      receiptUrl: typeof req.body.receiptUrl === "string" && /^https?:\/\//i.test(req.body.receiptUrl) ? req.body.receiptUrl : undefined,
      createdBy: uid(req.user)
    });
    await audit(req, { action: "expense.recorded", entityType: "HostelExpense", entityId: expense._id, metadata: { category: expense.category, amount: expense.amount } });
    return res.status(201).json({ expense: { ...expense.toObject(), id: String(expense._id) } });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/void", async (req, res, next) => {
  try {
    const expense = isId(req.params.id) ? await HostelExpense.findById(req.params.id) : null;
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    if (!(await canManageHostel(req.user, expense.hostel))) return res.status(403).json({ message: "Only the head office can void expenses." });
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required." });
    const updated = await HostelExpense.findOneAndUpdate({ _id: expense._id, status: "active" }, { status: "void", voidReason: reason }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Already void." });
    await audit(req, { action: "expense.voided", entityType: "HostelExpense", entityId: expense._id, metadata: { reason } });
    return res.json({ expense: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
