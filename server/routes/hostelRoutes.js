const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const Hostel = require("../models/Hostel");
const HostelGroup = require("../models/HostelGroup");
const Room = require("../models/Room");
const Review = require("../models/Review");
const VisitRequest = require("../models/VisitRequest");
const HostelPulse = require("../models/HostelPulse");
const MessMenu = require("../models/MessMenu");
const AlumniRecord = require("../models/AlumniRecord");
const validate = require("../middleware/validate");
const { protect, authorize } = require("../middleware/auth");
const { assertNoContactLeak } = require("../services/contactGatingService");
const { getDnaScore } = require("../services/dnaScoreService");
const { hostels, rooms, reviews } = require("../data/mockData");
const { demoHostelGroups } = require("../data/demoRuntime");

const router = express.Router();

const asImageUrl = (image) => (typeof image === "string" ? image : image?.url);

// Demo-mode hostels only store a lightweight `groupId` string reference (e.g. "grp-royal")
// rather than a real populated document, so attach the group's display name/slug here --
// this keeps demo and live responses shaped the same way for the client.
const attachDemoGroupInfo = (hostel) => {
  if (!hostel.groupId) return hostel;
  const group = demoHostelGroups.find((item) => item.id === hostel.groupId);
  if (!group) return hostel;
  return { ...hostel, groupSlug: group.slug, groupName: group.name };
};

const shapeHostel = (hostel) => {
  const source = hostel.toObject ? hostel.toObject() : hostel;
  const populatedGroup = source.groupId && typeof source.groupId === "object" ? source.groupId : null;
  return {
    ...source,
    id: source._id || source.id,
    groupId: populatedGroup ? populatedGroup._id : source.groupId,
    groupSlug: populatedGroup ? populatedGroup.slug : source.groupSlug,
    groupName: populatedGroup ? populatedGroup.name : source.groupName,
    images: (source.images || []).map(asImageUrl).filter(Boolean)
  };
};

