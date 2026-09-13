const express = require("express");
const mongoose = require("mongoose");
const HostelGroup = require("../models/HostelGroup");
const Hostel = require("../models/Hostel");
const slugifyText = require("../utils/slugifyText");
const validate = require("../middleware/validate");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const { hostels } = require("../data/mockData");
const { demoHostelGroups } = require("../data/demoRuntime");

const router = express.Router();

const shapeGroup = (group) => {
  const source = group.toObject ? group.toObject() : group;
  return { ...source, id: source._id || source.id };
};

const asImageUrl = (image) => (typeof image === "string" ? image : image?.url);

const shapeHostel = (hostel) => {
  const source = hostel.toObject ? hostel.toObject() : hostel;
  return {
    ...source,
    id: source._id || source.id,
    images: (source.images || []).map(asImageUrl).filter(Boolean)
  };
};

const demoGroupWithHostels = (group) => {
  const memberHostels = hostels.filter((hostel) => hostel.groupId === group.id);
  return {
    ...group,
    citiesPresent: group.citiesPresent?.length ? group.citiesPresent : [...new Set(memberHostels.map((hostel) => hostel.city))],
    hostels: memberHostels.map(shapeHostel)
  };
};

router.get("/", async (req, res, next) => {
  try {
    const search = req.query.search || req.query.q || "";

    if (mongoose.connection.readyState !== 1) {
      let items = [...demoHostelGroups];
      if (search) {
        const term = search.toLowerCase();
        items = items.filter((group) => group.name.toLowerCase().includes(term));
      }
      return res.json({ results: items.map(demoGroupWithHostels), demo: true });
    }

    const query = search ? { name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {};
    const groups = await HostelGroup.find(query).sort({ name: 1 }).lean();
    const groupIds = groups.map((group) => group._id);
    const memberHostels = await Hostel.find({ groupId: { $in: groupIds } }).lean();
    const results = groups.map((group) => ({
      ...group,
      id: group._id,
      hostels: memberHostels.filter((hostel) => String(hostel.groupId) === String(group._id)).map(shapeHostel)
    }));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const group = demoHostelGroups.find((item) => item.slug === req.params.slug || item.id === req.params.slug);
      if (!group) return res.status(404).json({ message: "Hostel group not found." });
      return res.json({ group: demoGroupWithHostels(group), demo: true });
    }

    const lookup = mongoose.Types.ObjectId.isValid(req.params.slug) ? { $or: [{ _id: req.params.slug }, { slug: req.params.slug }] } : { slug: req.params.slug };
    const group = await HostelGroup.findOne(lookup).lean();
    if (!group) return res.status(404).json({ message: "Hostel group not found." });
    const memberHostels = await Hostel.find({ groupId: group._id }).lean();
    return res.json({ group: { ...group, id: group._id, hostels: memberHostels.map(shapeHostel) } });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  protect,
  authorize("host", "admin"),
  [body("name").trim().notEmpty().withMessage("Group name is required.")],
  validate,
  async (req, res, next) => {
    try {
      const payload = {
        name: req.body.name,
        description: req.body.description,
        logoUrl: req.body.logoUrl,
        foundedYear: req.body.foundedYear ? Number(req.body.foundedYear) : undefined,
        citiesPresent: req.body.citiesPresent || []
      };

      if (mongoose.connection.readyState !== 1) {
        const group = {
          id: `grp-${Date.now()}`,
          slug: slugifyText(payload.name),
          ownerId: req.user.id,
          verified: false,
          ...payload,
          createdAt: new Date().toISOString()
        };
        demoHostelGroups.unshift(group);
        return res.status(201).json({ group: demoGroupWithHostels(group), demo: true });
      }

      const group = await HostelGroup.create({ ...payload, ownerId: req.user._id || req.user.id });
      return res.status(201).json({ group: { ...shapeGroup(group), hostels: [] } });
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/:id/hostels/:hostelId", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const group = demoHostelGroups.find((item) => item.id === req.params.id || item.slug === req.params.id);
      if (!group) return res.status(404).json({ message: "Hostel group not found." });
      const hostel = hostels.find((item) => item.id === req.params.hostelId);
      if (!hostel) return res.status(404).json({ message: "Hostel not found." });
      if (req.user.role !== "admin" && group.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You can only manage your own hostel group." });
      }
      if (hostel.owner !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "You can only attach hostels you own." });
      }
      hostel.groupId = group.id;
      return res.json({ hostel: shapeHostel(hostel), demo: true });
    }

    const group = await HostelGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Hostel group not found." });
    const hostel = await Hostel.findById(req.params.hostelId);
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    const requesterId = String(req.user._id || req.user.id);
    // Found during live QA: this only ever checked that the requester owned the
    // HOSTEL being attached, never that they owned (or were an admin of) the
    // GROUP it was being attached to. That meant any host could force their own
    // hostel into an unrelated group owner's group without that group owner's
    // consent -- a tenant-isolation violation between hostel-group tenants.
    if (req.user.role !== "admin" && String(group.ownerId) !== requesterId) {
      return res.status(403).json({ message: "You can only manage your own hostel group." });
    }
    if (String(hostel.owner) !== requesterId && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only attach hostels you own." });
    }
    hostel.groupId = group._id;
    await hostel.save();
    if (hostel.city && !group.citiesPresent.includes(hostel.city)) {
      group.citiesPresent.push(hostel.city);
      await group.save();
    }
    return res.json({ hostel: shapeHostel(hostel) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const updates = {};
    ["name", "description", "logoUrl", "foundedYear", "citiesPresent", "verified"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (mongoose.connection.readyState !== 1) {
      const index = demoHostelGroups.findIndex((item) => item.id === req.params.id || item.slug === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Hostel group not found." });
      demoHostelGroups[index] = { ...demoHostelGroups[index], ...updates };
      return res.json({ group: demoGroupWithHostels(demoHostelGroups[index]), demo: true });
    }

    const group = await HostelGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Hostel group not found." });
    const requesterId = String(req.user._id || req.user.id);
    if (String(group.ownerId) !== requesterId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only the group's managing host or an admin can update it." });
    }
    Object.assign(group, updates);
    await group.save();
    const memberHostels = await Hostel.find({ groupId: group._id }).lean();
    return res.json({ group: { ...shapeGroup(group), hostels: memberHostels.map(shapeHostel) } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
