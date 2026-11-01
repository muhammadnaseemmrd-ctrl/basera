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
const LeaveNotice = require("../models/LeaveNotice");
const OfferRedemption = require("../models/OfferRedemption");
require("../models/HostelOffer");

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

// ---------------------------------------------------------------- late fines + waivers
const quote = async (invoiceId, token) => (await http("GET", `/fees/invoices/${invoiceId}/quote`, { token })).data?.invoice || {};
const notifCount = async (userId, type) => ((await User.findById(userId).select("notifications").lean())?.notifications || []).filter((n) => n.type === type).length;

async function finesAndWaivers() {
  const hA = String(S.hostelA._id);
  await setToday(midday(2026, 11, 1));
  // invoices whose terms matter are created on Nov 1 (terms are snapshotted at creation)
  const s1Inv = await http("POST", "/fees/invoices", { token: S.ownerA.token, body: { hostelId: hA, studentId: S.s1.id, title: "Rent November", amount: 8000, kind: "rent", period: "2026-11" } });
  S.s1Invoice = s1Inv.data?.invoice?.id;
  check("F0", "Rent invoice defaults to the policy due date (5th) with PKR 100/day snapshotted", s1Inv.status === 201 && clock.dayKey(new Date(s1Inv.data.invoice.dueDate)) === "2026-11-05" && s1Inv.data.invoice.finePerDay === 100, `${s1Inv.status} ${s1Inv.data?.message || ""}`);

  // P6: change the fine to 150 → existing invoices keep 100, new ones get 150
  await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { lateFee: { finePerDay: 150 } } });
  const s2Inv = await http("POST", "/fees/invoices", { token: S.ownerA.token, body: { hostelId: hA, studentId: S.s2.id, title: "Rent November", amount: 8000, kind: "rent", period: "2026-11" } });
  S.s2Invoice = s2Inv.data?.invoice?.id;
  const s1Again = await FeeInvoice.findById(S.s1Invoice).lean();
  check("P6", "Fine changed to 150 after an invoice exists: old keeps 100, new uses 150", s2Inv.data?.invoice?.finePerDay === 150 && s1Again.finePerDay === 100, `${s2Inv.data?.invoice?.finePerDay}/${s1Again.finePerDay}`);
  // F6 prep: cap 300 for one new invoice, then restore platform defaults
  await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { lateFee: { finePerDay: 100, maxFine: 300 } } });
  const capInv = await http("POST", "/fees/invoices", { token: S.ownerA.token, body: { hostelId: hA, studentId: S.csv1.studentId, title: "Rent November", amount: 7000, kind: "rent", period: "2026-11" } });
  S.capInvoice = capInv.data?.invoice?.id;
  await http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body: { reset: ["lateFee.finePerDay", "lateFee.maxFine"] } });

  // due-soon reminder: daily job on Nov 2, twice → one notification
  await setToday(midday(2026, 11, 2));
  const d1 = await http("POST", "/jobs/daily", { token: S.admin.token });
  await http("POST", "/jobs/daily", { token: S.admin.token });
  const dueN = await notifCount(S.s1.id, "due_soon");
  check("N1", "Due-soon reminder (3 days before) is sent once even if the daily job runs twice", d1.status === 200 && dueN === 1, `${d1.status} ${dueN}`);
  const jobNoAuth = await http("POST", "/jobs/daily", { token: S.ownerA.token });
  check("N1b", "Jobs need CRON_SECRET or an admin token", jobNoAuth.status === 403, String(jobNoAuth.status));

  const q = async (y, m, d) => {
    await setToday(midday(y, m, d));
    return quote(S.s1Invoice, S.s1.token);
  };
  let r = await q(2026, 11, 4);
  check("F1", "4th: fine 0, total 8,000", r.fineAccrued === 0 && r.totalDue === 8000, JSON.stringify([r.fineAccrued, r.totalDue]));
  r = await q(2026, 11, 5);
  check("F2", "5th: fine 0, total 8,000", r.fineAccrued === 0 && r.totalDue === 8000, JSON.stringify([r.fineAccrued, r.totalDue]));
  r = await q(2026, 11, 6);
  check("F3", "6th: fine 100, total 8,100; tomorrow 8,200", r.fineAccrued === 100 && r.totalDue === 8100 && r.payTomorrow === 8200, JSON.stringify([r.fineAccrued, r.totalDue, r.payTomorrow]));

  // F8 + O5: offline O1 pays part on the 7th (rent first) — cash, receipt, WhatsApp
  await setToday(midday(2026, 11, 7));
  const o1Pay = await http("POST", `/fees/invoices/${S.o1.rentInvoice}/payments`, { token: S.wardenA.token, body: { amount: 3000, method: "cash" } });
  const o1Inv = o1Pay.data?.invoice || {};
  check("F8", "Partial PKR 3,000 on the 7th goes to rent first: rent due 5,000, fine 200 still owed", o1Pay.status === 201 && o1Pay.data.payment.rentPortion === 3000 && o1Pay.data.payment.finePortion === 0 && o1Inv.rentDue === 5000 && o1Inv.fineDue === 200 && o1Pay.data.balance === 5200, `${o1Pay.status} ${o1Pay.data?.message || JSON.stringify([o1Inv.rentDue, o1Inv.fineDue])}`);
  const o1Wa = await http("GET", `/fees/payments/${o1Pay.data?.payment?.id}/whatsapp`, { token: S.wardenA.token });
  const o1Pdf = await http("GET", `/fees/payments/${o1Pay.data?.payment?.id}/receipt.pdf`, { token: S.o1.token, raw: true });
  check("O5", "Offline student: cash receipt PDF + WhatsApp link work exactly like online", o1Wa.status === 200 && o1Wa.data.link.startsWith("https://wa.me/92") && o1Pdf.status === 200, `${o1Wa.status}/${o1Pdf.status}`);

  r = await q(2026, 11, 10);
  check("F4", "10th: fine 500, total 8,500", r.fineAccrued === 500 && r.totalDue === 8500, JSON.stringify([r.fineAccrued, r.totalDue]));
  const cap = await quote(S.capInvoice, S.ownerA.token);
  check("F6", "Invoice issued under a PKR 300 cap shows 300 on the 10th", cap.fineAccrued === 300 && cap.totalDue === 7300, JSON.stringify([cap.fineAccrued, cap.totalDue]));
  const pay = await http("POST", `/fees/invoices/${S.s1Invoice}/payments`, { token: S.wardenA.token, body: { amount: 8000, method: "bank_transfer", transactionId: `P2-${RUN}-RENT` } });
  check("F5a", "10th: paying 8,000 clears rent (rent first) and leaves the 500 fine", pay.status === 201 && pay.data.invoice.rentDue === 0 && pay.data.invoice.fineDue === 500 && pay.data.invoice.fineStatus === "frozen", `${pay.status} ${pay.data?.message || ""}`);
  r = await q(2026, 11, 12);
  check("F5b", "12th: the fine stayed frozen at 500", r.fineAccrued === 500 && r.totalDue === 500, JSON.stringify([r.fineAccrued, r.totalDue]));

  // same number on every screen
  const myFees = await http("GET", "/fees/my", { token: S.s1.token });
  const parentOv = await http("GET", `/parent-panel/children/${S.s1.id}/fees`, { token: S.parent1.token });
  const wardenList = await http("GET", `/fees/invoices?hostelId=${hA}&studentId=${S.s1.id}`, { token: S.wardenA.token });
  const views = [myFees.data?.invoices?.find((i) => i.id === S.s1Invoice), parentOv.data?.invoices?.find((i) => i.id === S.s1Invoice), wardenList.data?.results?.find((i) => i.id === S.s1Invoice)];
  check("F11", "Student, parent and warden screens show the same fine (500) and balance (500)", views.every((v) => v && v.fineAccrued === 500 && v.balance === 500), JSON.stringify(views.map((v) => v && [v.fineAccrued, v.balance])));

  // F9: job twice, then skip days and run once
  const j1 = await http("POST", "/jobs/late-fees", { token: S.admin.token });
  const j2 = await http("POST", "/jobs/late-fees", { token: S.admin.token });
  const afterTwice = await FeeInvoice.findById(S.o1.rentInvoice).lean();
  await setToday(midday(2026, 11, 15));
  await http("POST", "/jobs/late-fees", { token: S.admin.token });
  const afterSkip = await FeeInvoice.findById(S.o1.rentInvoice).lean();
  const s1Stored = await FeeInvoice.findById(S.s1Invoice).lean();
  check("F9", "Job twice = same totals; after skipping days it self-heals (O1: 700 on 12th → 1,000 on 15th; S1 frozen 500)", j1.status === 200 && j2.data.updated === 0 && afterTwice.fineAccrued === 700 && afterSkip.fineAccrued === 1000 && s1Stored.fineAccrued === 500, `${j2.data?.updated} ${afterTwice.fineAccrued} ${afterSkip.fineAccrued} ${s1Stored.fineAccrued}`);
  check("N2", "Fine-started notice reached the student once (deduped)", (await notifCount(S.o1.id, "fine_started")) === 1, String(await notifCount(S.o1.id, "fine_started")));

  // F10: Karachi midnight
  await setToday(new Date("2026-11-15T18:30:00Z")); // 23:30 PKT on the 15th
  const before = await quote(S.o1.rentInvoice, S.ownerA.token);
  await setToday(new Date("2026-11-15T19:30:00Z")); // 00:30 PKT on the 16th
  const after = await quote(S.o1.rentInvoice, S.ownerA.token);
  check("F10", "Day rolls at Karachi midnight: 23:30 PKT → 1,000, 00:30 PKT → 1,100", before.fineAccrued === 1000 && after.fineAccrued === 1100, `${before.fineAccrued}/${after.fineAccrued}`);

  // F7: late admission on the 20th — November rent due the 5th is not back-dated
  await setToday(midday(2026, 11, 20));
  const late = await http("POST", "/residents", { token: S.ownerA.token, body: { hostelId: hA, name: "[QA-P2] Late joiner", phone: phone(), roomId: String(S.roomA3._id), bedIndex: 0, monthlyRent: 8000, firstInvoice: { period: "2026-11" } } });
  S.late = { id: late.data?.student?.id, invoice: late.data?.firstInvoice?.id, bookingId: late.data?.booking?.id };
  const late20 = await quote(S.late.invoice, S.ownerA.token);
  await setToday(midday(2026, 11, 21));
  const late21 = await quote(S.late.invoice, S.ownerA.token);
  check("F7", "Invoice issued on the 20th (due the 5th): fine 0 on the 20th, 100 on the 21st", late.status === 201 && late20.fineAccrued === 0 && late21.fineAccrued === 100, `${late.status} ${late20.fineAccrued}/${late21.fineAccrued}`);

  // ---- waivers on S1's frozen 500 fine
  await setToday(midday(2026, 11, 12));
  const w1 = await http("POST", "/fees/waivers", { token: S.s1.token, body: { invoiceId: S.s1Invoice, amount: 500, reason: "Bank holiday delayed my transfer" } });
  const queue = await http("GET", `/fees/waivers?hostelId=${hA}&status=pending`, { token: S.ownerA.token });
  const qRow = queue.data?.results?.find((x) => x.id === w1.data?.request?.id);
  check("W1", "Student requests a waiver; head office queue shows it with age and amount", w1.status === 201 && qRow?.requestedAmount === 500 && qRow.ageDays === 0 && qRow.waivableNow === 500, `${w1.status} ${w1.data?.message || ""}`);
  const w2 = await http("POST", "/fees/waivers", { token: S.s1.token, body: { invoiceId: S.s1Invoice, amount: 100, reason: "again" } });
  check("W2", "A second pending request on the same invoice is refused", w2.status === 409, String(w2.status));
  const wid = w1.data?.request?.id;
  const rec = await http("POST", `/fees/waivers/${wid}/recommend`, { token: S.wardenA.token, body: { note: "Genuine — bank strike that week" } });
  const wDecide = await http("POST", `/fees/waivers/${wid}/decide`, { token: S.wardenA.token, body: { decision: "approve", amount: 500, note: "x" } });
  check("W3", "Warden can recommend but not approve (403)", rec.status === 200 && wDecide.status === 403, `${rec.status}/${wDecide.status}`);
  const xDecide = await http("POST", `/fees/waivers/${wid}/decide`, { token: S.ownerB.token, body: { decision: "approve", amount: 500, note: "x" } });
  const wbRec = await http("POST", `/fees/waivers/${wid}/recommend`, { token: S.wardenB.token, body: { note: "x" } });
  const otherStudent = await http("POST", "/fees/waivers", { token: S.o1.token, body: { invoiceId: S.s1Invoice, reason: "not mine" } });
  check("W7", "Other owner cannot decide; other block's warden cannot recommend; another student cannot request", xDecide.status === 403 && wbRec.status === 403 && otherStudent.status === 403, `${xDecide.status}/${wbRec.status}/${otherStudent.status}`);
  const noNote = await http("POST", `/fees/waivers/${wid}/decide`, { token: S.ownerA.token, body: { decision: "approve", amount: 300 } });
  const p1Before = await notifCount(S.parent1.id, "waiver_decision");
  const w4 = await http("POST", `/fees/waivers/${wid}/decide`, { token: S.ownerA.token, body: { decision: "approve", amount: 300, note: "Partial: first late payment" } });
  const s1After = await quote(S.s1Invoice, S.s1.token);
  const auditW = await AuditLog.countDocuments({ action: "fee.waiver.approved", entityId: wid });
  check("W4", "Head office approves PKR 300 (partial, note required): fine due 200, student+parent notified, audited", noNote.status === 400 && w4.status === 200 && w4.data.request.status === "partial" && s1After.fineWaived === 300 && s1After.fineDue === 200 && (await notifCount(S.s1.id, "waiver_decision")) === 1 && (await notifCount(S.parent1.id, "waiver_decision")) === p1Before + 1 && auditW === 1, `${noNote.status}/${w4.status} ${w4.data?.message || ""} ${s1After.fineDue}`);
  const again = await http("POST", `/fees/waivers/${wid}/decide`, { token: S.ownerA.token, body: { decision: "approve", amount: 100, note: "again" } });
  const w5b = await http("POST", "/fees/waivers", { token: S.s1.token, body: { invoiceId: S.s1Invoice, amount: "all", reason: "Please waive the rest" } });
  const huge = await http("POST", `/fees/waivers/${w5b.data?.request?.id}/decide`, { token: S.ownerA.token, body: { decision: "approve", amount: 9999, note: "too much" } });
  const stillPending = await http("GET", "/fees/waivers/my", { token: S.s1.token });
  check("W5", "Approving again → 409; approving 9,999 → 400 and the request stays pending; never above accrued", again.status === 409 && huge.status === 400 && stillPending.data.results.find((x) => x.id === w5b.data?.request?.id)?.status === "pending" && (await FeeInvoice.findById(S.s1Invoice).lean()).fineWaived === 300, `${again.status}/${huge.status}`);
  const rej = await http("POST", `/fees/waivers/${w5b.data?.request?.id}/decide`, { token: S.ownerA.token, body: { decision: "reject", note: "Only one waiver per term" } });
  const mine = await http("GET", "/fees/waivers/my", { token: S.s1.token });
  check("W6", "Head office rejects with a note; the student sees the note", rej.status === 200 && mine.data.results.find((x) => x.id === w5b.data?.request?.id)?.decisionNote === "Only one waiver per term", String(rej.status));
  const w9 = await http("POST", "/fees/waivers", { token: S.s1.token, body: { invoiceId: S.s1Invoice, amount: 50, reason: "try" } });
  const cancel = await http("POST", `/fees/waivers/${w9.data?.request?.id}/cancel`, { token: S.s1.token });
  const afterCancel = await http("POST", `/fees/waivers/${w9.data?.request?.id}/decide`, { token: S.ownerA.token, body: { decision: "approve", amount: 50, note: "late" } });
  check("W9", "Student cancels a pending request; it can't be approved afterwards", w9.status === 201 && cancel.status === 200 && afterCancel.status === 409, `${w9.status}/${cancel.status}/${afterCancel.status}`);
  const proNo = await http("POST", `/fees/invoices/${S.s1Invoice}/waive`, { token: S.ownerA.token, body: { amount: "all" } });
  const proX = await http("POST", `/fees/invoices/${S.s1Invoice}/waive`, { token: S.ownerB.token, body: { amount: "all", reason: "x" } });
  const proW = await http("POST", `/fees/invoices/${S.s1Invoice}/waive`, { token: S.wardenA.token, body: { amount: "all", reason: "x" } });
  const pro = await http("POST", `/fees/invoices/${S.s1Invoice}/waive`, { token: S.ownerA.token, body: { amount: "all", reason: "Goodwill" } });
  check("W8", "Proactive waiver: reason required, head office only, clears the rest (fine due 0, invoice paid)", proNo.status === 400 && proX.status === 403 && proW.status === 403 && pro.status === 200 && pro.data.waived === 200 && pro.data.invoice.fineDue === 0 && pro.data.invoice.status === "paid", `${proNo.status}/${proX.status}/${proW.status}/${pro.status} ${pro.data?.message || ""}`);
  const nothing = await http("POST", "/fees/waivers", { token: S.s1.token, body: { invoiceId: S.s1Invoice, reason: "more" } });
  check("W10", "Nothing left to waive → request refused (409)", nothing.status === 409, String(nothing.status));
  const rep = await http("GET", `/fees/waivers/report?hostelId=${hA}`, { token: S.ownerA.token });
  const nov = rep.data?.results?.find((x) => x.month === "2026-11");
  check("W11", "Monthly fines report: charged vs waived for November", rep.status === 200 && nov && nov.waived === 500 && nov.charged >= 500, JSON.stringify(nov));
  const repX = await http("GET", `/fees/waivers/report?hostelId=${hA}`, { token: S.ownerB.token });
  check("W12", "Other owner cannot read the fines report or waiver queue", repX.status === 403 && (await http("GET", `/fees/waivers?hostelId=${hA}`, { token: S.wardenX.token })).status === 403, String(repX.status));
}

