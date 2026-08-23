const express = require("express");
const mongoose = require("mongoose");
const Property = require("../models/Property");
const StayBooking = require("../models/StayBooking");
const { protect, authorize } = require("../middleware/auth");
const { assertNoContactLeak } = require("../services/contactGatingService");
const { stayProperties, stayBookings } = require("../data/mockData");

const router = express.Router();

const ACTIVE_STAY_STATUSES = ["pending", "confirmed"];

const toDayStart = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const nightsBetween = (checkIn, checkOut) => {
  const ms = toDayStart(checkOut).getTime() - toDayStart(checkIn).getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

const shapeProperty = (property) => {
  const source = property?.toObject ? property.toObject() : property;
  if (!source) return null;
  return {
    ...source,
    id: source._id || source.id,
    images: (source.images || []).map((image) => (typeof image === "string" ? image : image?.url)).filter(Boolean)
  };
};

const filterDemoProperties = (query) => {
  let results = [...stayProperties];
  if (query.city) results = results.filter((property) => property.city.toLowerCase() === String(query.city).toLowerCase());
  if (query.propertyType) results = results.filter((property) => property.propertyType === query.propertyType);
  if (query.guestCount) results = results.filter((property) => property.maxGuests >= Number(query.guestCount));
  if (query.maxNightlyRate) results = results.filter((property) => property.nightlyRatePkr <= Number(query.maxNightlyRate));

  if (query.checkInDate && query.checkOutDate) {
    const requestedIn = toDayStart(query.checkInDate);
    const requestedOut = toDayStart(query.checkOutDate);
    results = results.filter((property) => {
      const overlapping = stayBookings.filter(
        (booking) =>
          String(booking.propertyId) === String(property.id) &&
          ACTIVE_STAY_STATUSES.includes(booking.status) &&
          rangesOverlap(toDayStart(booking.checkInDate), toDayStart(booking.checkOutDate), requestedIn, requestedOut)
      );
      return overlapping.length < (property.totalRooms || 1);
    });
  }

  return results.sort((a, b) => a.nightlyRatePkr - b.nightlyRatePkr);
};

const countOverlappingLiveBookings = async ({ propertyId, checkInDate, checkOutDate, excludeBookingId }) => {
  const query = {
    propertyId,
    status: { $in: ACTIVE_STAY_STATUSES },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate }
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  return StayBooking.countDocuments(query);
};

// GET /api/v1/stays/properties -- search hotels/guest houses by city + date range + guest
// count. Dual-mode: demo data when MongoDB isn't connected, live Property/StayBooking
// collections otherwise. Mirrors the dual-mode pattern used throughout roomRoutes.js.
router.get("/properties", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ results: filterDemoProperties(req.query), demo: true });
    }

    const query = { status: "active" };
    if (req.query.city) query.city = new RegExp(`^${req.query.city}$`, "i");
    if (req.query.propertyType) query.propertyType = req.query.propertyType;
    if (req.query.guestCount) query.maxGuests = { $gte: Number(req.query.guestCount) };
    if (req.query.maxNightlyRate) query.nightlyRatePkr = { $lte: Number(req.query.maxNightlyRate) };

    const properties = await Property.find(query).sort({ nightlyRatePkr: 1 }).lean();

    if (!req.query.checkInDate || !req.query.checkOutDate) {
      return res.json({ results: properties.map(shapeProperty) });
    }

    const requestedIn = toDayStart(req.query.checkInDate);
    const requestedOut = toDayStart(req.query.checkOutDate);
    const available = [];
    for (const property of properties) {
      const overlapCount = await countOverlappingLiveBookings({ propertyId: property._id, checkInDate: requestedIn, checkOutDate: requestedOut });
      if (overlapCount < (property.totalRooms || 1)) available.push(property);
    }
    return res.json({ results: available.map(shapeProperty) });
  } catch (error) {
    return next(error);
  }
});

