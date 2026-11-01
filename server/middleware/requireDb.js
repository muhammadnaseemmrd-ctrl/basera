const mongoose = require("mongoose");

// Hostel-operations modules move real money and handle real people. Unlike the
// marketplace routes they deliberately have NO in-memory demo fallback, so a
// missing database can never silently "succeed" with fake data.
module.exports = function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database not connected. Hostel operations require a live database.", demo: true });
  }
  return next();
};
