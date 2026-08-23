// Smart pricing suggestions for hosts (Host Growth Center -> "Smart Pricing").
//
// Blends three real signals computed from data that actually exists in this
// app, instead of a single flat city/roomType average:
//   1. Occupancy history -- recent bookings for the room's comparable set
//      (or the specific room, when a roomId is supplied) vs. total bed
//      capacity. High recent occupancy nudges the suggested band up; low
//      occupancy/high vacancy nudges it down.
//   2. Comparable-set pricing -- the average price of other rooms in the same
//      city + roomType (and, when available, the same nearby university) as
//      the "market" anchor instead of a citywide average across all types.
//   3. Academic-calendar seasonality -- active/upcoming AcademicEvent rows
//      (semester start, exam season, etc.) nudge demand up or down.
//
// This intentionally does NOT claim to be an ML model -- it's a transparent,
// explainable blend of averages and simple heuristics over real records, with
// a plain-language explanation string describing exactly why the number came
// out the way it did.

const mongoose = require("mongoose");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const AcademicEvent = require("../models/AcademicEvent");
const { rooms: mockRooms, bookings: mockBookings } = require("../data/mockData");

const isDbReady = () => mongoose.connection.readyState === 1;
const priceFor = (room) => Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);

const OCCUPANCY_HIGH_THRESHOLD = 0.85;
const OCCUPANCY_LOW_THRESHOLD = 0.4;
const OCCUPANCY_ADJUSTMENT_PCT = 0.05;
const OCCUPANCY_LOOKBACK_DAYS = 90;
const ACTIVE_BOOKING_STATUSES = ["confirmed", "active", "completed", "overdue"];

const SEASONALITY_RULES = {
  semester_start: { multiplier: 1.06, label: "Semester start / admissions season is active nearby, so demand typically rises" },
  exam_season: { multiplier: 0.97, label: "Exam season is active nearby, so relocation demand typically softens a little" },
  summer_break: { multiplier: 0.93, label: "Summer break is active nearby, so relocation demand is typically lower" },
  eid_break: { multiplier: 0.95, label: "Eid break is active nearby, so relocation demand typically dips" },
  mid_terms: { multiplier: 1.0, label: "Mid-terms are active nearby; demand is broadly stable" },
  semester_end: { multiplier: 0.98, label: "Semester end is active nearby, with some students moving out" },
  custom: { multiplier: 1.0, label: "An academic-calendar event is active nearby" }
};

const round50 = (value) => Math.round(Number(value || 0) / 50) * 50;

const money = (value) => Math.round(Number(value || 0)).toLocaleString("en-PK");

const buildExplanation = ({ city, roomType, occupancyRate, comparableAvg, comparableSampleSize, seasonality, suggestedMin, suggestedMax }) => {
  const parts = [];
  if (occupancyRate != null) parts.push(`Occupancy is ${Math.round(occupancyRate * 100)}% recently`);
  if (comparableAvg) {
    const label = roomType ? String(roomType).toLowerCase().replace(/_/g, " ") : "rooms";
    const sampleNote = comparableSampleSize ? ` (based on ${comparableSampleSize} comparable listing${comparableSampleSize === 1 ? "" : "s"})` : "";
    parts.push(`comparable ${label} nearby in ${city} average PKR ${money(comparableAvg)}${sampleNote}`);
  }
  if (seasonality?.label) parts.push(seasonality.label.charAt(0).toLowerCase() + seasonality.label.slice(1));

  const lead = parts.length ? `${parts.join(", ")}.` : `Based on available Basera pricing data for ${city}.`;
  return `${lead} Consider a range of PKR ${money(suggestedMin)}-${money(suggestedMax)}.`;
};

const seasonalityForEvents = (events = []) => {
  if (!events.length) return { multiplier: 1, label: null, activeEvents: [] };
  // If multiple events overlap, use the strongest (furthest from 1.0) multiplier.
  const scored = events.map((event) => ({
    event,
    rule: SEASONALITY_RULES[event.eventType] || SEASONALITY_RULES.custom
  }));
  scored.sort((a, b) => Math.abs(b.rule.multiplier - 1) - Math.abs(a.rule.multiplier - 1));
  const top = scored[0];
  return {
    multiplier: top.rule.multiplier,
    label: `${top.event.title || top.rule.label} -- ${top.rule.label}`,
    activeEvents: events.map((event) => event.title).filter(Boolean)
  };
};

