const crypto = require("crypto");
const express = require("express");
const User = require("../models/User");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const Room = require("../models/Room");
const ParentLink = require("../models/ParentLink");
const ParentAccess = require("../models/ParentAccess");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const Complaint = require("../models/Complaint");
const Notice = require("../models/Notice");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const { present, refreshOpenInvoices } = require("../services/feeService");
const { phoneKey, toWhatsAppNumber } = require("../services/hostelOpsRules");
const { staffScope, recordScope, wardenBlocks, residents, currentStay, parentStudentIds, isId, uid } = require("../services/hostelAccess");

const router = express.Router();
router.use(protect, requireDb);

const appUrl = () => (process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

// ---------------- staff: invite a parent for a resident ----------------

router.post("/links", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, studentId, parentName, parentPhone, relation = "parent" } = req.body;
    if (!isId(hostelId) || !isId(studentId)) return res.status(400).json({ message: "hostelId and studentId are required." });
    const key = phoneKey(parentPhone);
    if (key.length < 10) return res.status(400).json({ message: "A valid parent phone number is required." });

    const row = (await residents({ hostelId })).find((r) => r.student && String(r.student._id) === String(studentId));
    if (!row) return res.status(404).json({ message: "That student has no active stay in this hostel." });
    const blockId = row.room?.blockId ? String(row.room.blockId) : null;
    if (!(await recordScope(req.user, { hostelId, blockId }))) return res.status(403).json({ message: "You cannot manage students outside your hostel/block." });

    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    let link = await ParentLink.findOne({ student: studentId, phoneKey: key, status: { $in: ["pending", "active"] } });
    if (link?.status === "active") return res.status(409).json({ message: "This parent is already linked to the student." });
    if (link) {
      link.inviteCode = inviteCode;
      link.inviteExpiresAt = new Date(Date.now() + 14 * 86400000);
      link.parentName = parentName || link.parentName;
      await link.save();
    } else {
      link = await ParentLink.create({
        student: studentId,
        hostel: hostelId,
        parentName,
        parentPhone,
        phoneKey: key,
        relation,
        status: "pending",
        inviteCode,
        inviteExpiresAt: new Date(Date.now() + 14 * 86400000),
        createdBy: uid(req.user),
        source: "staff"
      });
    }
    const hostel = await Hostel.findById(hostelId).select("name").lean();
    const text = `Assalam o Alaikum${parentName ? ` ${parentName}` : ""}. ${hostel?.name || "Your child's hostel"} invites you to follow ${row.student.name}'s fees, complaints and notices on Basera.\n1) Sign up as "Parent": ${appUrl()}/login\n2) Enter this code: ${inviteCode} (valid 14 days)`;
    const number = toWhatsAppNumber(parentPhone);
    return res.status(201).json({ link: { id: String(link._id), status: link.status, parentName: link.parentName, parentPhone: link.parentPhone }, inviteCode, whatsapp: number ? { number, text, link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` } : null });
  } catch (error) {
    return next(error);
  }
});

router.get("/links", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId } = req.query;
    const scope = isId(hostelId) ? await staffScope(req.user, { hostelId }) : null;
    if (!scope) return res.status(403).json({ message: "No access to this hostel." });
    const query = { hostel: hostelId, status: { $ne: "revoked" } };
    if (scope === "warden") {
      // wardens only see guardians of students living in their own blocks
      const own = new Set((await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => String(b._id)));
      const mine = (await residents({ hostelId })).filter((r) => r.student && r.room?.blockId && own.has(String(r.room.blockId))).map((r) => r.student._id);
      query.student = { $in: mine };
    }
    const results = await ParentLink.find(query).populate("student", "name").sort({ createdAt: -1 }).limit(300).select("-inviteCode").lean();
    return res.json({ results: results.map((l) => ({ ...l, id: String(l._id) })) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/links/:id", authorize("host", "admin", "warden", "student"), async (req, res, next) => {
  try {
    const link = isId(req.params.id) ? await ParentLink.findById(req.params.id) : null;
    if (!link) return res.status(404).json({ message: "Link not found." });
    const isOwnStudent = String(link.student) === uid(req.user);
    let staffOk = null;
    if (!isOwnStudent && link.hostel) {
      // a warden may only revoke guardians of students currently living in their own block
      const stay = await currentStay(link.student);
      const blockId = stay && stay.hostelId === String(link.hostel) ? stay.blockId : null;
      staffOk = await recordScope(req.user, { hostelId: link.hostel, blockId });
    }
    if (!isOwnStudent && !staffOk) return res.status(403).json({ message: "You cannot revoke this link." });
    link.status = "revoked";
    link.inviteCode = undefined;
    await link.save();
    return res.json({ revoked: true });
  } catch (error) {
    return next(error);
  }
});

// ---------------- parent: claim + view ----------------

router.post("/claim", authorize("parent"), async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim();
    if (code.length < 6) return res.status(400).json({ message: "Enter the invite code you received." });

    // (a) staff-issued invite code
    let link = await ParentLink.findOneAndUpdate(
      { inviteCode: code.toUpperCase(), status: "pending", inviteExpiresAt: { $gt: new Date() } },
      { parent: uid(req.user), status: "active", claimedAt: new Date(), $unset: { inviteCode: 1, inviteExpiresAt: 1 } },
      { new: true }
    );

    // (b) student share-link token (HHP-...)
    if (!link) {
      const access = await ParentAccess.findOne({ token: code, status: "active", expiresAt: { $gt: new Date() } }).lean();
      if (access?.student) {
        link = await ParentLink.findOneAndUpdate(
          { student: access.student, parent: uid(req.user) },
          { $setOnInsert: { parentName: access.parentName, parentPhone: access.parentPhone, source: "student_token" }, status: "active", claimedAt: new Date() },
          { new: true, upsert: true }
        );
      }
    }
    if (!link) return res.status(404).json({ message: "That code is invalid or has expired. Ask the hostel office or your child for a new one." });
    await recordAudit(req, { action: "parent.linked", entityType: "ParentLink", entityId: link._id, metadata: { student: String(link.student) } }).catch(() => {});
    return res.json({ linked: true, studentId: String(link.student) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This child is already linked to your account." });
    return next(error);
  }
});

router.get("/children", authorize("parent"), async (req, res, next) => {
  try {
    const ids = await parentStudentIds(req.user);
    const students = await User.find({ _id: { $in: ids } }).select("name university").lean();
    const results = await Promise.all(
      students.map(async (s) => {
        const stay = await currentStay(s._id);
        const hostel = stay ? await Hostel.findById(stay.hostelId).select("name").lean() : null;
        return { id: String(s._id), name: s.name, university: s.university, hostel: hostel?.name || null };
      })
    );
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

// ---- per-child data (parents only ever reach their own linked children) ----

async function requireOwnChild(req, res, next) {
  try {
    const { studentId } = req.params;
    if (!isId(studentId) || !(await parentStudentIds(req.user)).includes(String(studentId))) {
      return res.status(403).json({ message: "This student is not linked to your account." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function childFees(studentId) {
  await refreshOpenInvoices({ student: studentId });
  const [invoices, payments] = await Promise.all([
    FeeInvoice.find({ student: studentId, status: { $ne: "void" } }).sort({ dueDate: 1 }).lean(),
    FeePayment.find({ student: studentId, status: "confirmed" }).sort({ paidAt: -1 }).limit(50).lean()
  ]);
  const views = invoices.map((i) => present(i));
  return {
    billed: views.reduce((s, i) => s + i.amount, 0),
    discounts: views.reduce((s, i) => s + i.discountTotal, 0),
    fines: views.reduce((s, i) => s + i.fineAccrued - i.fineWaived, 0),
    paid: views.reduce((s, i) => s + i.paidAmount + i.finePaid, 0),
    due: views.reduce((s, i) => s + i.totalDue, 0),
    // read-only view; fines/discount lines shown exactly as the student sees them
    invoices: views.map((i) => ({ id: i.id, title: i.title, period: i.period, kind: i.kind, amount: i.amount, discountTotal: i.discountTotal, discounts: (i.discounts || []).map((d) => ({ name: d.name, amountOff: d.amountOff })), paidAmount: i.paidAmount, fineAccrued: i.fineAccrued, fineWaived: i.fineWaived, finePaid: i.finePaid, fineDue: i.fineDue, fineStatus: i.fineStatus, rentDue: i.rentDue, balance: i.totalDue, payTomorrow: i.payTomorrow, status: i.status, dueDate: i.dueDate })),
    // no screenshot links or staff phone numbers — receipt number + who signed is enough
    receipts: payments.map((p) => ({ id: String(p._id), receiptNo: p.receiptNo, amount: p.amount, method: p.method, paidAt: p.paidAt, receivedByName: p.receivedByName }))
  };
}

async function childComplaints(studentId) {
  const complaints = await Complaint.find({ student: studentId }).sort({ createdAt: -1 }).limit(30).lean();
  return complaints.map((c) => ({ id: String(c._id), title: c.title, category: c.category, status: c.status, priority: c.priority, createdAt: c.createdAt, fixedAt: c.fixedAt, resolvedAt: c.resolvedAt, timeline: (c.timeline || []).map((t) => ({ status: t.status, byRole: t.byRole, note: t.note, at: t.at })) }));
}

async function childNotices(stay) {
  if (!stay) return [];
  const blockClause = stay.blockId ? { $in: [null, stay.blockId] } : null;
  const notices = await Notice.find({ hostel: stay.hostelId, block: blockClause, audience: "parents" }).sort({ pinned: -1, createdAt: -1 }).limit(30).select("-readBy").lean();
  return notices.map((n) => ({ ...n, id: String(n._id) }));
}

async function childSeat(stay) {
  if (!stay) return null;
  const [hostel, block, room] = await Promise.all([
    Hostel.findById(stay.hostelId).select("name address city contactPhone").lean(),
    stay.blockId ? Block.findById(stay.blockId).select("name").lean() : null,
    Room.findById(stay.room._id).select("roomNumber floor floorNumber").lean()
  ]);
  return { hostel: hostel?.name, address: [hostel?.address, hostel?.city].filter(Boolean).join(", "), headOfficePhone: hostel?.contactPhone, block: block?.name || null, roomNumber: room?.roomNumber, floor: room?.floor ?? room?.floorNumber ?? null, bed: Number.isInteger(stay.booking.bedIndex) ? stay.booking.bedIndex + 1 : null, status: stay.booking.status };
}

router.get("/children/:studentId/overview", authorize("parent"), requireOwnChild, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const [student, stay, fees, complaints] = await Promise.all([User.findById(studentId).select("name university").lean(), currentStay(studentId), childFees(studentId), childComplaints(studentId)]);
    const [seat, notices] = await Promise.all([childSeat(stay), childNotices(stay)]);
    return res.json({ student: { id: String(studentId), name: student?.name, university: student?.university }, seat, fees, complaints, notices });
  } catch (error) {
    return next(error);
  }
});

router.get("/children/:studentId/fees", authorize("parent"), requireOwnChild, async (req, res, next) => {
  try {
    return res.json(await childFees(req.params.studentId));
  } catch (error) {
    return next(error);
  }
});

router.get("/children/:studentId/complaints", authorize("parent"), requireOwnChild, async (req, res, next) => {
  try {
    return res.json({ results: await childComplaints(req.params.studentId) });
  } catch (error) {
    return next(error);
  }
});

router.get("/children/:studentId/notices", authorize("parent"), requireOwnChild, async (req, res, next) => {
  try {
    return res.json({ results: await childNotices(await currentStay(req.params.studentId)) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
