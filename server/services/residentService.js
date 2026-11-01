// Admitting residents (single form, legacy head-office endpoint, CSV import). Offline and
// online students end up as the same thing: a User(role student) + a Booking on a seat.
// The only differences are Booking.source="offline", commission 0 and no escrow.
const crypto = require("crypto");
const User = require("../models/User");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const BedBlock = require("../models/BedBlock");
const ParentLink = require("../models/ParentLink");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const clock = require("./clock");
const { deriveSeatStates, phoneKey } = require("./hostelOpsRules");
const { stayFinancials } = require("./policyRules");
const { validateResident, csvToRecords, inFileDuplicates } = require("./residentRules");
const { createInvoice, recordPayment } = require("./feeService");
const { LIVE_BOOKING } = require("./hostelAccess");

class AdmitError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const INVITE_DAYS = 14;
const code8 = () => crypto.randomBytes(4).toString("hex").toUpperCase();

/** Phone spellings people actually type, so "0300-1234567" finds "03001234567". */
function phoneVariants(phone) {
  const key = phoneKey(phone);
  const raw = String(phone || "").trim();
  return [...new Set([raw, raw.replace(/\D/g, ""), `0${key}`, `92${key}`, `+92${key}`, `0${key.slice(0, 3)}-${key.slice(3)}`])];
}

async function findRoom(hostelId, { roomId, roomNumber }) {
  const base = { $or: [{ hostel: hostelId }, { hostProperty: hostelId }] };
  if (roomId) return Room.findOne({ _id: roomId, ...base });
  return Room.findOne({ roomNumber, ...base });
}

/** Seat state using the same rules as the seat map. */
async function seatState(room, bedIndex) {
  const now = clock.now();
  const [bookings, holds] = await Promise.all([
    Booking.find({ room: room._id, status: { $in: LIVE_BOOKING } }).lean(),
    BedBlock.find({ room: room._id, status: "active", from: { $lte: now }, to: { $gte: now } }).lean()
  ]);
  const seats = deriveSeatStates({
    totalBeds: room.totalBeds,
    bookings: bookings.map((x) => ({ id: x._id, bedIndex: x.bedIndex, status: x.status, student: x.student })),
    bedBlocks: holds.map((h) => ({ id: h._id, bedIndex: h.bedIndex, reason: h.reason, note: h.note }))
  });
  return seats[bedIndex]?.status;
}

/**
 * Checks that don't write anything: room/seat exist and are free, phone isn't someone else's.
 * @returns {Promise<{room, existingUser, duplicate?:string, error?:string}>}
 */
async function precheck(hostelId, v) {
  const room = await findRoom(hostelId, v);
  if (!room) return { error: v.roomNumber ? `Room "${v.roomNumber}" does not exist in this hostel.` : "Room not found in this hostel." };
  if (v.bedIndex >= room.totalBeds) return { room, error: `Room ${room.roomNumber} has only ${room.totalBeds} bed(s).` };
  const existingUser = await User.findOne({ phone: { $in: phoneVariants(v.phone) } });
  if (existingUser && existingUser.role !== "student") return { room, error: "That phone number belongs to a non-student account." };
  if (existingUser && (await Booking.exists({ student: existingUser._id, status: { $in: LIVE_BOOKING } }))) {
    return { room, existingUser, duplicate: "This student already has an active or pending stay." };
  }
  if (v.email && !existingUser && (await User.exists({ email: v.email }))) return { room, error: "That email is already registered to another account." };
  const state = await seatState(room, v.bedIndex);
  if (state !== "free") return { room, existingUser, error: `Seat ${v.bedIndex + 1} in room ${room.roomNumber} is not free (${String(state).replace("_", " ")}).` };
  return { room, existingUser };
}

/**
 * Admit one validated resident. `authorizeRoom(room)` must resolve truthy when the actor may
 * register into that room's block (head office: any; warden: own block).
 * Returns the result plus `undo()` so a CSV import can roll back a whole file.
 */