const occupancyAdjustment = (occupancyRate) => {
  if (occupancyRate == null) return 0;
  if (occupancyRate >= OCCUPANCY_HIGH_THRESHOLD) return OCCUPANCY_ADJUSTMENT_PCT;
  if (occupancyRate <= OCCUPANCY_LOW_THRESHOLD) return -OCCUPANCY_ADJUSTMENT_PCT;
  return 0;
};

const driversFor = ({ occupancyRate, comparableAvg, seasonality }) => {
  const drivers = [];
  if (comparableAvg) drivers.push("Nearby comparable listing prices");
  if (occupancyRate != null) drivers.push(`Recent occupancy (${Math.round(occupancyRate * 100)}%)`);
  if (seasonality?.label) drivers.push("Academic calendar seasonality");
  drivers.push("Meal plan and security amenities");
  if (!drivers.length) drivers.push("Nearby competition", "Current occupancy", "Seasonal student demand");
  return drivers;
};

/**
 * Real, DB-backed pricing suggestion. Looks up comparable rooms (same city +
 * roomType, preferring the same nearby university when a specific room is
 * given), computes an occupancy rate for that comparable set from real
 * Booking records, and blends in academic-calendar seasonality.
 */
const computeDbPricingSuggestion = async ({ city, roomType, roomId }) => {
  let targetRoom = null;
  if (roomId && mongoose.Types.ObjectId.isValid(roomId)) {
    targetRoom = await Room.findById(roomId).lean();
  }

  const effectiveCity = targetRoom?.city || city;
  const effectiveRoomType = targetRoom?.roomType || roomType;

  const baseFilter = { city: new RegExp(`^${effectiveCity}$`, "i") };
  if (effectiveRoomType) baseFilter.roomType = effectiveRoomType;
  if (targetRoom) baseFilter._id = { $ne: targetRoom._id };

  let comparableRooms = await Room.find(
    targetRoom?.nearestUniversity ? { ...baseFilter, nearestUniversity: targetRoom.nearestUniversity } : baseFilter
  )
    .select("pricePerHead pricePerBed pricePerRoom totalBeds availableBeds")
    .limit(60)
    .lean();

  // Not enough same-university comparables -- widen to the whole city/roomType.
  if (targetRoom?.nearestUniversity && comparableRooms.length < 3) {
    comparableRooms = await Room.find(baseFilter).select("pricePerHead pricePerBed pricePerRoom totalBeds availableBeds").limit(60).lean();
  }

  const comparablePrices = comparableRooms.map(priceFor).filter(Boolean);
  const comparableAvg = comparablePrices.length ? Math.round(comparablePrices.reduce((sum, value) => sum + value, 0) / comparablePrices.length) : null;

  const occupancyRoomSet = targetRoom ? [targetRoom] : comparableRooms;
  const occupancyRoomIds = occupancyRoomSet.map((room) => room._id);
  let occupancyRate = null;
  if (occupancyRoomIds.length) {
    const since = new Date(Date.now() - OCCUPANCY_LOOKBACK_DAYS * 86400000);
    const activeBookingCount = await Booking.countDocuments({
      room: { $in: occupancyRoomIds },
      status: { $in: ACTIVE_BOOKING_STATUSES },
      $or: [{ checkIn: { $gte: since } }, { createdAt: { $gte: since } }]
    });
    const totalBeds = occupancyRoomSet.reduce((sum, room) => sum + Number(room.totalBeds || 1), 0);
    occupancyRate = totalBeds ? Math.min(1, activeBookingCount / totalBeds) : null;
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86400000);
  const eventFilter = { isActive: true, startDate: { $lte: horizon }, endDate: { $gte: now } };
  if (effectiveCity) eventFilter.city = new RegExp(`^${effectiveCity}$`, "i");
  const activeEvents = await AcademicEvent.find(eventFilter).limit(10).lean().catch(() => []);
  const seasonality = seasonalityForEvents(activeEvents);

  const fallbackAvg = 22000; // used only when there is truly no comparable pricing data yet
  const baseAvg = comparableAvg || fallbackAvg;
  const occAdjustment = occupancyAdjustment(occupancyRate);
  const combinedMultiplier = (1 + occAdjustment) * seasonality.multiplier;

  const suggestedMin = round50(baseAvg * 0.9 * combinedMultiplier);
  const suggestedMax = round50(baseAvg * 1.15 * combinedMultiplier);

  const confidence = Math.min(0.95, 0.55 + Math.min(0.25, comparablePrices.length * 0.03) + (occupancyRate != null ? 0.1 : 0) + (activeEvents.length ? 0.05 : 0));

  return {
    city: effectiveCity,
    roomType: effectiveRoomType,
    suggestedMin,
    suggestedMax,
    confidence: Math.round(confidence * 100) / 100,
    drivers: driversFor({ occupancyRate, comparableAvg, seasonality }),
    explanation: buildExplanation({ city: effectiveCity, roomType: effectiveRoomType, occupancyRate, comparableAvg, comparableSampleSize: comparablePrices.length, seasonality, suggestedMin, suggestedMax }),
    occupancyRate: occupancyRate != null ? Math.round(occupancyRate * 100) / 100 : null,
    comparableAveragePrice: comparableAvg,
    comparableSampleSize: comparablePrices.length,
    seasonality: { label: seasonality.label, multiplier: seasonality.multiplier, activeEvents: seasonality.activeEvents },
    demo: false
  };
};

