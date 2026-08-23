const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Hostel = require("../models/Hostel");
const Booking = require("../models/Booking");
const NeighbourhoodCache = require("../models/NeighbourhoodCache");
const CommuteCache = require("../models/CommuteCache");
const HeatmapCache = require("../models/HeatmapCache");
const SavedRoute = require("../models/SavedRoute");
const MapStory = require("../models/MapStory");
const MapAnalytics = require("../models/MapAnalytics");
const OfflineMapPack = require("../models/OfflineMapPack");
const { protect, authorize } = require("../middleware/auth");
const { rooms, hostels } = require("../data/mockData");
const { universities, findUniversity } = require("../data/universities");
const { demoMapStories, demoSavedRoutes } = require("../data/demoRuntime");
const { round, rad, distanceKm, pointAt, pseudoPois, cityCenter, pointFrom, roomCoords } = require("../services/geoService");
const { resolveDirections } = require("../services/studentLifecycleService");

const router = express.Router();
const isDbReady = () => mongoose.connection.readyState === 1;

const toId = (value) => String(value?._id || value?.id || value || "");

const scoreNeighbourhood = (pois) => {
  const categories = ["university", "mosque", "food", "transport", "pharmacy", "atm"];
  const categoryScores = Object.fromEntries(
    categories.map((category) => {
      const nearest = pois.filter((poi) => poi.category === category).sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
      const score = nearest ? Math.max(45, Math.round(100 - nearest.distanceMeters / 14)) : 35;
      return [category, score];
    })
  );
  const score = Math.round(Object.values(categoryScores).reduce((sum, value) => sum + value, 0) / categories.length);
  return { score, label: score >= 85 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Moderate" : "Needs review", categoryScores };
};

const decodePolyline = (encoded = "") => {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
};

const demoRooms = (query = {}) => rooms
  .filter((room) => !query.city || String(room.city).toLowerCase() === String(query.city).toLowerCase())
  .filter((room) => !query.genderPolicy || String(room.genderPolicy).toLowerCase().includes(String(query.genderPolicy).toLowerCase()))
  .filter((room) => !query.maxPrice || Number(room.pricePerHead || room.pricePerBed) <= Number(query.maxPrice));

const buildRoute = async ({ waypoints, profile = "walking" }) => {
  const coordinates = waypoints.map((point) => `${point.lng},${point.lat}`).join(";");
  const osrmProfile = profile === "cycling" ? "bike" : profile === "walking" ? "foot" : "driving";
  const fallbackDistance = waypoints.slice(1).reduce((sum, point, index) => sum + distanceKm(waypoints[index], point), 0);
  const fallbackSpeed = profile === "walking" ? 4.7 : profile === "cycling" ? 12 : 24;
  const fallback = {
    distanceMeters: Math.round(fallbackDistance * 1000),
    durationSeconds: Math.round((fallbackDistance / fallbackSpeed) * 3600),
    geometry: waypoints.map((point) => [point.lat, point.lng]),
    source: "straight-line-fallback"
  };
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinates}?overview=full&geometries=polyline&steps=false`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return fallback;
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) return fallback;
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: decodePolyline(route.geometry),
      source: "osrm"
    };
  } catch {
    return fallback;
  }
};

router.get("/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat || cityCenter(req.query.city).lat);
    const lng = Number(req.query.lng || cityCenter(req.query.city).lng);
    const radius = Math.min(2500, Math.max(300, Number(req.query.radius || 1000)));
    const key = `${round(lat, 4)}:${round(lng, 4)}:${radius}`;

    if (isDbReady()) {
      const cached = await NeighbourhoodCache.findOne({ key });
      if (cached) return res.json({ score: cached.score, categoryScores: cached.categoryScores, pois: cached.pois, cached: true });
    }

    const center = { lat, lng };
    const pois = pseudoPois(center, radius);
    const score = scoreNeighbourhood(pois);
    if (isDbReady()) {
      await NeighbourhoodCache.findOneAndUpdate(
        { key },
        { key, lat, lng, radius, ...score, pois, fetchedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    return res.json({ ...score, pois, radius, cached: false, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/directions", async (req, res, next) => {
  try {
    const room = req.query.roomId
      ? (isDbReady() ? await Room.findById(req.query.roomId) : rooms.find((item) => item.id === req.query.roomId))
      : null;
    const hostel = req.query.hostelId
      ? (isDbReady() ? await Hostel.findById(req.query.hostelId) : hostels.find((item) => item.id === req.query.hostelId))
      : null;
    const center = (room && roomCoords(room)) || (hostel && pointFrom(hostel)) || cityCenter(req.query.city);
    const category = String(req.query.category || "pharmacy").toLowerCase();
    const result = resolveDirections({ center, category, originLat: req.query.originLat, originLng: req.query.originLng });
    return res.json({ ...result, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/commute", async (req, res, next) => {
  try {
    const from = { lat: Number(req.query.fromLat || req.query.lat), lng: Number(req.query.fromLng || req.query.lng) };
    let to = { lat: Number(req.query.toLat), lng: Number(req.query.toLng) };
    const university = findUniversity(req.query.university || "NUST", req.query.city);
    if (!to.lat || !to.lng) to = { lat: university.lat, lng: university.lng };
    if (!from.lat || !from.lng) return res.status(400).json({ message: "fromLat/fromLng or lat/lng are required." });

    const key = `${round(from.lat, 4)},${round(from.lng, 4)}:${round(to.lat, 4)},${round(to.lng, 4)}`;
    const farePerKm = Number(process.env.RICKSHAW_FARE_PER_KM || 28);
    if (isDbReady()) {
      const cached = await CommuteCache.findOne({ key: `${key}:walking` });
      if (cached) {
        const km = cached.distanceMeters / 1000;
        return res.json({
          to: { ...to, label: university?.name || req.query.toLabel || "Destination" },
          walking: { distanceKm: round(km), durationMin: Math.round(cached.durationSeconds / 60), geometry: cached.geometry },
          driving: { distanceKm: round(km), durationMin: Math.max(3, Math.round(cached.durationSeconds / 180)), fareMin: Math.round(km * farePerKm * 0.8), fareMax: Math.round(km * farePerKm * 1.2) },
          bus: { distanceKm: round(km), durationMin: Math.max(8, Math.round(cached.durationSeconds / 60 * 1.4)) },
          cached: true
        });
      }
    }

    const walkingRoute = await buildRoute({ waypoints: [from, to], profile: "walking" });
    const drivingRoute = await buildRoute({ waypoints: [from, to], profile: "driving" });
    const walkKm = walkingRoute.distanceMeters / 1000;
    const driveKm = drivingRoute.distanceMeters / 1000;
    const result = {
      from,
      to: { ...to, label: university?.name || req.query.toLabel || "Destination" },
      walking: { distanceKm: round(walkKm), durationMin: Math.max(1, Math.round(walkingRoute.durationSeconds / 60)), geometry: walkingRoute.geometry },
      driving: { distanceKm: round(driveKm), durationMin: Math.max(1, Math.round(drivingRoute.durationSeconds / 60)), fareMin: Math.round(driveKm * farePerKm * 0.8), fareMax: Math.round(driveKm * farePerKm * 1.2), geometry: drivingRoute.geometry },
      bus: { distanceKm: round(driveKm), durationMin: Math.max(8, Math.round(drivingRoute.durationSeconds / 60 * 1.4)) },
      source: walkingRoute.source === "osrm" || drivingRoute.source === "osrm" ? "osrm" : "fallback",
      demo: !isDbReady()
    };
    if (isDbReady()) {
      await CommuteCache.findOneAndUpdate(
        { key: `${key}:walking` },
        { key: `${key}:walking`, from, to, profile: "walking", distanceMeters: walkingRoute.distanceMeters, durationSeconds: walkingRoute.durationSeconds, geometry: walkingRoute.geometry, fetchedAt: new Date() },
        { upsert: true }
      );
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get("/heatmap", async (req, res, next) => {
  try {
    const type = req.query.type || "availability";
    const city = req.query.city || "Islamabad";
    const key = `${type}:${city}:${req.query.genderPolicy || ""}:${req.query.maxPrice || ""}`;
    if (isDbReady()) {
      const cached = await HeatmapCache.findOne({ key });
      if (cached) return res.json({ points: cached.points, cached: true });
    }

    if (type === "complaints") {
      const sourceHostels = isDbReady()
        ? await Hostel.find({ city: new RegExp(`^${city}$`, "i") }).limit(150).lean()
        : hostels.filter((hostel) => String(hostel.city).toLowerCase() === String(city).toLowerCase());
      const disputedCounts = isDbReady()
        ? await Booking.aggregate([
          { $match: { status: { $in: ["disputed", "cancelled"] } } },
          { $group: { _id: "$hostel", count: { $sum: 1 } } }
        ])
        : [];
      const countByHostel = Object.fromEntries(disputedCounts.map((item) => [String(item._id), item.count]));
      const points = sourceHostels.map((hostel, index) => {
        const coords = pointFrom(hostel) || cityCenter(hostel.city);
        const complaints = countByHostel[String(hostel._id)] || [4, 2, 1, 0][index % 4] || 0;
        return {
          lat: coords.lat,
          lng: coords.lng,
          intensity: round(Math.min(1, 0.2 + complaints / 6), 3),
          complaints,
          area: hostel.area,
          title: hostel.name,
          underImprovement: complaints >= 3
        };
      });
      const platformHealthScore = Math.max(55, 100 - points.reduce((sum, point) => sum + Number(point.complaints || 0), 0) * 3);
      if (isDbReady()) await HeatmapCache.findOneAndUpdate({ key }, { key, city, type, filters: req.query, points, fetchedAt: new Date() }, { upsert: true });
      return res.json({ points, type, city, platformHealthScore, demo: !isDbReady() });
    }

    const sourceRooms = isDbReady()
      ? await Room.find({ city: new RegExp(`^${city}$`, "i"), status: { $ne: "ARCHIVED" } }).limit(250)
      : demoRooms(req.query);
    const prices = sourceRooms.map((room) => Number(room.pricePerHead || room.pricePerBed || 0)).filter(Boolean);
    const min = Math.min(...prices, 1);
    const max = Math.max(...prices, min + 1);
    const budget = Number(req.query.maxPrice || max);
    const points = sourceRooms.map((room) => {
      const coords = roomCoords(room);
      const price = Number(room.pricePerHead || room.pricePerBed || 0);
      const available = Number(room.availableBeds || 0);
      let intensity = type === "price"
        ? 1 - Math.min(1, Math.max(0, (price - min) / (max - min)))
        : Math.min(1, available / 10);
      if (type === "price" && price <= budget) intensity = Math.max(intensity, 0.75);
      return { lat: coords.lat, lng: coords.lng, intensity: round(intensity, 3), price, availableBeds: available, roomId: toId(room), title: room.title };
    }).filter((point) => point.lat && point.lng && (type === "price" || point.availableBeds > 0));

    if (isDbReady()) await HeatmapCache.findOneAndUpdate({ key }, { key, city, type, filters: req.query, points, fetchedAt: new Date() }, { upsert: true });
    return res.json({ points, type, city, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/affordability", async (req, res, next) => {
  try {
    const city = req.query.city || "Islamabad";
    const farePerKm = Number(process.env.RICKSHAW_FARE_PER_KM || 28);
    const sourceRooms = isDbReady()
      ? await Room.find({ city: new RegExp(`^${city}$`, "i"), status: { $ne: "ARCHIVED" } }).limit(250)
      : demoRooms({ city });
    const points = sourceRooms.map((room) => {
      const coords = roomCoords(room);
      const rent = Number(room.pricePerHead || room.pricePerBed || 0);
      const meals = room.mealPlan === "NONE" ? 0 : Number(room.mealCost || 8000);
      const commute = Math.round(Number(room.distanceToUniversity || 3) * farePerKm * 22);
      const totalMonthlyCost = rent + meals + commute;
      return {
        id: toId(room),
        title: room.title,
        lat: coords.lat,
        lng: coords.lng,
        medianRent: rent,
        totalMonthlyCost,
        affordabilityScore: Math.max(20, Math.min(100, Math.round(100 - totalMonthlyCost / 900)))
      };
    });
    return res.json({ city, points, farePerKm, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/isochrones", (req, res) => {
  const university = findUniversity(req.query.universityId || req.query.university || "NUST", req.query.city) || universities[0];
  const center = { lat: university.lat, lng: university.lng };
  const rings = [10, 20, 30].map((minutes) => ({
    minutes,
    radiusMeters: minutes * 75,
    polygon: Array.from({ length: 16 }, (_, index) => pointAt(center, minutes * 75, index * 22.5))
  }));
  return res.json({ university, rings, mode: req.query.mode || "walking", demo: !isDbReady() });
});

router.get("/safety-confidence", (req, res) => {
  const city = req.query.city || "Islamabad";
  const center = cityCenter(city);
  const cells = Array.from({ length: 12 }, (_, index) => {
    const bearing = index * 30;
    const point = pointAt(center, 900 + (index % 4) * 500, bearing);
    const score = 86 - (index % 5) * 7 - (city === "Karachi" ? 8 : 0);
    return {
      id: `safe-confidence-${city}-${index}`,
      ...point,
      score,
      confidence: Math.max(0.55, Math.min(0.95, 0.72 + (index % 3) * 0.08)),
      drivers: ["verified listings", "POI density", "admin flags", "incident history"]
    };
  });
  return res.json({ city, cells, demo: !isDbReady() });
});

router.get("/demand-pulse", async (req, res, next) => {
  try {
    const city = req.query.city || "Islamabad";
    const center = cityCenter(city);
    const key = `demand:${city}`;
    if (isDbReady()) {
      const cached = await MapAnalytics.findOne({ key });
      if (cached) return res.json({ city, points: cached.points, cached: true });
    }
    const points = Array.from({ length: 10 }, (_, index) => {
      const point = pointAt(center, 600 + index * 180, index * 37);
      const searchCount = 130 - index * 8;
      return {
        id: `demand-${city}-${index}`,
        ...point,
        searchCount,
        saveCount: Math.round(searchCount * 0.32),
        waitlistCount: Math.round(searchCount * 0.12),
        demandScore: Math.max(25, 95 - index * 6)
      };
    });
    if (isDbReady()) {
      await MapAnalytics.findOneAndUpdate({ key }, { key, city, layer: "demand", points, expiresAt: new Date(Date.now() + 6 * 3600000) }, { upsert: true });
    }
    return res.json({ city, points, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/parent-summary", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat || cityCenter(req.query.city).lat);
    const lng = Number(req.query.lng || cityCenter(req.query.city).lng);
    const nearby = pseudoPois({ lat, lng }, 1200).filter((poi) => ["university", "mosque", "pharmacy", "transport", "food"].includes(poi.category));
    return res.json({
      score: scoreNeighbourhood(nearby),
      safety: { label: "Parent-safe summary", score: 84, notes: ["Verified listing data", "Contact gating active", "Deposit policy visible"] },
      pois: nearby,
      paymentProtection: ["Escrow hold", "QR receipt verification", "Dispute support"],
      demo: !isDbReady()
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/offline-pack/:universityId", async (req, res, next) => {
  try {
    const university = findUniversity(req.params.universityId, req.query.city) || universities[0];
    const bbox = [university.lat - 0.025, university.lng - 0.025, university.lat + 0.025, university.lng + 0.025];
    if (isDbReady()) {
      const cached = await OfflineMapPack.findOne({ universityId: university.id || university.name });
      if (cached) return res.json({ pack: cached, cached: true });
    }
    const pack = {
      universityId: university.id || university.name,
      universityName: university.name,
      city: university.city,
      bbox,
      tileVersion: "osm-v1",
      tileTemplates: ["https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      pois: pseudoPois({ lat: university.lat, lng: university.lng }, 1600),
      sizeEstimateMb: 14,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    if (isDbReady()) await OfflineMapPack.findOneAndUpdate({ universityId: pack.universityId }, pack, { upsert: true });
    return res.json({ pack, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.post("/route", protect, async (req, res, next) => {
  try {
    const waypoints = (req.body.waypoints || []).slice(0, 6).map((point) => ({
      label: point.label || "Stop",
      lat: Number(point.lat),
      lng: Number(point.lng)
    })).filter((point) => point.lat && point.lng);
    if (waypoints.length < 2) return res.status(400).json({ message: "At least two route stops are required." });
    const mode = req.body.mode || "walking";
    const route = await buildRoute({ waypoints, profile: mode });
    const payload = {
      title: req.body.title || "Saved student route",
      mode,
      waypoints,
      totalDistanceKm: round(route.distanceMeters / 1000),
      totalDurationMin: Math.round(route.durationSeconds / 60),
      geometry: route.geometry,
      shareCode: `HHROUTE-${Date.now().toString(36).toUpperCase()}`
    };
    if (!req.body.save) return res.json({ route: payload, demo: !isDbReady() });
    if (!isDbReady()) {
      const saved = { id: `route-${Date.now()}`, studentRef: req.user.id, createdByName: req.user.name, ...payload, createdAt: new Date().toISOString() };
      demoSavedRoutes.unshift(saved);
      return res.status(201).json({ route: saved, demo: true });
    }
    const saved = await SavedRoute.create({ ...payload, student: req.user._id || req.user.id, createdByName: req.user.name });
    return res.status(201).json({ route: saved });
  } catch (error) {
    return next(error);
  }
});

router.get("/routes", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoSavedRoutes.filter((route) => !route.studentRef || route.studentRef === req.user.id), demo: true });
    const results = await SavedRoute.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/safety", async (req, res) => {
  const city = req.query.city || "Islamabad";
  const center = cityCenter(city);
  const cells = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3) - 1;
    const col = (index % 3) - 1;
    const score = 82 - Math.abs(row) * 9 - Math.abs(col) * 7 + (city === "Karachi" ? -8 : 0);
    return {
      id: `safety-${city}-${index}`,
      lat: round(center.lat + row * 0.018, 5),
      lng: round(center.lng + col * 0.018, 5),
      score,
      label: score >= 80 ? "Safe" : score >= 60 ? "Moderate" : score >= 40 ? "Caution" : "High Caution"
    };
  });
  return res.json({ city, cells, score: Math.round(cells.reduce((sum, cell) => sum + cell.score, 0) / cells.length), demo: !isDbReady() });
});

router.get("/campus", (req, res) => {
  const university = findUniversity(req.query.university || "NUST", req.query.city) || universities[0];
  const center = { lat: university.lat, lng: university.lng };
  const polygon = [pointAt(center, 700, 45), pointAt(center, 700, 135), pointAt(center, 700, 225), pointAt(center, 700, 315)];
  return res.json({
    university,
    polygon,
    rings: [
      { label: "500m", radiusMeters: 500, walkingMinutes: 10 },
      { label: "1km", radiusMeters: 1000, walkingMinutes: 20 },
      { label: "2km", radiusMeters: 2000, walkingMinutes: 40 }
    ],
    demo: !isDbReady()
  });
});

router.get("/city-comparison", async (req, res, next) => {
  try {
    const cities = String(req.query.cities || "Islamabad,Lahore,Karachi").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3);
    const sourceRooms = isDbReady() ? await Room.find({ city: { $in: cities } }).limit(500) : rooms;
    const results = cities.map((city) => {
      const cityRooms = sourceRooms.filter((room) => String(room.city).toLowerCase() === city.toLowerCase());
      const prices = cityRooms.map((room) => Number(room.pricePerHead || room.pricePerBed || 0)).filter(Boolean);
      const femaleOnly = cityRooms.filter((room) => String(room.genderPolicy).includes("GIRLS")).length;
      const university = findUniversity("", city);
      return {
        city,
        center: cityCenter(city),
        roomCount: cityRooms.length,
        averagePrice: prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0,
        safetyScore: city === "Karachi" ? 68 : city === "Lahore" ? 76 : 84,
        femaleOnlyAvailability: femaleOnly,
        topUniversity: university?.name || "Major universities",
        availabilityScore: Math.min(100, cityRooms.reduce((sum, room) => sum + Number(room.availableBeds || 0), 0) * 8)
      };
    });
    return res.json({ results, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.get("/stories", async (req, res, next) => {
  try {
    const hostelId = req.query.hostelId || req.query.hostel;
    if (!isDbReady()) {
      const results = demoMapStories.filter((story) => !hostelId || story.hostelRef === hostelId || story.hostelName === hostelId);
      return res.json({ results, demo: true });
    }
    const query = { status: "published" };
    if (hostelId) query.$or = [{ hostel: hostelId }, { hostelRef: hostelId }];
    const results = await MapStory.find(query).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/stories", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const stops = (req.body.stops || []).slice(0, 5).map((stop, index) => ({ ...stop, order: index + 1 }));
    if (!stops.length) return res.status(400).json({ message: "At least one story stop is required." });
    const payload = {
      hostel: req.body.hostel,
      hostelRef: req.body.hostelRef || req.body.hostelId || "h1",
      hostelName: req.body.hostelName,
      title: req.body.title || "Neighbourhood Tour",
      createdBy: req.user._id || req.user.id,
      createdByName: req.user.name || req.user.email,
      status: "published",
      stops
    };
    if (!isDbReady()) {
      const story = { id: `story-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoMapStories.unshift(story);
      return res.status(201).json({ story, demo: true });
    }
    const story = await MapStory.create(payload);
    return res.status(201).json({ story });
  } catch (error) {
    return next(error);
  }
});

