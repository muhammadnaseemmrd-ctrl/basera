const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const UtilityBill = require("../models/UtilityBill");
const { bookings, rooms, users } = require("../data/mockData");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const demoBills = [];
const roomWeight = (room = {}) => (room.type === "single" || room.roomType === "SINGLE" ? 1 : room.type === "dorm" || room.roomType === "BUNK_DORM" ? 0.45 : 0.6);

const buildSplits = ({ bills = [], bookingRows = bookings }) => {
  const totalAmount = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const weightedRows = bookingRows.map((booking) => {
    const room = rooms.find((item) => item.id === booking.room) || rooms[0];
    return { booking, room, weight: Number(booking.beds || 1) * roomWeight(room), occupancyDays: Number(booking.occupancyDays || 30) };
  });
  const denominator = weightedRows.reduce((sum, row) => sum + row.weight * row.occupancyDays, 0) || 1;
  return weightedRows.map(({ booking, room, weight, occupancyDays }) => {
    const share = Math.round((totalAmount * weight * occupancyDays) / denominator);
    return {
      bookingRef: booking.id,
      studentName: users.find((user) => user.id === booking.student)?.name || "Student",
      roomTitle: room.title,
      occupancyDays,
      weight,
      share,
      breakdown: bills.reduce((acc, bill) => ({ ...acc, [bill.type]: Math.round((Number(bill.amount || 0) * weight * occupancyDays) / denominator) }), {})
    };
  });
};

router.post("/", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const bills = req.body.bills?.length ? req.body.bills : [
      { type: "electricity", amount: Number(req.body.electricity || 12000), proofUrl: req.body.proofUrl },
      { type: "gas", amount: Number(req.body.gas || 4000) },
      { type: "water", amount: Number(req.body.water || 1500) }
    ];
    const month = Number(req.body.month || new Date().getMonth() + 1);
    const year = Number(req.body.year || new Date().getFullYear());
    const splits = buildSplits({ bills });
    const payload = {
      host: req.user._id,
      hostRef: req.user.id,
      hostelRef: req.body.hostelId || "h1",
      month,
      year,
      includeInRentInvoice: req.body.includeInRentInvoice !== false,
      bills,
      splits,
      totalAmount: bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
      status: req.body.includeInRentInvoice === false ? "absorbed" : "posted"
    };
    if (!isDbReady()) {
      const bill = { id: `ub-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoBills.unshift(bill);
      return res.status(201).json({ bill, demo: true });
    }
    const bill = await UtilityBill.create(payload);
    return res.status(201).json({ bill });
  } catch (error) {
    return next(error);
  }
});

router.get("/split/:bookingId", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const bill = demoBills[0] || {
        id: "ub-demo",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        bills: [{ type: "electricity", amount: 12000 }, { type: "gas", amount: 4000 }, { type: "water", amount: 1500 }],
        splits: buildSplits({ bills: [{ type: "electricity", amount: 12000 }, { type: "gas", amount: 4000 }, { type: "water", amount: 1500 }] })
      };
      const split = bill.splits.find((item) => item.bookingRef === req.params.bookingId) || bill.splits[0];
      return res.json({ billId: bill.id, split, totalUtilityShare: split.share, demo: true });
    }
    const bill = await UtilityBill.findOne({ "splits.bookingRef": req.params.bookingId }).sort({ createdAt: -1 }).lean();
    if (!bill) return res.status(404).json({ message: "Utility split not found." });
    const split = bill.splits.find((item) => item.bookingRef === req.params.bookingId);
    return res.json({ billId: bill._id, split, totalUtilityShare: split?.share || 0 });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
