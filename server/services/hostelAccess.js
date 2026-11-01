const mongoose = require("mongoose");
const Hostel = require("../models/Hostel");
const HostelGroup = require("../models/HostelGroup");
const Block = require("../models/Block");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const StaffMember = require("../models/StaffMember");
const ParentLink = require("../models/ParentLink");
const { canonicalRole } = require("../middleware/auth");

const isDbReady = () => mongoose.connection.readyState === 1;
const uid = (user) => String(user._id || user.id);
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const LIVE_BOOKING = ["pending", "payment_pending", "confirmed", "active", "overdue"];
const RESIDENT_BOOKING = ["confirmed", "active", "overdue"];

/** Head office = admin, the hostel's owner, or the owner of the hostel's group. */
async function canManageHostel(user, hostelId) {
  if (!user || !isId(hostelId)) return false;
  if (canonicalRole(user.role) === "admin") return true;
  if (canonicalRole(user.role) !== "host") return false;
  const hostel = await Hostel.findById(hostelId).select("owner groupId").lean();
  if (!hostel) return false;
  if (String(hostel.owner) === uid(user)) return true;
  if (hostel.groupId) {
    const group = await HostelGroup.findById(hostel.groupId).select("ownerId").lean();
    if (group && String(group.ownerId) === uid(user)) return true;
  }
  return false;
}

/** Hostels the user runs as head office (admin = all). */
async function managedHostelIds(user) {
  const role = canonicalRole(user.role);
  if (role === "admin") return (await Hostel.find().select("_id").lean()).map((h) => String(h._id));
  if (role !== "host") return [];
  const groups = await HostelGroup.find({ ownerId: uid(user) }).select("_id").lean();
  const hostels = await Hostel.find({ $or: [{ owner: uid(user) }, { groupId: { $in: groups.map((g) => g._id) } }] }).select("_id").lean();
  return hostels.map((h) => String(h._id));
}

/** Blocks a warden may act on. A suspended/terminated staff record revokes access. */
async function wardenBlocks(user) {
  if (canonicalRole(user.role) !== "warden") return [];
  const blocks = await Block.find({ wardenId: uid(user) }).lean();
  if (!blocks.length) return [];
  const records = await StaffMember.find({ user: uid(user) }).select("hostel status").lean();
  if (!records.length) return blocks; // legacy warden provisioned before the staff register existed
  const activeHostels = new Set(records.filter((r) => r.status === "active").map((r) => String(r.hostel)));
  const knownHostels = new Set(records.map((r) => String(r.hostel)));
  return blocks.filter((b) => !knownHostels.has(String(b.hostelId)) || activeHostels.has(String(b.hostelId)));
}

/**
 * Resolve what the caller may do for a hostel/block.
 * @returns {Promise<"head_office"|"warden"|null>}
 */
async function staffScope(user, { hostelId, blockId }) {
  if (hostelId && (await canManageHostel(user, hostelId))) return "head_office";
  if (canonicalRole(user.role) === "warden") {
    const blocks = await wardenBlocks(user);
    if (blockId && blocks.some((b) => String(b._id) === String(blockId))) return "warden";
    if (!blockId && hostelId && blocks.some((b) => String(b.hostelId) === String(hostelId))) return "warden";
  }
  return null;
}

/**
 * Scope for acting on ONE record (invoice, payment, complaint, resident) that sits in a block.
 * Unlike staffScope, a warden never gets hostel-level access here: a record with no block
 * (room not yet assigned to a block) belongs to head office only.
 * @returns {Promise<"head_office"|"warden"|null>}
 */
async function recordScope(user, { hostelId, blockId }) {
  if (hostelId && (await canManageHostel(user, hostelId))) return "head_office";
  if (!blockId || canonicalRole(user.role) !== "warden") return null;
  const blocks = await wardenBlocks(user);
  return blocks.some((b) => String(b._id) === String(blockId) && String(b.hostelId) === String(hostelId)) ? "warden" : null;
}

/** A block id is only usable with the hostel it belongs to. */
async function blockInHostel(blockId, hostelId) {
  if (!isId(blockId) || !isId(hostelId)) return false;
  return Boolean(await Block.exists({ _id: blockId, hostelId }));
}

async function hostelRoomIds(hostelId, blockId) {
  const query = { $or: [{ hostel: hostelId }, { hostProperty: hostelId }] };
  if (blockId) query.blockId = blockId;
  const rooms = await Room.find(query).select("_id").lean();
  return rooms.map((r) => r._id);
}

/** Residents (confirmed/active/overdue bookings) for a hostel, optionally a single block. */
async function residents({ hostelId, blockId, statuses = RESIDENT_BOOKING }) {
  const roomIds = await hostelRoomIds(hostelId, blockId);
  if (!roomIds.length) return [];
  return Booking.find({ room: { $in: roomIds }, status: { $in: statuses } })
    .populate("student", "name phone email")
    .populate("room", "roomNumber blockId totalBeds")
    .lean();
}

/** The caller's current stay (student) → { booking, hostelId, blockId, room }. */
async function currentStay(studentId) {
  const booking = await Booking.findOne({ student: studentId, status: { $in: RESIDENT_BOOKING } })
    .sort({ createdAt: -1 })
    .populate("room", "hostel hostProperty blockId roomNumber")
    .lean();
  if (!booking || !booking.room) return null;
  return {
    booking,
    room: booking.room,
    hostelId: String(booking.hostel || booking.room.hostel || booking.room.hostProperty || ""),
    blockId: booking.room.blockId ? String(booking.room.blockId) : null
  };
}

/** Active parent→student links for a parent user. */
async function parentStudentIds(parentUser) {
  const links = await ParentLink.find({ parent: uid(parentUser), status: "active" }).select("student").lean();
  return links.map((l) => String(l.student));
}

module.exports = {
  isDbReady,
  uid,
  isId,
  LIVE_BOOKING,
  RESIDENT_BOOKING,
  canManageHostel,
  managedHostelIds,
  wardenBlocks,
  staffScope,
  recordScope,
  blockInHostel,
  hostelRoomIds,
  residents,
  currentStay,
  parentStudentIds
};
