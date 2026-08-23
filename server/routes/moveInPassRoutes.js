const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const { bookings, rooms, hostels } = require("../data/mockData");

const router = express.Router();

const passFor = (bookingId, user) => {
  const booking = bookings.find((item) => item.id === bookingId) || bookings[0];
  const room = rooms.find((item) => item.id === booking.room) || rooms[0];
  const hostel = hostels.find((item) => item.id === booking.hostel) || hostels[0];
  const token = `MIP-${bookingId}-${Date.now().toString(36).toUpperCase()}`;
  return {
    id: token,
    token,
    qrPayload: JSON.stringify({ type: "move_in_pass", bookingId, token }),
    bookingId,
    studentName: user.name || "Student",
    hostelName: hostel.name,
    roomTitle: room.title,
    moveInDate: booking.moveInDate || booking.checkIn || new Date().toISOString(),
    status: booking.paymentStatus === "paid" || booking.status === "confirmed" ? "ready" : "payment_pending",
    checklist: [
      { label: "Payment verified", done: booking.paymentStatus === "paid" || booking.status === "confirmed" },
      { label: "CNIC/student ID ready", done: true },
      { label: "Emergency contact saved", done: true },
      { label: "Host contact unlock after confirmation", done: booking.paymentStatus === "paid" || booking.status === "confirmed" }
    ]
  };
};

router.get("/:bookingId", protect, (req, res) => {
  return res.json({ pass: passFor(req.params.bookingId, req.user), demo: true });
});

router.post("/:bookingId/verify", protect, authorize("host", "owner", "landlord", "admin"), (req, res) => {
  return res.json({
    verified: true,
    bookingId: req.params.bookingId,
    token: req.body.token,
    checkedBy: req.user.name || req.user.email,
    checkedAt: new Date().toISOString(),
    demo: true
  });
});

module.exports = router;
