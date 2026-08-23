const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const BedBlock = require("../models/BedBlock");
const Block = require("../models/Block");
const RentOffer = require("../models/RentOffer");
const validate = require("../middleware/validate");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const { calculateAvailability } = require("../middleware/availability");
const { buildWaitlistEntry, waitlistMessage } = require("../services/waitlistService");
const { assertNoContactLeak, publicHostProfile } = require("../services/contactGatingService");
const { recommendRooms } = require("../services/recommendationService");
const { forecastForRoom } = require("../services/vacancyForecastService");
const { getTrustScore } = require("../services/trustScoreService");
const { recordAudit } = require("../services/auditService");
const { computeImageHash, hammingDistance, isLikelyDuplicate, isSharpAvailable } = require("../services/imageHashService");
const { rooms, users, bookings } = require("../data/mockData");
const { demoBedBlocks, demoBlocks } = require("../data/demoRuntime");
const { demoOffers } = require("./offerRoutes");

const router = express.Router();

const asCoordinates = (room = {}) => {
  if (room.coordinates?.lat && room.coordinates?.lng) return room.coordinates;
  if (room.location?.coordinates?.length === 2) return { lat: room.location.coordinates[1], lng: room.location.coordinates[0] };
  return null;
};

const pointInBbox = (point, bbox) => {
  if (!point || !bbox) return true;
  const [swLat, swLng, neLat, neLng] = bbox;
  return point.lat >= swLat && point.lat <= neLat && point.lng >= swLng && point.lng <= neLng;
};

const pointInPolygon = (point, polygon) => {
  if (!point || !polygon?.length) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

const distanceKm = (a, b) => {
  if (!a || !b) return Infinity;
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const parseBbox = (value) => {
  if (!value) return null;
  const values = String(value).split(",").map(Number);
  return values.length === 4 && values.every(Number.isFinite) ? values : null;
};

const parsePolygon = (value) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length >= 3 ? parsed.map((point) => point.map(Number)) : null;
  } catch {
    return null;
  }
};

const mapMarkerRoom = (room) => ({
  id: room.id || room._id,
  slug: room.slug || room.id || room._id,
  title: room.title,
  location: asCoordinates(room),
  coordinates: asCoordinates(room),
  roomType: room.roomType,
  listingCategory: room.listingCategory,
  pricePerHead: room.pricePerHead || room.pricePerBed,
  availableBeds: room.availableBeds,
  totalBeds: room.totalBeds,
  genderPolicy: room.genderPolicy,
  instantBooking: room.instantBooking,
  photo: room.photos?.[0] || room.images?.[0],
  photos: room.photos?.length ? room.photos.slice(0, 1) : room.images?.slice(0, 1) || [],
  rating: room.rating || 4.7,
  virtualTourUrl: room.virtualTourUrl || room.videoTour,
  panoramaUrl: room.panoramaUrl
});

const normalizeRoom = (room) => {
  const source = room?.toObject ? room.toObject() : room;
  if (!source) return null;
  const coordinates = asCoordinates(source);
  return {
    ...source,
    id: source._id || source.id,
    coordinates,
    location: source.location || (coordinates ? { type: "Point", coordinates: [coordinates.lng, coordinates.lat] } : undefined),
    pricePerHead: source.pricePerHead || source.pricePerBed,
    pricePerRoom: source.pricePerRoom || source.pricePerBed,
    photos: source.photos?.length ? source.photos : source.images || [],
    amenities: source.amenities?.length ? source.amenities : source.facilities || [],
    lister: source.listedBy?.name
      ? publicHostProfile(source.listedBy)
      : publicHostProfile(users.find((user) => user.id === source.listedBy) || users.find((user) => ["host", "owner", "landlord"].includes(user.role)))
  };
};

const OCCUPIED_BOOKING_STATUSES = ["confirmed", "payment_pending", "active", "overdue"];

const shapeOccupantProfile = (profile) => {
  if (!profile || profile.visibleToProspectiveRoommates === false || !profile.occupantType) return null;
  return {
    occupantType: profile.occupantType,
    fieldOrSubject: profile.fieldOrSubject,
    studyLevel: profile.studyLevel,
    bio: profile.bio
  };
};

