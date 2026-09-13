const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const SavedSearch = require("../models/SavedSearch");
const RoommateProfile = require("../models/RoommateProfile");
const StudentActivity = require("../models/StudentActivity");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyClaim = require("../models/LoyaltyClaim");
const LoyaltyRedemption = require("../models/LoyaltyRedemption");
const { protect } = require("../middleware/auth");
const { rooms, hostels } = require("../data/mockData");
const { demoLoyaltyAccount, demoLoyaltyClaims, demoPlatformSettings } = require("../data/demoRuntime");
const { rewardsCatalog } = require("../data/rewardsCatalog");
const { assertNoContactLeak } = require("../services/contactGatingService");
const { recordActivityContributionLedger } = require("../services/ledgerService");

const router = express.Router();

const isDbReady = () => mongoose.connection.readyState === 1;

const demoSavedSearches = [
  {
    id: "ss-nust-budget",
    title: "NUST rooms under 20k",
    filters: { city: "Islamabad", university: "NUST", maxBudget: 20000, roomType: "DOUBLE", amenities: ["WiFi", "Mess"] },
    frequency: "daily",
    isActive: true
  }
];

const demoActivities = [
  {
    id: "act-murree",
    title: "Saturday Murree Day Trip",
    type: "trip",
    location: "Murree",
    activityDate: "2026-06-13T08:00:00.000Z",
    description: "Shared transport, lunch stop, and return by evening.",
    capacity: 10,
    contributionTarget: 25000,
    contributionPerPerson: 2500,
    status: "open",
    visibility: "campus",
    organizerName: "Ali Ahmed",
    participants: [{ name: "Ali Ahmed", status: "joined" }, { name: "Hamza Sheikh", status: "joined" }],
    contributions: [{ name: "Ali Ahmed", amount: 2500, paymentMethod: "jazzcash", status: "paid" }]
  },
  {
    id: "act-cricket",
    title: "F-10 Evening Cricket",
    type: "sports",
    location: "F-10 Park Ground",
    activityDate: "2026-06-08T17:30:00.000Z",
    description: "Friendly tape-ball match with shared ground and refreshments cost.",
    capacity: 14,
    contributionTarget: 5600,
    contributionPerPerson: 400,
    status: "open",
    visibility: "hostel",
    organizerName: "Bilal Khan",
    participants: [{ name: "Bilal Khan", status: "joined" }],
    contributions: []
  }
];

// Other students shown on the demo leaderboard alongside the live demo account (Ali
// Ahmed / demoLoyaltyAccount). Kept separate from demoLoyaltyAccount so referral/claim
// actions that mutate demoLoyaltyAccount.pointsBalance are reflected live on refresh.
const demoLeaderboardPeers = [
  { name: "Hamza Sheikh", points: 6200 },
  { name: "Noor Fatima", points: 5400 },
  { name: "Bilal Khan", points: 3800 },
  { name: "Sarah Malik", points: 3200 },
  { name: "Usman Tariq", points: 2600 },
  { name: "Ayesha Raza", points: 2100 },
  { name: "Hassan Iqbal", points: 1500 }
];

// In-memory redemption log used only when Mongo isn't connected (demo mode).
const demoRedemptions = [];

// Masks a full name to "First L." for leaderboard privacy (e.g. "Ahmed Khan" -> "Ahmed K.").
const maskName = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Student";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const toId = (value) => String(value?._id || value?.id || value || "");

const referralCodeFor = (user = {}) => {
  const name = String(user.name || user.email || "student")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const suffix = String(user._id || user.id || Date.now()).slice(-5).toUpperCase();
  return `HH-${name || "STU"}-${suffix}`;
};

