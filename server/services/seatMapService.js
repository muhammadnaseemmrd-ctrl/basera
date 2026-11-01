const Room = require("../models/Room");
const Block = require("../models/Block");
const Booking = require("../models/Booking");
const BedBlock = require("../models/BedBlock");
const { deriveSeatStates, summarizeSeats } = require("./hostelOpsRules");

const LIVE = ["pending", "payment_pending", "confirmed", "active", "overdue"];

/**
 * Build the seat map for a hostel (optionally one block).
 * Rooms with no block are grouped under a synthetic "Unassigned" block so
 * head-office totals always equal the real number of beds.
 */
async function buildSeatMap({ hostelId, blockId = null, includeStudents = true }) {
  const roomQuery = { $or: [{ hostel: hostelId }, { hostProperty: hostelId }] };
  if (blockId) roomQuery.blockId = blockId;
  const rooms = await Room.find(roomQuery).sort({ roomNumber: 1 }).lean();
  const blocks = await Block.find({ hostelId }).populate("wardenId", "name phone").lean();
  const roomIds = rooms.map((r) => r._id);
  const now = new Date();

  const [bookings, bedBlocks] = await Promise.all([
    Booking.find({ room: { $in: roomIds }, status: { $in: LIVE } })
      .populate(includeStudents ? { path: "student", select: "name phone" } : { path: "student", select: "_id" })
      .lean(),
    BedBlock.find({ room: { $in: roomIds }, status: "active", from: { $lte: now }, to: { $gte: now } }).lean()
  ]);

  const byRoom = (list, key) =>
    list.reduce((acc, item) => {
      const k = String(item[key]);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  const bookingsByRoom = byRoom(bookings, "room");
  const blocksByRoom = byRoom(bedBlocks, "room");

  const blockMap = new Map(blocks.map((b) => [String(b._id), { id: String(b._id), name: b.name, warden: b.wardenId ? { id: String(b.wardenId._id), name: b.wardenId.name } : null, floorCount: b.floorCount, rooms: [] }]));
  const unassigned = { id: null, name: "Unassigned rooms", warden: null, rooms: [] };

  for (const room of rooms) {
    const roomBookings = (bookingsByRoom[String(room._id)] || []).map((b) => ({
      id: String(b._id),
      bedIndex: b.bedIndex,
      status: b.status,
      student: b.student ? { id: String(b.student._id), name: b.student.name, phone: b.student.phone, source: b.source || "online" } : null
    }));
    const roomBedBlocks = (blocksByRoom[String(room._id)] || []).map((b) => ({ id: String(b._id), bedIndex: b.bedIndex, reason: b.reason, note: b.note }));
    const seats = deriveSeatStates({
      totalBeds: room.totalBeds,
      bookings: roomBookings.map((b) => ({ ...b, student: b.student })),
      bedBlocks: roomBedBlocks
    }).map((seat) => ({
      ...seat,
      studentId: undefined,
      student: seat.status === "occupied" || seat.status === "reserved" ? roomBookings.find((b) => b.id === String(seat.bookingId))?.student || null : null
    }));
    const entry = { id: String(room._id), roomNumber: room.roomNumber, floor: room.floor ?? room.floorNumber ?? null, totalBeds: room.totalBeds, pricePerBed: room.pricePerBed, seats, summary: summarizeSeats(seats) };
    const target = room.blockId ? blockMap.get(String(room.blockId)) : unassigned;
    (target || unassigned).rooms.push(entry);
  }

  const out = [...blockMap.values(), ...(unassigned.rooms.length ? [unassigned] : [])]
    .filter((b) => !blockId || b.id === String(blockId))
    .map((b) => {
      const allSeats = b.rooms.flatMap((r) => r.seats);
      return { ...b, summary: summarizeSeats(allSeats) };
    });

  const totalSeats = out.flatMap((b) => b.rooms.flatMap((r) => r.seats));
  return { hostelId: String(hostelId), blocks: out, summary: summarizeSeats(totalSeats) };
}

module.exports = { buildSeatMap };
