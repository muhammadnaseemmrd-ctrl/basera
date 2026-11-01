#!/usr/bin/env node
/**
 * Live use-case runner for Phase 1 hostel & block management (UC1–UC18 + cross-tenant 403 sweep).
 *
 *   BASE_URL=http://localhost:5000 MONGO_URI=mongodb://... node scripts/hostelOpsUseCases.js
 *
 * - Talks to the real HTTP API; seeds hostels/blocks/rooms/bookings straight into
 *   the same database (booking creation itself needs payments and is covered elsewhere).
 * - Uses synthetic "[QA-HOPS]" data only and deletes everything it created (set KEEP=1 to keep it).
 * - Never prints passwords or tokens.
 * - Exits 1 if any check fails.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

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
const Complaint = require("../models/Complaint");
const ParentLink = require("../models/ParentLink");
const BedBlock = require("../models/BedBlock");

const results = [];
const created = { users: [], hostels: [], blocks: [], rooms: [], bookings: [] };
let phoneSeq = 0;
const phone = () => `0399${RUN.replace(/\D/g, "").padEnd(3, "7").slice(0, 3)}${String(++phoneSeq).padStart(4, "0")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(id, name, ok, detail = "") {
  results.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
}

async function http(method, path, { token, body, raw } = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429 && attempt < 2) {
      console.log("  (rate limited, waiting 62s...)");
      await sleep(62000);
      continue;
    }
    if (raw) return res;
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  }
  return { status: 429, data: null };
}

async function makeUser(name, role) {
  const email = `qa.hops.${role}.${RUN}.${++phoneSeq}@example.test`;
  const user = await User.create({ name: `[QA-HOPS] ${name}`, email, phone: phone(), password: PASSWORD, role, isVerified: true });
  created.users.push(user._id);
  return { id: String(user._id), email, doc: user };
}

// Cached: the auth endpoints are rate-limited (10/min/IP), so log each user in once.
const tokenCache = new Map();
async function login(email) {
  if (tokenCache.has(email)) return { status: 200, token: tokenCache.get(email) };
  const r = await http("POST", "/auth/login", { body: { email, password: PASSWORD } });
  if (r.data?.token) tokenCache.set(email, r.data.token);
  return { status: r.status, token: r.data?.token };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required (same database the API at BASE_URL uses).");
  await mongoose.connect(process.env.MONGO_URI);
  const health = await http("GET", "/health");
  if (health.status !== 200) throw new Error(`API at ${BASE} is not healthy (${health.status}).`);
  if (health.data?.database !== "mongodb") throw new Error("API is in demo-data mode; hostel operations need the live database.");

  // ---------- seed ----------
  const ownerA = await makeUser("Owner A", "host");
  const ownerB = await makeUser("Owner B", "host");
  const students = [];
  for (const n of ["Ali", "Sara", "Hamza", "Bilal"]) students.push(await makeUser(n, "student"));
  const [s1, s2, s3, s4] = students;
  const parent1 = await makeUser("Parent One", "parent");
  const parent2 = await makeUser("Parent Two", "parent");

  const hostelA = await Hostel.create({ owner: ownerA.id, name: `[QA-HOPS] Hostel A ${RUN}`, type: "boys", city: "Islamabad", area: "F-10", address: "QA Street 1", status: "active", contactPhone: "0300-0000000" });
  const hostelB = await Hostel.create({ owner: ownerB.id, name: `[QA-HOPS] Hostel B ${RUN}`, type: "boys", city: "Lahore", area: "DHA", address: "QA Street 2", status: "active" });
  created.hostels.push(hostelA._id, hostelB._id);
  const blockA = await Block.create({ hostelId: hostelA._id, name: "Block A", floorCount: 2 });
  const blockB = await Block.create({ hostelId: hostelA._id, name: "Block B", floorCount: 1 });
  const blockX = await Block.create({ hostelId: hostelB._id, name: "Block X" });
  created.blocks.push(blockA._id, blockB._id, blockX._id);
  const mkRoom = (hostel, block, roomNumber, beds) =>
    Room.create({ hostel: hostel._id, listedBy: hostel.owner, blockId: block._id, roomNumber, type: beds === 2 ? "double" : beds === 3 ? "triple" : "quad", totalBeds: beds, availableBeds: beds, pricePerBed: 8000, city: hostel.city, status: "ACTIVE" });
  const roomA1 = await mkRoom(hostelA, blockA, "A1", 2);
  const roomA2 = await mkRoom(hostelA, blockA, "A2", 3);
  const roomB1 = await mkRoom(hostelA, blockB, "B1", 4);
  const roomX1 = await mkRoom(hostelB, blockX, "X1", 2);
  created.rooms.push(roomA1._id, roomA2._id, roomB1._id, roomX1._id);

  const ownerAT = (await login(ownerA.email)).token;
  const ownerBT = (await login(ownerB.email)).token;

  // UC1
  let seats = await http("GET", `/head-office/hostels/${hostelA._id}/seats`, { token: ownerAT });
  check("UC1", "Owner sees 9 free seats across Block A (5) and Block B (4)", seats.status === 200 && seats.data.summary.total === 9 && seats.data.summary.free === 9 && seats.data.blocks.length === 2, JSON.stringify(seats.data?.summary));

  // UC2
  const mkBooking = async (student, room, bedIndex, status) => {
    const b = await Booking.create({ student: student.id, hostel: room.hostel, room: room._id, bedIndex, checkIn: new Date(), duration: "monthly", totalAmount: 8000, commission: 560, ownerReceives: 7440, status });
    created.bookings.push(b._id);
    return b;
  };
  await mkBooking(s1, roomA1, 0, "active");
  await mkBooking(s2, roomA2, 1, "active");
  await mkBooking(s3, roomA2, 2, "payment_pending");
  await mkBooking(s4, roomB1, 0, "active");
  seats = await http("GET", `/head-office/hostels/${hostelA._id}/seats`, { token: ownerAT });
  const sm = seats.data?.summary || {};
  check("UC2", "Active = occupied (3), pending = reserved (1), rest free (5)", sm.occupied === 3 && sm.reserved === 1 && sm.free === 5, JSON.stringify(sm));

  // staff: create warden for Block A with a login (UC9 prerequisite)
  const wardenEmail = `qa.hops.warden.${RUN}@example.test`;
  const mk = await http("POST", "/staff", { token: ownerAT, body: { hostelId: String(hostelA._id), name: "[QA-HOPS] Warden Rashid", phone: phone(), role: "warden", blockIds: [String(blockA._id)], login: { email: wardenEmail, password: PASSWORD } } });
  check("UC9a", "Owner creates a warden (with login) for Block A", mk.status === 201, `${mk.status} ${mk.data?.message || ""}`);
  const staffId = mk.data?.staff?._id;
  const wardenT = (await login(wardenEmail)).token;
  const wUser = await User.findOne({ email: wardenEmail });
  if (wUser) created.users.push(wUser._id);

  // UC3: warden marks a seat offline-booked in own block; head office sees it
  const off = await http("POST", `/rooms/${roomA1._id}/bed-blocks`, { token: wardenT, body: { bedIndex: 1, reason: "booked_offline", note: "[QA-HOPS] cash family booking", from: new Date().toISOString(), to: new Date(Date.now() + 86400000 * 30).toISOString() } });
  seats = await http("GET", `/blocks/${blockA._id}/seats`, { token: wardenT });
  check("UC3", "Warden marks seat offline; block seat map shows booked_offline", off.status === 201 && seats.data?.summary?.booked_offline === 1, `${off.status} ${JSON.stringify(seats.data?.summary)}`);
  const wardenOtherRoom = await http("POST", `/rooms/${roomB1._id}/bed-blocks`, { token: wardenT, body: { bedIndex: 3, reason: "maintenance" } });
  check("UC8a", "Warden cannot hold a seat in Block B", wardenOtherRoom.status === 403, String(wardenOtherRoom.status));
  const otherOwnerHold = await http("POST", `/rooms/${roomA1._id}/bed-blocks`, { token: ownerBT, body: { bedIndex: 0, reason: "maintenance" } });
  check("UC10a", "Other hostel's owner cannot hold seats here (IDOR fix)", otherOwnerHold.status === 403, String(otherOwnerHold.status));
  const wardenBlockB = await http("GET", `/blocks/${blockB._id}/seats`, { token: wardenT });
  check("UC8b", "Warden cannot read Block B seat map", wardenBlockB.status === 403, String(wardenBlockB.status));

  // ---------- fees ----------
  const inv = await http("POST", "/fees/invoices", { token: ownerAT, body: { hostelId: String(hostelA._id), studentId: s1.id, title: "November rent", amount: 8000, kind: "rent", period: "2026-11", dueDate: "2026-11-10" } });
  check("UC4a", "Owner raises an 8,000 rent invoice for Ali", inv.status === 201, `${inv.status} ${inv.data?.message || ""}`);
  const invoiceId = inv.data?.invoice?.id;
  const dup = await http("POST", "/fees/invoices", { token: ownerAT, body: { hostelId: String(hostelA._id), studentId: s1.id, title: "November rent", amount: 8000, kind: "rent", period: "2026-11" } });
  check("UC4b", "Duplicate rent invoice for the same period is rejected", dup.status === 409, String(dup.status));
  const crossInv = await http("POST", "/fees/invoices", { token: wardenT, body: { hostelId: String(hostelA._id), studentId: s4.id, title: "Rent", amount: 8000, period: "2026-11" } });
  check("UC8c", "Warden of Block A cannot bill a Block B student", crossInv.status === 403, String(crossInv.status));
  const crossOwner = await http("POST", "/fees/invoices", { token: ownerBT, body: { hostelId: String(hostelA._id), studentId: s1.id, title: "Rent", amount: 1, period: "2026-12" } });
  check("UC10b", "Other hostel's owner cannot bill our students", crossOwner.status === 403, String(crossOwner.status));

  const cash = await http("POST", `/fees/invoices/${invoiceId}/payments`, { token: wardenT, body: { amount: 3000, method: "cash" } });
  check("UC4c", "Warden records PKR 3,000 cash -> receipt issued, balance 5,000", cash.status === 201 && /^BSR-\d{4}-\d{6}$/.test(cash.data?.receiptNo || "") && cash.data.balance === 5000, `${cash.status} ${JSON.stringify(cash.data)}`.slice(0, 200));
  const noProof = await http("POST", `/fees/invoices/${invoiceId}/payments`, { token: wardenT, body: { amount: 1000, method: "bank_transfer" } });
  check("UC5", "Bank payment with no txn ID/screenshot -> 400", noProof.status === 400, String(noProof.status));
  const bank = await http("POST", `/fees/invoices/${invoiceId}/payments`, { token: wardenT, body: { amount: 2000, method: "bank_transfer", bankName: "HBL", transactionId: `TXN-${RUN}-1` } });
  check("UC4d", "Bank payment with txn ID accepted, balance 3,000", bank.status === 201 && bank.data.balance === 3000, `${bank.status} ${JSON.stringify(bank.data)}`.slice(0, 200));
  const reuse = await http("POST", `/fees/invoices/${invoiceId}/payments`, { token: wardenT, body: { amount: 500, method: "bank_transfer", transactionId: `TXN-${RUN}-1` } });
  check("UC6", "Re-using the same transaction ID -> 409", reuse.status === 409, String(reuse.status));
  const over = await http("POST", `/fees/invoices/${invoiceId}/payments`, { token: wardenT, body: { amount: 99999, method: "cash" } });
  check("UC6b", "Overpaying the invoice -> 400", over.status === 400, String(over.status));

  const payId = bank.data?.payment?.id;
  const pdf = await http("GET", `/fees/payments/${payId}/receipt.pdf`, { token: wardenT, raw: true });
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  check("UC7a", "Receipt PDF generated", pdf.status === 200 && (pdf.headers.get("content-type") || "").includes("pdf") && pdfBuf.slice(0, 4).toString() === "%PDF", String(pdf.status));
  const wa = await http("GET", `/fees/payments/${payId}/whatsapp`, { token: wardenT });
  check("UC7b", "WhatsApp share link points to the student's number and carries the receipt no.", wa.status === 200 && wa.data.link.startsWith("https://wa.me/92") && decodeURIComponent(wa.data.link).includes(bank.data.receiptNo), `${wa.status}`);
  const verify = await http("GET", `/fees/verify/${bank.data?.receiptNo}?format=json`);
  check("UC7c", "Public verify page confirms the receipt without login", verify.status === 200 && verify.data.valid === true && !JSON.stringify(verify.data).includes("phone"), String(verify.status));
  const stranger = await http("GET", `/fees/payments/${payId}/receipt.pdf`, { token: (await login(s2.email)).token, raw: true });
  check("UC7d", "Another student cannot download Ali's receipt", stranger.status === 403, String(stranger.status));
  const waOther = await http("GET", `/fees/payments/${payId}/whatsapp`, { token: ownerBT });
  check("UC7e", "Other hostel's owner cannot get the WhatsApp share for our receipt", waOther.status === 403, String(waOther.status));

  // ---------- parents ----------
  const link = await http("POST", "/parent-panel/links", { token: wardenT, body: { hostelId: String(hostelA._id), studentId: s1.id, parentName: "Mr Ali Sr", parentPhone: "0300-7654321" } });
  check("UC14a", "Warden issues a parent invite code for Ali", link.status === 201 && /^[A-F0-9]{8}$/.test(link.data?.inviteCode || ""), `${link.status} ${link.data?.message || ""}`);
  const p1T = (await login(parent1.email)).token;
  const p2T = (await login(parent2.email)).token;
  const badClaim = await http("POST", "/parent-panel/claim", { token: p2T, body: { code: "DEADBEEF" } });
  check("UC14b", "Wrong invite code does not link a parent", badClaim.status === 404, String(badClaim.status));
  const claim = await http("POST", "/parent-panel/claim", { token: p1T, body: { code: link.data.inviteCode } });
  check("UC14c", "Parent redeems the code", claim.status === 200 && claim.data.linked, String(claim.status));
  const reClaim = await http("POST", "/parent-panel/claim", { token: p2T, body: { code: link.data.inviteCode } });
  check("UC14d", "Invite code is single-use", reClaim.status === 404, String(reClaim.status));
  const kids = await http("GET", "/parent-panel/children", { token: p1T });
  check("UC14e", "Parent sees exactly one child", kids.status === 200 && kids.data.results.length === 1 && kids.data.results[0].id === s1.id, JSON.stringify(kids.data));
  const ov = await http("GET", `/parent-panel/children/${s1.id}/overview`, { token: p1T });
  check("UC14f", "Parent overview shows seat, fee balance 3,000 and 2 receipts", ov.status === 200 && ov.data.seat?.roomNumber === "A1" && ov.data.fees.due === 3000 && ov.data.fees.receipts.length === 2, `${ov.status} ${JSON.stringify(ov.data?.fees || {})}`.slice(0, 220));
  const ovOther = await http("GET", `/parent-panel/children/${s2.id}/overview`, { token: p1T });
  check("UC14g", "Parent cannot open another student's overview", ovOther.status === 403, String(ovOther.status));
  const p2Ov = await http("GET", `/parent-panel/children/${s1.id}/overview`, { token: p2T });
  check("UC14h", "An unlinked parent cannot open Ali's overview", p2Ov.status === 403, String(p2Ov.status));
  const parentRcpt = await http("GET", `/fees/payments/${payId}/receipt.pdf`, { token: p1T, raw: true });
  check("UC14i", "Linked parent can download the receipt", parentRcpt.status === 200, String(parentRcpt.status));
  const parentStaff = await http("GET", `/head-office/hostels/${hostelA._id}/seats`, { token: p1T });
  check("UC14j", "Parent cannot use head-office endpoints", parentStaff.status === 403, String(parentStaff.status));
  const [pFees, pCmp, pNot] = await Promise.all(["fees", "complaints", "notices"].map((x) => http("GET", `/parent-panel/children/${s1.id}/${x}`, { token: p1T })));
  check("UC14k", "Parent fees / complaints / notices endpoints work for own child", pFees.status === 200 && pFees.data.due === 3000 && pCmp.status === 200 && Array.isArray(pCmp.data.results) && pNot.status === 200, `${pFees.status}/${pCmp.status}/${pNot.status}`);
  const pOther = await Promise.all(["fees", "complaints", "notices"].map((x) => http("GET", `/parent-panel/children/${s2.id}/${x}`, { token: p1T })));
  check("UC14l", "Parent gets 403 on every per-child endpoint for another student", pOther.every((r) => r.status === 403), pOther.map((r) => r.status).join("/"));
  check("UC14m", "Parent fee view never exposes payment screenshots", !JSON.stringify(pFees.data || {}).includes("screenshotUrl"));

  // ---------- complaints ----------
  const s1T = (await login(s1.email)).token;
  const s2T = (await login(s2.email)).token;
  const cmp = await http("POST", "/complaints", { token: s1T, body: { title: "[QA-HOPS] Tap leaking", description: "Bathroom tap leaks all night.", category: "plumbing", priority: "high" } });
  check("UC11a", "Student raises complaint; it is routed to Block A", cmp.status === 201 && cmp.data.complaint.status === "raised" && String(cmp.data.complaint.block) === String(blockA._id), `${cmp.status}`);
  const cid = cmp.data?.complaint?.id;
  const setStatus = (token, status, note = "note", extra = {}) => http("POST", `/complaints/${cid}/status`, { token, body: { status, note, ...extra } });
  const queue = await http("GET", `/complaints?hostelId=${hostelA._id}`, { token: wardenT });
  check("UC11b", "Warden's queue contains it", queue.status === 200 && queue.data.results.some((c) => c.id === cid), String(queue.status));
  check("UC11c", "Warden: raised -> under_review", (await setStatus(wardenT, "under_review")).status === 200);
  check("UC11d", "Warden: under_review -> in_progress", (await setStatus(wardenT, "in_progress")).status === 200);
  const wardenResolve = await setStatus(wardenT, "resolved");
  check("UC12a", "Warden cannot mark resolved (409/403)", [403, 409].includes(wardenResolve.status), String(wardenResolve.status));
  const studentFix = await setStatus(s1T, "fixed");
  check("UC12b", "Student cannot mark fixed", studentFix.status === 403, String(studentFix.status));
  const fixNoNote = await http("POST", `/complaints/${cid}/status`, { token: wardenT, body: { status: "fixed" } });
  check("UC12c", "Marking fixed requires a note", fixNoNote.status === 400, String(fixNoNote.status));
  check("UC11e", "Warden: in_progress -> fixed", (await setStatus(wardenT, "fixed", "Washer replaced")).status === 200);
  const resolve = await setStatus(s1T, "resolved", "Confirmed fixed", { rating: 5 });
  check("UC11f", "Student marks resolved (rating 5)", resolve.status === 200 && resolve.data.complaint.status === "resolved" && resolve.data.complaint.rating === 5, String(resolve.status));
  const timeline = resolve.data?.complaint?.timeline?.map((t) => t.status).join(">");
  check("UC11g", "Timeline is complete and ordered", timeline === "raised>under_review>in_progress>fixed>resolved", timeline);
  const afterResolved = await setStatus(s1T, "reopened", "again");
  check("UC11h", "A resolved complaint cannot be reopened", afterResolved.status === 409, String(afterResolved.status));

  const cmp2 = await http("POST", "/complaints", { token: s2T, body: { title: "[QA-HOPS] No hot water", description: "Geyser not working.", category: "plumbing" } });
  const cid2 = cmp2.data?.complaint?.id;
  const st2 = (token, status, note = "n") => http("POST", `/complaints/${cid2}/status`, { token, body: { status, note } });
  await st2(wardenT, "under_review");
  await st2(wardenT, "fixed", "Geyser reset");
  const reopen = await st2(s2T, "reopened", "Still cold");
  check("UC13", "Student reopens a fixed complaint", reopen.status === 200 && reopen.data.complaint.status === "reopened" && reopen.data.complaint.reopenCount === 1, String(reopen.status));
  const wardenEsc = await st2(wardenT, "escalated", "Needs new geyser");
  check("UC13b", "Warden cannot escalate (head office decision)", wardenEsc.status === 403, String(wardenEsc.status));
  const esc = await http("POST", `/complaints/${cid2}/status`, { token: ownerAT, body: { status: "escalated", note: "Needs new geyser", assignedTo: "Plumber Aslam" } });
  check("UC13d", "Head office escalates and assigns", esc.status === 200 && esc.data.complaint.status === "escalated" && esc.data.complaint.assignedTo === "Plumber Aslam", String(esc.status));
  const s2TouchesS1 = await http("POST", `/complaints/${cid}/status`, { token: s2T, body: { status: "reopened", note: "x" } });
  check("UC8e", "A different student cannot change Ali's complaint", s2TouchesS1.status === 403, String(s2TouchesS1.status));
  const wardenQueueB = await http("GET", `/complaints?hostelId=${hostelA._id}&blockId=${blockB._id}`, { token: wardenT });
  check("UC8f", "Warden of Block A cannot list Block B complaints", wardenQueueB.status === 403, String(wardenQueueB.status));
  const studentQueue = await http("GET", `/complaints?hostelId=${hostelA._id}`, { token: s1T });
  check("UC8g", "A student cannot open the staff complaint queue", studentQueue.status === 403, String(studentQueue.status));
  const s1ReadsS2 = await http("GET", `/complaints/${cid2}`, { token: s1T });
  check("UC8d", "A different student cannot read Sara's complaint", s1ReadsS2.status === 403, String(s1ReadsS2.status));
  const ownerBReads = await http("GET", `/complaints/${cid2}`, { token: ownerBT });
  check("UC10c", "Other hostel's owner cannot read it", ownerBReads.status === 403, String(ownerBReads.status));
  const headFix = await st2(ownerAT, "in_progress", "Ordered");
  check("UC13c", "Head office can drive an escalated complaint", headFix.status === 200, String(headFix.status));

  // ---------- UC15 overview ----------
  const ovh = await http("GET", `/head-office/hostels/${hostelA._id}/overview`, { token: ownerAT });
  const o = ovh.data || {};
  const blockSum = (o.seats?.blocks || []).reduce((s, b) => s + b.total, 0);
  check("UC15a", "Overview seat totals = sum of block totals", ovh.status === 200 && o.seats.total === blockSum && o.seats.total === 9, `${ovh.status} ${blockSum}/${o.seats?.total}`);
  check("UC15b", "Overview fees match recorded payments (5,000 collected of 8,000)", o.fees?.collected === 5000 && o.fees.outstanding === 3000 && o.fees.collectedThisMonthTotal === 5000, JSON.stringify(o.fees));
  check("UC15c", "Overview complaints by status match", o.complaints?.byStatus?.resolved === 1 && o.complaints.byStatus.in_progress === 1, JSON.stringify(o.complaints));
  const otherOv = await http("GET", `/head-office/hostels/${hostelA._id}/overview`, { token: ownerBT });
  check("UC10d", "Other owner cannot open our head-office overview", otherOv.status === 403, String(otherOv.status));
  const roll = await http("GET", "/head-office/overview", { token: ownerAT });
  const rollA = (roll.data?.hostels || []).find((h) => h.hostelId === String(hostelA._id));
  check("UC15d", "GET /head-office/overview rolls up the owner's hostels and matches the hostel view", roll.status === 200 && rollA && roll.data.totals.seats.total === o.seats.total && roll.data.totals.fees.collected === 5000 && Array.isArray(roll.data.latestNotices), `${roll.status} ${JSON.stringify(roll.data?.totals?.seats)}`.slice(0, 200));
  const rollB = await http("GET", "/head-office/overview", { token: ownerBT });
  check("UC10f", "Other owner's rollup never includes our hostel", rollB.status === 200 && !(rollB.data.hostels || []).some((h) => h.hostelId === String(hostelA._id)), String(rollB.status));
  const rollBForA = await http("GET", `/head-office/overview?hostelId=${hostelA._id}`, { token: ownerBT });
  check("UC10g", "Other owner cannot pass our hostelId to the rollup", rollBForA.status === 403, String(rollBForA.status));
  const sweep = await Promise.all([
    http("GET", `/staff?hostelId=${hostelA._id}`, { token: ownerBT }),
    http("GET", `/fees/invoices?hostelId=${hostelA._id}`, { token: ownerBT }),
    http("GET", `/fees/payments?hostelId=${hostelA._id}`, { token: ownerBT }),
    http("POST", `/fees/invoices/${invoiceId}/payments`, { token: ownerBT, body: { amount: 100, method: "cash" } }),
    http("POST", "/notices", { token: ownerBT, body: { hostelId: String(hostelA._id), title: "x", message: "y" } }),
    http("GET", `/complaints?hostelId=${hostelA._id}`, { token: ownerBT }),
    http("GET", `/parent-panel/links?hostelId=${hostelA._id}`, { token: ownerBT }),
    http("POST", `/staff/${staffId}/suspend`, { token: ownerBT, body: { reason: "x" } })
  ]);
  check("UC10h", "Other owner gets 403 across staff / fees / notices / complaints / parent links", sweep.every((r) => r.status === 403), sweep.map((r) => r.status).join("/"));

  // A room not yet placed in any block belongs to head office only: no warden can act on it.
  const loose = await Room.create({ hostel: hostelA._id, listedBy: hostelA.owner, roomNumber: "U1", type: "double", totalBeds: 2, availableBeds: 2, pricePerBed: 8000, city: hostelA.city, status: "ACTIVE" });
  created.rooms.push(loose._id);
  const s5 = await makeUser("Umar", "student");
  await mkBooking(s5, loose, 0, "active");
  const looseInv = await http("POST", "/fees/invoices", { token: ownerAT, body: { hostelId: String(hostelA._id), studentId: s5.id, title: "Rent", amount: 8000, period: "2026-11" } });
  const wardenLooseBill = await http("POST", "/fees/invoices", { token: wardenT, body: { hostelId: String(hostelA._id), studentId: s5.id, title: "Mess", amount: 3000, kind: "mess", period: "2026-11" } });
  const wardenLooseCollect = await http("POST", `/fees/invoices/${looseInv.data?.invoice?.id}/payments`, { token: wardenT, body: { amount: 1000, method: "cash" } });
  check("UC8h", "Warden cannot bill or collect from a resident of an unassigned room", looseInv.status === 201 && wardenLooseBill.status === 403 && wardenLooseCollect.status === 403, `${looseInv.status}/${wardenLooseBill.status}/${wardenLooseCollect.status}`);
  const looseCmp = await http("POST", "/complaints", { token: (await login(s5.email)).token, body: { title: "[QA-HOPS] Fan", description: "Fan broken", category: "electricity" } });
  const wardenLooseCmp = await http("POST", `/complaints/${looseCmp.data?.complaint?.id}/status`, { token: wardenT, body: { status: "under_review", note: "x" } });
  check("UC8i", "Warden cannot act on a complaint from an unassigned room", looseCmp.status === 201 && wardenLooseCmp.status === 403, `${looseCmp.status}/${wardenLooseCmp.status}`);

  // ---------- UC16–UC18 onboarding: rooms, residents, checkout ----------
  const bulkBody = { blockId: String(blockB._id), prefix: "Z", from: 1, to: 3, beds: 2, pricePerBed: 7000 };
  const bulkRooms = await http("POST", `/head-office/hostels/${hostelA._id}/rooms/bulk`, { token: ownerAT, body: bulkBody });
  check("UC16a", "Owner bulk-creates rooms Z1–Z3 (2 seats each) in Block B", bulkRooms.status === 201 && bulkRooms.data.created === 3, `${bulkRooms.status} ${bulkRooms.data?.message || ""}`);
  const zRooms = await Room.find({ hostel: hostelA._id, roomNumber: /^Z/ });
  zRooms.forEach((r) => created.rooms.push(r._id));
  const bulkDup = await http("POST", `/head-office/hostels/${hostelA._id}/rooms/bulk`, { token: ownerAT, body: bulkBody });
  check("UC16b", "Creating the same room numbers again -> 409", bulkDup.status === 409, String(bulkDup.status));
  const bulkOther = await http("POST", `/head-office/hostels/${hostelA._id}/rooms/bulk`, { token: ownerBT, body: { ...bulkBody, prefix: "Y" } });
  check("UC16c", "Other owner cannot create rooms in our hostel", bulkOther.status === 403, String(bulkOther.status));
  const badBlock = await http("POST", `/head-office/hostels/${hostelA._id}/rooms/bulk`, { token: ownerAT, body: { ...bulkBody, prefix: "Q", blockId: String(blockX._id) } });
  check("UC16d", "A block from another hostel is rejected", badBlock.status === 400, String(badBlock.status));

  const z1 = zRooms.find((r) => r.roomNumber === "Z1");
  const admitBody = { name: "[QA-HOPS] Existing Resident", phone: phone(), roomId: String(z1?._id), bedIndex: 0, monthlyRent: 7000, guardianName: "Guardian", guardianPhone: "0300-5551234" };
  const admit = await http("POST", `/head-office/hostels/${hostelA._id}/residents`, { token: ownerAT, body: admitBody });
  check("UC17a", "Owner admits an existing resident into Z1 seat 1 (login + guardian invite created)", admit.status === 201 && admit.data.tempPassword && admit.data.guardian?.inviteCode, `${admit.status} ${admit.data?.message || ""}`);
  if (admit.data?.student?.id) created.users.push(admit.data.student.id);
  const admitSame = await http("POST", `/head-office/hostels/${hostelA._id}/residents`, { token: ownerAT, body: { ...admitBody, name: "[QA-HOPS] Second", phone: phone() } });
  check("UC17b", "The same seat cannot be given to a second student", admitSame.status === 409, `${admitSame.status} ${admitSame.data?.message || ""}`);
  const admitBad = await http("POST", `/head-office/hostels/${hostelA._id}/residents`, { token: ownerAT, body: { ...admitBody, phone: phone(), bedIndex: 9 } });
  check("UC17c", "A seat number beyond the room's size is rejected", admitBad.status === 400, String(admitBad.status));
  const afterAdmit = await Room.findById(z1._id).lean();
  check("UC17d", "Marketplace bed count dropped from 2 to 1", afterAdmit.availableBeds === 1, String(afterAdmit.availableBeds));
  const zSeats = await http("GET", `/head-office/hostels/${hostelA._id}/seats?blockId=${blockB._id}`, { token: ownerAT });
  const z1Seat = zSeats.data?.blocks?.[0]?.rooms?.find((r) => r.roomNumber === "Z1")?.seats?.[0];
  check("UC17e", "Seat map shows Z1 seat 1 occupied by the new resident", z1Seat?.status === "occupied" && /Existing Resident/.test(z1Seat.student?.name || ""), JSON.stringify(z1Seat));
  const newLogin = await http("POST", "/auth/login", { body: { email: admit.data?.student?.email, password: admit.data?.tempPassword } });
  const residentFees = newLogin.data?.token ? await http("GET", "/fees/my", { token: newLogin.data.token }) : { status: 0 };
  check("UC17f", "The admitted resident can log in with the temporary password", newLogin.status === 200 && residentFees.status === 200, `${newLogin.status}/${residentFees.status}`);
  const bookingId = admit.data?.booking?.id;
  const out = await http("POST", `/head-office/hostels/${hostelA._id}/residents/${bookingId}/checkout`, { token: ownerAT });
  const afterOut = await Room.findById(z1._id).lean();
  check("UC18a", "Checkout frees the seat and returns the bed to the marketplace", out.status === 200 && afterOut.availableBeds === 2, `${out.status} ${afterOut.availableBeds}`);
  const outTwice = await http("POST", `/head-office/hostels/${hostelA._id}/residents/${bookingId}/checkout`, { token: ownerAT });
  check("UC18b", "Checking out twice -> 409 (no double bed return)", outTwice.status === 409 && (await Room.findById(z1._id).lean()).availableBeds === 2, String(outTwice.status));
  const moved = await http("POST", `/head-office/hostels/${hostelA._id}/blocks/${blockA._id}/assign-rooms`, { token: ownerAT, body: { roomIds: [String(z1._id)] } });
  const movedOther = await http("POST", `/head-office/hostels/${hostelA._id}/blocks/${blockX._id}/assign-rooms`, { token: ownerAT, body: { roomIds: [String(z1._id)] } });
  check("UC18c", "Rooms can move between this hostel's blocks, but not into another hostel's block", moved.status === 200 && moved.data.updated === 1 && movedOther.status === 404, `${moved.status}/${movedOther.status}`);

  // ---------- UC9 termination ----------
  const otherTerm = await http("POST", `/staff/${staffId}/terminate`, { token: ownerBT, body: { reason: "hostile" } });
  check("UC10e", "Other hostel's owner cannot terminate our warden", otherTerm.status === 403, String(otherTerm.status));
  const noReason = await http("POST", `/staff/${staffId}/terminate`, { token: ownerAT, body: {} });
  check("UC9b", "Termination requires a reason", noReason.status === 400, String(noReason.status));
  const term = await http("POST", `/staff/${staffId}/terminate`, { token: ownerAT, body: { reason: "Collected cash without issuing receipts" } });
  check("UC9c", "Owner terminates the warden", term.status === 200 && term.data.staff.status === "terminated", `${term.status} ${term.data?.message || ""}`);
  check("UC9d", "Notice recipients: 2 students in Block A (Ali, Sara), not Bilal in Block B", term.data?.recipients?.students === 2 && term.data?.notices?.length === 1, JSON.stringify(term.data?.recipients));
  const twice = await http("POST", `/staff/${staffId}/terminate`, { token: ownerAT, body: { reason: "again" } });
  check("UC9e", "Terminating twice -> 409 (no duplicate notice)", twice.status === 409 && (await Notice.countDocuments({ staff: staffId })) === 1, String(twice.status));

  const nA = await http("GET", "/notices/my", { token: s1T });
  const nB = await http("GET", "/notices/my", { token: (await login(s4.email)).token });
  const nP = await http("GET", "/notices/my", { token: p1T });
  const has = (r) => (r.data?.results || []).some((n) => n.type === "staff_termination" && /Do NOT pay/.test(n.message));
  check("UC9f", "Ali (Block A) receives the do-not-pay notice", nA.status === 200 && has(nA), String(nA.status));
  check("UC9g", "Bilal (Block B) does NOT receive it", nB.status === 200 && !has(nB), String(nB.status));
  check("UC9h", "Ali's linked parent receives it", nP.status === 200 && has(nP), String(nP.status));
  check("UC9i", "WhatsApp broadcast list includes students and parents", (term.data?.whatsapp || []).some((w) => w.audience === "parent") && (term.data?.whatsapp || []).some((w) => w.audience === "student"));

  const wardenAfter = await http("GET", `/blocks/${blockA._id}/seats`, { token: wardenT });
  check("UC9j", "Terminated warden's existing token stops working immediately", wardenAfter.status === 403, String(wardenAfter.status));
  const wardenLogin = await http("POST", "/auth/login", { body: { email: wardenEmail, password: PASSWORD } });
  check("UC9k", "Terminated warden cannot log in again", wardenLogin.status === 403, String(wardenLogin.status));
  const blockNow = await Block.findById(blockA._id).lean();
  check("UC9l", "Block A has no warden assigned any more", !blockNow.wardenId);
  const wardenReceipt = await FeePayment.countDocuments({ receivedBy: wUser?._id, status: "confirmed" });
  check("UC9m", "Receipts issued by the warden before termination remain valid", wardenReceipt === 2, String(wardenReceipt));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  return failed.length;
}

async function cleanup() {
  if (process.env.KEEP === "1") return console.log("KEEP=1: leaving [QA-HOPS] data in place.");
  try {
    const hostelIds = created.hostels;
    await Promise.all([
      FeePayment.deleteMany({ hostel: { $in: hostelIds } }),
      FeeInvoice.deleteMany({ hostel: { $in: hostelIds } }),
      Complaint.deleteMany({ hostel: { $in: hostelIds } }),
      Notice.deleteMany({ hostel: { $in: hostelIds } }),
      StaffMember.deleteMany({ hostel: { $in: hostelIds } }),
      ParentLink.deleteMany({ student: { $in: created.users } }),
      BedBlock.deleteMany({ room: { $in: created.rooms } }),
      Booking.deleteMany({ $or: [{ _id: { $in: created.bookings } }, { room: { $in: created.rooms } }] }),
      Room.deleteMany({ _id: { $in: created.rooms } }),
      Block.deleteMany({ _id: { $in: created.blocks } }),
      Hostel.deleteMany({ _id: { $in: hostelIds } }),
      User.deleteMany({ _id: { $in: created.users } })
    ]);
    console.log("Cleaned up all [QA-HOPS] data.");
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