async function admitResident({ hostelId, value: v, actor, actorRole, authorizeRoom, loginByDefault = false }) {
  // authorise on the room BEFORE any state check, so another tenant learns nothing
  // (not even whether a seat is taken)
  const target = await findRoom(hostelId, v);
  if (!target) throw new AdmitError(404, v.roomNumber ? `Room "${v.roomNumber}" does not exist in this hostel.` : "Room not found in this hostel.");
  if (!(await authorizeRoom(target))) throw new AdmitError(403, "You can only register students into your own block.");
  const pre = await precheck(hostelId, v);
  if (pre.error) throw new AdmitError(pre.error.includes("not free") || pre.error.includes("registered") ? 409 : 400, pre.error);
  if (pre.duplicate) throw new AdmitError(409, pre.duplicate);
  const { room } = pre;

  const undo = [];
  const rollback = async () => {
    for (const fn of undo.reverse()) await fn().catch(() => {});
  };
  try {
    const wantsLogin = v.login || loginByDefault;
    let student = pre.existingUser;
    let tempPassword = null;
    let claimCode = null;
    if (!student) {
      const digits = String(v.phone).replace(/\D/g, "");
      tempPassword = wantsLogin ? crypto.randomBytes(5).toString("hex") : null;
      claimCode = wantsLogin ? null : code8();
      student = await User.create({
        name: v.name,
        phone: v.phone,
        email: v.email || `${digits}@resident.basera.invalid`,
        password: tempPassword || crypto.randomBytes(24).toString("hex"),
        role: "student",
        isVerified: true,
        loginEnabled: wantsLogin,
        claimCode: claimCode || undefined,
        claimCodeExpiresAt: claimCode ? clock.addDays(clock.now(), INVITE_DAYS) : undefined,
        gender: v.gender,
        university: v.university,
        emergencyContact: v.emergencyContact,
        residentProfile: { cnic: v.cnic, dob: v.dob || undefined, homeAddress: v.homeAddress, employer: v.employer, photoUrl: v.photoUrl, cnicDocUrl: v.cnicDocUrl, billingPlan: v.billingPlan, guardians: v.guardians }
      });
      undo.push(() => User.deleteOne({ _id: student._id }));
    }

    // take the bed off the marketplace atomically so it can't also be booked online
    const taken = await Room.findOneAndUpdate({ _id: room._id, availableBeds: { $gt: 0 } }, { $inc: { availableBeds: -1 } }, { new: true });
    if (!taken) throw new AdmitError(409, `Room ${room.roomNumber} shows no free beds online. Fix the room's bed count first.`);
    undo.push(() => Room.updateOne({ _id: room._id }, { $inc: { availableBeds: 1 }, status: "ACTIVE" }));
    if (taken.availableBeds === 0) await Room.updateOne({ _id: room._id }, { status: "FULL" });

    const join = v.joinDate || clock.startOfDayKarachi(clock.now());
    const money = stayFinancials({ source: "offline", rent: v.monthlyRent });
    const booking = await Booking.create({
      student: student._id,
      hostel: hostelId,
      room: room._id,
      bedIndex: v.bedIndex,
      checkIn: join,
      moveInDate: join,
      duration: v.billingPlan === "semester" ? "semester" : "monthly",
      bookingType: v.billingPlan === "semester" ? "SEMESTER" : "MONTHLY",
      totalRent: v.monthlyRent,
      totalAmount: v.monthlyRent,
      commission: money.commission,
      ownerReceives: money.ownerReceives,
      escrowStatus: money.escrowStatus,
      securityDeposit: v.securityDeposit,
      paymentMethod: money.paymentMethod,
      paymentStatus: "paid",
      status: "active",
      source: "offline",
      admittedBy: actor._id || actor.id,
      specialRequests: "Admitted by hostel office (offline resident)."
    });
    undo.push(() => Booking.deleteOne({ _id: booking._id }));

    let deposit = null;
    if (v.securityDeposit > 0) {
      const invoice = await createInvoice({ hostel: hostelId, block: room.blockId || null, room: room._id, bedIndex: v.bedIndex, student: student._id, booking: booking._id, title: "Security deposit", kind: "security_deposit", amount: v.securityDeposit, createdBy: actor._id || actor.id });
      undo.push(() => FeeInvoice.deleteOne({ _id: invoice._id }));
      deposit = { invoiceId: String(invoice._id) };
      if (v.depositCollected) {
        const paid = await recordPayment({ invoiceId: invoice._id, actor, actorRole, amount: v.securityDeposit, method: "cash", note: "Collected at admission" });
        undo.push(() => FeePayment.deleteOne({ _id: paid.payment._id }));
        deposit.receiptNo = paid.payment.receiptNo;
        deposit.paymentId = String(paid.payment._id);
      }
    }

    const guardians = [];
    for (const g of v.guardians) {
      const inviteCode = code8();
      try {
        const link = await ParentLink.create({ student: student._id, hostel: hostelId, parentName: g.name, parentPhone: g.phone, phoneKey: phoneKey(g.phone), relation: g.relation, status: "pending", inviteCode, inviteExpiresAt: clock.addDays(clock.now(), INVITE_DAYS), createdBy: actor._id || actor.id, source: "staff" });
        undo.push(() => ParentLink.deleteOne({ _id: link._id }));
        guardians.push({ name: g.name, phone: g.phone, inviteCode });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    return {
      result: {
        booking: { id: String(booking._id), room: room.roomNumber, roomId: String(room._id), bed: v.bedIndex + 1, source: "offline" },
        student: { id: String(student._id), name: student.name, phone: student.phone, email: tempPassword ? student.email : undefined, loginEnabled: student.loginEnabled },
        tempPassword,
        claimCode,
        guardians,
        guardian: guardians[0] ? { inviteCode: guardians[0].inviteCode } : null,
        deposit
      },
      blockId: room.blockId ? String(room.blockId) : null,
      undo: rollback
    };
  } catch (error) {
    await rollback();
    throw error;
  }
}

/** Validate a whole CSV without writing anything. Each row: ok | duplicate | error. */
async function previewImport({ hostelId, csv, authorizeRoom, maxRows = 1000 }) {
  const parsed = csvToRecords(csv);
  if (parsed.error) return { error: parsed.error };
  if (parsed.records.length > maxRows) return { error: `A file can hold at most ${maxRows} rows.` };
  const checked = parsed.records.map((rec) => ({ rec, ...validateResident(rec) }));
  const { dupPhone, dupSeat } = inFileDuplicates(checked.map((c) => c.value));
  const rows = [];
  for (let i = 0; i < checked.length; i += 1) {
    const { rec, value, errors } = checked[i];
    const row = { line: rec._line, name: rec.name, phone: rec.phone, room: rec.roomNumber, bed: rec.bed, status: "ok", errors: [...errors] };
    if (value && dupPhone.has(i)) {
      row.status = "duplicate";
      row.errors.push("Same phone appears earlier in this file.");
    } else if (value && dupSeat.has(i)) {
      row.errors.push("Same room and bed appear earlier in this file.");
    } else if (value) {
      const target = await findRoom(hostelId, value);
      if (target && !(await authorizeRoom(target))) row.errors.push("You can only register students into your own block.");
      else {
        const pre = await precheck(hostelId, value);
        if (pre.error) row.errors.push(pre.error);
        else if (pre.duplicate) {
          row.status = "duplicate";
          row.errors.push(pre.duplicate);
        }
      }
    }
    if (row.status !== "duplicate" && row.errors.length) row.status = "error";
    row.value = value;
    rows.push(row);
  }
  const summary = { total: rows.length, ok: rows.filter((r) => r.status === "ok").length, duplicate: rows.filter((r) => r.status === "duplicate").length, error: rows.filter((r) => r.status === "error").length };
  return { rows, summary };
}

/**
 * Import a confirmed file: re-validates everything; refuses the whole file if any row is in
 * error; admits ok rows in order; if any admission fails midway, every row already admitted
 * from this file is rolled back so a failed file never partially applies.
 */
async function commitImport({ hostelId, csv, actor, actorRole, authorizeRoom }) {
  const preview = await previewImport({ hostelId, csv, authorizeRoom });
  if (preview.error) return { status: 400, body: { message: preview.error } };
  if (preview.summary.error) return { status: 400, body: { message: `${preview.summary.error} row(s) have errors — nothing was imported.`, ...strip(preview) } };
  const admitted = [];
  try {
    for (const row of preview.rows.filter((r) => r.status === "ok")) {
      const out = await admitResident({ hostelId, value: row.value, actor, actorRole, authorizeRoom });
      admitted.push({ line: row.line, undo: out.undo, result: out.result });
    }
  } catch (error) {
    for (const a of admitted.reverse()) await a.undo();
    return { status: error.code && error.code < 500 ? 409 : 500, body: { message: `Import stopped at a row that changed since preview (${error.message}). Nothing was imported.` } };
  }
  return {
    status: 201,
    body: {
      imported: admitted.length,
      duplicatesSkipped: preview.summary.duplicate,
      rows: preview.rows.map((r) => ({ line: r.line, name: r.name, status: r.status, errors: r.errors })),
      residents: admitted.map((a) => ({ line: a.line, studentId: a.result.student.id, name: a.result.student.name, claimCode: a.result.claimCode, guardians: a.result.guardians }))
    }
  };
}

const strip = (preview) => ({ summary: preview.summary, rows: preview.rows.map(({ value, ...r }) => r) });

/** New one-time claim code for a managed resident (staff action). */
async function issueClaimCode(studentId) {
  const code = code8();
  const user = await User.findOneAndUpdate({ _id: studentId, role: "student" }, { claimCode: code, claimCodeExpiresAt: clock.addDays(clock.now(), INVITE_DAYS) }, { new: true });
  return user ? { code, user } : null;
}

/**
 * Resident redeems the code: sets their own password (and real email if given) and the
 * login is enabled. Same User id, so every invoice/receipt/complaint stays attached.
 */
async function claimResident({ code, phone, password, email }) {
  const clean = String(code || "").trim().toUpperCase();
  if (clean.length !== 8) throw new AdmitError(400, "Enter the 8-character code from your hostel office.");
  if (typeof password !== "string" || password.length < 8) throw new AdmitError(400, "Choose a password of at least 8 characters.");
  const user = await User.findOne({ claimCode: clean, claimCodeExpiresAt: { $gt: clock.now() }, role: "student" }).select("+claimCode +password");
  // phone must match too, so a leaked code alone can't take over the account
  if (!user || phoneKey(user.phone) !== phoneKey(phone)) throw new AdmitError(404, "That code is invalid, expired, or doesn't match this phone number.");
  if (email) {
    const e = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AdmitError(400, "Email is not valid.");
    if (await User.exists({ email: e, _id: { $ne: user._id } })) throw new AdmitError(409, "That email is already registered.");
    user.email = e;
  }
  user.password = password;
  user.loginEnabled = true;
  user.claimCode = undefined;
  user.claimCodeExpiresAt = undefined;
  await user.save();
  return user;
}

module.exports = { AdmitError, admitResident, previewImport, commitImport, issueClaimCode, claimResident, phoneVariants };
