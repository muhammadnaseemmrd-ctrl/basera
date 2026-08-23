const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const { getTrustScore } = require("../services/trustScoreService");

const router = express.Router();

router.get("/:id/trust-score", protect, authorize("host", "owner", "landlord", "admin", "student"), async (req, res, next) => {
  try {
    const ownScore = String(req.user.id || req.user._id) === String(req.params.id);
    if (req.user.role === "student" && !ownScore && req.params.id !== "me") return res.status(403).json({ message: "Students can only view their own trust score." });
    const id = req.params.id === "me" ? req.user._id || req.user.id : req.params.id;
    return res.json({ trustScore: await getTrustScore(id, req.user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
