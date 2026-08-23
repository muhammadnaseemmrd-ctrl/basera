const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const keyByUserOrIp = (req) => req.user?.id || req.user?._id?.toString?.() || ipKeyGenerator(req.ip);
const skipInValidation = () => process.env.RATE_LIMIT_DISABLED === "true" || process.env.NODE_ENV === "test";

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  skip: skipInValidation,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  skip: skipInValidation,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: keyByUserOrIp,
  skip: skipInValidation,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

const mapLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  skip: skipInValidation,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

module.exports = { generalApiLimiter, authLimiter, paymentLimiter, mapLimiter };
