const express = require("express");
const mongoose = require("mongoose");
const ParentAccess = require("../models/ParentAccess");
const { protect } = require("../middleware/auth");
const { rooms, bookings, hostels } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;
const tokenFor = () => `HHP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const parentPayload = (access = {}) => {
  const selectedBooking = bookings.find((item) => item.id === access.bookingRef) || bookings[0];
  const selectedRooms = (access.roomIds?.length ? rooms.filter((room) => access.roomIds.includes(room.id)) : rooms.slice(0, 3));
  return {
    access: {
      token: access.token || "HHP-DEMO",
      parentName: access.parentName || "Parent",
      studentName: access.studentName || "Ali Ahmed",
      status: access.status || "active",
      expiresAt: access.expiresAt || new Date(Date.now() + 14 * 86400000).toISOString()
    },
    booking: {
      id: selectedBooking.id,
      status: selectedBooking.status || "confirmed",
      paymentStatus: selectedBooking.paymentStatus || "paid",
      moveInDate: selectedBooking.moveInDate || selectedBooking.checkIn,
      totalAmount: selectedBooking.totalAmount || 23500,
      deposit: selectedBooking.securityDeposit || 5000
    },
    rooms: selectedRooms.map((room) => {
      const hostel = hostels.find((item) => item.id === room.hostel) || hostels[0];
      return {
        id: room.id,
        title: room.title,
        hostelName: hostel.name,
        city: room.city,
        area: room.area,
        pricePerHead: room.pricePerHead || room.pricePerBed,
        image: room.photos?.[0] || room.images?.[0] || hostel.images?.[0],
        parentSafety: ["Verified Host", "Escrow payment", "Contact gated until paid confirmation"]
      };
    }),
    safety: {
      score: 86,
      notes: ["Basera escrow protection", "QR-verifiable receipts", "Admin dispute support", "Emergency contact saved"]
    },
    payments: [
      { label: "Rent + fees", amount: selectedBooking.totalAmount || 23500, status: selectedBooking.paymentStatus || "paid" },
      { label: "Security deposit", amount: selectedBooking.securityDeposit || 5000, status: "held separately" }
    ]
  };
};

router.post("/share", protect, async (req, res, next) => {
  try {
    const token = tokenFor();
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      studentName: req.user.name,
      bookingRef: req.body.bookingId || "b1",
      roomIds: req.body.roomIds || ["r1", "r4"],
      parentName: req.body.parentName,
      parentEmail: req.body.parentEmail,
      parentPhone: req.body.parentPhone,
      token,
      expiresAt: new Date(Date.now() + 14 * 86400000)
    };
    if (!isDbReady()) return res.status(201).json({ access: { id: `parent-${Date.now()}`, ...payload }, portalUrl: `/parent/${token}`, demo: true });
    const access = await ParentAccess.create(payload);
    return res.status(201).json({ access, portalUrl: `/parent/${token}` });
  } catch (error) {
    return next(error);
  }
});

router.get("/portal/:token", async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ portal: parentPayload({ token: req.params.token }), demo: true });
    const access = await ParentAccess.findOneAndUpdate({ token: req.params.token, status: "active" }, { lastViewedAt: new Date() }, { new: true });
    if (!access) return res.status(404).json({ message: "Parent portal link not found or expired." });
    return res.json({ portal: parentPayload(access) });
  } catch (error) {
    return next(error);
  }
});

router.post("/portal/:token/consent", async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ acknowledged: true, token: req.params.token, demo: true });
    const access = await ParentAccess.findOneAndUpdate({ token: req.params.token }, { consentAcknowledgedAt: new Date() }, { new: true });
    if (!access) return res.status(404).json({ message: "Parent portal link not found." });
    return res.json({ acknowledged: true, access });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