router.get("/host-portfolio", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const ownedHostels = isDbReady()
      ? await Hostel.find(req.user.role === "admin" ? {} : { owner: req.user._id || req.user.id }).limit(100)
      : hostels.filter((hostel) => req.user.role === "admin" || hostel.owner === req.user.id || ["u-owner", "u-landlord"].includes(req.user.id));
    const results = ownedHostels.map((hostel) => {
      const coords = pointFrom(hostel) || hostel.location || cityCenter(hostel.city);
      const hostelRooms = rooms.filter((room) => room.hostel === toId(hostel));
      const totalBeds = hostelRooms.reduce((sum, room) => sum + Number(room.totalBeds || 0), 0) || 12;
      const availableBeds = hostelRooms.reduce((sum, room) => sum + Number(room.availableBeds || 0), 0) || Number(hostel.availabilityLeft || 2);
      const occupancy = totalBeds ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0;
      return {
        id: toId(hostel),
        name: hostel.name,
        city: hostel.city,
        area: hostel.area,
        lat: coords.lat,
        lng: coords.lng,
        occupancy,
        availableBeds,
        totalBeds,
        monthlyRevenue: Number(hostel.minPrice || 18000) * Math.max(1, totalBeds - availableBeds),
        pendingRequests: Math.max(1, Number(hostel.availabilityLeft || availableBeds)),
        status: availableBeds <= 0 ? "full" : availableBeds <= 1 ? "limited" : "available"
      };
    });
    return res.json({ results, demo: !isDbReady() });
  } catch (error) {
    return next(error);
  }
});

router.post("/cache/invalidate", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ invalidated: true, collections: ["neighbourhood", "commute", "heatmap"], demo: true });
    const [neighbourhood, commute, heatmap] = await Promise.all([
      NeighbourhoodCache.deleteMany({}),
      CommuteCache.deleteMany({}),
      HeatmapCache.deleteMany({})
    ]);
    return res.json({ invalidated: true, deleted: { neighbourhood: neighbourhood.deletedCount, commute: commute.deletedCount, heatmap: heatmap.deletedCount } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