// Surfaces category-level "who lives here" info (occupation, field/subject, study level, a
// short bio) for each currently-occupied bed in a room, so a prospective tenant browsing
// before booking can judge fit -- e.g. "1 teacher (Mathematics)" -- without ever exposing the
// occupant's name, email, or phone. Respects each occupant's own opt-out
// (`occupantProfile.visibleToProspectiveRoommates`) by simply omitting that bed's entry.
// Mirrors the contact-gating philosophy in services/contactGatingService.js.
const buildOccupantSummaries = async ({ room, availability }) => {
  const totalBeds = availability?.totalBeds || room.totalBeds || 1;
  const availableIndices = new Set(availability?.availableBedIndices || []);
  const blockedIndices = new Set((availability?.blocks || []).map((block) => block.bedIndex));
  const occupiedIndices = Array.from({ length: totalBeds }, (_, index) => index).filter(
    (index) => !availableIndices.has(index) && !blockedIndices.has(index)
  );
  if (!occupiedIndices.length) return [];

  const roomId = String(room._id || room.id);

  if (mongoose.connection.readyState !== 1) {
    const roomBookings = bookings.filter((booking) => String(booking.room) === roomId && OCCUPIED_BOOKING_STATUSES.includes(booking.status));
    return occupiedIndices
      .map((bedIndex, position) => {
        const booking = roomBookings[position];
        const occupant = booking && users.find((user) => user.id === booking.student);
        const profile = shapeOccupantProfile(occupant?.occupantProfile);
        return profile ? { bedIndex, ...profile } : null;
      })
      .filter(Boolean);
  }

  const roomBookings = await Booking.find({ room: roomId, status: { $in: OCCUPIED_BOOKING_STATUSES } })
    .populate("student", "occupantProfile")
    .sort({ bedIndex: 1, createdAt: 1 })
    .lean();

  return occupiedIndices
    .map((bedIndex, position) => {
      const booking = roomBookings.find((item) => item.bedIndex === bedIndex) || roomBookings[position];
      const profile = shapeOccupantProfile(booking?.student?.occupantProfile);
      return profile ? { bedIndex, ...profile } : null;
    })
    .filter(Boolean);
};

const filterDemoRooms = (query) => {
  let results = rooms.map(normalizeRoom);
  const bbox = parseBbox(query.bbox);
  const polygon = parsePolygon(query.polygon);
  const radiusCenter = query.lat && query.lng ? { lat: Number(query.lat), lng: Number(query.lng) } : null;
  const radius = Number(query.radius || 0);
  if (query.hostelId) results = results.filter((room) => room.hostel === query.hostelId);
  if (query.city) results = results.filter((room) => String(room.city || "").toLowerCase() === query.city.toLowerCase());
  if (query.type || query.roomType) {
    const type = String(query.roomType || query.type).toUpperCase();
    results = results.filter((room) => room.roomType === type || String(room.type).toUpperCase() === type);
  }
  if (query.listingCategory) results = results.filter((room) => room.listingCategory === query.listingCategory);
  if (query.gender) {
    const gender = String(query.gender).toLowerCase();
    results = results.filter((room) => String(room.genderPolicy || "").toLowerCase().includes(gender.replace("female", "girls").replace("male", "boys")));
  }
  if (query.maxPrice) results = results.filter((room) => Number(room.pricePerHead || room.pricePerBed) <= Number(query.maxPrice));
  if (query.university) results = results.filter((room) => String(room.nearestUniversity || "").toLowerCase().includes(query.university.toLowerCase()));
  if (query.meals) results = results.filter((room) => room.mealPlan && room.mealPlan !== "NONE");
  if (query.instantBooking === "true") results = results.filter((room) => room.instantBooking);
  if (bbox) results = results.filter((room) => pointInBbox(asCoordinates(room), bbox));
  if (polygon) results = results.filter((room) => pointInPolygon(asCoordinates(room), polygon));
  if (radiusCenter && radius) results = results.filter((room) => distanceKm(radiusCenter, asCoordinates(room)) <= radius);
  return results.sort((a, b) => Number(a.pricePerHead || a.pricePerBed) - Number(b.pricePerHead || b.pricePerBed));
};

