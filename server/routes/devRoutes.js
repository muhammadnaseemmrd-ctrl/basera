const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const clock = require("../services/clock");
const { recordAudit } = require("../services/auditService");

// QA-only time travel for business dates (fines, notice periods, offers, reminders).
// Every route 404s in production so the clock can never be moved on live data.
const router = express.Router();

router.use((req, res, next) => (process.env.NODE_ENV === "production" ? res.status(404).json({ message: "Not found." }) : next()));

router.get("/clock", protect, (req, res) => res.json(clock.clockInfo()));

/** Body: { days } (absolute offset from real time, may be fractional) or { setTo: ISO date-time }. */
router.post("/clock", protect, authorize("admin"), async (req, res) => {
  let info;
  if (req.body.setTo) {
    const target = new Date(req.body.setTo);
    if (Number.isNaN(target.getTime())) return res.status(400).json({ message: "setTo must be an ISO date-time." });
    const envMs = Number(process.env.CLOCK_OFFSET_DAYS || 0) * clock.DAY;
    info = clock.setOffset({ ms: target.getTime() - Date.now() - envMs });
  } else {
    const days = Number(req.body.days);
    if (!Number.isFinite(days)) return res.status(400).json({ message: "days must be a number." });
    info = clock.setOffset({ days });
  }
  await recordAudit(req, { action: "dev.clock.set", entityType: "Clock", metadata: info }).catch(() => {});
  return res.json(info);
});

module.exports = router;
