const express = require("express");
const FeeInvoice = require("../models/FeeInvoice");
const JobLog = require("../models/JobLog");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const clock = require("../services/clock");
const { refreshOpenInvoices } = require("../services/feeService");
const { emitDueSoon, emitFineStarted } = require("../services/hostelEvents");

// Scheduled jobs. Safe to run twice, late, or after missed days: fines are recomputed from
// dates (never incremented) and reminders are de-duplicated by HostelEventLog keys.
// Auth: header x-cron-secret === CRON_SECRET, or an admin token.
const router = express.Router();

const cronOrAdmin = (req, res, next) => {
  if (process.env.CRON_SECRET && req.headers["x-cron-secret"] === process.env.CRON_SECRET) return next();
  return protect(req, res, () => authorize("admin")(req, res, next));
};
router.use(requireDb, cronOrAdmin);

// JobLog timestamps are operational (real wall-clock run times), not business dates.
async function withJobLog(name, fn) {
  const log = await JobLog.create({ jobName: name, startedAt: new Date(), status: "running" });
  try {
    const out = await fn();
    await JobLog.updateOne({ _id: log._id }, { status: "completed", completedAt: new Date(), processedCount: out.processed || 0, notes: JSON.stringify(out).slice(0, 1000) });
    return { job: name, ...out };
  } catch (error) {
    await JobLog.updateOne({ _id: log._id }, { status: "failed", completedAt: new Date(), errorCount: 1, notes: error.message });
    throw error;
  }
}

async function lateFees() {
  const asOf = clock.now();
  const { scanned, updated } = await refreshOpenInvoices({}, asOf);
  // first day a fine exists → one "fine started" notice per invoice (deduped)
  const accruing = await FeeInvoice.find({ status: { $in: ["unpaid", "partial"] }, fineStatus: "accruing", fineAccrued: { $gt: 0 } }).lean();
  let notified = 0;
  for (const inv of accruing) {
    const r = await emitFineStarted(inv);
    if (r?.sent) notified += 1;
  }
  return { asOf: clock.dayKey(asOf), processed: scanned, updated, fineStartedNotices: notified };
}

async function dueSoon() {
  const today = clock.startOfDayKarachi(clock.now());
  const until = clock.addDays(today, 3);
  const invoices = await FeeInvoice.find({ status: { $in: ["unpaid", "partial"] }, dueDate: { $gte: today, $lte: until } }).lean();
  let sent = 0;
  for (const inv of invoices) {
    const r = await emitDueSoon(inv, clock.dayKey(clock.addDays(inv.dueDate, 1)));
    if (r?.sent) sent += 1;
  }
  return { processed: invoices.length, dueSoonNotices: sent };
}

router.post("/late-fees", async (req, res, next) => {
  try {
    return res.json(await withJobLog("hostel.late-fees", lateFees));
  } catch (error) {
    return next(error);
  }
});

// Daily bundle: late fees + due-soon reminders + leave reminders (when the leave module is loaded).
router.post("/daily", async (req, res, next) => {
  try {
    const out = await withJobLog("hostel.daily", async () => {
      const fees = await lateFees();
      const due = await dueSoon();
      let leave = { processed: 0 };
      try {
        leave = await require("../services/leaveService").sendReminders();
      } catch (error) {
        if (error.code !== "MODULE_NOT_FOUND") throw error;
      }
      return { processed: fees.processed + due.processed + (leave.processed || 0), lateFees: fees, dueSoon: due, leave };
    });
    return res.json(out);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
