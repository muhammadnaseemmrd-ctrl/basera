const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const User = require("../models/User");
const validate = require("../middleware/validate");
const { protect, generateToken, canonicalRole } = require("../middleware/auth");
const { users } = require("../data/mockData");

const router = express.Router();

const findDemoUser = (email) => users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());

const publicUser = (user) => ({
  id: user._id || user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: canonicalRole(user.role),
  legacyRole: ["owner", "landlord"].includes(user.role) ? user.role : undefined,
  avatar: user.avatar,
  university: user.university,
  city: user.city,
  gender: user.gender,
  isVerified: user.isVerified,
  landlordProfile: user.landlordProfile,
  hostProfile: user.hostProfile
});

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("phone").trim().notEmpty().withMessage("Phone is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    body("role").optional().isIn(["student", "host", "owner", "landlord", "property_manager", "admin", "finance", "warden"]).withMessage("Invalid role.")
  ],
  validate,
  async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        const user = { id: `demo-${Date.now()}`, ...req.body, isVerified: false };
        return res.status(201).json({ user: publicUser(user), token: generateToken(user), demo: true });
      }

      const exists = await User.findOne({ $or: [{ email: req.body.email }, { phone: req.body.phone }] });
      if (exists) return res.status(409).json({ message: "Email or phone already registered." });

      const payload = { ...req.body, role: canonicalRole(req.body.role) };
      const user = await User.create(payload);
      return res.status(201).json({ user: publicUser(user), token: generateToken(user) });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/register-landlord",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("phone").trim().notEmpty().withMessage("Phone is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    body("listerType").optional().isIn(["hostel_owner", "individual_landlord", "pg_operator"]),
    body("verificationDocuments").optional().isArray(),
    body("agreementAccepted").optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const landlordPayload = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password,
        role: "host",
        city: req.body.city,
        isVerified: false,
        verificationDocuments: req.body.verificationDocuments || [],
        landlordProfile: {
          listerType: req.body.listerType || "individual_landlord",
          verificationTier: "unverified",
          agreementAccepted: Boolean(req.body.agreementAccepted),
          agreementSignedBy: req.body.agreementSignedBy || req.body.name,
          agreementSignedAt: req.body.agreementAccepted ? new Date() : undefined,
          commissionAcknowledged: Boolean(req.body.commissionAcknowledged),
          reviewStatus: "pending"
        },
        hostProfile: {
          type: req.body.listerType === "hostel_owner" ? "hostel_host" : req.body.listerType === "pg_operator" ? "pg_host" : "individual_host",
          verificationTier: "unverified",
          agreementAccepted: Boolean(req.body.agreementAccepted),
          agreementSignedBy: req.body.agreementSignedBy || req.body.name,
          agreementSignedAt: req.body.agreementAccepted ? new Date() : undefined,
          commissionAcknowledged: Boolean(req.body.commissionAcknowledged),
          offPlatformPolicyAccepted: Boolean(req.body.offPlatformPolicyAccepted ?? req.body.agreementAccepted),
          reviewStatus: "pending"
        }
      };

      if (mongoose.connection.readyState !== 1) {
        const user = { id: `landlord-${Date.now()}`, ...landlordPayload };
        return res.status(201).json({ user: publicUser(user), token: generateToken(user), demo: true });
      }

      const exists = await User.findOne({ $or: [{ email: landlordPayload.email }, { phone: landlordPayload.phone }] });
      if (exists) return res.status(409).json({ message: "Email or phone already registered." });

      const user = await User.create(landlordPayload);
      return res.status(201).json({ user: publicUser(user), token: generateToken(user) });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/login",
  [body("email").isEmail().withMessage("Valid email is required."), body("password").notEmpty().withMessage("Password is required.")],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (mongoose.connection.readyState !== 1) {
        const user = findDemoUser(email);
        if (!user) return res.status(401).json({ message: "Invalid credentials." });
        if (password !== user.password && password !== "password123") {
          return res.status(401).json({ message: "Invalid credentials." });
        }
        return res.json({ user: publicUser(user), token: generateToken(user), demo: true });
      }

      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) {
        const demoUser = findDemoUser(email);
        if (demoUser && (password === demoUser.password || password === "password123")) {
          return res.json({ user: publicUser(demoUser), token: generateToken(demoUser), demo: true });
        }
        return res.status(401).json({ message: "Invalid credentials." });
      }

      return res.json({ user: publicUser(user), token: generateToken(user) });
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/verify-otp", (req, res) => {
  res.json({ verified: true, message: "OTP verified in demo mode." });
});

router.post("/forgot-password", [body("email").isEmail()], validate, (req, res) => {
  res.json({ message: "Password reset instructions queued if the account exists." });
});

router.post("/refresh-token", protect, (req, res) => {
  res.json({ token: generateToken(req.user), user: publicUser(req.user) });
});

router.get("/me", protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