const loyaltyShape = (account, claims = []) => ({
  account: {
    id: toId(account),
    referralCode: account.referralCode,
    pointsBalance: account.pointsBalance || 0,
    lifetimePoints: account.lifetimePoints || 0,
    pointsRedeemed: account.pointsRedeemed || 0,
    referralCount: account.referralCount || account.referrals?.length || 0,
    referrals: account.referrals || []
  },
  claims: claims.map((claim) => ({
    ...(claim.toObject ? claim.toObject() : claim),
    id: toId(claim)
  })),
  config: {
    referralPoints: demoPlatformSettings.loyaltyReferralPoints,
    claimThreshold: demoPlatformSettings.loyaltyClaimThreshold,
    discountRange: [demoPlatformSettings.loyaltyDiscountMin, demoPlatformSettings.loyaltyDiscountMax]
  }
});

const ensureLoyaltyAccount = async (user) => {
  const studentId = user._id || user.id;
  let account = await LoyaltyAccount.findOne({ student: studentId });
  if (!account) {
    account = await LoyaltyAccount.create({
      student: studentId,
      referralCode: referralCodeFor(user)
    });
  }
  return account;
};

const hostelForRoom = (room) => {
  const hostelId = toId(room.hostel);
  if (room.hostel?.name) return room.hostel;
  return hostels.find((hostel) => hostel.id === hostelId) || null;
};

const priceFor = (room) => Number(room.pricePerHead || room.pricePerBed || room.pricePerRoom || 0);

const amenityScore = (room) => {
  const amenities = room.amenities || room.facilities || [];
  const important = ["WiFi", "Mess", "CCTV", "Security", "AC", "Laundry", "Parking", "Study Table"];
  return important.reduce((score, item) => score + (amenities.some((amenity) => String(amenity).toLowerCase().includes(item.toLowerCase())) ? 1 : 0), 0);
};

const compareShape = (room) => {
  const hostel = hostelForRoom(room);
  const price = priceFor(room);
  const distance = Number(room.distanceToUniversity || 20);
  const deposit = Number(room.securityDeposit || 0);
  const mealCost = Number(room.mealCost || 0);
  const totalMoveInCost = price + deposit + mealCost;
  const amenities = room.amenities || room.facilities || [];
  const valueScore = Math.max(35, Math.min(98, Math.round(100 - price / 700 + amenityScore(room) * 5 + Number(room.availableBeds || 0) * 2)));
  const commuteScore = Math.max(20, Math.min(100, Math.round(100 - distance * 3)));
  const safetyScore = Math.min(100, 55 + (hostel?.isVerified ? 25 : 0) + (amenities.some((item) => /cctv|security/i.test(item)) ? 15 : 0));

  return {
    id: toId(room),
    title: room.title || `${room.roomType || room.type} room`,
    hostelName: hostel?.name || room.hostelName || "Independent listing",
    city: room.city || hostel?.city,
    area: room.area || hostel?.area,
    roomType: room.roomType || String(room.type || "").toUpperCase(),
    pricePerHead: price,
    securityDeposit: deposit,
    mealCost,
    totalMoveInCost,
    availableBeds: room.availableBeds,
    nearestUniversity: room.nearestUniversity,
    distanceToUniversity: distance,
    mealPlan: room.mealPlan,
    genderPolicy: room.genderPolicy,
    curfewTime: room.curfewTime || "Flexible",
    amenities,
    image: room.photos?.[0] || room.images?.[0] || hostel?.images?.[0],
    scores: {
      value: valueScore,
      commute: commuteScore,
      amenities: Math.min(100, amenityScore(room) * 14),
      safety: safetyScore
    },
    highlights: [
      price <= 18000 ? "Budget friendly" : "Premium option",
      distance <= 10 ? "Close commute" : "Longer commute",
      room.instantBooking ? "Instant booking" : "Host approval",
      hostel?.isVerified ? "Verified property" : "Identity checked"
    ]
  };
};