/**
 * Same signal blend as computeDbPricingSuggestion, but computed from the
 * in-memory mock data set used whenever MongoDB isn't connected (local demo
 * mode). occupancy is derived from mock totalBeds/availableBeds and the
 * single mock booking record instead of a real query.
 */
const computeDemoPricingSuggestion = ({ city, roomType }) => {
  const cityRooms = mockRooms.filter((room) => String(room.city).toLowerCase() === String(city).toLowerCase() && (!roomType || room.roomType === roomType));
  const comparablePrices = cityRooms.map(priceFor).filter(Boolean);
  const comparableAvg = comparablePrices.length ? Math.round(comparablePrices.reduce((sum, value) => sum + value, 0) / comparablePrices.length) : null;

  const totalBeds = cityRooms.reduce((sum, room) => sum + Number(room.totalBeds || 1), 0);
  const occupiedBeds = cityRooms.reduce((sum, room) => sum + Math.max(0, Number(room.totalBeds || 1) - Number(room.availableBeds ?? room.totalBeds ?? 1)), 0);
  const bookingBoost = mockBookings.filter((booking) => cityRooms.some((room) => room.id === booking.room) && ["confirmed", "active", "completed"].includes(booking.status)).length;
  const occupancyRate = totalBeds ? Math.min(1, (occupiedBeds + bookingBoost) / totalBeds) : null;

  const seasonality = { multiplier: 1, label: null, activeEvents: [] };
  const baseAvg = comparableAvg || 22000;
  const occAdjustment = occupancyAdjustment(occupancyRate);
  const suggestedMin = round50(baseAvg * 0.9 * (1 + occAdjustment));
  const suggestedMax = round50(baseAvg * 1.15 * (1 + occAdjustment));

  return {
    city,
    roomType,
    suggestedMin,
    suggestedMax,
    confidence: 0.78,
    drivers: driversFor({ occupancyRate, comparableAvg, seasonality }),
    explanation: buildExplanation({ city, roomType, occupancyRate, comparableAvg, comparableSampleSize: comparablePrices.length, seasonality, suggestedMin, suggestedMax }),
    occupancyRate: occupancyRate != null ? Math.round(occupancyRate * 100) / 100 : null,
    comparableAveragePrice: comparableAvg,
    comparableSampleSize: comparablePrices.length,
    seasonality: { label: null, multiplier: 1, activeEvents: [] },
    demo: true
  };
};

/**
 * Entry point used by GET /api/v1/host/pricing/suggestions. Response shape is
 * backward compatible with the previous heuristic: city, roomType,
 * suggestedMin, suggestedMax, confidence, drivers, demo are all still
 * present. New fields (explanation, occupancyRate, comparableAveragePrice,
 * comparableSampleSize, seasonality) are additive.
 */
const computePricingSuggestion = async ({ city = "Islamabad", roomType = "DOUBLE", roomId } = {}) => {
  if (!isDbReady()) return computeDemoPricingSuggestion({ city, roomType });
  try {
    return await computeDbPricingSuggestion({ city, roomType, roomId });
  } catch (error) {
    // Any unexpected query failure should never break the host's dashboard --
    // fall back to the demo-style computation over mock data.
    return computeDemoPricingSuggestion({ city, roomType });
  }
};

module.exports = { computePricingSuggestion };
