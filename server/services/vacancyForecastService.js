const mongoose = require("mongoose");
const VacancyForecast = require("../models/VacancyForecast");
const { rooms } = require("../data/mockData");

const forecastForRoom = async (roomId) => {
  if (mongoose.connection.readyState === 1) {
    const cached = await VacancyForecast.findOne({ $or: [{ room: roomId }, { roomRef: roomId }] }).sort({ computedAt: -1 }).lean();
    if (cached) return cached;
  }
  const room = rooms.find((item) => item.id === roomId) || rooms[0];
  const expected = new Date();
  const semesterOffsets = { January: 12, May: 28, August: 45 };
  const month = expected.toLocaleString("en-US", { month: "long" });
  expected.setDate(expected.getDate() + (semesterOffsets[month] || 30));
  return {
    roomId: room.id,
    roomTitle: room.title,
    expectedVacancyDate: expected.toISOString(),
    confidence: room.availableBeds > 0 ? 92 : 74,
    basedOn: ["Average booking duration by city", "Semester start/end patterns", "Current room occupancy", "Saved search demand"],
    recommendedActions: [
      "Show Available Soon badge 30 days before expected vacancy.",
      "Notify matched waitlist students.",
      "Prepare semester-start campaign for nearby universities."
    ],
    computedAt: new Date().toISOString(),
    demo: mongoose.connection.readyState !== 1
  };
};

module.exports = { forecastForRoom };
