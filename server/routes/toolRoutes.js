const express = require("express");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/cost-estimator", protect, (req, res) => {
  const rent = Number(req.body.rent || req.body.pricePerHead || 0);
  const meals = Number(req.body.meals || req.body.mealCost || 9000);
  const laundry = Number(req.body.laundry || 1500);
  const commuteKm = Number(req.body.commuteKm || 2);
  const farePerKm = Number(process.env.RICKSHAW_FARE_PER_KM || 28);
  const utilities = Number(req.body.utilities || 3000);
  const serviceFee = Number(req.body.serviceFee || process.env.STUDENT_SERVICE_FEE_PKR || 400);
  const deposit = Number(req.body.deposit || req.body.securityDeposit || 5000);
  const depositMonths = Math.max(1, Number(req.body.depositAmortizationMonths || 6));
  const commute = Math.round(commuteKm * farePerKm * 22);
  const monthlyTotal = rent + meals + laundry + commute + utilities + serviceFee + Math.round(deposit / depositMonths);
  return res.json({
    estimate: {
      rent,
      meals,
      laundry,
      commute,
      utilities,
      serviceFee,
      depositAmortized: Math.round(deposit / depositMonths),
      monthlyTotal,
      moveInCost: rent + deposit + serviceFee
    },
    assumptions: { farePerKm, commuteDays: 22, depositMonths },
    demo: true
  });
});

router.post("/rent-split", protect, (req, res) => {
  const people = Math.max(1, Number(req.body.people || 2));
  const total = Number(req.body.rent || 0) + Number(req.body.deposit || 0) + Number(req.body.utilities || 0) + Number(req.body.meals || 0);
  return res.json({
    split: {
      people,
      total,
      perPerson: Math.ceil(total / people),
      rentShare: Math.ceil(Number(req.body.rent || 0) / people),
      depositShare: Math.ceil(Number(req.body.deposit || 0) / people)
    },
    demo: true
  });
});

module.exports = router;