const filterRooms = (filters = {}) => {
  const maxBudget = Number(filters.maxBudget || filters.budget || 0);
  return rooms.filter((room) => {
    if (filters.city && String(room.city).toLowerCase() !== String(filters.city).toLowerCase()) return false;
    if (filters.roomType && String(room.roomType).toLowerCase() !== String(filters.roomType).toLowerCase()) return false;
    if (filters.genderPolicy && String(room.genderPolicy).toLowerCase() !== String(filters.genderPolicy).toLowerCase()) return false;
    if (filters.university && !String(room.nearestUniversity || "").toLowerCase().includes(String(filters.university).toLowerCase())) return false;
    if (maxBudget && priceFor(room) > maxBudget) return false;
    if (filters.amenities?.length) {
      const text = (room.amenities || []).join(" ").toLowerCase();
      if (!filters.amenities.every((item) => text.includes(String(item).toLowerCase()))) return false;
    }
    return true;
  });
};

const roomQueryFromFilters = (filters = {}) => {
  const query = { status: "ACTIVE" };
  if (filters.city) query.city = new RegExp(`^${String(filters.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (filters.roomType) query.roomType = String(filters.roomType).toUpperCase();
  if (filters.genderPolicy) query.genderPolicy = String(filters.genderPolicy).toUpperCase();
  if (filters.university) query.nearestUniversity = new RegExp(String(filters.university).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (filters.maxBudget) query.$or = [{ pricePerHead: { $lte: Number(filters.maxBudget) } }, { pricePerBed: { $lte: Number(filters.maxBudget) } }];
  return query;
};

const compatibilityScore = (profile, room) => {
  let score = 50;
  if (profile.city && String(profile.city).toLowerCase() === String(room.city).toLowerCase()) score += 10;
  if (profile.university && String(room.nearestUniversity || "").toLowerCase().includes(String(profile.university).toLowerCase())) score += 14;
  if (profile.budget && priceFor(room) <= Number(profile.budget)) score += 12;
  if (profile.foodPreference === "mess" && ["FULL_BOARD", "TWO_MEALS", "BREAKFAST"].includes(room.mealPlan)) score += 8;
  if (profile.foodPreference === "self_cook" && (room.amenities || []).some((item) => /kitchen/i.test(item))) score += 8;
  if (profile.noiseTolerance === "low" && ["SINGLE", "PG", "STUDIO"].includes(room.roomType)) score += 8;
  if (profile.cleanliness === "strict" && (room.amenities || []).some((item) => /clean|laundry|cctv/i.test(item))) score += 5;
  return Math.min(98, score);
};

const activitySummary = (activity) => {
  const source = activity.toObject ? activity.toObject() : activity;
  const participants = source.participants || [];
  const contributions = source.contributions || [];
  const collected = contributions.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    ...source,
    id: toId(source),
    participantCount: participants.filter((item) => item.status !== "cancelled").length,
    collectedAmount: collected,
    remainingAmount: Math.max(0, Number(source.contributionTarget || 0) - collected),
    collectionProgress: Number(source.contributionTarget || 0) ? Math.round((collected / Number(source.contributionTarget || 1)) * 100) : 0
  };
};

router.get("/compare", protect, async (req, res, next) => {
  try {
    const ids = String(req.query.roomIds || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!isDbReady()) {
      const selected = ids.length ? rooms.filter((room) => ids.includes(room.id)) : rooms.slice(0, 4);
      return res.json({ results: selected.map(compareShape), demo: true });
    }

    const query = ids.length && ids.every((id) => mongoose.Types.ObjectId.isValid(id)) ? { _id: { $in: ids } } : {};
    const results = await Room.find(query).populate("hostel", "name city area images isVerified").limit(4);
    return res.json({ results: results.map(compareShape) });
  } catch (error) {
    return next(error);
  }
});

router.get("/roommate-profile", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const profile = {
        city: "Islamabad",
        university: "NUST",
        budget: 20000,
        sleepSchedule: "balanced",
        studyStyle: "silent",
        cleanliness: "regular",
        noiseTolerance: "low",
        foodPreference: "mess"
      };
      const matches = rooms.slice(0, 5).map((room) => ({ ...compareShape(room), matchScore: compatibilityScore(profile, room) })).sort((a, b) => b.matchScore - a.matchScore);
      return res.json({ profile, matches, demo: true });
    }

    const profile = await RoommateProfile.findOne({ student: req.user._id || req.user.id });
    const source = profile || {};
    const query = roomQueryFromFilters({ city: source.city, university: source.university, maxBudget: source.budget });
    const candidates = await Room.find(query).populate("hostel", "name city area images isVerified").limit(12);
    return res.json({ profile, matches: candidates.map((room) => ({ ...compareShape(room), matchScore: compatibilityScore(source, room) })).sort((a, b) => b.matchScore - a.matchScore) });
  } catch (error) {
    return next(error);
  }
});

router.post("/roommate-profile", protect, async (req, res, next) => {
  try {
    const payload = {
      city: req.body.city,
      university: req.body.university,
      budget: Number(req.body.budget || 0),
      genderPreference: req.body.genderPreference || "any",
      sleepSchedule: req.body.sleepSchedule || "balanced",
      studyStyle: req.body.studyStyle || "normal",
      cleanliness: req.body.cleanliness || "regular",
      noiseTolerance: req.body.noiseTolerance || "medium",
      foodPreference: req.body.foodPreference || "any",
      guestsComfort: req.body.guestsComfort || "sometimes",
      notes: req.body.notes
    };

    if (!isDbReady()) {
      const matches = filterRooms({ city: payload.city, university: payload.university, maxBudget: payload.budget })
        .map((room) => ({ ...compareShape(room), matchScore: compatibilityScore(payload, room) }))
        .sort((a, b) => b.matchScore - a.matchScore);
      return res.status(201).json({ profile: payload, matches, demo: true });
    }

    const profile = await RoommateProfile.findOneAndUpdate(
      { student: req.user._id || req.user.id },
      { ...payload, student: req.user._id || req.user.id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const candidates = await Room.find(roomQueryFromFilters({ city: profile.city, university: profile.university, maxBudget: profile.budget })).populate("hostel", "name city area images isVerified").limit(12);
    return res.status(201).json({ profile, matches: candidates.map((room) => ({ ...compareShape(room), matchScore: compatibilityScore(profile, room) })).sort((a, b) => b.matchScore - a.matchScore) });
  } catch (error) {
    return next(error);
  }
});

router.get("/saved-searches", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoSavedSearches, demo: true });
    const results = await SavedSearch.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/saved-searches", protect, async (req, res, next) => {
  try {
    const payload = {
      title: req.body.title || `${req.body.city || "Any city"} saved search`,
      filters: {
        city: req.body.city,
        university: req.body.university,
        maxBudget: Number(req.body.maxBudget || 0),
        roomType: req.body.roomType,
        genderPolicy: req.body.genderPolicy,
        amenities: req.body.amenities || []
      },
      frequency: req.body.frequency || "daily",
      isActive: true
    };

    if (!isDbReady()) {
      const item = { id: `ss-${Date.now()}`, ...payload };
      demoSavedSearches.unshift(item);
      return res.status(201).json({ search: item, matches: filterRooms(payload.filters).map(compareShape), demo: true });
    }

    const search = await SavedSearch.create({ ...payload, student: req.user._id || req.user.id });
    const matches = await Room.find(roomQueryFromFilters(payload.filters)).populate("hostel", "name city area images isVerified").limit(8);
    return res.status(201).json({ search, matches: matches.map(compareShape) });
  } catch (error) {
    return next(error);
  }
});

router.get("/saved-searches/alerts", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const alerts = demoSavedSearches.map((search) => ({
        search,
        matches: filterRooms(search.filters).slice(0, 4).map(compareShape)
      }));
      return res.json({ alerts, demo: true });
    }

    const searches = await SavedSearch.find({ student: req.user._id || req.user.id, isActive: true }).sort({ createdAt: -1 });
    const alerts = await Promise.all(
      searches.map(async (search) => {
        const matches = await Room.find(roomQueryFromFilters(search.filters)).populate("hostel", "name city area images isVerified").limit(4);
        return { search, matches: matches.map(compareShape) };
      })
    );
    return res.json({ alerts });
  } catch (error) {
    return next(error);
  }
});

router.delete("/saved-searches/:id", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const index = demoSavedSearches.findIndex((item) => item.id === req.params.id);
      if (index >= 0) demoSavedSearches.splice(index, 1);
      return res.json({ deleted: true, demo: true });
    }
    await SavedSearch.findOneAndDelete({ _id: req.params.id, student: req.user._id || req.user.id });
    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/activities", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) return res.json({ results: demoActivities.map(activitySummary), demo: true });
    const results = await StudentActivity.find({ status: { $ne: "cancelled" } }).populate("organizer", "name avatar").sort({ activityDate: 1 }).limit(50);
    return res.json({ results: results.map(activitySummary) });
  } catch (error) {
    return next(error);
  }
});

router.post("/activities", protect, async (req, res, next) => {
  try {
    assertNoContactLeak({ title: req.body.title, description: req.body.description, paymentNote: req.body.paymentNote });
    const payload = {
      title: req.body.title,
      type: req.body.type || "trip",
      location: req.body.location,
      activityDate: req.body.activityDate,
      description: req.body.description,
      capacity: Number(req.body.capacity || 8),
      contributionTarget: Number(req.body.contributionTarget || 0),
      contributionPerPerson: Number(req.body.contributionPerPerson || 0),
      paymentNote: req.body.paymentNote || "Collect through Basera contribution tracker.",
      visibility: req.body.visibility || "campus",
      status: "open"
    };
    if (!payload.title || !payload.location || !payload.activityDate) return res.status(400).json({ message: "Title, location, and date are required." });

    if (!isDbReady()) {
      const activity = {
        id: `act-${Date.now()}`,
        ...payload,
        organizerName: req.user.name || "Student",
        participants: [{ name: req.user.name || "Student", status: "joined" }],
        contributions: []
      };
      demoActivities.unshift(activity);
      return res.status(201).json({ activity: activitySummary(activity), demo: true });
    }

    const activity = await StudentActivity.create({
      ...payload,
      organizer: req.user._id || req.user.id,
      participants: [{ student: req.user._id || req.user.id, name: req.user.name, status: "joined" }]
    });
    return res.status(201).json({ activity: activitySummary(activity) });
  } catch (error) {
    return next(error);
  }
});

router.post("/activities/:id/join", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      const activity = demoActivities.find((item) => item.id === req.params.id) || demoActivities[0];
      if (!activity.participants.some((item) => item.name === req.user.name)) activity.participants.push({ name: req.user.name || "Student", status: req.body.status || "joined" });
      return res.json({ activity: activitySummary(activity), demo: true });
    }

    const activity = await StudentActivity.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: "Activity not found." });
    const alreadyJoined = activity.participants.some((item) => toId(item.student) === toId(req.user._id || req.user.id));
    if (!alreadyJoined) activity.participants.push({ student: req.user._id || req.user.id, name: req.user.name, status: req.body.status || "joined" });
    await activity.save();
    return res.json({ activity: activitySummary(activity) });
  } catch (error) {
    return next(error);
  }
});

router.post("/activities/:id/contribute", protect, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (amount <= 0) return res.status(400).json({ message: "Contribution amount is required." });
    const paymentMethod = req.body.paymentMethod || "jazzcash";
    const paymentRef = req.body.paymentRef || `ACT-${Date.now()}`;

    if (!isDbReady()) {
      const activity = demoActivities.find((item) => item.id === req.params.id) || demoActivities[0];
      activity.contributions.push({ name: req.user.name || "Student", amount, paymentMethod, paymentRef, status: "paid", paidAt: new Date().toISOString() });
      if (!activity.participants.some((item) => item.name === req.user.name)) activity.participants.push({ name: req.user.name || "Student", status: "joined" });
      const ledger = await recordActivityContributionLedger({ activity, student: req.user, amount, paymentMethod, paymentRef });
      return res.status(201).json({ activity: activitySummary(activity), contribution: activity.contributions.at(-1), ledger, demo: true });
    }

    const activity = await StudentActivity.findById(req.params.id);
    if (!activity) return res.status(404).json({ message: "Activity not found." });
    activity.contributions.push({ student: req.user._id || req.user.id, name: req.user.name, amount, paymentMethod, paymentRef, status: "paid", paidAt: new Date() });
    if (!activity.participants.some((item) => toId(item.student) === toId(req.user._id || req.user.id))) {
      activity.participants.push({ student: req.user._id || req.user.id, name: req.user.name, status: "joined" });
    }
    await activity.save();
    const ledger = await recordActivityContributionLedger({ activity, student: req.user, amount, paymentMethod, paymentRef });
    return res.status(201).json({ activity: activitySummary(activity), contribution: activity.contributions.at(-1), ledger });
  } catch (error) {
    return next(error);
  }
});

router.get("/loyalty", protect, async (req, res, next) => {
  try {
    if (!isDbReady()) {
      return res.json({
        ...loyaltyShape(demoLoyaltyAccount, demoLoyaltyClaims.filter((claim) => claim.student === (req.user.id || "u-student"))),
        demo: true
      });
    }

    const account = await ensureLoyaltyAccount(req.user);
    const claims = await LoyaltyClaim.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 }).limit(10);
    return res.json(loyaltyShape(account, claims));
  } catch (error) {
    return next(error);
  }
});

router.post("/loyalty/referrals", protect, async (req, res, next) => {
  try {
    const referredEmail = String(req.body.referredEmail || "").trim().toLowerCase();
    const referredName = String(req.body.referredName || "").trim() || "Referred student";
    if (!referredEmail || !referredEmail.includes("@")) return res.status(400).json({ message: "Valid referred student email is required." });
    if (referredEmail === String(req.user.email || "").toLowerCase()) return res.status(400).json({ message: "You cannot refer your own account." });

    const points = Number(demoPlatformSettings.loyaltyReferralPoints || 1000);
    const referral = {
      id: `ref-${Date.now()}`,
      referredName,
      referredEmail,
      status: "completed",
      pointsAwarded: points,
      awardedAt: new Date().toISOString()
    };

    if (!isDbReady()) {
      // Idempotency guard (demo mode): a student re-submitting the same referral
      // (double click, retried request) must not be credited twice for the same
      // referredEmail.
      const alreadyReferredDemo = demoLoyaltyAccount.referrals.some(
        (item) => String(item.referredEmail || "").toLowerCase() === referredEmail
      );
      if (alreadyReferredDemo) {
        return res.status(409).json({
          message: "This student has already been referred.",
          ...loyaltyShape(demoLoyaltyAccount, demoLoyaltyClaims),
          demo: true
        });
      }
      demoLoyaltyAccount.referrals.unshift(referral);
      demoLoyaltyAccount.pointsBalance += points;
      demoLoyaltyAccount.lifetimePoints += points;
      demoLoyaltyAccount.referralCount += 1;
      return res.status(201).json({
        referral,
        ...loyaltyShape(demoLoyaltyAccount, demoLoyaltyClaims),
        demo: true
      });
    }

    const account = await ensureLoyaltyAccount(req.user);
    const claims = await LoyaltyClaim.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 }).limit(10);
    const alreadyReferred = account.referrals.some((item) => String(item.referredEmail || "").toLowerCase() === referredEmail);
    if (alreadyReferred) {
      return res.status(409).json({ message: "This student has already been referred.", ...loyaltyShape(account, claims) });
    }

    // Atomic idempotency guard: the filter's "referrals.referredEmail": { $ne }
    // condition and the $push/$inc happen in a single Mongo update, so two
    // concurrent requests for the same referredEmail cannot both succeed in
    // crediting points (unlike a read-balance-then-save pattern, which would
    // race). If another request already added this email between our check
    // above and this update, findOneAndUpdate simply matches nothing and
    // returns null here.
    const updatedAccount = await LoyaltyAccount.findOneAndUpdate(
      { _id: account._id, "referrals.referredEmail": { $ne: referredEmail } },
      {
        $push: {
          referrals: {
            referredName,
            referredEmail,
            status: "completed",
            pointsAwarded: points,
            awardedAt: new Date()
          }
        },
        $inc: { pointsBalance: points, lifetimePoints: points, referralCount: 1 }
      },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(409).json({ message: "This student has already been referred.", ...loyaltyShape(account, claims) });
    }

    return res.status(201).json({
      referral: updatedAccount.referrals.at(-1),
      ...loyaltyShape(updatedAccount, claims)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/loyalty/claims", protect, async (req, res, next) => {
  try {
    const threshold = Number(demoPlatformSettings.loyaltyClaimThreshold || 5000);
    const preferredDiscountPercent = Math.min(
      Number(demoPlatformSettings.loyaltyDiscountMax || 10),
      Math.max(Number(demoPlatformSettings.loyaltyDiscountMin || 5), Number(req.body.preferredDiscountPercent || 5))
    );

    if (!isDbReady()) {
      if (demoLoyaltyAccount.pointsBalance < threshold) {
        return res.status(422).json({ message: `You need ${threshold.toLocaleString("en-PK")} loyalty points to claim a discount.` });
      }
      const claim = {
        id: `claim-${Date.now()}`,
        student: req.user.id || "u-student",
        studentName: req.user.name || "Student",
        requestedPoints: threshold,
        preferredDiscountPercent,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      demoLoyaltyAccount.pointsBalance -= threshold;
      demoLoyaltyAccount.pointsRedeemed += threshold;
      demoLoyaltyClaims.unshift(claim);
      return res.status(201).json({ claim, ...loyaltyShape(demoLoyaltyAccount, demoLoyaltyClaims), demo: true });
    }

    const account = await ensureLoyaltyAccount(req.user);
    if (account.pointsBalance < threshold) return res.status(422).json({ message: `You need ${threshold.toLocaleString("en-PK")} loyalty points to claim a discount.` });

    const existingPending = await LoyaltyClaim.findOne({ student: req.user._id || req.user.id, status: "pending" });
    if (existingPending) return res.status(409).json({ message: "You already have a pending loyalty discount claim.", claim: existingPending });

    // Found during live QA: firing 5 identical concurrent claim requests all
    // returned 201 and created 5 separate pending 5,000-point claims from a
    // single 5,000-point balance -- the previous `account.pointsBalance -=
    // threshold; await account.save()` was a read-modify-write, not atomic, so
    // concurrent requests could all read the same starting balance before any of
    // them saved. Fixed the same way the loyalty/referrals route above already
    // correctly guards against duplicate referral awards: a single atomic
    // findOneAndUpdate with the balance check baked into the filter, so only as
    // many concurrent requests as the account can actually afford will succeed --
    // any request that loses the race gets a clean 422 instead of over-crediting.
    const updatedAccount = await LoyaltyAccount.findOneAndUpdate(
      { _id: account._id, pointsBalance: { $gte: threshold } },
      { $inc: { pointsBalance: -threshold, pointsRedeemed: threshold } },
      { new: true }
    );
    if (!updatedAccount) {
      return res.status(422).json({ message: `You need ${threshold.toLocaleString("en-PK")} loyalty points to claim a discount.` });
    }

    const claim = await LoyaltyClaim.create({
      student: req.user._id || req.user.id,
      requestedPoints: threshold,
      preferredDiscountPercent,
      status: "pending"
    });
    const claims = await LoyaltyClaim.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 }).limit(10);
    return res.status(201).json({ claim, ...loyaltyShape(updatedAccount, claims) });
  } catch (error) {
    return next(error);
  }
});