const roomPayload = (req) => {
  const bodyPayload = { ...req.body };
  assertNoContactLeak({
    title: bodyPayload.title,
    address: bodyPayload.address,
    landmark: bodyPayload.landmark,
    rules: Array.isArray(bodyPayload.rules) ? bodyPayload.rules.join(" ") : bodyPayload.rules,
    description: bodyPayload.description
  });
  const roomType = bodyPayload.roomType || String(bodyPayload.type || "double").toUpperCase();
  const legacyTypeMap = {
    SINGLE: "single",
    DOUBLE: "double",
    TRIPLE: "triple",
    QUAD: "quad",
    BUNK_DORM: "dorm",
    SEMI_PRIVATE: "double",
    PG: "pg",
    STUDIO: "studio",
    ENTIRE_FLOOR: "floor"
  };
  return {
    ...bodyPayload,
    roomNumber: bodyPayload.roomNumber || `ROOM-${Date.now()}`,
    type: bodyPayload.type || legacyTypeMap[roomType] || "double",
    roomType,
    pricePerBed: Number(bodyPayload.pricePerBed || bodyPayload.pricePerHead || bodyPayload.pricePerRoom || 0),
    pricePerHead: Number(bodyPayload.pricePerHead || bodyPayload.pricePerBed || bodyPayload.pricePerRoom || 0),
    pricePerRoom: Number(bodyPayload.pricePerRoom || bodyPayload.pricePerHead || bodyPayload.pricePerBed || 0),
    securityDeposit: Number(bodyPayload.securityDeposit || 5000),
    totalBeds: Number(bodyPayload.totalBeds || 1),
    availableBeds: Number(bodyPayload.availableBeds ?? bodyPayload.totalBeds ?? 1),
    mealCost: Number(bodyPayload.mealCost || 0),
    distanceToUniversity: Number(bodyPayload.distanceToUniversity || 0),
    coordinates: bodyPayload.coordinates,
    location: bodyPayload.location || (bodyPayload.coordinates?.lat && bodyPayload.coordinates?.lng
      ? { type: "Point", coordinates: [Number(bodyPayload.coordinates.lng), Number(bodyPayload.coordinates.lat)] }
      : undefined),
    virtualTourUrl: bodyPayload.virtualTourUrl || bodyPayload.videoTour,
    panoramaUrl: bodyPayload.panoramaUrl,
    description: bodyPayload.description,
    descriptionUrdu: bodyPayload.descriptionUrdu,
    listedBy: req.user?._id || req.user?.id,
    contactScanStatus: "clean"
  };
};

const DUPLICATE_PHOTO_CANDIDATE_LIMIT = 300;

/**
 * Computes perceptual hashes for a room's photos, stores them on the room,
 * and -- when a hash closely matches a hash already stored on a DIFFERENT
 * host's room -- writes an AuditLog entry (status "pending") so admins can
 * review the possible duplicate/stolen photo in the existing audit-log
 * moderation view (GET /api/v1/operations/audit-logs). This never blocks or
 * rejects the upload: perceptual hashing is a heuristic that can have false
 * positives (e.g. stock photos, same host re-using their own images), so it
 * only flags for human review.
 */
const hashAndFlagRoomPhotos = async ({ room, req }) => {
  const photoUrls = (room.photos?.length ? room.photos : room.images) || [];
  if (!photoUrls.length) return;

  const hashes = (await Promise.all(photoUrls.map((url) => computeImageHash(url)))).filter(Boolean);
  if (!hashes.length) return;

  const candidates = await Room.find({ _id: { $ne: room._id }, imageHashes: { $exists: true, $ne: [] } })
    .select("title listedBy imageHashes")
    .limit(DUPLICATE_PHOTO_CANDIDATE_LIMIT)
    .lean();

  const duplicates = [];
  for (const candidate of candidates) {
    if (String(candidate.listedBy || "") === String(room.listedBy || "")) continue; // same host re-using their own photos is not fraud
    const matchedHash = (candidate.imageHashes || []).find((existingHash) => hashes.some((hash) => isLikelyDuplicate(hash, existingHash)));
    if (matchedHash) {
      const sourceHash = hashes.find((hash) => isLikelyDuplicate(hash, matchedHash));
      duplicates.push({
        roomId: String(candidate._id),
        roomTitle: candidate.title,
        listedBy: String(candidate.listedBy || ""),
        hammingDistance: hammingDistance(sourceHash, matchedHash)
      });
    }
  }

  room.imageHashes = hashes;
  await room.save();

  if (duplicates.length) {
    await recordAudit(req, {
      action: "listing.duplicate_photo_flagged",
      entityType: "Room",
      entityId: room._id,
      status: "pending",
      metadata: {
        note: "Perceptual hash match found against another host's listing photos. Heuristic signal only -- needs human review before any moderation action.",
        newRoomId: String(room._id),
        newRoomListedBy: String(room.listedBy || ""),
        matches: duplicates,
        sharpAvailable: isSharpAvailable()
      }
    });
  }
};