router.get("/properties/:id", async (req, res, next) => {
  try {
    const property = mongoose.connection.readyState === 1
      ? await Property.findById(req.params.id).lean()
      : stayProperties.find((item) => item.id === req.params.id || item.slug === req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found." });
    return res.json({ property: shapeProperty(property), demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/properties", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (!req.body.propertyType || !["hotel", "guest_house"].includes(req.body.propertyType)) {
      return res.status(400).json({ message: "propertyType must be 'hotel' or 'guest_house'." });
    }
    if (!req.body.name || !req.body.city || !req.body.area || !req.body.address) {
      return res.status(400).json({ message: "name, city, area, and address are required." });
    }
    if (!req.body.nightlyRatePkr || Number(req.body.nightlyRatePkr) <= 0) {
      return res.status(400).json({ message: "nightlyRatePkr must be greater than zero." });
    }
    assertNoContactLeak({ name: req.body.name, description: req.body.description, address: req.body.address });

    const payload = {
      propertyType: req.body.propertyType,
      name: req.body.name,
      description: req.body.description,
      city: req.body.city,
      area: req.body.area,
      address: req.body.address,
      location: req.body.location,
      images: req.body.images || [],
      facilities: req.body.facilities || [],
      nightlyRatePkr: Number(req.body.nightlyRatePkr),
      maxGuests: Number(req.body.maxGuests || 2),
      checkInTime: req.body.checkInTime || "14:00",
      checkOutTime: req.body.checkOutTime || "12:00",
      totalRooms: Number(req.body.totalRooms || 1),
      contactPhone: req.body.contactPhone,
      status: "active",
      isVerified: false
    };

    if (mongoose.connection.readyState !== 1) {
      const property = { id: `prop-${Date.now()}`, owner: req.user.id, ...payload, rating: { average: 0, count: 0 } };
      stayProperties.unshift(property);
      return res.status(201).json({ property, demo: true });
    }

    const property = await Property.create({ ...payload, owner: req.user._id || req.user.id });
    return res.status(201).json({ property: shapeProperty(property) });
  } catch (error) {
    return next(error);
  }
});

router.put("/properties/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (req.body.description || req.body.name || req.body.address) {
      assertNoContactLeak({ name: req.body.name, description: req.body.description, address: req.body.address });
    }

    if (mongoose.connection.readyState !== 1) {
      const index = stayProperties.findIndex((item) => item.id === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Property not found." });
      stayProperties[index] = { ...stayProperties[index], ...req.body, id: stayProperties[index].id };
      return res.json({ property: stayProperties[index], demo: true });
    }

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found." });
    if (String(property.owner) !== String(req.user._id || req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only update your own properties." });
    }
    Object.assign(property, req.body);
    await property.save();
    return res.json({ property: shapeProperty(property) });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/stays/bookings -- create a nightly stay booking after checking the
// requested date range against existing bookings for that property (see
// countOverlappingLiveBookings / the demo equivalent above).
router.post("/bookings", protect, async (req, res, next) => {
  try {
    const { propertyId, checkInDate, checkOutDate, guestCount, contactPhone, specialRequests } = req.body;
    if (!propertyId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ message: "propertyId, checkInDate, and checkOutDate are required." });
    }
    if (!contactPhone) {
      return res.status(400).json({ message: "A contact phone number is required so the property can reach you about check-in." });
    }
    const requestedIn = toDayStart(checkInDate);
    const requestedOut = toDayStart(checkOutDate);
    if (requestedOut <= requestedIn) {
      return res.status(400).json({ message: "checkOutDate must be after checkInDate." });
    }
    const nights = nightsBetween(requestedIn, requestedOut);

    if (mongoose.connection.readyState !== 1) {
      const property = stayProperties.find((item) => item.id === propertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
      const overlapping = stayBookings.filter(
        (booking) =>
          String(booking.propertyId) === String(propertyId) &&
          ACTIVE_STAY_STATUSES.includes(booking.status) &&
          rangesOverlap(toDayStart(booking.checkInDate), toDayStart(booking.checkOutDate), requestedIn, requestedOut)
      );
      if (overlapping.length >= (property.totalRooms || 1)) {
        return res.status(409).json({ message: "This property is fully booked for the selected dates." });
      }
      if (guestCount && Number(guestCount) > property.maxGuests) {
        return res.status(400).json({ message: `This property allows up to ${property.maxGuests} guests.` });
      }
      const booking = {
        id: `stay-${Date.now()}`,
        propertyId,
        guestUserId: req.user.id,
        checkInDate,
        checkOutDate,
        guestCount: Number(guestCount || 1),
        nights,
        nightlyRatePkr: property.nightlyRatePkr,
        totalPkr: nights * property.nightlyRatePkr,
        status: "confirmed",
        contactPhone,
        specialRequests,
        paymentStatus: "pending",
        createdAt: new Date().toISOString()
      };
      stayBookings.unshift(booking);
      return res.status(201).json({ booking, demo: true });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found." });
    if (guestCount && Number(guestCount) > property.maxGuests) {
      return res.status(400).json({ message: `This property allows up to ${property.maxGuests} guests.` });
    }
    const overlapCount = await countOverlappingLiveBookings({ propertyId: property._id, checkInDate: requestedIn, checkOutDate: requestedOut });
    if (overlapCount >= (property.totalRooms || 1)) {
      return res.status(409).json({ message: "This property is fully booked for the selected dates." });
    }

    const booking = await StayBooking.create({
      propertyId: property._id,
      guestUserId: req.user._id || req.user.id,
      checkInDate: requestedIn,
      checkOutDate: requestedOut,
      guestCount: Number(guestCount || 1),
      nights,
      nightlyRatePkr: property.nightlyRatePkr,
      totalPkr: nights * property.nightlyRatePkr,
      status: "confirmed",
      contactPhone,
      specialRequests
    });
    return res.status(201).json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.get("/bookings/my", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const results = stayBookings
        .filter((booking) => booking.guestUserId === req.user.id)
        .map((booking) => ({ ...booking, property: stayProperties.find((item) => item.id === booking.propertyId) }));
      return res.json({ results, demo: true });
    }
    const results = await StayBooking.find({ guestUserId: req.user._id || req.user.id }).populate("propertyId").sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/owner/properties", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const results = stayProperties.filter((property) => property.owner === req.user.id);
      return res.json({ results, demo: true });
    }
    const results = await Property.find({ owner: req.user._id || req.user.id }).sort({ createdAt: -1 });
    return res.json({ results: results.map(shapeProperty) });
  } catch (error) {
    return next(error);
  }
});

router.get("/owner/bookings", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const ownedIds = stayProperties.filter((property) => property.owner === req.user.id).map((property) => property.id);
      const results = stayBookings
        .filter((booking) => ownedIds.includes(booking.propertyId))
        .map((booking) => ({ ...booking, property: stayProperties.find((item) => item.id === booking.propertyId) }));
      return res.json({ results, demo: true });
    }
    const ownedProperties = await Property.find({ owner: req.user._id || req.user.id }).select("_id");
    const results = await StayBooking.find({ propertyId: { $in: ownedProperties.map((property) => property._id) } })
      .populate("propertyId")
      .populate("guestUserId", "name phone")
      .sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