router.get("/loyalty/leaderboard", protect, async (req, res, next) => {
  try {
    const limit = Math.min(20, Number(req.query.limit || 10));
    const userId = String(req.user._id || req.user.id || "");

    if (!isDbReady()) {
      const entries = [
        { id: "u-student", name: req.user.name || "Ali Ahmed", points: demoLoyaltyAccount.pointsBalance || 0, isCurrentStudent: true },
        ...demoLeaderboardPeers.map((peer, index) => ({ id: `peer-${index}`, ...peer, isCurrentStudent: false }))
      ]
        .sort((a, b) => b.points - a.points)
        .slice(0, limit)
        .map((entry, index) => ({ rank: index + 1, name: maskName(entry.name), points: entry.points, isCurrentStudent: entry.isCurrentStudent }));
      return res.json({ results: entries, demo: true });
    }

    const accounts = await LoyaltyAccount.find({}).sort({ pointsBalance: -1 }).limit(limit).populate("student", "name");
    const entries = accounts.map((account, index) => ({
      rank: index + 1,
      name: maskName(account.student?.name || "Student"),
      points: account.pointsBalance || 0,
      isCurrentStudent: toId(account.student) === userId
    }));
    return res.json({ results: entries });
  } catch (error) {
    return next(error);
  }
});