router.get("/", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const results = filterDemoRooms(req.query);
      return res.json({ results: req.query.view === "map" || req.query.slim === "true" ? results.map(mapMarkerRoom) : results });
    }

    const query = { status: { $ne: "ARCHIVED" } };
    const bbox = parseBbox(req.query.bbox);
    const polygon = parsePolygon(req.query.polygon);
    if (req.query.hostelId) query.$or = [{ hostel: req.query.hostelId }, { hostProperty: req.query.hostelId }];
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    if (req.query.roomType || req.query.type) query.roomType = String(req.query.roomType || req.query.type).toUpperCase();
    if (req.query.listingCategory) query.listingCategory = req.query.listingCategory;
    if (req.query.gender) query.genderPolicy = new RegExp(req.query.gender, "i");
    if (req.query.maxPrice) query.pricePerHead = { $lte: Number(req.query.maxPrice) };
    if (req.query.university) query.nearestUniversity = new RegExp(req.query.university, "i");
    if (req.query.meals) query.mealPlan = { $ne: "NONE" };
    if (req.query.instantBooking === "true") query.instantBooking = true;
    if (bbox) {
      const [swLat, swLng, neLat, neLng] = bbox;
      query.location = { $geoWithin: { $box: [[swLng, swLat], [neLng, neLat]] } };
    }
    if (polygon) {
      query.location = { $geoWithin: { $polygon: polygon.map(([lat, lng]) => [lng, lat]) } };
    }
    if (req.query.lat && req.query.lng && req.query.radius) {
      query.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [Number(req.query.lng), Number(req.query.lat)] },
          $maxDistance: Number(req.query.radius) * 1000
        }
      };
    }

    const results = await Room.find(query).populate("listedBy", "name role avatar landlordProfile").sort({ pricePerHead: 1, pricePerBed: 1 });
    const normalized = results.map(normalizeRoom);
    return res.json({ results: req.query.view === "map" || req.query.slim === "true" ? normalized.map(mapMarkerRoom) : normalized });
  } catch (error) {
    return next(error);
  }
});

router.post("/generate-description", protect, authorize("host", "admin"), (req, res) => {
  const roomType = String(req.body.roomType || req.body.type || "shared room").replaceAll("_", " ").toLowerCase();
  const city = req.body.city || "Islamabad";
  const area = req.body.area || req.body.address || "a central student area";
  const price = Number(req.body.pricePerHead || req.body.pricePerBed || req.body.pricePerRoom || 0);
  const amenities = (req.body.amenities || req.body.facilities || ["WiFi", "study space", "secure access"]).join(", ");
  const university = req.body.nearestUniversity || req.body.university || "nearby universities";
  const mealPlan = String(req.body.mealPlan || "FULL_BOARD").replaceAll("_", " ").toLowerCase();
  const gender = String(req.body.genderPolicy || "students").replaceAll("_", " ").toLowerCase();
  const english = [
    `This ${roomType} in ${area}, ${city} is designed for students who want a reliable, secure, and practical living setup close to ${university}.`,
    `The room includes ${amenities}, with a ${mealPlan} arrangement and clear ${gender} policy so students can evaluate fit before booking.`,
    price ? `Monthly rent starts from PKR ${price.toLocaleString("en-PK")} per head, with booking, rent tracking, and support handled through Basera.` : "Pricing, availability, and booking support are handled through Basera.",
    "The listing is written to highlight verified details, daily convenience, study comfort, and transparent move-in expectations."
  ].join(" ");
  const urdu = `یہ ${roomType} ${area}, ${city} میں طلبہ کے لیے ایک محفوظ اور عملی رہائشی انتخاب ہے۔ سہولیات میں ${amenities} شامل ہیں، ${mealPlan} پلان دستیاب ہے، اور بکنگ Basera کے ذریعے شفاف طریقے سے مکمل ہوتی ہے۔`;
  return res.json({ english, urdu, provider: process.env.CLAUDE_API_KEY ? "claude-ready" : "template-fallback", demo: !process.env.CLAUDE_API_KEY });
});

