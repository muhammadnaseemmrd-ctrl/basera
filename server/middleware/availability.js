const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BedBlock = require("../models/BedBlock");
const { demoBedBlocks } = require("../data/demoRuntime");

const dateRangeQuery = ({ roomId, from, to }) => {
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : start;
  return {
    room: roomId,
    status: { $in: ["confirmed", "payment_pending", "active", "overdue"] },
    $or: [
      { moveInDate: { $lte: end }, moveOutDate: { $gte: start } },
      { checkIn: { $lte: end }, checkOut: { $gte: start } },
      { checkIn: { $lte: end }, checkOut: { $exists: false } }
    ]
  };
};

const occupiedBedIndices = async ({ roomId, from, to }) => {
  if (mongoose.connection.readyState !== 1) return [];
  const bookings = await Booking.find(dateRangeQuery({ roomId, from, to })).select("bedIndex beds");
  return bookings.flatMap((booking) => {
    if (Number.isInteger(booking.bedIndex)) return [booking.bedIndex];
    return Array.from({ length: booking.beds || 1 }, (_, index) => index);
  });
};

const blockRangeQuery = ({ roomId, from, to }) => {
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : start;
  return {
    room: roomId,
    status: "active",
    from: { $lte: end },
    to: { $gte: start }
  };
};

const blockedBeds = async ({ roomId, from, to }) => {
  if (mongoose.connection.readyState !== 1) {
    const start = from ? new Date(from).getTime() : Date.now();
    const end = to ? new Date(to).getTime() : start;
    return demoBedBlocks.filter((block) => {
      const blockFrom = new Date(block.from).getTime();
      const blockTo = new Date(block.to).getTime();
      return String(block.room) === String(roomId) && block.status === "active" && blockFrom <= end && blockTo >= start;
    });
  }
  return BedBlock.find(blockRangeQuery({ roomId, from, to })).lean();
};

const calculateAvailability = async ({ room, from, to }) => {
  const totalBeds = room.totalBeds || 1;
  const occupied = await occupiedBedIndices({ roomId: room._id || room.id, from, to });
  const blocks = await blockedBeds({ roomId: room._id || room.id, from, to });
  const occupiedSet = new Set(occupied);
  const blockedSet = new Set(blocks.map((block) => block.bedIndex));
  const unavailableSet = new Set([...occupiedSet, ...blockedSet]);
  const availableIndices = Array.from({ length: totalBeds }, (_, index) => index).filter((index) => !unavailableSet.has(index));
  const fallbackAvailable = Math.max(0, room.availableBeds ?? availableIndices.length);

  return {
    roomId: room._id || room.id,
    from,
    to,
    totalBeds,
    occupiedBeds: Math.min(totalBeds, occupiedSet.size),
    blockedBeds: Math.min(totalBeds, blockedSet.size),
    blocks,
    availableBeds: mongoose.connection.readyState === 1 ? availableIndices.length : fallbackAvailable,
    availableBedIndices: mongoose.connection.readyState === 1 ? availableIndices : Array.from({ length: totalBeds }, (_, index) => index).filter((index) => !blockedSet.has(index)).slice(0, fallbackAvailable),
    isAvailable: (mongoose.connection.readyState === 1 ? availableIndices.length : fallbackAvailable) > 0
  };
};

module.exports = { calculateAvailability };
