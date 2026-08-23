const express = require("express");
const mongoose = require("mongoose");
const Block = require("../models/Block");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const { rooms, hostels } = require("../data/mockData");
const { demoBlocks } = require("../data/demoRuntime");

const router = express.Router();

const shapeBlock = (block) => {
  const source = block.toObject ? block.toObject() : block;
  return { ...source, id: source._id || source.id };
};

const userId = (user) => String(user._id || user.id);

router.get("/", protect, authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const role = canonicalRole(req.user.role);
    const isWarden = role === "warden";
    // A plain host (not admin) with no hostelId filter should only see blocks that
    // belong to hostels they actually own -- otherwise "list my blocks" would leak
    // every other host's block/warden assignments.
    const isScopedHost = role === "host";

    if (mongoose.connection.readyState !== 1) {
      let items = [...demoBlocks];
      if (req.query.hostelId) {
        items = items.filter((block) => block.hostelId === req.query.hostelId);
      } else if (isWarden) {
        items = items.filter((block) => block.wardenId === userId(req.user));
      } else if (isScopedHost) {
        const ownedHostelIds = hostels.filter((hostel) => hostel.owner === userId(req.user)).map((hostel) => hostel.id);
        items = items.filter((block) => ownedHostelIds.includes(block.hostelId));
      }
      return res.json({ results: items, demo: true });
    }

    const query = {};
    if (req.query.hostelId) {
      query.hostelId = req.query.hostelId;
    } else if (isWarden) {
      query.wardenId = req.user._id || req.user.id;
    } else if (isScopedHost) {
      const ownedHostels = await Hostel.find({ owner: req.user._id || req.user.id }).select("_id");
      query.hostelId = { $in: ownedHostels.map((hostel) => hostel._id) };
    }
    const docs = await Block.find(query).sort({ name: 1 });
    return res.json({ results: docs.map(shapeBlock) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (!req.body.hostelId || !req.body.name) {
      return res.status(400).json({ message: "hostelId and name are required." });
    }

    const payload = {
      hostelId: req.body.hostelId,
      name: req.body.name,
      wardenId: req.body.wardenId || null,
      floorCount: Number(req.body.floorCount || 1),
      notes: req.body.notes
    };

    if (mongoose.connection.readyState !== 1) {
      const block = { id: `blk-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoBlocks.unshift(block);
      return res.status(201).json({ block, demo: true });
    }

    const hostel = await Hostel.findById(payload.hostelId);
    if (!hostel) return res.status(404).json({ message: "Hostel not found." });
    if (String(hostel.owner) !== userId(req.user) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only create blocks for hostels you own." });
    }

    const block = await Block.create(payload);
    return res.status(201).json({ block: shapeBlock(block) });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.wardenId !== undefined) updates.wardenId = req.body.wardenId || null;
    if (req.body.floorCount !== undefined) updates.floorCount = Number(req.body.floorCount);
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    if (mongoose.connection.readyState !== 1) {
      const index = demoBlocks.findIndex((block) => block.id === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Block not found." });
      demoBlocks[index] = { ...demoBlocks[index], ...updates };
      return res.json({ block: demoBlocks[index], demo: true });
    }

    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    const hostel = await Hostel.findById(block.hostelId);
    if (hostel && String(hostel.owner) !== userId(req.user) && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only manage blocks for hostels you own." });
    }
    Object.assign(block, updates);
    await block.save();
    return res.json({ block: shapeBlock(block) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/rooms", protect, authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const isWarden = canonicalRole(req.user.role) === "warden";

    if (mongoose.connection.readyState !== 1) {
      const block = demoBlocks.find((item) => item.id === req.params.id);
      if (!block) return res.status(404).json({ message: "Block not found." });
      if (isWarden && String(block.wardenId) !== userId(req.user)) {
        return res.status(403).json({ message: "You are not assigned to this block." });
      }
      const blockRooms = rooms.filter((room) => room.blockId === block.id);
      return res.json({ block, results: blockRooms, demo: true });
    }

    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: "Block not found." });
    if (isWarden && String(block.wardenId || "") !== userId(req.user)) {
      return res.status(403).json({ message: "You are not assigned to this block." });
    }
    const blockRooms = await Room.find({ blockId: block._id });
    return res.json({ block: shapeBlock(block), results: blockRooms });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
