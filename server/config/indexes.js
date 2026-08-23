const mongoose = require("mongoose");

const indexSpecs = [
  ["rooms", { city: 1, roomType: 1, genderPolicy: 1, pricePerHead: 1, availableBeds: 1, status: 1 }],
  ["rooms", { location: "2dsphere" }],
  ["rooms", { hostId: 1, status: 1 }],
  ["rooms", { listedBy: 1, status: 1 }],
  ["rooms", { hostel: 1, status: 1, availableBeds: 1 }],
  ["bookings", { student: 1, status: 1, createdAt: -1 }],
  ["bookings", { studentId: 1, status: 1, createdAt: -1 }],
  ["bookings", { hostId: 1, status: 1, createdAt: -1 }],
  ["bookings", { hostel: 1, status: 1, createdAt: -1 }],
  ["bookings", { status: 1, nextRentDueDate: 1 }],
  ["bookings", { status: 1, escrowReleaseAfter: 1 }],
  ["payments", { bookingId: 1, createdAt: -1 }],
  ["payments", { studentId: 1, status: 1, createdAt: -1 }],
  ["ledgerentries", { entityId: 1, entityType: 1, createdAt: -1 }],
  ["ledgerentries", { host: 1, createdAt: -1 }],
  ["ledgerentries", { student: 1, createdAt: -1 }],
  ["ledgerentries", { type: 1, createdAt: -1 }],
  ["notifications", { userId: 1, read: 1, createdAt: -1 }],
  ["chatmessages", { threadId: 1, createdAt: -1 }],
  ["chatthreads", { participants: 1, updatedAt: -1 }],
  ["loyaltyaccounts", { user: 1, status: 1, expiresAt: 1 }],
  ["loyaltyledgers", { userId: 1, status: 1, expiresAt: 1 }],
  ["globalalerts", { status: 1, expiresAt: 1, "affectedScope.city": 1 }],
  ["hostels", { city: 1, status: 1, isVerified: 1 }],
  ["reviews", { hostel: 1, createdAt: -1 }],
  ["reviews", { hostelId: 1, createdAt: -1 }],
  ["maintenancetickets", { host: 1, status: 1, createdAt: -1 }],
  ["maintenancerequests", { hostId: 1, status: 1, createdAt: -1 }]
];

const ensureIndexes = async () => {
  if (mongoose.connection.readyState !== 1) return { skipped: true };
  const db = mongoose.connection.db;
  const results = [];
  for (const [collectionName, spec] of indexSpecs) {
    try {
      const name = await db.collection(collectionName).createIndex(spec, { background: true });
      results.push({ collectionName, name });
    } catch (error) {
      results.push({ collectionName, error: error.message });
    }
  }
  return { created: results };
};

module.exports = { ensureIndexes, indexSpecs };
