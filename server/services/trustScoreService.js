const mongoose = require("mongoose");
const TrustScore = require("../models/TrustScore");
const { bookings, users } = require("../data/mockData");

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const gradeFor = (score) => (score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Developing" : "Needs work");

const buildBreakdown = ({ user = {}, studentBookings = [] }) => {
  const paid = studentBookings.filter((booking) => booking.paymentStatus === "paid").length;
  const overdue = studentBookings.filter((booking) => booking.status === "overdue").length;
  const completed = studentBookings.filter((booking) => booking.status === "completed" || booking.status === "confirmed").length;
  return {
    payments: clamp(60 + paid * 10 - overdue * 20),
    disputes: clamp(90 - studentBookings.filter((booking) => booking.status === "disputed").length * 25),
    profile: clamp(45 + ["phone", "university", "city", "gender", "studentId"].filter((field) => user[field]).length * 8 + (user.isVerified ? 15 : 0)),
    completion: clamp(55 + completed * 10),
    community: clamp(60 + (user.isVerified ? 8 : 0) + Math.min(studentBookings.length, 5) * 4)
  };
};

const scoreFromBreakdown = (breakdown) =>
  clamp(breakdown.payments * 0.4 + breakdown.disputes * 0.2 + breakdown.profile * 0.2 + breakdown.completion * 0.1 + breakdown.community * 0.1);

const recommendationsFor = (breakdown) => [
  breakdown.profile < 80 ? "Complete CNIC/student ID verification and emergency contact." : null,
  breakdown.payments < 80 ? "Pay rent before due dates to improve payment reliability." : null,
  breakdown.community < 75 ? "Join study sessions, leave reviews, or report safety issues responsibly." : null
].filter(Boolean);

const demoTrustScore = (id = "u-student") => {
  const user = users.find((item) => item.id === id || item.email === id) || users.find((item) => item.role === "student") || users[0];
  const studentBookings = bookings.filter((booking) => booking.student === user.id);
  const breakdown = buildBreakdown({ user, studentBookings });
  const score = scoreFromBreakdown(breakdown);
  return {
    studentId: user.id,
    studentName: user.name,
    score,
    grade: gradeFor(score),
    breakdown,
    recommendations: recommendationsFor(breakdown),
    lastUpdated: new Date().toISOString(),
    demo: true
  };
};

const getTrustScore = async (studentId, user) => {
  if (mongoose.connection.readyState !== 1) return demoTrustScore(studentId || user?.id);
  const existing = await TrustScore.findOne({ $or: [{ student: studentId }, { studentRef: studentId }] }).sort({ lastUpdated: -1 }).lean();
  if (existing) return existing;
  const breakdown = buildBreakdown({ user, studentBookings: [] });
  const score = scoreFromBreakdown(breakdown);
  return {
    studentId,
    studentName: user?.name || "Student",
    score,
    grade: gradeFor(score),
    breakdown,
    recommendations: recommendationsFor(breakdown),
    lastUpdated: new Date().toISOString()
  };
};

module.exports = { buildBreakdown, demoTrustScore, getTrustScore, gradeFor, scoreFromBreakdown };
