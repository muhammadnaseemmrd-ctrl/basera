const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Dispute = require("../models/Dispute");
const Room = require("../models/Room");
const User = require("../models/User");
const { bookings, users } = require("../data/mockData");

const tierWeight = {
  unverified: 20,
  id_verified: 10,
  identity_verified: 10,
  property_verified: 0,
  superhost: -10
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

const labelFor = (score) => {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const demoHostRisk = (hostId = "u-landlord") => {
  const host = users.find((user) => user.id === hostId) || users.find((user) => ["host", "landlord", "owner"].includes(user.role)) || users[0];
  const related = bookings.filter((booking) => booking.room === "r7" || booking.status === "disputed");
  const complaints = related.filter((booking) => booking.status === "disputed").length;
  const cancellations = related.filter((booking) => booking.status === "cancelled").length;
  const offPlatformFlags = 1;
  const score = clamp(20 + complaints * 18 + cancellations * 8 + offPlatformFlags * 14 + (tierWeight[host.hostProfile?.verificationTier || host.landlordProfile?.verificationTier] || 5));
  return {
    hostId: host.id,
    hostName: host.name,
    score,
    label: labelFor(score),
    factors: [
      { label: "Open or historic disputes", value: complaints },
      { label: "Cancellations", value: cancellations },
      { label: "Off-platform flags", value: offPlatformFlags },
      { label: "Verification tier", value: host.hostProfile?.verificationTier || host.landlordProfile?.verificationTier || "identity_verified" }
    ],
    recommendedAction: score >= 70 ? "Manual review before new payouts" : score >= 40 ? "Monitor messages and payouts" : "Normal operations",
    demo: true
  };
};

const calculateHostRisk = async (hostId) => {
  if (mongoose.connection.readyState !== 1) return demoHostRisk(hostId);

  const host = await User.findById(hostId).lean();
  const hostRooms = await Room.find({ listedBy: hostId }).select("_id").lean();
  const roomIds = hostRooms.map((room) => room._id);
  const hostBookings = await Booking.find({ $or: [{ room: { $in: roomIds } }, { status: "disputed" }] }).lean();
  const disputes = await Dispute.find({ $or: [{ owner: hostId }, { raisedAgainst: hostId }] }).lean();
  const complaints = disputes.length;
  const cancellations = hostBookings.filter((booking) => booking.status === "cancelled" || booking.status === "declined").length;
  const offPlatformFlags = disputes.filter((dispute) => String(dispute.category || "").toLowerCase().includes("payment")).length;
  const tier = host?.hostProfile?.verificationTier || host?.landlordProfile?.verificationTier || "unverified";
  const score = clamp(15 + complaints * 18 + cancellations * 8 + offPlatformFlags * 14 + (tierWeight[tier] || 0));

  return {
    hostId,
    hostName: host?.name || "Host",
    score,
    label: labelFor(score),
    factors: [
      { label: "Open or historic disputes", value: complaints },
      { label: "Cancellations/declines", value: cancellations },
      { label: "Off-platform payment flags", value: offPlatformFlags },
      { label: "Verification tier", value: tier }
    ],
    recommendedAction: score >= 70 ? "Manual review before new payouts" : score >= 40 ? "Monitor messages and payouts" : "Normal operations"
  };
};

module.exports = { calculateHostRisk, demoHostRisk };
