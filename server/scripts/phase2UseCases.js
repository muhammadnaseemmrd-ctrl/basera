#!/usr/bin/env node
/**
 * Live use-case runner for Phase 2 (hostel SaaS): policies, offline residents + CSV import,
 * late fines + waivers, leave notice + settlement, offers, notifications, visitors, reports,
 * expenses, transfers, plan limits — each with wrong-tenant 403 checks.
 *
 *   BASE_URL=http://localhost:5000 MONGO_URI=mongodb://... node scripts/phase2UseCases.js
 *
 * - The API must run outside production (time travel via POST /dev/clock) and ideally with
 *   RATE_LIMIT_DISABLED=true.
 * - Seeds "[QA-P2]" data straight into the same database and deletes it afterwards (KEEP=1 keeps it).
 * - Never prints passwords or tokens. Exits 1 if any check fails.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const clock = require("../services/clock");

const BASE = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const RUN = Date.now().toString(36);
const PASSWORD = `Qa!${RUN}${Math.random().toString(36).slice(2, 8)}`;

const User = require("../models/User");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const StaffMember = require("../models/StaffMember");
const Notice = require("../models/Notice");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const ParentLink = require("../models/ParentLink");
const HostelPolicy = require("../models/HostelPolicy");
const AuditLog = require("../models/AuditLog");

const results = [];
const created = { users: [], hostels: [], blocks: [], rooms: [] };
let seq = 0;
const phone = () => `0398${RUN.replace(/\D/g, "").padEnd(3, "5").slice(0, 3)}${String(++seq).padStart(4, "0")}`;

function check(id, name, ok, detail = "") {
  results.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
}

async function http(method, path, { token, body, raw, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  if (raw) return res;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data };
}

const tokens = new Map();
async function makeUser(name, role, extra = {}) {
  const email = `qa.p2.${role}.${RUN}.${++seq}@example.test`;
  const user = await User.create({ name: `[QA-P2] ${name}`, email, phone: phone(), password: PASSWORD, role, isVerified: true, ...extra });
  created.users.push(user._id);
  const r = await http("POST", "/auth/login", { body: { email, password: PASSWORD } });
  if (!r.data?.token) throw new Error(`login failed for ${role} (${r.status})`);
  tokens.set(String(user._id), r.data.token);
  return { id: String(user._id), email, token: r.data.token, doc: user };
}

// ---- shared state between sections
const S = {};
const K = (y, m, d) => clock.karachiDate(y, m, d);
async function setToday(dateKarachiMidday) {
  const r = await http("POST", "/dev/clock", { token: S.admin.token, body: { setTo: dateKarachiMidday.toISOString() } });
  if (r.status !== 200) throw new Error(`clock move failed (${r.status})`);
  return r.data;
}
const midday = (y, m, d) => new Date(K(y, m, d).getTime() + 12 * 3600000);

async function seed() {
  S.admin = await makeUser("Admin", "admin");
  S.ownerA = await makeUser("Owner A", "host");
  S.ownerB = await makeUser("Owner B", "host");
  S.hostelA = await Hostel.create({ owner: S.ownerA.id, name: `[QA-P2] Hostel A ${RUN}`, type: "boys", city: "Islamabad", area: "G-9", address: "QA Street 9", status: "active", contactPhone: "0300-1110000" });
  S.hostelB = await Hostel.create({ owner: S.ownerB.id, name: `[QA-P2] Hostel B ${RUN}`, type: "boys", city: "Karachi", area: "DHA", address: "QA Street 10", status: "active" });
  created.hostels.push(S.hostelA._id, S.hostelB._id);
  S.blockA = await Block.create({ hostelId: S.hostelA._id, name: "Block A" });
  S.blockB = await Block.create({ hostelId: S.hostelA._id, name: "Block B" });
  S.blockX = await Block.create({ hostelId: S.hostelB._id, name: "Block X" });
  created.blocks.push(S.blockA._id, S.blockB._id, S.blockX._id);
  const mkRoom = async (hostel, block, roomNumber, beds) => {
    const r = await Room.create({ hostel: hostel._id, listedBy: hostel.owner, blockId: block._id, roomNumber, type: "double", totalBeds: beds, availableBeds: beds, pricePerBed: 8000, city: hostel.city, status: "ACTIVE" });
    created.rooms.push(r._id);
    return r;
  };
  S.roomA1 = await mkRoom(S.hostelA, S.blockA, "A1", 2);
  S.roomA2 = await mkRoom(S.hostelA, S.blockA, "A2", 2);
  S.roomA3 = await mkRoom(S.hostelA, S.blockA, "A3", 2);
  S.roomB1 = await mkRoom(S.hostelA, S.blockB, "B1", 3);
  S.roomB2 = await mkRoom(S.hostelA, S.blockB, "B2", 3);
  S.roomX1 = await mkRoom(S.hostelB, S.blockX, "X1", 2);
  S.roomB3 = await mkRoom(S.hostelA, S.blockB, "B3", 3);
  S.roomB4 = await mkRoom(S.hostelA, S.blockB, "B4", 3);
  S.roomB5 = await mkRoom(S.hostelA, S.blockB, "B5", 3);

  // two ONLINE students (marketplace bookings) to compare with offline ones
  const mkOnline = async (name, room, bedIndex) => {
    const st = await makeUser(name, "student");
    const b = await Booking.create({ student: st.id, hostel: room.hostel, room: room._id, bedIndex, checkIn: K(2026, 10, 1), duration: "monthly", totalRent: 8000, totalAmount: 8000, commission: 560, ownerReceives: 7440, status: "active", source: "online", securityDeposit: 10000 });
    await Room.updateOne({ _id: room._id }, { $inc: { availableBeds: -1 } });
    return { ...st, bookingId: String(b._id) };
  };
  S.s1 = await mkOnline("Online S1 (Block A)", S.roomA2, 0);
  S.s2 = await mkOnline("Online S2 (Block B)", S.roomB1, 0);
  S.parent1 = await makeUser("Parent of S1", "parent");
  S.parentO = await makeUser("Parent of O1", "parent");
  S.parentX = await makeUser("Unlinked parent", "parent");
  // link parent1 to S1 through the Phase 1 invite flow
  const inv = await http("POST", "/parent-panel/links", { token: S.ownerA.token, body: { hostelId: String(S.hostelA._id), studentId: S.s1.id, parentName: "P1", parentPhone: "0301-1112223" } });
  await http("POST", "/parent-panel/claim", { token: S.parent1.token, body: { code: inv.data.inviteCode } });

  // wardens via the staff API (block-scoped logins)
  const mkWarden = async (ownerToken, hostel, block, label) => {
    const email = `qa.p2.warden.${label}.${RUN}@example.test`;
    const r = await http("POST", "/staff", { token: ownerToken, body: { hostelId: String(hostel._id), name: `[QA-P2] Warden ${label}`, phone: phone(), role: "warden", blockIds: [String(block._id)], login: { email, password: PASSWORD } } });
    if (r.status !== 201) throw new Error(`warden ${label} create failed ${r.status} ${r.data?.message}`);
    const u = await User.findOne({ email });
    created.users.push(u._id);
    const l = await http("POST", "/auth/login", { body: { email, password: PASSWORD } });
    return { id: String(u._id), token: l.data.token };
  };
  S.wardenA = await mkWarden(S.ownerA.token, S.hostelA, S.blockA, "A");
  S.wardenB = await mkWarden(S.ownerA.token, S.hostelA, S.blockB, "B");
  S.wardenX = await mkWarden(S.ownerB.token, S.hostelB, S.blockX, "X");
}

// ---------------------------------------------------------------- clock + policies
async function clockAndPolicies() {
  await setToday(midday(2026, 11, 1));
  const c = await http("GET", "/dev/clock", { token: S.ownerA.token });
  check("C1", "Dev clock moves 'today' (2026-11-01)", c.status === 200 && c.data.today === "2026-11-01", JSON.stringify(c.data));
  const cOwner = await http("POST", "/dev/clock", { token: S.ownerA.token, body: { days: 3 } });
  check("C2", "Only an admin can move the clock", cOwner.status === 403, String(cOwner.status));

  const hA = String(S.hostelA._id);
  const p1 = await http("GET", `/policies/${hA}`, { token: S.ownerA.token });
  const v = p1.data?.hostel?.values || {};
  check("P1", "Defaults: 30 days notice, due 5th, PKR 100/day, all 'platform'", p1.status === 200 && v.leaveNoticeDays === 30 && v.dueDayOfMonth === 5 && v.finePerDay === 100 && p1.data.hostel.source.leaveNoticeDays === "platform", JSON.stringify(v).slice(0, 160));
  const p2 = await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { leaveNotice: { days: 45 }, blockOverrides: [{ block: String(S.blockB._id), leaveNoticeDays: 15 }] } });
  const bA = p2.data?.blocks?.find((b) => b.id === String(S.blockA._id));
  const bB = p2.data?.blocks?.find((b) => b.id === String(S.blockB._id));
  check("P2", "Hostel 45 days + Block B override 15: A=45 (hostel), B=15 (block), preview text", p2.status === 200 && bA.values.leaveNoticeDays === 45 && bA.source.leaveNoticeDays === "hostel" && bB.values.leaveNoticeDays === 15 && bB.source.leaveNoticeDays === "block" && /45 days' notice/.test(bA.preview), `${p2.status} ${p2.data?.message || ""}`);
  const p3r = await http("GET", `/policies/${hA}`, { token: S.wardenA.token });
  const p3w = await http("PUT", `/policies/${hA}`, { token: S.wardenA.token, body: { leaveNotice: { days: 1 } } });
  check("P3", "Warden reads effective policy for own block only; write → 403", p3r.status === 200 && p3r.data.editable === false && p3r.data.blocks.length === 1 && p3r.data.blocks[0].id === String(S.blockA._id) && p3w.status === 403, `${p3r.status}/${p3w.status}`);
  const p4 = await Promise.all([http("PUT", `/policies/${hA}`, { token: S.ownerB.token, body: { leaveNotice: { days: 1 } } }), http("GET", `/policies/${hA}`, { token: S.ownerB.token }), http("GET", `/policies/${hA}`, { token: S.wardenX.token })]);
  check("P4", "Other hostel's owner / warden: policy read and write → 403", p4.every((r) => r.status === 403), p4.map((r) => r.status).join("/"));
  const p5 = await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { leaveNotice: { days: -1 }, lateFee: { finePerDay: 0.5, dueDayOfMonth: 40 } } });
  check("P5", "Invalid values (-1 days, fine 0.5, due day 40) rejected with all three messages", p5.status === 400 && p5.data.errors?.length === 3, `${p5.status} ${JSON.stringify(p5.data?.errors)}`);
  const foreignBlock = await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { blockOverrides: [{ block: String(S.blockX._id), leaveNoticeDays: 5 }] } });
  check("P5b", "A block override pointing at another hostel's block → 400", foreignBlock.status === 400, String(foreignBlock.status));
  const audited = await AuditLog.countDocuments({ action: "policy.updated", entityId: String((await HostelPolicy.findOne({ hostel: S.hostelA._id }))._id) });
  check("P5c", "Policy change is audited", audited >= 1, String(audited));
}

// ---------------------------------------------------------------- offline residents
const csvLine = (r) => [r.name, r.phone, "", "", "male", "", "QA Uni", "QA address", r.gName || "", "father", r.gPhone || "", r.room, r.bed, r.rent ?? 7000, r.dep ?? 0, "no", "2026-11-01", "monthly"].map((v) => (String(v).includes(",") ? `"${v}"` : v)).join(",");
const CSV_HEAD = "name,phone,cnic,email,gender,dob,university,homeAddress,guardianName,guardianRelation,guardianPhone,roomNumber,bed,monthlyRent,securityDeposit,depositCollected,joinDate,billingPlan";

async function offlineResidents() {
  const hA = String(S.hostelA._id);
  const o1Phone = phone();
  const body = {
    hostelId: hA,
    name: "[QA-P2] Offline O1",
    phone: o1Phone,
    cnic: "35202-1234567-1",
    dob: "2005-04-12",
    gender: "male",
    university: "QA University",
    homeAddress: "House 5, Lahore",
    guardians: [{ name: "Father of O1", relation: "father", phone: "0302-2223334" }],
    roomId: String(S.roomA1._id),
    bedIndex: 0,
    monthlyRent: 8000,
    securityDeposit: 10000,
    depositCollected: true,
    joinDate: "2026-11-01",
    cnicDocUrl: "https://example.test/cnic.pdf",
    firstInvoice: { period: "2026-11" }
  };
  const o1 = await http("POST", "/residents", { token: S.ownerA.token, body });
  S.o1 = { id: o1.data?.student?.id, bookingId: o1.data?.booking?.id, phone: o1Phone, claimCode: o1.data?.claimCode, rentInvoice: o1.data?.firstInvoice?.id, guardianCode: o1.data?.guardians?.[0]?.inviteCode };
  const bk = S.o1.bookingId ? await Booking.findById(S.o1.bookingId).lean() : null;
  const dep = S.o1.id ? await FeeInvoice.findOne({ student: S.o1.id, kind: "security_deposit" }).lean() : null;
  check("O1", "Head office registers offline student: occupied seat, deposit invoice+receipt, commission 0, no escrow, no login yet", o1.status === 201 && bk?.source === "offline" && bk.commission === 0 && bk.escrowStatus === "not_created" && dep?.status === "paid" && /^BSR-/.test(o1.data.deposit?.receiptNo || "") && o1.data.student.loginEnabled === false && /^[A-F0-9]{8}$/.test(S.o1.claimCode || ""), `${o1.status} ${o1.data?.message || ""}`);
  const seats = await http("GET", `/blocks/${S.blockA._id}/seats`, { token: S.wardenA.token });
  const seat = seats.data?.blocks?.[0]?.rooms?.find((r) => r.roomNumber === "A1")?.seats?.[0];
  check("O1b", "Seat map shows the offline student as occupied (source offline)", seat?.status === "occupied" && seat.student?.source === "offline", JSON.stringify(seat));

  const wOk = await http("POST", "/residents", { token: S.wardenA.token, body: { hostelId: hA, name: "[QA-P2] Warden-registered", phone: phone(), roomId: String(S.roomA1._id), bedIndex: 1, monthlyRent: 7500 } });
  const wNo = await http("POST", "/residents", { token: S.wardenA.token, body: { hostelId: hA, name: "[QA-P2] Wrong block", phone: phone(), roomId: String(S.roomB2._id), bedIndex: 0, monthlyRent: 7500 } });
  check("O2", "Warden A registers into Block A (201) but not Block B (403)", wOk.status === 201 && wNo.status === 403, `${wOk.status} ${wOk.data?.message || ""}/${wNo.status}`);
  S.w1 = { id: wOk.data?.student?.id };
  const xNo = await http("POST", "/residents", { token: S.ownerB.token, body: { ...body, phone: phone(), bedIndex: 1 } });
  check("O2b", "Other hostel's owner cannot register into our hostel", xNo.status === 403, String(xNo.status));
  const sameSeat = await http("POST", "/residents", { token: S.ownerA.token, body: { ...body, phone: phone(), name: "[QA-P2] Same seat" } });
  const samePhone = await http("POST", "/residents", { token: S.ownerA.token, body: { ...body, roomId: String(S.roomA3._id), bedIndex: 0 } });
  check("O3", "Same seat twice / same phone twice: 409 with a clear message", sameSeat.status === 409 && /not free/.test(sameSeat.data?.message) && samePhone.status === 409 && /already has an active/.test(samePhone.data?.message), `${sameSeat.status} ${sameSeat.data?.message} / ${samePhone.status} ${samePhone.data?.message}`);
  const badInput = await http("POST", "/residents", { token: S.ownerA.token, body: { hostelId: hA, name: "X", phone: "1", roomId: String(S.roomA3._id), bedIndex: 0, monthlyRent: 10.5 } });
  check("O3b", "Invalid registration input: 400 listing the problems", badInput.status === 400 && badInput.data.errors?.length >= 3, JSON.stringify(badInput.data?.errors));

  // ---- CSV import: 10 rows, 2 invalid, 1 duplicate phone
  const rows = [];
  const phones = Array.from({ length: 9 }, () => phone());
  const seatsCsv = [["B3", 1], ["B3", 2], ["B3", 3], ["B4", 1], ["B4", 2], ["B4", 3], ["B5", 1], ["B5", 2], ["B5", 3]];
  for (let i = 0; i < 9; i += 1) rows.push({ name: `[QA-P2] CSV ${i + 1}`, phone: phones[i], room: seatsCsv[i][0], bed: seatsCsv[i][1], gName: i === 0 ? "Guardian CSV1" : "", gPhone: i === 0 ? "0303-3334445" : "" });
  const broken = rows.map((r) => ({ ...r }));
  broken[3].rent = "abc"; // invalid rent
  broken[5].room = "ZZ9"; // room does not exist
  const dupRow = { name: "[QA-P2] CSV dup", phone: phones[1], room: "B5", bed: 3 };
  const csvBad = [CSV_HEAD, ...broken.map(csvLine), csvLine(dupRow)].join("\n");
  const prev = await http("POST", "/residents/import/preview", { token: S.ownerA.token, body: { hostelId: hA, csv: csvBad } });
  const errLines = (prev.data?.rows || []).filter((r) => r.status === "error").map((r) => r.line);
  check("O4a", "Preview lists exactly the 2 bad rows and the 1 duplicate", prev.status === 200 && prev.data.summary.error === 2 && prev.data.summary.duplicate === 1 && errLines.join(",") === "5,7", `${prev.status} ${JSON.stringify(prev.data?.summary)} ${errLines}`);
  const before = await Booking.countDocuments({ hostel: S.hostelA._id });
  const commitBad = await http("POST", "/residents/import/commit", { token: S.ownerA.token, body: { hostelId: hA, csv: csvBad } });
  check("O4b", "Committing a file with errors imports nothing", commitBad.status === 400 && (await Booking.countDocuments({ hostel: S.hostelA._id })) === before, `${commitBad.status}`);
  const csvGood = [CSV_HEAD, ...rows.map(csvLine), csvLine(dupRow)].join("\n");
  const commit = await http("POST", "/residents/import/commit", { token: S.ownerA.token, body: { hostelId: hA, csv: csvGood } });
  check("O4c", "Corrected file imports all 9 valid rows, skips the duplicate", commit.status === 201 && commit.data.imported === 9 && commit.data.duplicatesSkipped === 1 && (await Booking.countDocuments({ hostel: S.hostelA._id, source: "offline" })) === 2 + 9, `${commit.status} ${commit.data?.message || ""} ${commit.data?.imported}`);
  const again = await http("POST", "/residents/import/commit", { token: S.ownerA.token, body: { hostelId: hA, csv: csvGood } });
  check("O4d", "Re-importing the same file reports duplicates and creates none", again.status === 201 && again.data.imported === 0 && again.data.duplicatesSkipped === 10, `${again.status} ${JSON.stringify(again.data?.summary || again.data?.message)}`);
  const xImport = await Promise.all([
    http("POST", "/residents/import/preview", { token: S.ownerB.token, body: { hostelId: hA, csv: csvGood } }),
    http("POST", "/residents/import/commit", { token: S.wardenX.token, body: { hostelId: hA, csv: csvGood } })
  ]);
  check("O4e", "Other hostel's owner / warden cannot preview or import into our hostel", xImport.every((r) => r.status === 403), xImport.map((r) => r.status).join("/"));
  const tmpl = await http("GET", "/residents/import/template.csv", { token: S.ownerA.token, raw: true });
  check("O4f", "CSV template downloads", tmpl.status === 200 && (await tmpl.text()).startsWith("name,phone"), String(tmpl.status));
  S.csv1 = (commit.data?.residents || [])[0];

  // ---- invite + claim
  const list = await http("GET", `/head-office/hostels/${hA}/students`, { token: S.ownerA.token });
  const o1Row = (list.data?.results || []).find((r) => r.studentId === S.o1.id);
  check("O6a", "Before claiming, the offline student is listed (source offline, no login)", o1Row?.source === "offline" && o1Row.loginEnabled === false, JSON.stringify(o1Row));
  const o1User = await User.findById(S.o1.id).lean();
  const preLogin = await http("POST", "/auth/login", { body: { email: o1User.email, password: "whatever123" } });
  check("O6b", "An unclaimed resident cannot log in", [401, 403].includes(preLogin.status), String(preLogin.status));
  const inviteX = await http("POST", `/residents/${S.o1.id}/invite`, { token: S.ownerB.token });
  const inviteWB = await http("POST", `/residents/${S.o1.id}/invite`, { token: S.wardenB.token });
  check("O6c", "Other owner / other block's warden cannot invite our resident", inviteX.status === 403 && inviteWB.status === 403, `${inviteX.status}/${inviteWB.status}`);
  const invite = await http("POST", `/residents/${S.o1.id}/invite`, { token: S.wardenA.token });
  check("O6d", "Own-block warden re-issues an invite code + WhatsApp link", invite.status === 200 && /^[A-F0-9]{8}$/.test(invite.data.code) && invite.data.whatsapp.link.startsWith("https://wa.me/92"), String(invite.status));
  const wrongPhone = await http("POST", "/residents/claim", { body: { code: invite.data?.code, phone: "0399-0000000", password: PASSWORD } });
  const oldCode = await http("POST", "/residents/claim", { body: { code: S.o1.claimCode, phone: S.o1.phone, password: PASSWORD } });
  check("O6e", "Claim with the wrong phone or a superseded code fails", wrongPhone.status === 404 && oldCode.status === 404, `${wrongPhone.status}/${oldCode.status}`);
  const claimEmail = `qa.p2.o1.${RUN}@example.test`;
  const claim = await http("POST", "/residents/claim", { body: { code: invite.data?.code, phone: S.o1.phone, password: PASSWORD, email: claimEmail } });
  S.o1.token = claim.data?.token;
  const myFees = S.o1.token ? await http("GET", "/fees/my", { token: S.o1.token }) : { status: 0 };
  check("O6f", "Claim works; history (deposit receipt + first rent invoice) is preserved", claim.status === 200 && myFees.status === 200 && myFees.data.invoices.length === 2 && myFees.data.payments.length === 1, `${claim.status} ${claim.data?.message || ""} ${myFees.data?.invoices?.length}`);
  const relogin = await http("POST", "/auth/login", { body: { email: claimEmail, password: PASSWORD } });
  const reuse = await http("POST", "/residents/claim", { body: { code: invite.data?.code, phone: S.o1.phone, password: PASSWORD } });
  check("O6g", "Normal login works afterwards; the code is single-use", relogin.status === 200 && reuse.status === 404, `${relogin.status}/${reuse.status}`);
  const g = await http("POST", "/parent-panel/claim", { token: S.parentO.token, body: { code: S.o1.guardianCode } });
  check("O6h", "Guardian of the offline student claims the parent invite issued at admission", g.status === 200, String(g.status));
}

const SECTIONS = [clockAndPolicies, offlineResidents];

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required (same database the API at BASE_URL uses).");
  await mongoose.connect(process.env.MONGO_URI);
  const health = await http("GET", "/health");
  if (health.data?.database !== "mongodb") throw new Error("API is not connected to MongoDB.");
  await seed();
  for (const section of SECTIONS) {
    try {
      await section();
    } catch (error) {
      check("ERR", `${section.name} crashed`, false, error.stack?.split("\n").slice(0, 3).join(" | "));
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  return failed.length;
}

async function cleanup() {
  if (S.admin) await http("POST", "/dev/clock", { token: S.admin.token, body: { days: 0 } }).catch(() => {});
  if (process.env.KEEP === "1") return console.log("KEEP=1: leaving [QA-P2] data in place.");
  try {
    const hostelIds = created.hostels;
    const studentIds = (await User.find({ name: /^\[QA-P2\]/ }).select("_id").lean()).map((u) => u._id);
    const names = mongoose.modelNames();
    await Promise.all(
      names.map((name) => {
        const M = mongoose.model(name);
        const paths = M.schema.paths;
        if (paths.hostel) return M.deleteMany({ hostel: { $in: hostelIds } });
        if (paths.hostelId && name !== "Hostel") return M.deleteMany({ hostelId: { $in: hostelIds } });
        return null;
      })
    );
    await Promise.all([
      ParentLink.deleteMany({ student: { $in: studentIds } }),
      Booking.deleteMany({ room: { $in: created.rooms } }),
      Room.deleteMany({ $or: [{ _id: { $in: created.rooms } }, { hostel: { $in: hostelIds } }] }),
      Block.deleteMany({ _id: { $in: created.blocks } }),
      Hostel.deleteMany({ _id: { $in: hostelIds } }),
      StaffMember.deleteMany({ hostel: { $in: hostelIds } }),
      Notice.deleteMany({ hostel: { $in: hostelIds } }),
      FeeInvoice.deleteMany({ hostel: { $in: hostelIds } }),
      FeePayment.deleteMany({ hostel: { $in: hostelIds } }),
      User.deleteMany({ $or: [{ _id: { $in: created.users } }, { _id: { $in: studentIds } }] })
    ]);
    console.log("Cleaned up all [QA-P2] data.");
  } catch (error) {
    console.error("Cleanup failed:", error.message);
  }
}

main()
  .then(async (failed) => {
    await cleanup();
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
  })
  .catch(async (error) => {
    console.error("Runner error:", error.message);
    await cleanup();
    await mongoose.disconnect().catch(() => {});
    process.exit(2);
  });