// ---------------------------------------------------------------- leave notice
const dayStr = (d) => clock.dayKey(d);
async function leaveNotices() {
  const hA = String(S.hostelA._id);
  await setToday(midday(2026, 11, 20));
  const today = K(2026, 11, 20);
  const plus = (n) => dayStr(clock.addDays(today, n));
  const setPolicy = (body) => http("PUT", `/policies/${hA}`, { token: S.ownerA.token, body });

  // offline O2 with a login and a FUTURE join date (for the "before join date" rule + L13)
  const o2 = await http("POST", "/residents", { token: S.ownerA.token, body: { hostelId: hA, name: "[QA-P2] Offline O2", phone: phone(), roomId: String(S.roomA3._id), bedIndex: 1, monthlyRent: 7000, joinDate: "2026-12-10", login: true } });
  const o2Login = await http("POST", "/auth/login", { body: { email: o2.data?.student?.email, password: o2.data?.tempPassword } });
  S.o2 = { id: o2.data?.student?.id, token: o2Login.data?.token, bookingId: o2.data?.booking?.id };

  const pol = await http("GET", "/leave/policy", { token: S.s1.token });
  check("L0", "Student sees their policy: 45 days, earliest compliant date", pol.status === 200 && pol.data.policyDays === 45 && pol.data.earliestCompliantDate === plus(45), JSON.stringify(pol.data).slice(0, 160));
  const past = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: "2026-11-19", reason: "x" } });
  const beforeJoin = await http("POST", "/leave", { token: S.o2.token, body: { intendedLeaveDate: "2026-12-05", reason: "x" } });
  check("L4", "Past date and date before join date are rejected (400)", past.status === 400 && beforeJoin.status === 400 && /join date/.test(beforeJoin.data?.message), `${past.status}/${beforeJoin.status}`);

  await setPolicy({ leaveNotice: { shortNoticeAction: "block" } });
  const blocked = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: plus(44), reason: "Short" } });
  check("L2a", "44 days under 'block': refused and the earliest allowed date is shown", blocked.status === 422 && blocked.data.earliestCompliantDate === plus(45), `${blocked.status} ${blocked.data?.earliestCompliantDate}`);
  await setPolicy({ leaveNotice: { shortNoticeAction: "allow_with_charge", shortNoticeChargeDays: 3 } });
  const charged = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: plus(44), reason: "Short" } });
  const chargeInv = charged.data?.notice?.shortNoticeCharge?.invoice ? await FeeInvoice.findById(charged.data.notice.shortNoticeCharge.invoice).lean() : null;
  check("L2b", "44 days under 'charge': accepted + flagged; charge = 3 × 8,000/30 = 800 on a labelled invoice", charged.status === 201 && charged.data.notice.flagged && charged.data.notice.shortBy === 1 && chargeInv?.amount === 800 && /Short-notice charge/.test(chargeInv.title), `${charged.status} ${charged.data?.message || ""} ${chargeInv?.amount}`);
  const wd = await http("POST", `/leave/${charged.data?.notice?.id}/withdraw`, { token: S.s1.token });
  const seatsAfterWd = await http("GET", `/blocks/${S.blockA._id}/seats`, { token: S.wardenA.token });
  const s1Seat = () => seatsAfterWd.data?.blocks?.[0]?.rooms?.find((r) => r.roomNumber === "A2")?.seats?.[0];
  check("L6", "Withdraw before approval: withdrawn, charge voided, seat unchanged (occupied)", wd.status === 200 && wd.data.notice.status === "withdrawn" && (await FeeInvoice.findById(chargeInv?._id).lean())?.status === "void" && s1Seat()?.status === "occupied", `${wd.status} ${s1Seat()?.status}`);
  await setPolicy({ leaveNotice: { shortNoticeAction: "allow_flag_only", shortNoticeChargeDays: 0 } });
  const flagged = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: plus(44), reason: "Short" } });
  check("L2c", "44 days under 'flag only': accepted, flagged, no charge", flagged.status === 201 && flagged.data.notice.flagged && !flagged.data.notice.shortNoticeCharge?.invoice, String(flagged.status));
  await http("POST", `/leave/${flagged.data?.notice?.id}/withdraw`, { token: S.s1.token });

  const ok = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: plus(45), reason: "Graduating" } });
  S.s1Notice = ok.data?.notice?.id;
  S.s1LeaveDay = plus(45);
  check("L1", "Exactly 45 days ahead: compliant, submitted", ok.status === 201 && ok.data.notice.status === "submitted" && ok.data.notice.shortBy === 0 && !ok.data.notice.flagged && ok.data.notice.noticeDaysGiven === 45, `${ok.status} ${ok.data?.message || ""}`);
  const second = await http("POST", "/leave", { token: S.s1.token, body: { intendedLeaveDate: plus(60), reason: "again" } });
  check("L5", "Second open notice for the same stay → 409", second.status === 409, String(second.status));
  const b16 = await http("POST", "/leave", { token: S.s2.token, body: { intendedLeaveDate: plus(16), reason: "Moving" } });
  S.s2Notice = b16.data?.notice?.id;
  check("L3", "Block B (15-day override) student, 16 days ahead: compliant", b16.status === 201 && b16.data.notice.policyDays === 15 && !b16.data.notice.flagged, `${b16.status} ${b16.data?.notice?.policyDays}`);

  await setPolicy({ leaveNotice: { days: 60 } });
  const snap = await LeaveNotice.findById(S.s1Notice).lean();
  check("L9", "Changing policy after submission doesn't alter the snapshot (still 45)", snap.policyDays === 45 && snap.shortBy === 0, String(snap.policyDays));
  await setPolicy({ leaveNotice: { days: 45 } });

  const decWB = await http("POST", `/leave/${S.s1Notice}/decide`, { token: S.wardenB.token, body: { decision: "approve" } });
  const decWA = await http("POST", `/leave/${S.s1Notice}/decide`, { token: S.wardenA.token, body: { decision: "approve" } });
  const decX = await http("POST", `/leave/${S.s1Notice}/decide`, { token: S.ownerB.token, body: { decision: "approve" } });
  const listX = await http("GET", `/leave?hostelId=${hA}`, { token: S.wardenX.token });
  const otherWithdraw = await http("POST", `/leave/${S.s1Notice}/withdraw`, { token: S.o1.token });
  check("L8", "Other block's warden, own warden (no permission), other owner → 403; other student can't withdraw", [decWB, decWA, decX, listX, otherWithdraw].every((r) => r.status === 403), [decWB, decWA, decX, listX, otherWithdraw].map((r) => r.status).join("/"));
  const appr = await http("POST", `/leave/${S.s1Notice}/decide`, { token: S.ownerA.token, body: { decision: "approve", note: "Good luck" } });
  const seats = await http("GET", `/head-office/hostels/${hA}/seats?blockId=${S.blockA._id}`, { token: S.ownerA.token });
  const seat = seats.data?.blocks?.[0]?.rooms?.find((r) => r.roomNumber === "A2")?.seats?.[0];
  const pov = await http("GET", `/parent-panel/children/${S.s1.id}/overview`, { token: S.parent1.token });
  check("L7", "Head office approves: seat 'leaving', still counted occupied, available from the date; parent sees it read-only", appr.status === 200 && seat?.status === "leaving" && seat.availableFrom === S.s1LeaveDay && seats.data.summary.leaving === 1 && pov.data?.leave?.status === "approved", `${appr.status} ${seat?.status} ${seat?.availableFrom} ${pov.data?.leave?.status}`);
  const twice = await http("POST", `/leave/${S.s1Notice}/decide`, { token: S.ownerA.token, body: { decision: "reject", note: "x" } });
  check("L7b", "Deciding twice → 409", twice.status === 409, String(twice.status));
  await setPolicy({ leaveNotice: { wardenCanApprove: true } });
  const wbOk = await http("POST", `/leave/${S.s2Notice}/decide`, { token: S.wardenB.token, body: { decision: "reject", note: "Pay November first" } });
  check("L8b", "With wardenCanApprove on, the block's own warden can decide (reject needs a note)", wbOk.status === 200 && wbOk.data.notice.status === "rejected", String(wbOk.status));
  await setPolicy({ reset: ["leaveNotice.wardenCanApprove"] });

  // L13 (offline O2, identical endpoints)
  const o2n = await http("POST", "/leave", { token: S.o2.token, body: { intendedLeaveDate: plus(50), reason: "Job" } });
  const o2a = await http("POST", `/leave/${o2n.data?.notice?.id}/decide`, { token: S.ownerA.token, body: { decision: "approve" } });
  check("L13", "Offline student gives notice and gets it approved through the same flow", o2n.status === 201 && o2a.status === 200, `${o2n.status}/${o2a.status}`);

  // L12: reminders 7 days and 1 day before (deduped)
  const leaveDate = clock.parseDay(S.s1LeaveDay);
  const at = (n) => new Date(clock.addDays(leaveDate, -n).getTime() + 12 * 3600000);
  await setToday(at(7));
  await http("POST", "/jobs/daily", { token: S.admin.token });
  await http("POST", "/jobs/daily", { token: S.admin.token });
  await setToday(at(1));
  await http("POST", "/jobs/daily", { token: S.admin.token });
  // the warden also gets O2's reminder (same block) — count only the ones about S1's date
  const aboutS1 = async (id, type) => ((await User.findById(id).select("notifications").lean())?.notifications || []).filter((n) => n.type === type && n.message.includes(S.s1LeaveDay)).length;
  const r7 = await Promise.all([S.s1.id, S.parent1.id, S.wardenA.id].map((id) => aboutS1(id, "leave_reminder7")));
  const r1 = await notifCount(S.s1.id, "leave_reminder1");
  check("L12", "7-day and 1-day reminders reach student, parent and warden once each", r7.every((n) => n === 1) && r1 === 1, `${r7} / ${r1}`);

  // L10: checkout blocked by unpaid rent (O1 still owes rent)
  const blockedOut = await http("POST", `/head-office/hostels/${hA}/residents/${S.o1.bookingId}/checkout`, { token: S.ownerA.token, body: {} });
  check("L10", "Checkout with unpaid rent is blocked with the list of dues", blockedOut.status === 409 && blockedOut.data.dues?.[0]?.rentDue === 5000, `${blockedOut.status} ${JSON.stringify(blockedOut.data?.dues)}`);
  const early = await http("POST", `/head-office/hostels/${hA}/residents/${S.s1.bookingId}/checkout`, { token: S.ownerA.token, body: {} });
  check("L10b", "Checkout before the approved leave date is refused", early.status === 409 && /leave date/.test(early.data?.message), `${early.status} ${early.data?.message}`);

  // L11: on the leave date
  await setToday(new Date(leaveDate.getTime() + 12 * 3600000));
  const xOut = await http("POST", `/head-office/hostels/${hA}/residents/${S.s1.bookingId}/checkout`, { token: S.ownerB.token, body: {} });
  const before = (await Room.findById(S.roomA2._id).lean()).availableBeds;
  const out = await http("POST", `/head-office/hostels/${hA}/residents/${S.s1.bookingId}/checkout`, { token: S.ownerA.token, body: { damages: [{ label: "Broken chair", amount: 1500 }] } });
  const st = out.data?.settlement || {};
  const noticeDone = await LeaveNotice.findById(S.s1Notice).lean();
  const afterBeds = (await Room.findById(S.roomA2._id).lean()).availableBeds;
  check("L11a", "S1 checkout: deposit 10,000 − dues 0 − damage 1,500 = refund 8,500; notice completed; bed back", xOut.status === 403 && out.status === 200 && st.deposit === 10000 && st.duesTotal === 0 && st.damagesTotal === 1500 && st.refund === 8500 && noticeDone.status === "completed" && afterBeds === before + 1, `${xOut.status}/${out.status} ${JSON.stringify(st).slice(0, 160)}`);
  const outTwice = await http("POST", `/head-office/hostels/${hA}/residents/${S.s1.bookingId}/checkout`, { token: S.ownerA.token, body: {} });
  check("L11b", "Checking out twice → 409, no double refund", outTwice.status === 409, String(outTwice.status));
  // O1 (offline): pay the rent, leaving the frozen fine; checkout settles the fine from the deposit
  const o1q = await quote(S.o1.rentInvoice, S.ownerA.token);
  await http("POST", `/fees/invoices/${S.o1.rentInvoice}/payments`, { token: S.ownerA.token, body: { amount: o1q.rentDue, method: "cash" } });
  const o1After = await quote(S.o1.rentInvoice, S.ownerA.token);
  const o1Out = await http("POST", `/head-office/hostels/${hA}/residents/${S.o1.bookingId}/checkout`, { token: S.ownerA.token, body: { damages: [{ label: "Lost key", amount: 1000 }] } });
  const o1st = o1Out.data?.settlement || {};
  const o1Final = await quote(S.o1.rentInvoice, S.ownerA.token);
  check("L11c", "Offline O1: deposit 10,000 − fine dues − 1,000 damage settled exactly; fine cleared by a deposit adjustment receipt", o1Out.status === 200 && o1st.duesTotal === o1After.fineDue && o1st.refund === 10000 - o1After.fineDue - 1000 && o1Final.totalDue === 0 && o1Out.data.adjustments.length === 1, `${o1Out.status} ${o1Out.data?.message || ""} fine ${o1After.fineDue} ${JSON.stringify(o1st).slice(0, 140)}`);
}