const distanceKm = (a, b) => {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const filterMockHostels = (query) => {
  const amenityFilters = query.amenities
    ? query.amenities.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [];

  let items = [...hostels];

  if (query.city) items = items.filter((item) => item.city.toLowerCase() === query.city.toLowerCase());
  if (query.type) items = items.filter((item) => item.type === query.type);
  if (query.gender) {
    const normalizedGender = query.gender.toLowerCase().includes("girl") || query.gender.toLowerCase().includes("female") ? "girls" : "boys";
    items = items.filter((item) => item.type === normalizedGender || item.type === "mixed");
  }
  if (query.minPrice) items = items.filter((item) => item.minPrice >= Number(query.minPrice));
  if (query.maxPrice) items = items.filter((item) => item.minPrice <= Number(query.maxPrice));
  if (query.university) {
    items = items.filter((item) =>
      item.nearbyUniversities.some((uni) => uni.name.toLowerCase().includes(query.university.toLowerCase()))
    );
  }
  if (amenityFilters.length) {
    items = items.filter((item) =>
      amenityFilters.every((amenity) =>
        item.amenities.map((a) => a.toLowerCase()).some((available) => available.includes(amenity))
      )
    );
  }
  if (query.groupSlug) {
    const group = demoHostelGroups.find((item) => item.slug === query.groupSlug);
    items = group ? items.filter((item) => item.groupId === group.id) : [];
  }
  if (query.search || query.q) {
    const term = String(query.search || query.q).toLowerCase();
    items = items.filter((item) => {
      if (item.name.toLowerCase().includes(term) || item.area.toLowerCase().includes(term)) return true;
      const group = item.groupId ? demoHostelGroups.find((groupItem) => groupItem.id === item.groupId) : null;
      return group ? group.name.toLowerCase().includes(term) : false;
    });
  }

  if (query.sort === "price-high") items.sort((a, b) => b.minPrice - a.minPrice);
  else if (query.sort === "rating") items.sort((a, b) => b.rating.average - a.rating.average);
  else items.sort((a, b) => a.minPrice - b.minPrice);

  return items;
};

const requiredVerificationMissing = (payload = {}) => {
  const verification = payload.ownerVerification || {};
  return [
    !verification.identityDocument?.url,
    !verification.propertyDocument?.url,
    !verification.agreement?.accepted,
    !verification.agreement?.offPlatformPolicyAccepted,
    !verification.agreement?.signedBy,
    !verification.agreement?.signerCnic
  ].some(Boolean);
};

const buildOwnerVerification = (req) => {
  const verification = req.body.ownerVerification || {};
  const now = new Date();

  return {
    status: "pending",
    identityDocument: {
      type: "identity",
      label: "Host identity proof",
      ...verification.identityDocument,
      status: "pending",
      uploadedAt: verification.identityDocument?.uploadedAt || now
    },
    propertyDocument: {
      type: "property",
      label: "Property ownership or authorization proof",
      ...verification.propertyDocument,
      status: "pending",
      uploadedAt: verification.propertyDocument?.uploadedAt || now
    },
    licenseDocument: verification.licenseDocument?.url
      ? {
          type: "license",
          label: "Hostel registration or license",
          ...verification.licenseDocument,
          status: "pending",
          uploadedAt: verification.licenseDocument.uploadedAt || now
        }
      : undefined,
    agreement: {
      version: "host-agreement-v3",
      ...verification.agreement,
      accepted: Boolean(verification.agreement?.accepted),
      signedAt: now,
      ipAddress: req.ip
    },
    submittedAt: now
  };
};

const demoMessMenus = [];
const demoAlumni = [
  { id: "alumni-1", hostelRef: "h1", studentRef: "u-student", university: "NUST", graduationYear: 2025, monthsStayed: 14, referralsGenerated: 2, review: { rating: 4.8, pros: ["Reliable mess", "Quiet study hours"], cons: ["Laundry rush on weekends"], text: "I stayed here through my final year and the location made daily classes easy." } },
  { id: "alumni-2", hostelRef: "h1", studentRef: "demo-alumni-2", university: "FAST-NU", graduationYear: 2024, monthsStayed: 18, referralsGenerated: 1, review: { rating: 4.6, pros: ["Good WiFi"], cons: ["Limited parking"], text: "A practical hostel for students who need predictable rent and a clean room." } }
];
const mealDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const defaultMessMenu = (hostelId) => ({
  hostelRef: hostelId,
  weekStartDate: new Date().toISOString().slice(0, 10),
  messScore: 4.6,
  meals: mealDays.flatMap((day, dayIndex) => [
    { mealId: `${hostelId}-${dayIndex}-breakfast`, day, type: "breakfast", items: ["Paratha", "Omelette", "Tea"], rating: 4.4, ratingCount: 18 },
    { mealId: `${hostelId}-${dayIndex}-lunch`, day, type: "lunch", items: ["Chicken pulao", "Raita", "Salad"], rating: 4.6, ratingCount: 22 },
    { mealId: `${hostelId}-${dayIndex}-dinner`, day, type: "dinner", items: ["Daal", "Chapati", "Rice"], rating: 4.2, ratingCount: 15 }
  ])
});

const buildLiveBoard = async (hostelId) => {
  const hostelRooms = mongoose.connection.readyState === 1
    ? await Room.find({ $or: [{ hostel: hostelId }, { hostProperty: hostelId }] }).select("title roomNumber totalBeds availableBeds status").lean()
    : rooms.filter((room) => room.hostel === hostelId || hostels.find((hostel) => hostel.id === hostelId || hostel.slug === hostelId)?.id === room.hostel);
  return {
    hostelId,
    generatedAt: new Date().toISOString(),
    summary: {
      rooms: hostelRooms.length,
      totalBeds: hostelRooms.reduce((sum, room) => sum + Number(room.totalBeds || 0), 0),
      availableBeds: hostelRooms.reduce((sum, room) => sum + Number(room.availableBeds || 0), 0),
      occupiedBeds: hostelRooms.reduce((sum, room) => sum + Number((room.totalBeds || 0) - (room.availableBeds || 0)), 0)
    },
    rooms: hostelRooms.map((room) => ({
      id: room._id || room.id,
      title: room.title || room.roomNumber,
      totalBeds: Number(room.totalBeds || 1),
      availableBeds: Number(room.availableBeds || 0),
      status: room.availableBeds > 0 ? "available" : room.status === "MAINTENANCE" ? "maintenance" : "occupied",
      beds: Array.from({ length: Number(room.totalBeds || 1) }, (_, index) => ({
        bed: index + 1,
        status: index < Number(room.availableBeds || 0) ? "available" : "occupied"
      }))
    }))
  };
};

const alumniSummary = (records = []) => {
  const byUniversity = records.reduce((acc, item) => {
    const key = item.university || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byGraduationYear = records.reduce((acc, item) => {
    const key = item.graduationYear || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    count: records.length,
    byUniversity,
    byGraduationYear,
    networkStrength: Math.min(100, 55 + records.length * 12 + records.reduce((sum, item) => sum + Number(item.referralsGenerated || 0), 0) * 5),
    sampleReviews: records.filter((item) => item.review).slice(0, 3).map((item) => ({
      university: item.university,
      graduationYear: item.graduationYear,
      rating: item.review.rating,
      pros: item.review.pros || [],
      cons: item.review.cons || [],
      text: item.review.text
    }))
  };
};

router.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);

    if (mongoose.connection.readyState !== 1) {
      const filtered = filterMockHostels(req.query);
      const start = (page - 1) * limit;
      return res.json({
        total: filtered.length,
        page,
        limit,
        results: filtered.slice(start, start + limit).map(attachDemoGroupInfo).map(shapeHostel)
      });
    }

    const query = {};
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    if (req.query.type) query.type = req.query.type;
    if (req.query.gender) {
      const normalizedGender = req.query.gender.toLowerCase().includes("girl") || req.query.gender.toLowerCase().includes("female") ? "girls" : "boys";
      query.type = { $in: [normalizedGender, "mixed"] };
    }
    if (req.query.minPrice || req.query.maxPrice) {
      query.minPrice = {};
      if (req.query.minPrice) query.minPrice.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.minPrice.$lte = Number(req.query.maxPrice);
    }
    if (req.query.amenities) {
      query.amenities = {
        $all: req.query.amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
      };
    }
    if (req.query.groupSlug) {
      const group = await HostelGroup.findOne({ slug: req.query.groupSlug }).select("_id");
      // No matching group -- force an empty result set (a random id) rather than
      // silently ignoring the filter and returning every hostel.
      query.groupId = group ? group._id : new mongoose.Types.ObjectId();
    }
    if (req.query.search || req.query.q) {
      const term = String(req.query.search || req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(term, "i");
      const matchingGroups = await HostelGroup.find({ name: pattern }).select("_id");
      query.$or = [
        { name: pattern },
        { area: pattern },
        ...(matchingGroups.length ? [{ groupId: { $in: matchingGroups.map((group) => group._id) } }] : [])
      ];
    }

    const sort = req.query.sort === "rating" ? { "rating.average": -1 } : req.query.sort === "price-high" ? { minPrice: -1 } : { minPrice: 1 };
    const [total, docs] = await Promise.all([
      Hostel.countDocuments(query),
      Hostel.find(query).populate("groupId", "name slug").sort(sort).skip((page - 1) * limit).limit(limit)
    ]);

    return res.json({ total, page, limit, results: docs.map(shapeHostel) });
  } catch (error) {
    return next(error);
  }
});

router.get("/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || 5);

    if (!lat || !lng) return res.status(400).json({ message: "lat and lng are required." });

    if (mongoose.connection.readyState !== 1) {
      const results = hostels
        .map((hostel) => ({ ...hostel, distanceKm: Number(distanceKm({ lat, lng }, hostel.location).toFixed(2)) }))
        .filter((hostel) => hostel.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      return res.json({ radius, results });
    }

    const docs = await Hostel.find({
      "location.coordinates": {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radius * 1000
        }
      }
    });

    return res.json({ radius, results: docs.map(shapeHostel) });
  } catch (error) {
    return next(error);
  }
});

