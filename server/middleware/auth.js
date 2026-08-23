const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const jwtSecret = () => process.env.JWT_SECRET || "basera-dev-secret";

const roleAliases = {
  host: ["host", "owner", "landlord"],
  owner: ["owner", "host"],
  landlord: ["landlord", "host"],
  finance: ["finance", "finance_officer"],
  finance_officer: ["finance", "finance_officer"]
};

const canonicalRole = (role) => {
  if (["owner", "landlord"].includes(role)) return "host";
  if (role === "finance_officer") return "finance";
  return role || "student";
};

const roleMatches = (userRole, allowedRole) => {
  const userCanonical = canonicalRole(userRole);
  const allowed = roleAliases[allowedRole] || [allowedRole];
  return allowed.includes(userRole) || allowed.includes(userCanonical) || canonicalRole(allowedRole) === userCanonical;
};

const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id || user.id,
      role: user.role,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Not authorized. Token missing." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret());
    const dbConnected = mongoose.connection.readyState === 1;

    if (dbConnected && decoded.id) {
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        // MongoDB is connected and authoritative, so a missing user means the
        // account was deleted/deactivated -- never trust the stale token payload here.
        return res.status(401).json({ message: "User not found or deactivated" });
      }
      req.user = user;
      return next();
    }

    // Demo mode (no live MongoDB connection): fall back to the decoded token's
    // embedded user data since there's no database to verify against.
    req.user = decoded.user || { id: decoded.id, role: decoded.role || "student" };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token." });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.some((role) => roleMatches(req.user.role, role))) {
    return res.status(403).json({ message: `${roles.join(" or ")} access only.` });
  }
  return next();
};

module.exports = { protect, authorize, generateToken, canonicalRole, roleMatches };