router.get("/loyalty/rewards", protect, async (req, res, next) => {
  try {
    return res.json({ results: rewardsCatalog });
  } catch (error) {
    return next(error);
  }
});

router.post("/loyalty/rewards/:id/redeem", protect, async (req, res, next) => {
  try {
    const reward = rewardsCatalog.find((item) => item.id === req.params.id);
    if (!reward) return res.status(404).json({ message: "Reward not found." });

    if (!isDbReady()) {
      if ((demoLoyaltyAccount.pointsBalance || 0) < reward.pointsCost) {
        return res.status(422).json({ message: `You need ${reward.pointsCost.toLocaleString("en-PK")} points to redeem this reward.` });
      }
      demoLoyaltyAccount.pointsBalance -= reward.pointsCost;
      demoLoyaltyAccount.pointsRedeemed = (demoLoyaltyAccount.pointsRedeemed || 0) + reward.pointsCost;
      const redemption = {
        id: `redeem-${Date.now()}`,
        student: req.user.id || "u-student",
        rewardId: reward.id,
        rewardName: reward.name,
        pointsCost: reward.pointsCost,
        status: "fulfilled",
        createdAt: new Date().toISOString()
      };
      demoRedemptions.unshift(redemption);
      return res.status(201).json({ redemption, ...loyaltyShape(demoLoyaltyAccount, demoLoyaltyClaims), demo: true });
    }

    const account = await ensureLoyaltyAccount(req.user);
    if (account.pointsBalance < reward.pointsCost) {
      return res.status(422).json({ message: `You need ${reward.pointsCost.toLocaleString("en-PK")} points to redeem this reward.` });
    }
    account.pointsBalance -= reward.pointsCost;
    account.pointsRedeemed = (account.pointsRedeemed || 0) + reward.pointsCost;
    await account.save();
    const redemption = await LoyaltyRedemption.create({
      student: req.user._id || req.user.id,
      rewardId: reward.id,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
      status: "fulfilled"
    });
    const claims = await LoyaltyClaim.find({ student: req.user._id || req.user.id }).sort({ createdAt: -1 }).limit(10);
    return res.status(201).json({ redemption, ...loyaltyShape(account, claims) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