router.get("/recommendations", (req, res) => {
  const budget = Number(req.query.budget || 25000);
  const city = req.query.city || "Islamabad";
  const type = req.query.type || "boys";

  const results = filterMockHostels({ city, type })
    .map((hostel) => {
      const priceScore = Math.max(0, 40 - Math.abs(hostel.minPrice - budget) / 500);
      const trustScore = hostel.isVerified ? 25 : 5;
      const ratingScore = hostel.rating.average * 7;
      return { ...hostel, matchScore: Math.round(priceScore + trustScore + ratingScore) };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  res.json({ results });
});

router.post("/:id/visit-request", protect, async (req, res, next) => {
  try {
    if (!req.body.preferredDate) return res.status(400).json({ message: "Preferred date is required." });

    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        visitRequest: {
          id: `visit-${Date.now()}`,
          student: req.user.id,
          hostel: req.params.id,
          preferredDate: req.body.preferredDate,
          preferredTime: req.body.preferredTime,
          note: req.body.note,
          status: "pending"
        },
        demo: true
      });
    }

    const visitRequest = await VisitRequest.create({
      student: req.user._id || req.user.id,
      hostel: req.params.id,
      preferredDate: req.body.preferredDate,
      preferredTime: req.body.preferredTime,
      note: req.body.note
    });

    return res.status(201).json({ visitRequest });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/dna-score", async (req, res, next) => {
  try {
    const id = req.params.id;
    const hostel = mongoose.connection.readyState === 1
      ? await Hostel.findOne(mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }).lean()
      : hostels.find((item) => item.id === id || item.slug === id) || hostels[0];
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    const hostelRooms = mongoose.connection.readyState === 1
      ? await Room.find({ hostel: hostel._id }).lean()
      : rooms.filter((room) => room.hostel === hostel.id);
    const hostelReviews = mongoose.connection.readyState === 1
      ? await Review.find({ hostel: hostel._id, moderationStatus: { $ne: "rejected" } }).lean()
      : reviews.filter((review) => review.hostel === hostel.id);
    const score = await getDnaScore(id, { hostel, hostelRooms, hostelReviews });
    return res.json({ score, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/pulse", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (mongoose.connection.readyState === 1) {
      const record = await HostelPulse.findOne({ $or: [{ hostel: id }, { hostelRef: id }] }).sort({ updatedAt: -1 }).lean();
      if (record) return res.json({ pulse: record });
    }
    const hostel = hostels.find((item) => item.id === id || item.slug === id) || hostels[0];
    const hostelRooms = rooms.filter((room) => room.hostel === hostel.id);
    return res.json({
      pulse: {
        hostelRef: hostel.id,
        viewsLast24h: 128,
        bookingsLast24h: 3,
        availableBeds: hostelRooms.reduce((sum, room) => sum + Number(room.availableBeds || 0), 0),
        lastReviewAge: "2 days ago",
        lastMessUpdate: new Date(Date.now() - 6 * 3600000).toISOString(),
        pulseLevel: "active"
      },
      demo: mongoose.connection.readyState !== 1
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/mess-menu", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const menu = await MessMenu.findOne({ $or: [{ hostel: req.params.id }, { hostelRef: req.params.id }] }).sort({ weekStartDate: -1 }).lean();
      if (menu) return res.json({ menu });
    }
    const menu = demoMessMenus.find((item) => item.hostelRef === req.params.id) || defaultMessMenu(req.params.id);
    return res.json({ menu, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/mess-menu", protect, authorize("host", "owner", "landlord", "admin"), async (req, res, next) => {
  try {
    const payload = {
      hostel: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : undefined,
      hostelRef: req.params.id,
      weekStartDate: req.body.weekStartDate || new Date(),
      meals: req.body.meals?.length ? req.body.meals : defaultMessMenu(req.params.id).meals,
      city: req.body.city,
      messScore: Number(req.body.messScore || 4.5),
      updatedByName: req.user.name
    };
    if (mongoose.connection.readyState !== 1) {
      const menu = { id: `menu-${Date.now()}`, ...payload, updatedAt: new Date().toISOString() };
      const index = demoMessMenus.findIndex((item) => item.hostelRef === req.params.id);
      if (index >= 0) demoMessMenus[index] = menu;
      else demoMessMenus.unshift(menu);
      return res.status(201).json({ menu, demo: true });
    }
    const menu = await MessMenu.findOneAndUpdate(
      { $or: [{ hostel: req.params.id }, { hostelRef: req.params.id }] },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ menu });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/live-board", async (req, res, next) => {
  try {
    const board = await buildLiveBoard(req.params.id);
    return res.json({ board, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/live-board/stream", async (req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const send = async () => {
      const board = await buildLiveBoard(req.params.id);
      res.write(`event: live-board\n`);
      res.write(`data: ${JSON.stringify(board)}\n\n`);
    };
    await send();
    const timer = setInterval(send, 15000);
    req.on("close", () => clearInterval(timer));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/alumni", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const hostel = hostels.find((item) => item.id === req.params.id || item.slug === req.params.id) || hostels[0];
      const records = demoAlumni.filter((item) => item.hostelRef === hostel.id || item.hostelRef === req.params.id);
      return res.json({ summary: alumniSummary(records), demo: true });
    }
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id) ? { $or: [{ hostel: req.params.id }, { hostelRef: req.params.id }] } : { hostelRef: req.params.id };
    const records = await AlumniRecord.find(lookup).sort({ createdAt: -1 }).lean();
    return res.json({ summary: alumniSummary(records) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/alumni/link", protect, async (req, res, next) => {
  try {
    const payload = {
      hostel: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : undefined,
      hostelRef: req.params.id,
      student: req.user._id,
      studentRef: req.user.id,
      university: req.body.university || req.user.university || "NUST",
      graduationYear: Number(req.body.graduationYear || new Date().getFullYear()),
      monthsStayed: Number(req.body.monthsStayed || 12),
      badge: "Alumni",
      review: req.body.review
    };
    if (payload.monthsStayed < 6) return res.status(400).json({ message: "Alumni badge requires at least 6 months of stay history." });
    if (mongoose.connection.readyState !== 1) {
      const record = { id: `alumni-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoAlumni.unshift(record);
      return res.status(201).json({ record, pointsEligible: payload.monthsStayed >= 12 ? 1500 : 1000, demo: true });
    }
    const record = await AlumniRecord.findOneAndUpdate(
      { hostelRef: req.params.id, studentRef: req.user.id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ record, pointsEligible: payload.monthsStayed >= 12 ? 1500 : 1000 });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/alumni/referral", protect, async (req, res, next) => {
  try {
    const points = 1500;
    if (mongoose.connection.readyState !== 1) {
      const record = demoAlumni.find((item) => item.hostelRef === req.params.id && item.studentRef === req.user.id) || demoAlumni[0];
      if (record) record.referralsGenerated = Number(record.referralsGenerated || 0) + 1;
      return res.status(201).json({
        referral: { id: `alumni-ref-${Date.now()}`, hostelRef: req.params.id, referredEmail: req.body.email, pointsForAlumni: points, pointsForNewStudent: points, status: "invited" },
        demo: true
      });
    }
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { $or: [{ hostel: req.params.id, student: req.user._id }, { hostelRef: req.params.id, studentRef: req.user.id }] }
      : { hostelRef: req.params.id, studentRef: req.user.id };
    await AlumniRecord.findOneAndUpdate(lookup, { $inc: { referralsGenerated: 1 } }, { new: true });
    return res.status(201).json({ referral: { hostelRef: req.params.id, referredEmail: req.body.email, pointsForAlumni: points, pointsForNewStudent: points, status: "invited" } });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/photos", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (mongoose.connection.readyState !== 1) {
      const hostel = hostels.find((item) => item.id === id || item.slug === id) || hostels[0];
      const hostelRooms = rooms.filter((room) => room.hostel === hostel.id);
      const reviewPhotos = reviews
        .filter((review) => review.hostel === hostel.id)
        .flatMap((review) => (review.photos || []).map((url) => ({ url, source: "review", uploader: review.student || "Verified Tenant", label: "Review photo", likes: 4 })));
      const hostPhotos = (hostel.images || []).map((url, index) => ({ id: `host-${index}`, url, source: "host", uploader: "Host", label: hostel.name, likes: 12 + index }));
      const roomPhotos = hostelRooms.flatMap((room) => (room.photos || room.images || []).slice(0, 2).map((url, index) => ({
        id: `${room.id}-${index}`,
        url,
        source: "room",
        uploader: "Host",
        label: room.title,
        roomId: room.id,
        likes: 8 + index
      })));
      return res.json({ results: [...hostPhotos, ...roomPhotos, ...reviewPhotos], demo: true });
    }

    const lookup = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { slug: id }] } : { slug: id };
    const hostel = await Hostel.findOne(lookup);
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    const [hostelRooms, hostelReviews] = await Promise.all([
      Room.find({ hostel: hostel._id }).select("title photos images"),
      Review.find({ hostel: hostel._id }).populate("student", "name").select("photos student createdAt")
    ]);
    const hostPhotos = (hostel.images || []).map((image, index) => ({ id: `host-${index}`, url: asImageUrl(image), source: "host", uploader: "Host", label: hostel.name, likes: 12 + index })).filter((item) => item.url);
    const roomPhotos = hostelRooms.flatMap((room) => (room.photos?.length ? room.photos : room.images || []).map((url, index) => ({ id: `${room._id}-${index}`, url, source: "room", uploader: "Host", label: room.title, roomId: room._id, likes: 5 + index })));
    const reviewPhotos = hostelReviews.flatMap((review) => (review.photos || []).map((url, index) => ({ id: `${review._id}-${index}`, url, source: "review", uploader: review.student?.name || "Verified Tenant", label: "Review photo", likes: 4, createdAt: review.createdAt })));
    return res.json({ results: [...hostPhotos, ...roomPhotos, ...reviewPhotos] });
  } catch (error) {
    return next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const hostel = hostels.find((item) => item.slug === req.params.slug);
      if (!hostel) return res.status(404).json({ message: "Hostel not found." });
      return res.json({
        hostel: shapeHostel(attachDemoGroupInfo(hostel)),
        rooms: rooms.filter((room) => room.hostel === hostel.id),
        reviews: reviews.filter((review) => review.hostel === hostel.id),
        nearby: hostels.filter((item) => item.city === hostel.city && item.id !== hostel.id).slice(0, 3)
      });
    }

    const hostel = await Hostel.findOneAndUpdate({ slug: req.params.slug }, { $inc: { totalViews: 1 } }, { new: true }).populate("groupId", "name slug");
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    const [hostelRooms, hostelReviews, nearby] = await Promise.all([
      Room.find({ hostel: hostel._id }),
      Review.find({ hostel: hostel._id }).populate("student", "name university avatar"),
      Hostel.find({ city: hostel.city, _id: { $ne: hostel._id } }).limit(3)
    ]);
    return res.json({ hostel: shapeHostel(hostel), rooms: hostelRooms, reviews: hostelReviews, nearby: nearby.map(shapeHostel) });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  protect,
  authorize("host", "admin"),
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("city").notEmpty().withMessage("City is required."),
    body("area").notEmpty().withMessage("Area is required."),
    body("address").notEmpty().withMessage("Address is required."),
    body("type").isIn(["boys", "girls", "mixed"]).withMessage("Invalid hostel type."),
    body("ownerVerification.identityDocument.url").notEmpty().withMessage("Host identity proof is required."),
    body("ownerVerification.propertyDocument.url").notEmpty().withMessage("Property ownership or authorization proof is required."),
    body("ownerVerification.agreement.accepted")
      .custom((value) => value === true || value === "true")
      .withMessage("Host agreement must be accepted."),
    body("ownerVerification.agreement.offPlatformPolicyAccepted")
      .custom((value) => value === true || value === "true")
      .withMessage("Off-platform payment policy must be accepted."),
    body("ownerVerification.agreement.signedBy").trim().notEmpty().withMessage("Agreement signer name is required."),
    body("ownerVerification.agreement.signerCnic").trim().notEmpty().withMessage("Agreement signer CNIC is required.")
  ],
  validate,
  async (req, res, next) => {
    try {
      if (requiredVerificationMissing(req.body)) {
        return res.status(400).json({ message: "Identity proof, property proof, signed Host agreement, and off-platform payment acknowledgement are required." });
      }
      assertNoContactLeak({
        name: req.body.name,
        description: req.body.description,
        address: req.body.address,
        rules: Array.isArray(req.body.rules) ? req.body.rules.join(" ") : req.body.rules
      });

      const ownerVerification = buildOwnerVerification(req);
      const payload = {
        ...req.body,
        ownerVerification,
        isVerified: false,
        status: "pending"
      };

      if (mongoose.connection.readyState !== 1) {
        return res.status(201).json({ hostel: { id: `demo-${Date.now()}`, ...payload, owner: req.user.id }, demo: true });
      }

      const hostel = await Hostel.create({ ...payload, owner: req.user._id || req.user.id });
      return res.status(201).json({ hostel: shapeHostel(hostel) });
    } catch (error) {
      return next(error);
    }
  }
);

router.put("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    assertNoContactLeak({
      name: req.body.name,
      description: req.body.description,
      address: req.body.address,
      rules: Array.isArray(req.body.rules) ? req.body.rules.join(" ") : req.body.rules
    });
    if (mongoose.connection.readyState !== 1) {
      const existingDemo = hostels.find((item) => item.id === req.params.id || item.slug === req.params.id);
      if (!existingDemo) return res.status(404).json({ message: "Hostel not found." });
      if (req.user.role !== "admin" && String(existingDemo.owner) !== String(req.user._id || req.user.id)) {
        return res.status(403).json({ message: "You can only update hostels you own." });
      }
      return res.json({ hostel: { ...existingDemo, ...req.body, id: existingDemo.id }, demo: true });
    }
    const existing = await Hostel.findById(req.params.id).select("owner");
    if (!existing) return res.status(404).json({ message: "Hostel not found." });
    if (req.user.role !== "admin" && String(existing.owner) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ message: "You can only update hostels you own." });
    }
    const hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    return res.json({ hostel: shapeHostel(hostel) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const existingDemo = hostels.find((item) => item.id === req.params.id || item.slug === req.params.id);
      if (!existingDemo) return res.status(404).json({ message: "Hostel not found." });
      if (req.user.role !== "admin" && String(existingDemo.owner) !== String(req.user._id || req.user.id)) {
        return res.status(403).json({ message: "You can only delete hostels you own." });
      }
      return res.json({ deleted: true, demo: true });
    }
    const existing = await Hostel.findById(req.params.id).select("owner");
    if (!existing) return res.status(404).json({ message: "Hostel not found." });
    if (req.user.role !== "admin" && String(existing.owner) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ message: "You can only delete hostels you own." });
    }
    await Hostel.findByIdAndDelete(req.params.id);
    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/verify", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, isVerified: true, demo: true });
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    if (requiredVerificationMissing(hostel)) {
      return res.status(409).json({ message: "Verification package is incomplete. Required documents and agreement must be present before approval." });
    }
    hostel.isVerified = true;
    hostel.status = "active";
    hostel.ownerVerification.status = "approved";
    hostel.ownerVerification.reviewedAt = new Date();
    hostel.ownerVerification.reviewedBy = req.user._id || req.user.id;
    hostel.ownerVerification.identityDocument.status = "approved";
    hostel.ownerVerification.propertyDocument.status = "approved";
    if (hostel.ownerVerification.licenseDocument?.url) {
      hostel.ownerVerification.licenseDocument.status = "approved";
    }
    await hostel.save();
    return res.json({ hostel: shapeHostel(hostel) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/feature", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, isFeatured: true, demo: true });
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    hostel.isFeatured = !hostel.isFeatured;
    await hostel.save();
    return res.json({ hostel: shapeHostel(hostel) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
