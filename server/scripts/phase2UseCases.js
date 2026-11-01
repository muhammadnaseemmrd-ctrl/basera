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

const SECTIONS = [clockAndPolicies];

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
