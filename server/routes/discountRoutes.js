const express = require("express");
const mongoose = require("mongoose");
const Discount = require("../models/Discount");
const { protect, authorize } = require("../middleware/auth");
const { demoLoyaltyClaims } = require("../data/demoRuntime");

const router = express.Router();

const demoDiscounts = [
  {
    id: "disc-semester",
    name: "Semester Start Special",
    type: "SEASONAL",
    valueType: "PERCENTAGE",
    value: 10,
    appliesTo: { cities: ["Islamabad", "Lahore"], roomTypes: ["DOUBLE", "PG"] },
    status: "ACTIVE",
    fundedBy: "BASERA",
    canStack: true
  },
  {
    id: "disc-referral",
    name: "Referral Code HH-2026",
    type: "COUPON_CODE",
    valueType: "FLAT_PKR",
    value: 500,
    couponCode: "HH-2026",
    status: "ACTIVE",
    fundedBy: "BASERA",
    canStack: true
  }
];

const demoLoyaltyDiscounts = () =>
  demoLoyaltyClaims
    .filter((claim) => claim.status === "approved" && claim.couponCode)
    .map((claim) => ({
      id: `disc-${claim.id}`,
      name: `Loyalty ${claim.approvedDiscountPercent}% room booking discount`,
      type: "LOYALTY",
      valueType: "PERCENTAGE",
      value: Number(claim.approvedDiscountPercent || 5),
      couponCode: claim.couponCode,
      status: "ACTIVE",
      fundedBy: "BASERA",
      canStack: false,
      usageLimit: 1
    }));

const demoDiscountList = () => [...demoDiscounts, ...demoLoyaltyDiscounts()];

const isApplicable = (discount, params = {}) => {
  if (discount.status !== "ACTIVE") return false;
  const cities = discount.appliesTo?.cities || [];
  const roomTypes = discount.appliesTo?.roomTypes || [];
  if (cities.length && params.city && !cities.map((city) => city.toLowerCase()).includes(String(params.city).toLowerCase())) return false;
  if (roomTypes.length && params.roomType && !roomTypes.includes(String(params.roomType).toUpperCase())) return false;
  if (discount.type === "COUPON_CODE" && params.couponCode && discount.couponCode !== String(params.couponCode).toUpperCase()) return false;
  return true;
};

const valueFor = (discount, amount = 0) => {
  if (discount.valueType === "PERCENTAGE") return Math.round(Number(amount) * (Number(discount.value) / 100));
  return Number(discount.value || 0);
};

router.get("/", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: demoDiscountList(), demo: true });
    const results = await Discount.find().sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(201).json({ discount: { id: `disc-${Date.now()}`, ...req.body }, demo: true });
    const discount = await Discount.create(req.body);
    return res.status(201).json({ discount });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ discount: { id: req.params.id, ...req.body }, demo: true });
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!discount) return res.status(404).json({ message: "Discount not found." });
    return res.json({ discount });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deleted: true, paused: true, demo: true });
    await Discount.findByIdAndUpdate(req.params.id, { status: "PAUSED" });
    return res.json({ deleted: true, paused: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/validate", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    const couponCode = String(req.body.couponCode || "").toUpperCase();
    const params = { ...req.body, couponCode };
    const list = mongoose.connection.readyState === 1
      ? await Discount.find({ status: "ACTIVE", couponCode })
      : demoDiscountList().filter((discount) => discount.couponCode === couponCode);
    const discount = list.find((item) => isApplicable(item.toObject ? item.toObject() : item, params));
    if (!discount) return res.status(404).json({ valid: false, message: "Discount code is not valid for this booking." });
    const source = discount.toObject ? discount.toObject() : discount;
    return res.json({ valid: true, discount: source, amountOff: valueFor(source, amount) });
  } catch (error) {
    return next(error);
  }
});

router.get("/applicable", async (req, res, next) => {
  try {
    const amount = Number(req.query.amount || 0);
    const list = mongoose.connection.readyState === 1 ? await Discount.find({ status: "ACTIVE" }) : demoDiscountList();
    const results = list
      .map((item) => (item.toObject ? item.toObject() : item))
      .filter((discount) => isApplicable(discount, req.query))
      .map((discount) => ({ ...discount, amountOff: valueFor(discount, amount) }));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/host-funded", protect, authorize("host"), async (req, res, next) => {
  try {
    const payload = { ...req.body, type: "HOST_FUNDED", fundedBy: "HOST", hostId: req.user._id || req.user.id };
    if (mongoose.connection.readyState !== 1) return res.status(201).json({ discount: { id: `host-disc-${Date.now()}`, ...payload }, demo: true });
    const discount = await Discount.create(payload);
    return res.status(201).json({ discount });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