// ---------------------------------------------------------------- offers & discounts
async function offersAndDiscounts() {
  const hA = String(S.hostelA._id);
  await setToday(midday(2027, 2, 1));
  const O = (body) => http("POST", "/hostel-offers", { token: S.ownerA.token, body: { hostelId: hA, status: "active", ...body } });
  const bill = async (studentId, amount) => (await http("POST", "/fees/invoices", { token: S.ownerA.token, body: { hostelId: hA, studentId, title: "Rent February", amount, kind: "rent", period: "2027-02" } })).data?.invoice?.id;
  const csvIds = (await Booking.find({ hostel: S.hostelA._id, source: "offline", status: "active", room: { $in: [S.roomB3._id, S.roomB4._id, S.roomB5._id] } }).select("student").lean()).map((b) => String(b.student));
  const inv = {
    o2: await bill(S.o2.id, 7000),
    late: await bill(S.late.id, 8000),
    w1: await bill(S.w1.id, 7500),
    s2: await bill(S.s2.id, 8000),
    c: await Promise.all(csvIds.slice(0, 8).map((id) => bill(id, 7000)))
  };
  check("D0", "February invoices created for online + offline students", inv.o2 && inv.late && inv.w1 && inv.s2 && inv.c.every(Boolean), JSON.stringify(inv).slice(0, 120));

  const bad = await O({ name: "", type: "percent", value: 150 });
  const xCreate = await http("POST", "/hostel-offers", { token: S.ownerB.token, body: { hostelId: hA, name: "x", type: "flat", value: 1 } });
  const wCreate = await http("POST", "/hostel-offers", { token: S.wardenA.token, body: { hostelId: hA, name: "x", type: "flat", value: 1 } });
  check("D0b", "Invalid offer → 400; other owner / warden cannot create offers (403)", bad.status === 400 && xCreate.status === 403 && wCreate.status === 403, `${bad.status}/${xCreate.status}/${wCreate.status}`);
  const early = await O({ name: "Early pay 2%", type: "percent", value: 2, trigger: "early_payment", condition: { payBeforeDay: 3 }, scope: "block", blocks: [String(S.blockA._id)], validFrom: "2027-02-01", validTo: "2027-02-28" });
  const list = await http("GET", `/hostel-offers?hostelId=${hA}`, { token: S.ownerA.token });
  check("D1", "Early-pay 2% by the 3rd (Block A, active, valid this month) is listed active", early.status === 201 && list.data.results.some((o) => o.id === early.data.offer.id && o.status === "active"), `${early.status} ${early.data?.message || ""}`);

  await setToday(midday(2027, 2, 2));
  const qO2 = await quote(inv.o2, S.o2.token);
  const d2 = await http("POST", `/fees/invoices/${inv.o2}/payments`, { token: S.wardenA.token, body: { amount: 6860, method: "cash" } });
  const d2inv = d2.data?.invoice || {};
  const rcpt = await http("GET", `/fees/payments/${d2.data?.payment?.id}/receipt.pdf`, { token: S.o2.token, raw: true });
  check("D2", "Paid on the 2nd: explicit −140 line (2% of 7,000), 6,860 settles the invoice; receipt PDF renders", qO2.eligibleOffers === undefined && d2.status === 201 && d2.data.payment.discountApplied === 140 && d2inv.discounts?.[0]?.amountOff === 140 && d2inv.discounts[0].name === "Early pay 2%" && d2inv.totalDue === 0 && d2inv.status === "paid" && rcpt.status === 200, `${d2.status} ${d2.data?.message || ""} ${JSON.stringify(d2inv.discounts)}`);
  const qInfo = await http("GET", `/fees/invoices/${inv.late}/quote`, { token: S.ownerA.token });
  check("D2b", "Payment screen lists the early-pay offer while it's eligible", qInfo.data?.eligibleOffers?.some((o) => o.name === "Early pay 2%" && o.amountOff === 160), JSON.stringify(qInfo.data?.eligibleOffers));

  await setToday(midday(2027, 2, 4));
  const d3 = await http("POST", `/fees/invoices/${inv.late}/payments`, { token: S.wardenA.token, body: { amount: 8000, method: "cash" } });
  check("D3", "Paid on the 4th: no discount", d3.status === 201 && d3.data.payment.discountApplied === 0 && d3.data.invoice.discountTotal === 0, `${d3.status} ${d3.data?.message || ""}`);
  await setToday(midday(2027, 2, 6));
  const qLate = await http("GET", `/fees/invoices/${inv.w1}/quote`, { token: S.ownerA.token });
  const d4 = await http("POST", `/fees/invoices/${inv.w1}/payments`, { token: S.wardenA.token, body: { amount: 7600, method: "cash" } });
  check("D4", "Late invoice (6th): early offer not offered or applied; the fine is paid in full, never discounted", !qLate.data.eligibleOffers.some((o) => o.name === "Early pay 2%") && qLate.data.invoice.fineAccrued === 100 && d4.status === 201 && d4.data.payment.discountApplied === 0 && d4.data.payment.finePortion === 100, `${d4.status} ${d4.data?.message || ""}`);

  // D5: coupon, max 2 redemptions, three applications at once
  await setToday(midday(2027, 2, 2));
  const coupon = await O({ name: "Welcome coupon", type: "flat", value: 500, trigger: "coupon", code: `QA${RUN}`.toUpperCase().slice(0, 12), maxRedemptions: 2, stackable: true });
  const race = await Promise.all(inv.c.slice(0, 3).map((id) => http("POST", "/hostel-offers/apply", { token: S.ownerA.token, body: { invoiceId: id, code: coupon.data?.offer?.code } })));
  const ok = race.filter((r) => r.status === 201).length;
  const third = race.find((r) => r.status !== 201);
  const dbl = await http("POST", "/hostel-offers/apply", { token: S.ownerA.token, body: { invoiceId: inv.c[0], code: coupon.data?.offer?.code } });
  const counter = (await mongoose.model("HostelOffer").findById(coupon.data?.offer?.id).lean())?.redemptionCount;
  check("D5", "Coupon capped at 2: three at once → exactly 2 succeed, the third gets a clear message; no double redemption", coupon.status === 201 && ok === 2 && third?.status >= 400 && /redeemed|already/.test(third?.data?.message || "") && [400, 409].includes(dbl.status) && counter === 2, `${coupon.status} ok=${ok} third=${third?.status} ${third?.data?.message} dbl=${dbl.status} n=${counter}`);
  // true double-click: two simultaneous applies of an uncapped offer on the same invoice
  const extra = await bill(csvIds[8], 7000);
  const dc = await O({ name: "Double-click test", type: "flat", value: 250, trigger: "manual" });
  const clicks = await Promise.all([1, 2].map(() => http("POST", "/hostel-offers/apply", { token: S.ownerA.token, body: { invoiceId: extra, offerId: dc.data?.offer?.id } })));
  const dcInv = await FeeInvoice.findById(extra).lean();
  check("D5c", "Double-click: two simultaneous applies on one invoice → one 201, one 409, discount counted once", clicks.map((r) => r.status).sort().join(",") === "201,409" && dcInv.discountTotal === 250 && dcInv.discounts.length === 1, `${clicks.map((r) => r.status)} ${dcInv.discountTotal}`);
  const studentBadCode = await http("POST", "/hostel-offers/apply", { token: S.s2.token, body: { invoiceId: inv.s2, code: "NOPE" } });
  check("D5b", "Wrong coupon code → 404", studentBadCode.status === 404, String(studentBadCode.status));

  // D6: stackable vs non-stackable
  const NS = await O({ name: "Non-stack 500", type: "flat", value: 500, trigger: "manual" });
  const ST1 = await O({ name: "Stack 300", type: "flat", value: 300, trigger: "manual", stackable: true });
  const ST2 = await O({ name: "Stack 400", type: "flat", value: 400, trigger: "manual", stackable: true });
  const apply = (invoiceId, offer) => http("POST", "/hostel-offers/apply", { token: S.ownerA.token, body: { invoiceId, offerId: offer.data.offer.id } });
  const a1 = await apply(inv.c[3], ST1);
  const a2 = await apply(inv.c[3], NS);
  const a3 = await apply(inv.c[3], ST2);
  const b1 = await apply(inv.c[4], NS);
  const b2 = await apply(inv.c[4], ST1);
  check("D6", "Stackables add up (300+400); a non-stackable can't join stackables, and nothing joins a non-stackable", a1.status === 201 && a2.status === 409 && a3.status === 201 && a3.data.invoice.discountTotal === 700 && b1.status === 201 && b2.status === 409, [a1, a2, a3, b1, b2].map((r) => r.status).join("/"));

  // D7: inclusive end date + paused
  const shortLived = await O({ name: "Two-day deal", type: "flat", value: 200, trigger: "manual", validFrom: "2027-02-01", validTo: "2027-02-02" });
  const onLastDay = await apply(inv.c[5], shortLived);
  await setToday(midday(2027, 2, 3));
  const dayAfter = await apply(inv.c[6], shortLived);
  const paused = await O({ name: "Paused deal", type: "flat", value: 200, trigger: "manual" });
  await http("POST", `/hostel-offers/${paused.data.offer.id}/status`, { token: S.ownerA.token, body: { status: "paused" } });
  const onPaused = await apply(inv.c[6], paused);
  check("D7", "End date is inclusive (applies on the 2nd, not the 3rd); a paused offer can't be used", onLastDay.status === 201 && dayAfter.status === 400 && /expired/.test(dayAfter.data?.message) && onPaused.status === 400, `${onLastDay.status}/${dayAfter.status}/${onPaused.status}`);

  // D8: discount larger than the line
  const huge = await O({ name: "Huge", type: "flat", value: 99999, trigger: "manual" });
  const d8 = await apply(inv.c[7], huge);
  check("D8", "A discount larger than the line is capped at it; the invoice never goes negative", d8.status === 201 && d8.data.redemption.amountOff === 7000 && d8.data.invoice.totalDue === 0 && d8.data.invoice.rentDue === 0, `${d8.status} ${d8.data?.redemption?.amountOff}`);

  // D9: void the payment that used the early-pay discount
  const voided = await http("POST", `/fees/payments/${d2.data?.payment?.id}/void`, { token: S.ownerA.token, body: { reason: "Counterfeit note" } });
  const earlyCount = (await mongoose.model("HostelOffer").findById(early.data.offer.id).lean()).redemptionCount;
  const red = await OfferRedemption.findOne({ payment: d2.data?.payment?.id }).lean();
  const auditVoid = await AuditLog.countDocuments({ action: "fee.payment.voided", entityId: d2.data?.payment?.id });
  check("D9", "Voiding the payment reverses its redemption, restores the counter and removes the −140 line; audited", voided.status === 200 && voided.data.redemptionsReversed === 1 && red?.status === "reversed" && earlyCount === 0 && voided.data.invoice.discountTotal === 0 && voided.data.invoice.rentDue === 7000 && auditVoid === 1, `${voided.status} ${voided.data?.redemptionsReversed} ${red?.status} ${earlyCount}`);

  // D10: block scope + tenant isolation
  const blockOnly = await O({ name: "Block A only", type: "flat", value: 100, trigger: "manual", scope: "block", blocks: [String(S.blockA._id)] });
  const onB = await apply(inv.s2, blockOnly);
  const xList = await http("GET", `/hostel-offers?hostelId=${hA}`, { token: S.ownerB.token });
  const xApply = await http("POST", "/hostel-offers/apply", { token: S.ownerB.token, body: { invoiceId: inv.s2, offerId: blockOnly.data.offer.id } });
  const xWarden = await http("POST", "/hostel-offers/apply", { token: S.wardenX.token, body: { invoiceId: inv.s2, offerId: blockOnly.data.offer.id } });
  const myB = await http("GET", "/hostel-offers/my", { token: S.s2.token });
  check("D10", "Block A offer: not eligible for a Block B student, invisible to them; other hostel's owner/warden → 403", onB.status === 400 && xList.status === 403 && xApply.status === 403 && xWarden.status === 403 && !myB.data.results.some((o) => o.id === blockOnly.data.offer.id), `${onB.status}/${xList.status}/${xApply.status}/${xWarden.status}`);
  const statusX = await http("POST", `/hostel-offers/${early.data.offer.id}/status`, { token: S.ownerB.token, body: { status: "paused" } });
  const editX = await http("PUT", `/hostel-offers/${early.data.offer.id}`, { token: S.wardenA.token, body: { name: "hijack" } });
  check("D10b", "Other owner can't change an offer's status; a warden can't edit offers", statusX.status === 403 && editX.status === 403, `${statusX.status}/${editX.status}`);

  // D11: scholarship needing approval
  const sch = await O({ name: "Scholarship 25%", type: "percent", value: 25, trigger: "scholarship", requiresApproval: true });
  const studentTry = await http("POST", "/hostel-offers/apply", { token: S.s2.token, body: { invoiceId: inv.s2, offerId: sch.data.offer.id } });
  const wb = await http("POST", "/hostel-offers/apply", { token: S.wardenB.token, body: { invoiceId: inv.s2, offerId: sch.data.offer.id } });
  const before = (await FeeInvoice.findById(inv.s2).lean()).discountTotal;
  const wbApprove = await http("POST", `/hostel-offers/redemptions/${wb.data?.redemption?.id}/approve`, { token: S.wardenB.token });
  const approve = await http("POST", `/hostel-offers/redemptions/${wb.data?.redemption?.id}/approve`, { token: S.ownerA.token });
  const approveAgain = await http("POST", `/hostel-offers/redemptions/${wb.data?.redemption?.id}/approve`, { token: S.ownerA.token });
  check("D11", "Scholarship: student can't apply it; warden's request stays pending (no discount) until head office approves once", studentTry.status === 403 && wb.status === 201 && wb.data.redemption.status === "pending_approval" && before === 0 && wbApprove.status === 403 && approve.status === 200 && approve.data.invoice.discountTotal === 2000 && approveAgain.status === 409, `${studentTry.status}/${wb.status}/${wbApprove.status}/${approve.status}/${approveAgain.status}`);

  // D12: counters and "offers for you" match
  const listAfter = await http("GET", `/hostel-offers?hostelId=${hA}`, { token: S.ownerA.token });
  const u = (offer) => listAfter.data.results.find((o) => o.id === offer.data.offer.id)?.usage || {};
  const my = await http("GET", "/hostel-offers/my", { token: S.s2.token });
  check("D12", "Usage counters match (coupon 2, early-pay 0 after reversal, stack 300 ×1); student sees savings 2,000 and no coupon codes", u(coupon).applied === 2 && u(early).applied === 0 && u(early).reversed === 1 && u(ST1).applied === 1 && my.status === 200 && my.data.savings.total === 2000 && !JSON.stringify(my.data.results).includes(coupon.data.offer.code), `${JSON.stringify([u(coupon), u(early), u(ST1)])} ${my.data?.savings?.total}`);
  const rev = await http("POST", `/hostel-offers/redemptions/${approve.data?.redemption?._id}/reverse`, { token: S.ownerA.token, body: { reason: "Scholarship withdrawn" } });
  check("D13", "Head office can reverse a manually applied discount (reason required); invoice amount restored", rev.status === 200 && rev.data.invoice.discountTotal === 0 && rev.data.invoice.rentDue === 8000, `${rev.status} ${rev.data?.message || ""}`);
}

const SECTIONS = [clockAndPolicies, offlineResidents, finesAndWaivers, leaveNotices, offersAndDiscounts];

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
