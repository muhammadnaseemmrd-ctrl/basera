const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const validate = require("../middleware/validate");

const router = express.Router();

// In-memory fallback store used when MongoDB isn't connected (demo/offline mode),
// mirroring the dual-mode pattern used elsewhere in this codebase (e.g. hostelRoutes'
// demoMessMenus, roomRoutes' demoBedBlocks).
const demoSubscribers = [];

router.post(
  "/subscribe",
  [
    body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("city").optional().trim(),
    body("university").optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const email = String(req.body.email).toLowerCase().trim();
      const city = req.body.city || undefined;
      const university = req.body.university || undefined;

      if (mongoose.connection.readyState !== 1) {
        const existing = demoSubscribers.find((item) => item.email === email);
        if (existing) {
          existing.city = city || existing.city;
          existing.university = university || existing.university;
        } else {
          demoSubscribers.push({
            id: `newsletter-${Date.now()}`,
            email,
            city,
            university,
            source: "homepage",
            createdAt: new Date().toISOString()
          });
        }
        return res.status(201).json({
          message: "You're on the list. We'll email you when new listings and price drops match your search.",
          demo: true
        });
      }

      const subscriber = await NewsletterSubscriber.findOneAndUpdate(
        { email },
        { email, city, university, source: "homepage" },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({
        message: "You're on the list. We'll email you when new listings and price drops match your search.",
        subscriberId: subscriber._id
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
