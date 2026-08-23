const { rooms } = require("../data/mockData");

const universityCoordinates = {
  NUST: { lat: 33.6427, lng: 72.9915, aliases: ["NUST", "H-12"] },
  LUMS: { lat: 31.4706, lng: 74.4111, aliases: ["LUMS", "DHA Lahore"] },
  FAST: { lat: 33.6565, lng: 73.0151, aliases: ["FAST", "FAST-NU"] },
  IBA: { lat: 24.9437, lng: 67.1129, aliases: ["IBA", "KU"] }
};

const toRad = (value) => (Number(value) * Math.PI) / 180;

const distanceKm = (a, b) => {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const earth = 6371;
  const latDelta = toRad(b.lat - a.lat);
  const lngDelta = toRad(b.lng - a.lng);
  const x = Math.sin(latDelta / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const coordinateForUniversity = (name = "") => {
  const query = String(name).toLowerCase();
  return Object.values(universityCoordinates).find((item) => item.aliases.some((alias) => query.includes(alias.toLowerCase())));
};

const scoreRoom = (room, params = {}) => {
  const budget = Number(params.maxPrice || params.budget || 0);
  const price = Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);
  const target = coordinateForUniversity(params.university || params.nearUniversity || room.nearestUniversity);
  const distance = distanceKm(target, room.coordinates);
  const budgetScore = budget ? Math.max(0, 30 - Math.abs(price - budget) / Math.max(1000, budget) * 30) : 18;
  const availabilityScore = Number(room.availableBeds || 0) > 0 ? 20 : -20;
  const distanceScore = distance === null ? 8 : Math.max(0, 25 - distance * 2);
  const verificationScore = room.listedBy ? 12 : 5;
  const instantScore = room.instantBooking ? 8 : 0;
  const mealScore = room.mealPlan && room.mealPlan !== "NONE" ? 5 : 0;
  return {
    score: Math.round(budgetScore + availabilityScore + distanceScore + verificationScore + instantScore + mealScore),
    distanceKm: distance === null ? undefined : Number(distance.toFixed(1))
  };
};

const recommendRooms = (params = {}, sourceRooms = rooms) =>
  sourceRooms
    .map((room) => {
      const result = scoreRoom(room, params);
      return { ...room, recommendationScore: result.score, distanceToUniversityKm: result.distanceKm };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

module.exports = {
  universityCoordinates,
  distanceKm,
  coordinateForUniversity,
  scoreRoom,
  recommendRooms
};
