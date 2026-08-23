const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const { bookings, adminDashboard } = require("../data/mockData");

const router = express.Router();
const adminAccess = [protect, authorize("admin")];

router.get("/disputes/:id/timeline", adminAccess, (req, res) => {
  const booking = bookings[0];
  return res.json({
    disputeId: req.params.id,
    bookingId: booking.id,
    summary: "Evidence timeline combines payment, chat flag, student report, host response, and admin resolution notes.",
    riskScore: 82,
    recommendedAction: "Hold payout and request Host response within 24 hours.",
    events: [
      { at: booking.createdAt || new Date().toISOString(), type: "booking", title: "Booking created", actor: "Student", evidence: "Booking record" },
      { at: new Date(Date.now() - 3 * 3600000).toISOString(), type: "payment", title: "Payment captured in Basera", actor: "Gateway", evidence: "Ledger transaction" },
      { at: new Date(Date.now() - 2 * 3600000).toISOString(), type: "chat_flag", title: "Possible direct payment language", actor: "Chat filter", evidence: "Masked message" },
      { at: new Date(Date.now() - 1 * 3600000).toISOString(), type: "student_report", title: "Off-platform payment report", actor: "Student", evidence: "Report form" }
    ],
    demo: true
  });
});

router.get("/reviews/sentiment", protect, authorize("admin", "host", "owner", "landlord"), (req, res) => {
  const rows = [
    { topic: "Food quality", sentiment: 72, mentions: 31, trend: "+8%", sample: "Meals are consistent and hygienic." },
    { topic: "Internet speed", sentiment: 68, mentions: 28, trend: "-3%", sample: "WiFi slows after 9 PM." },
    { topic: "Cleanliness", sentiment: 84, mentions: 24, trend: "+6%", sample: "Rooms are cleaned regularly." },
    { topic: "Host response", sentiment: 79, mentions: 19, trend: "+4%", sample: "Host replies quickly." }
  ];
  return res.json({
    score: Math.round(rows.reduce((sum, row) => sum + row.sentiment, 0) / rows.length),
    topics: rows,
    flaggedReviews: adminDashboard.disputes?.slice(0, 2) || [],
    demo: true
  });
});

module.exports = router;
