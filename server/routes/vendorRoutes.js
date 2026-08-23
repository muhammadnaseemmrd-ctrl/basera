const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const VendorOrder = require("../models/VendorOrder");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const vendors = [
  { id: "vendor-laundry", name: "Campus Laundry Express", category: "laundry", city: "Islamabad", rating: 4.7, basePrice: 900, eta: "24 hours", services: ["Wash & fold", "Ironing", "Pickup"] },
  { id: "vendor-transport", name: "SafeMove Student Transport", category: "transport", city: "Islamabad", rating: 4.8, basePrice: 2500, eta: "Scheduled", services: ["Move-in van", "Campus shuttle", "Airport pickup"] },
  { id: "vendor-meals", name: "Healthy Mess Partner", category: "meals", city: "Lahore", rating: 4.5, basePrice: 8500, eta: "Monthly", services: ["Lunch", "Dinner", "Diet plan"] },
  { id: "vendor-cleaning", name: "Room Reset Crew", category: "cleaning", city: "Karachi", rating: 4.6, basePrice: 1200, eta: "Same day", services: ["Deep clean", "Mattress sanitize", "Pest check"] }
];

const demoOrders = [
  { id: "vo-1", vendorId: "vendor-laundry", vendorName: "Campus Laundry Express", service: "Wash & fold", amount: 900, status: "confirmed", scheduledFor: new Date(Date.now() + 86400000).toISOString() }
];

router.get("/", (req, res) => {
  const results = vendors
    .filter((vendor) => !req.query.city || vendor.city === req.query.city)
    .filter((vendor) => !req.query.category || vendor.category === req.query.category);
  return res.json({ results });
});

router.post("/orders", protect, async (req, res, next) => {
  try {
    const vendor = vendors.find((item) => item.id === req.body.vendorId) || vendors[0];
    const payload = {
      student: req.user._id,
      studentRef: req.user.id,
      studentName: req.user.name,
      vendorId: vendor.id,
      vendorName: vendor.name,
      service: req.body.service || vendor.services[0],
      amount: Number(req.body.amount || vendor.basePrice),
      scheduledFor: req.body.scheduledFor || new Date(Date.now() + 86400000),
      address: req.body.address,
      notes: req.body.notes
    };
    if (!isDbReady()) {
      const order = { id: `vo-${Date.now()}`, ...payload, status: "requested", scheduledFor: new Date(payload.scheduledFor).toISOString() };
      demoOrders.unshift(order);
      return res.status(201).json({ order, demo: true });
    }
    const order = await VendorOrder.create(payload);
    return res.status(201).json({ order });
  } catch (error) {
    return next(error);
  }
});

router.get("/orders/my", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoOrders, demo: true });
    const results = await VendorOrder.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/orders", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ vendors, orders: demoOrders, demo: true });
    const orders = await VendorOrder.find().populate("student").sort({ createdAt: -1 }).limit(200);
    return res.json({ vendors, orders });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
