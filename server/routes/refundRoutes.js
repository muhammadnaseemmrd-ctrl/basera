const express = require("express");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/preview", protect, (req, res) => {
  const rentPaid = Number(req.body.rentPaid || req.body.totalAmount || 25000);
  const deposit = Number(req.body.securityDeposit || 5000);
  const daysUntilMoveIn = Number(req.body.daysUntilMoveIn ?? 7);
  const nonRefundableAmount = daysUntilMoveIn < 2 ? Math.round(rentPaid * 0.3) : daysUntilMoveIn < 7 ? Math.round(rentPaid * 0.15) : 0;
  return res.json({
    preview: {
      refundAmount: Math.max(0, rentPaid - nonRefundableAmount) + deposit,
      depositRefund: deposit,
      rentRefund: Math.max(0, rentPaid - nonRefundableAmount),
      nonRefundableAmount,
      policyReason: daysUntilMoveIn < 2 ? "Late cancellation window" : "Standard cancellation window",
      policyVersion: process.env.REFUND_POLICY_VERSION || "v6-demo",
      etaDays: 3
    },
    demo: true
  });
});

module.exports = router;