router.post("/compare", protect, async (req, res) => {
  const ids = (req.body.roomIds || []).slice(0, 5).map(String);
  const selected = ids.length ? filterDemoRooms({}).filter((room) => ids.includes(String(room.id || room._id))) : filterDemoRooms({}).slice(0, 4);
  const results = selected.map((room) => {
    const rent = Number(room.pricePerHead || room.pricePerBed || 0);
    const deposit = Number(room.securityDeposit || 5000);
    const commute = Number(room.distanceToUniversity || 15);
    return {
      id: room.id || room._id,
      title: room.title,
      city: room.city,
      area: room.area,
      roomType: room.roomType,
      rent,
      deposit,
      moveInCost: rent + deposit + Number(room.mealCost || 0),
      commuteMinutes: commute,
      mealPlan: room.mealPlan,
      safetyScore: (room.amenities || []).some((item) => /cctv|security/i.test(item)) ? 88 : 72,
      rules: [room.genderPolicy, room.curfewTime || "Flexible"],
      image: room.photos?.[0] || room.image
    };
  });
  return res.json({ results, comparedAt: new Date().toISOString(), demo: mongoose.connection.readyState !== 1 });
});

router.get("/recommendations", async (req, res, next) => {
  try {
    const limit = Math.min(24, Math.max(1, Number(req.query.limit || 9)));
    if (mongoose.connection.readyState !== 1) {
      const filtered = filterDemoRooms(req.query);
      return res.json({ results: recommendRooms(req.query, filtered).slice(0, limit), demo: true });
    }

    const query = { status: "ACTIVE", isAvailable: true };
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    if (req.query.gender) query.genderPolicy = new RegExp(req.query.gender, "i");
    if (req.query.maxPrice) query.pricePerHead = { $lte: Number(req.query.maxPrice) };
    if (req.query.roomType) query.roomType = String(req.query.roomType).toUpperCase();
    if (req.query.listingCategory) query.listingCategory = req.query.listingCategory;

    const results = await Room.find(query).populate("listedBy", "name role avatar landlordProfile hostProfile").limit(80);
    return res.json({ results: recommendRooms(req.query, results.map(normalizeRoom)).slice(0, limit) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/availability", async (req, res, next) => {
  try {
    const room = mongoose.connection.readyState === 1 ? await Room.findById(req.params.id) : rooms.find((item) => item.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    const availability = await calculateAvailability({ room, from: req.query.from, to: req.query.to });
    const occupants = await buildOccupantSummaries({ room, availability });
    return res.json({ ...availability, occupants });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/availability-calendar", async (req, res, next) => {
  try {
    const room = mongoose.connection.readyState === 1 ? await Room.findById(req.params.id) : rooms.find((item) => item.id === req.params.id) || rooms[0];
    if (!room) return res.status(404).json({ message: "Room not found." });

    const from = req.query.from ? new Date(req.query.from) : new Date();
    const days = Math.min(60, Math.max(1, Number(req.query.days || 14)));
    const calendar = [];
    for (let index = 0; index < days; index += 1) {
      const date = new Date(from.getTime() + index * 86400000);
      const iso = date.toISOString().slice(0, 10);
      const availability = await calculateAvailability({ room, from: iso, to: iso });
      calendar.push({
        date: iso,
        totalBeds: availability.totalBeds,
        availableBeds: availability.availableBeds,
        occupiedBeds: availability.occupiedBeds,
        blockedBeds: availability.blockedBeds,
        bedStatuses: Array.from({ length: availability.totalBeds }, (_, bedIndex) => {
          if (availability.availableBedIndices.includes(bedIndex)) return { bedIndex, status: "available" };
          const block = availability.blocks.find((item) => item.bedIndex === bedIndex);
          if (!block) return { bedIndex, status: "occupied" };
          // A "booked_offline" hold is a manual warden/host correction (cash booking, family
          // walk-in, etc.) and must render distinctly from repair/cleaning/owner holds so
          // staff can tell "unavailable because of a real hold" from "unavailable because we
          // manually marked it booked".
          return {
            bedIndex,
            status: block.reason === "booked_offline" ? "booked_offline" : "blocked",
            reason: block.reason,
            note: block.note
          };
        })
      });
    }

    return res.json({ roomId: req.params.id, calendar });
  } catch (error) {
    return next(error);
  }
});

// Wardens are only allowed to touch bed blocks (including the "booked_offline" manual
// override) for rooms that live inside a block they are actually assigned to. Hosts/owners/
// admins are trusted at the role level (same as every other host-scoped route in this file),
// but wardens get this extra per-room check enforced server-side, not just hidden in the UI.
const isRoomInWardenBlock = async ({ roomId, wardenId }) => {
  if (mongoose.connection.readyState !== 1) {
    const room = rooms.find((item) => item.id === roomId);
    if (!room?.blockId) return false;
    const block = demoBlocks.find((item) => item.id === room.blockId);
    return Boolean(block && String(block.wardenId) === String(wardenId));
  }
  const room = await Room.findById(roomId).select("blockId").lean();
  if (!room?.blockId) return false;
  const block = await Block.findById(room.blockId).select("wardenId").lean();
  return Boolean(block && String(block.wardenId) === String(wardenId));
};

router.get("/:id/bed-blocks", protect, authorize("host", "owner", "landlord", "admin", "warden"), async (req, res, next) => {
  try {
    const isWarden = canonicalRole(req.user.role) === "warden";
    if (isWarden) {
      const scoped = await isRoomInWardenBlock({ roomId: req.params.id, wardenId: req.user._id || req.user.id });
      if (!scoped) return res.status(403).json({ message: "You are not assigned to this room's block." });
    }

    if (mongoose.connection.readyState !== 1) {
      const results = demoBedBlocks.filter((block) => String(block.room) === String(req.params.id) && (req.query.status ? block.status === req.query.status : true));
      return res.json({ results, demo: true });
    }

    const query = { room: req.params.id };
    if (req.query.status) query.status = req.query.status;
    const results = await BedBlock.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/bed-blocks", protect, authorize("host", "owner", "landlord", "admin", "warden"), async (req, res, next) => {
  try {
    const isWarden = canonicalRole(req.user.role) === "warden";
    if (isWarden) {
      const scoped = await isRoomInWardenBlock({ roomId: req.params.id, wardenId: req.user._id || req.user.id });
      if (!scoped) return res.status(403).json({ message: "You are not assigned to this room's block." });
    }

    const payload = {
      room: req.params.id,
      bedIndex: Number(req.body.bedIndex || 0),
      from: req.body.from || new Date().toISOString(),
      to: req.body.to || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: req.body.reason || "maintenance",
      note: req.body.note,
      status: "active"
    };

    if (mongoose.connection.readyState !== 1) {
      const block = { id: `BB-${Date.now()}`, ...payload, createdBy: req.user.id, createdAt: new Date().toISOString() };
      demoBedBlocks.unshift(block);
      await recordAudit(req, { action: "room.bed_block.created", entityType: "BedBlock", entityId: block.id, metadata: payload });
      return res.status(201).json({ block, demo: true });
    }

    const block = await BedBlock.create({ ...payload, createdBy: req.user._id || req.user.id });
    await recordAudit(req, { action: "room.bed_block.created", entityType: "BedBlock", entityId: block._id, metadata: payload });
    return res.status(201).json({ block });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/bed-blocks/:blockId", protect, authorize("host", "owner", "landlord", "admin", "warden"), async (req, res, next) => {
  try {
    const isWarden = canonicalRole(req.user.role) === "warden";
    if (isWarden) {
      const scoped = await isRoomInWardenBlock({ roomId: req.params.id, wardenId: req.user._id || req.user.id });
      if (!scoped) return res.status(403).json({ message: "You are not assigned to this room's block." });
    }

    const updates = {};
    if (req.body.status) updates.status = req.body.status; // "active" | "released" -- this is the reversible toggle
    if (req.body.note !== undefined) updates.note = req.body.note;
    if (req.body.reason) updates.reason = req.body.reason;

    if (mongoose.connection.readyState !== 1) {
      const index = demoBedBlocks.findIndex((block) => String(block.id) === String(req.params.blockId) && String(block.room) === String(req.params.id));
      if (index === -1) return res.status(404).json({ message: "Bed block not found." });
      demoBedBlocks[index] = { ...demoBedBlocks[index], ...updates, updatedAt: new Date().toISOString() };
      await recordAudit(req, { action: "room.bed_block.updated", entityType: "BedBlock", entityId: demoBedBlocks[index].id, metadata: updates });
      return res.json({ block: demoBedBlocks[index], demo: true });
    }

    const block = await BedBlock.findOneAndUpdate({ _id: req.params.blockId, room: req.params.id }, updates, { new: true, runValidators: true });
    if (!block) return res.status(404).json({ message: "Bed block not found." });
    await recordAudit(req, { action: "room.bed_block.updated", entityType: "BedBlock", entityId: block._id, metadata: updates });
    return res.json({ block });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/waitlist", protect, async (req, res, next) => {
  try {
    const room = mongoose.connection.readyState === 1 ? await Room.findById(req.params.id) : rooms.find((item) => item.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });

    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({ waitlistEntry: buildWaitlistEntry({ user: req.user, room }), message: waitlistMessage(room), demo: true });
    }

    await Room.findByIdAndUpdate(req.params.id, { $addToSet: { waitlist: req.user._id || req.user.id } });
    return res.status(201).json({ joined: true, message: waitlistMessage(room) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/waitlist", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ left: true, demo: true });
    await Room.findByIdAndUpdate(req.params.id, { $pull: { waitlist: req.user._id || req.user.id } });
    return res.json({ left: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/trial", protect, async (req, res, next) => {
  try {
    const days = Math.min(7, Math.max(3, Number(req.body.days || 3)));
    const room = mongoose.connection.readyState === 1 ? await Room.findById(req.params.id) : rooms.find((item) => item.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    if (!room.trialStayAvailable) return res.status(400).json({ message: "Trial stay is not available for this room." });

    const dailyRate = Math.ceil(Number(room.pricePerHead || room.pricePerBed || 0) / 30);
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        trialRequest: {
          id: `trial-${Date.now()}`,
          room: req.params.id,
          days,
          totalAmount: dailyRate * days,
          status: "pending"
        },
        demo: true
      });
    }

    const booking = await Booking.create({
      student: req.user._id || req.user.id,
      room: room._id,
      hostel: room.hostel,
      checkIn: req.body.moveInDate || new Date(),
      duration: "trial",
      bookingType: "TRIAL",
      moveInDate: req.body.moveInDate || new Date(),
      moveOutDate: new Date(new Date(req.body.moveInDate || Date.now()).getTime() + days * 24 * 60 * 60 * 1000),
      beds: 1,
      totalAmount: dailyRate * days,
      totalRent: dailyRate * days,
      commission: Math.round(dailyRate * days * 0.1),
      ownerReceives: Math.round(dailyRate * days * 0.9),
      paymentMethod: req.body.paymentMethod || "cash",
      status: "pending"
    });
    return res.status(201).json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/vacancy-forecast", async (req, res, next) => {
  try {
    const forecast = await forecastForRoom(req.params.id);
    return res.json({ forecast, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/match-score", protect, async (req, res, next) => {
  try {
    const room = mongoose.connection.readyState === 1
      ? await Room.findById(req.params.id).lean()
      : rooms.find((item) => item.id === req.params.id) || rooms[0];
    if (!room) return res.status(404).json({ message: "Room not found." });

    const trust = await getTrustScore(req.user._id || req.user.id || "u-student");
    const budget = Number(req.query.budget || req.user.budget || req.user.studentProfile?.monthlyBudget || 25000);
    const rent = Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);
    const budgetFit = Math.max(0, 100 - Math.round(Math.abs(rent - budget) / Math.max(budget, 1) * 100));
    const university = String(req.query.university || req.user.university || "").toLowerCase();
    const campusFit = university && String(room.nearestUniversity || "").toLowerCase().includes(university) ? 100 : 74;
    const preferenceFit = String(room.genderPolicy || "").toLowerCase().includes(String(req.user.gender || req.query.gender || "").toLowerCase().slice(0, 4)) ? 92 : 80;
    const total = Math.round((budgetFit * 0.35) + (campusFit * 0.25) + (preferenceFit * 0.2) + (Number(trust.score || 70) * 0.2));
    return res.json({
      match: {
        roomId: req.params.id,
        score: Math.max(0, Math.min(100, total)),
        label: total >= 88 ? "Excellent fit" : total >= 75 ? "Strong fit" : "Good fit",
        breakdown: {
          budgetFit,
          campusFit,
          preferenceFit,
          trustScore: trust.score || 70
        },
        suggestions: [
          budgetFit < 70 ? "Adjust budget or negotiate rent before booking." : "Budget is aligned with this room.",
          campusFit < 80 ? "Check commute route before confirming." : "Campus proximity looks good.",
          "Use group booking if friends are moving together."
        ]
      },
      demo: mongoose.connection.readyState !== 1
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/offers", protect, async (req, res, next) => {
  try {
    const offeredPrice = Number(req.body.offeredPrice || req.body.price || 0);
    if (offeredPrice <= 0) return res.status(400).json({ message: "Offered price is required." });
    const room = mongoose.connection.readyState === 1
      ? await Room.findById(req.params.id).populate("listedBy", "name")
      : rooms.find((item) => item.id === req.params.id) || rooms[0];
    if (!room) return res.status(404).json({ message: "Room not found." });
    const listedPrice = Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);
    const payload = {
      room: room._id,
      roomRef: room.id || String(room._id || req.params.id),
      roomTitle: room.title,
      student: req.user._id,
      studentRef: req.user.id,
      studentName: req.user.name,
      host: room.listedBy?._id || room.listedBy,
      hostRef: room.listedBy?.id || room.listedBy,
      listedPrice,
      offeredPrice,
      duration: req.body.duration || "Monthly",
      moveInDate: req.body.moveInDate,
      status: "pending",
      rounds: [{ by: "student", price: offeredPrice, message: req.body.message || "Student submitted a negotiation offer." }],
      expiresAt: new Date(Date.now() + 48 * 3600000)
    };
    if (mongoose.connection.readyState !== 1) {
      const offer = { id: `offer-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoOffers.unshift(offer);
      return res.status(201).json({ offer, demo: true });
    }
    const offer = await RentOffer.create(payload);
    return res.status(201).json({ offer });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const room = mongoose.connection.readyState === 1
      ? await Room.findById(req.params.id).populate("listedBy", "name role avatar hostProfile landlordProfile city").populate("hostel", "name slug city area address images rating")
      : rooms.find((item) => item.id === req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    const shapedRoom = normalizeRoom(room);
    const availability = await calculateAvailability({ room, from: req.query.from, to: req.query.to });
    const occupants = await buildOccupantSummaries({ room, availability });
    return res.json({ room: shapedRoom, availability, occupants });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  protect,
  authorize("host", "admin"),
  [
    body("roomType").optional().isIn(["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "BUNK_DORM", "SEMI_PRIVATE", "PG", "STUDIO", "ENTIRE_FLOOR"]),
    body("totalBeds").optional().isInt({ min: 1 }),
    body("availableBeds").optional().isInt({ min: 0 }),
    body("pricePerHead").optional().isNumeric()
  ],
  validate,
  async (req, res, next) => {
    try {
      const payload = roomPayload(req);
      if (mongoose.connection.readyState !== 1) return res.status(201).json({ room: { id: `room-${Date.now()}`, ...payload }, demo: true });
      const room = await Room.create(payload);
      await hashAndFlagRoomPhotos({ room, req });
      return res.status(201).json({ room: normalizeRoom(room) });
    } catch (error) {
      return next(error);
    }
  }
);

router.put("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ room: { id: req.params.id, ...req.body }, demo: true });
    const room = await Room.findByIdAndUpdate(req.params.id, roomPayload(req), { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found." });
    await hashAndFlagRoomPhotos({ room, req });
    return res.json({ room: normalizeRoom(room) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deleted: true, archived: true, demo: true });
    await Room.findByIdAndUpdate(req.params.id, { status: "ARCHIVED", isAvailable: false });
    return res.json({ deleted: true, archived: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
