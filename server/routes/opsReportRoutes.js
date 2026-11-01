const express = require("express");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const Booking = require("../models/Booking");
const Complaint = require("../models/Complaint");
const OfferRedemption = require("../models/OfferRedemption");
const HostelExpense = require("../models/HostelExpense");
const Hostel = require("../models/Hostel");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const clock = require("../services/clock");
const { toCsv, reportRange, turnaroundHours, median, profitByMonth } = require("../services/reportRules");
const { ageBucket } = require("../services/policyRules");
const { present, refreshOpenInvoices } = require("../services/feeService");
const { buildSeatMap } = require("../services/seatMapService");
const { staffScope, wardenBlocks, hostelRoomIds, isId } = require("../services/hostelAccess");

// Reports & exports. ?format=json (default) | csv | pdf, ?from=&to= (Karachi days, inclusive),
// ?blockId=. Wardens are limited to their own blocks; profit is head office only.
const router = express.Router();
router.use(protect, authorize("host", "admin", "warden"), requireDb);

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const name = (u) => u?.name || "";

const REPORTS = {
  async collections({ match, range }) {
    const rows = await FeePayment.aggregate([
      { $match: { ...match, status: "confirmed", paidAt: { $gte: range.from, $lt: range.toExclusive } } },
      { $group: { _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt", timezone: "+05:00" } }, method: "$method" }, count: { $sum: 1 }, total: { $sum: "$amount" }, fines: { $sum: { $ifNull: ["$finePortion", 0] } }, discounts: { $sum: { $ifNull: ["$discountApplied", 0] } } } },
      { $sort: { "_id.day": 1, "_id.method": 1 } }
    ]);
    const out = rows.map((r) => ({ date: r._id.day, method: r._id.method, receipts: r.count, total: r.total, ofWhichFines: r.fines, discountsGiven: r.discounts }));
    // deposit adjustments move held deposits onto dues at checkout — not new cash
    const cash = out.filter((r) => r.method !== "deposit_adjustment");
    const byMethod = {};
    cash.forEach((r) => {
      byMethod[r.method] = (byMethod[r.method] || 0) + r.total;
    });
    return {
      rows: out,
      summary: { cashCollected: cash.reduce((s, r) => s + r.total, 0), receipts: cash.reduce((s, r) => s + r.receipts, 0), byMethod, depositAdjustments: out.filter((r) => r.method === "deposit_adjustment").reduce((s, r) => s + r.total, 0) },
      columns: [{ label: "Date", key: "date" }, { label: "Method", key: "method" }, { label: "Receipts", key: "receipts" }, { label: "Total (PKR)", key: "total" }, { label: "Of which fines", key: "ofWhichFines" }, { label: "Discounts given", key: "discountsGiven" }]
    };
  },

  async outstanding({ match }) {
    await refreshOpenInvoices(match);
    const today = clock.now();
    const invoices = await FeeInvoice.find({ ...match, status: { $in: ["unpaid", "partial"] } }).populate("student", "name").populate("room", "roomNumber").lean();
    const rows = invoices
      .map((i) => present(i, today))
      .filter((i) => i.totalDue > 0)
      .map((i) => {
        const daysOverdue = i.dueDate ? clock.daysBetween(i.dueDate, today) : 0;
        return { student: name(i.student), room: i.room?.roomNumber || "", title: i.title, period: i.period || "", dueDate: i.dueDate ? clock.dayKey(i.dueDate) : "", daysOverdue: Math.max(0, daysOverdue), bucket: ageBucket(daysOverdue), rentDue: i.rentDue, fineDue: i.fineDue, totalDue: i.totalDue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    const buckets = { current: 0, "0-7": 0, "8-30": 0, "30+": 0 };
    rows.forEach((r) => {
      buckets[r.bucket] += r.totalDue;
    });
    return {
      rows,
      summary: { invoices: rows.length, totalDue: rows.reduce((s, r) => s + r.totalDue, 0), byAge: buckets },
      columns: [{ label: "Student", key: "student" }, { label: "Room", key: "room" }, { label: "Invoice", key: "title" }, { label: "Period", key: "period" }, { label: "Due date", key: "dueDate" }, { label: "Days overdue", key: "daysOverdue" }, { label: "Age", key: "bucket" }, { label: "Rent due", key: "rentDue" }, { label: "Fine due", key: "fineDue" }, { label: "Total due", key: "totalDue" }]
    };
  },

  async fines({ match, range }) {
    await refreshOpenInvoices(match);
    const rows = await FeeInvoice.aggregate([
      { $match: { ...match, status: { $ne: "void" }, fineAccrued: { $gt: 0 }, dueDate: { $gte: range.from, $lt: range.toExclusive } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$dueDate", timezone: "+05:00" } }, charged: { $sum: "$fineAccrued" }, waived: { $sum: "$fineWaived" }, paid: { $sum: "$finePaid" }, invoices: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const out = rows.map((r) => ({ month: r._id, charged: r.charged, waived: r.waived, paid: r.paid, outstanding: r.charged - r.waived - r.paid, invoices: r.invoices }));
    return { rows: out, summary: { charged: out.reduce((s, r) => s + r.charged, 0), waived: out.reduce((s, r) => s + r.waived, 0) }, columns: [{ label: "Month due", key: "month" }, { label: "Charged", key: "charged" }, { label: "Waived", key: "waived" }, { label: "Paid", key: "paid" }, { label: "Outstanding", key: "outstanding" }, { label: "Invoices", key: "invoices" }] };
  },

  async occupancy({ hostelId, blockIds }) {
    const map = await buildSeatMap({ hostelId, includeStudents: false });
    const rows = map.blocks.filter((b) => !blockIds || blockIds.includes(String(b.id))).map((b) => ({ block: b.name, ...b.summary }));
    return { rows, summary: blockIds ? undefined : map.summary, columns: [{ label: "Block", key: "block" }, { label: "Total", key: "total" }, { label: "Free", key: "free" }, { label: "Reserved", key: "reserved" }, { label: "Occupied", key: "occupied" }, { label: "Leaving", key: "leaving" }, { label: "Offline-booked", key: "booked_offline" }, { label: "Maintenance", key: "maintenance" }, { label: "Occupancy %", key: "occupancyPct" }] };
  },

  async movements({ hostelId, blockIds, range }) {
    const roomIds = blockIds ? (await Promise.all(blockIds.map((b) => hostelRoomIds(hostelId, b)))).flat() : await hostelRoomIds(hostelId);
    const bookings = await Booking.find({
      room: { $in: roomIds },
      status: { $nin: ["cancelled", "declined", "pending", "payment_pending"] },
      $or: [{ checkIn: { $gte: range.from, $lt: range.toExclusive } }, { moveOutDate: { $gte: range.from, $lt: range.toExclusive } }]
    })
      .populate("student", "name")
      .populate("room", "roomNumber")
      .lean();
    const rows = [];
    bookings.forEach((b) => {
      if (b.checkIn >= range.from && b.checkIn < range.toExclusive) rows.push({ type: "move-in", date: clock.dayKey(b.checkIn), student: name(b.student), room: b.room?.roomNumber || "", source: b.source || "online" });
      if (b.moveOutDate && b.moveOutDate >= range.from && b.moveOutDate < range.toExclusive) rows.push({ type: "move-out", date: clock.dayKey(b.moveOutDate), student: name(b.student), room: b.room?.roomNumber || "", source: b.source || "online" });
    });
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { rows, summary: { moveIns: rows.filter((r) => r.type === "move-in").length, moveOuts: rows.filter((r) => r.type === "move-out").length }, columns: [{ label: "Type", key: "type" }, { label: "Date", key: "date" }, { label: "Student", key: "student" }, { label: "Room", key: "room" }, { label: "Source", key: "source" }] };
  },

  async complaints({ match, range }) {
    const list = await Complaint.find({ ...match, createdAt: { $gte: range.from, $lt: range.toExclusive } }).lean();
    const byCategory = {};
    list.forEach((c) => {
      const row = byCategory[c.category] || { category: c.category, raised: 0, resolved: 0, open: 0, hours: [] };
      row.raised += 1;
      if (c.status === "resolved") {
        row.resolved += 1;
        row.hours.push(turnaroundHours(c));
      } else row.open += 1;
      byCategory[c.category] = row;
    });
    const rows = Object.values(byCategory).map(({ hours, ...r }) => ({ ...r, medianHoursToResolve: median(hours) }));
    const byStatus = {};
    list.forEach((c) => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });
    return { rows, summary: { raised: list.length, byStatus, medianHoursToResolve: median(list.map(turnaroundHours)) }, columns: [{ label: "Category", key: "category" }, { label: "Raised", key: "raised" }, { label: "Resolved", key: "resolved" }, { label: "Open", key: "open" }, { label: "Median hours to resolve", key: "medianHoursToResolve" }] };
  },

  async offers({ match, range, blockIds }) {
    const rows = await OfferRedemption.aggregate([
      { $match: { hostel: match.hostel, appliedAt: { $gte: range.from, $lt: range.toExclusive } } },
      { $lookup: { from: "feeinvoices", localField: "invoice", foreignField: "_id", as: "inv" } },
      ...(blockIds ? [{ $match: { "inv.block": { $in: blockIds.map(oid) } } }] : []),
      { $group: { _id: { offer: "$offer", status: "$status" }, n: { $sum: 1 }, amount: { $sum: "$amountOff" } } },
      { $lookup: { from: "hosteloffers", localField: "_id.offer", foreignField: "_id", as: "offer" } }
    ]);
    const out = rows.map((r) => ({ offer: r.offer[0]?.name || "?", status: r._id.status, redemptions: r.n, amount: r.amount }));
    return { rows: out, summary: { discountGiven: out.filter((r) => r.status === "applied").reduce((s, r) => s + r.amount, 0) }, columns: [{ label: "Offer", key: "offer" }, { label: "Status", key: "status" }, { label: "Redemptions", key: "redemptions" }, { label: "Amount (PKR)", key: "amount" }] };
  },

  async profit({ match, range, scope }) {
    if (scope !== "head_office") return { forbidden: true };
    const depositInvoices = await FeeInvoice.find({ hostel: match.hostel, kind: "security_deposit" }).distinct("_id");
    const collections = await FeePayment.aggregate([
      // income only: refundable deposits and deposit adjustments are not revenue
      { $match: { hostel: match.hostel, status: "confirmed", method: { $ne: "deposit_adjustment" }, invoice: { $nin: depositInvoices }, paidAt: { $gte: range.from, $lt: range.toExclusive } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone: "+05:00" } }, total: { $sum: "$amount" } } }
    ]);
    const expenses = await HostelExpense.aggregate([
      { $match: { hostel: match.hostel, status: "active", spentOn: { $gte: range.from, $lt: range.toExclusive } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$spentOn", timezone: "+05:00" } }, total: { $sum: "$amount" } } }
    ]);
    const rows = profitByMonth(collections.map((c) => ({ month: c._id, total: c.total })), expenses.map((e) => ({ month: e._id, total: e.total })));
    return { rows, summary: { collections: rows.reduce((s, r) => s + r.collections, 0), expenses: rows.reduce((s, r) => s + r.expenses, 0), profit: rows.reduce((s, r) => s + r.profit, 0) }, columns: [{ label: "Month", key: "month" }, { label: "Collections", key: "collections" }, { label: "Expenses", key: "expenses" }, { label: "Profit", key: "profit" }] };
  }
};

function pdfTable(res, { title, subtitle, columns, rows, summary }) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${title.replace(/[^\w-]+/g, "_")}.pdf"`);
  const doc = new PDFDocument({ size: "A4", layout: columns.length > 6 ? "landscape" : "portrait", margin: 36 });
  doc.pipe(res);
  doc.font("Helvetica-Bold").fontSize(16).text(title);
  doc.font("Helvetica").fontSize(9).fillColor("#475569").text(subtitle);
  doc.moveDown(0.6).fillColor("#0f172a");
  const width = (doc.page.width - 72) / columns.length;
  const line = (cells, bold) => {
    if (doc.y > doc.page.height - 60) doc.addPage();
    const y = doc.y;
    cells.forEach((c, i) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(String(c ?? ""), 36 + i * width, y, { width: width - 4 }));
    doc.y = Math.max(doc.y, y + 12);
  };
  line(columns.map((c) => c.label), true);
  rows.forEach((r) => line(columns.map((c) => r[c.key])));
  if (summary) {
    doc.moveDown().font("Helvetica-Bold").fontSize(9).text("Summary");
    doc.font("Helvetica").fontSize(8).text(JSON.stringify(summary, null, 1).replace(/[{}"]/g, "").trim());
  }
  doc.end();
}

router.get("/:report", async (req, res, next) => {
  try {
    const builder = REPORTS[req.params.report];
    if (!builder) return res.status(404).json({ message: `Unknown report. Available: ${Object.keys(REPORTS).join(", ")}.` });
    const { hostelId, blockId, from, to, format = "json" } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
    if (!scope) return res.status(403).json({ message: "No access to this hostel/block." });
    const range = reportRange(from, to);
    if (range.error) return res.status(400).json({ message: range.error });

    let blockIds = null;
    if (scope === "warden") {
      const own = (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => String(b._id));
      if (blockId && isId(blockId) && !own.includes(String(blockId))) return res.status(403).json({ message: "Not your block." });
      blockIds = blockId && isId(blockId) ? [String(blockId)] : own;
    } else if (blockId && isId(blockId)) blockIds = [String(blockId)];
    const match = { hostel: oid(hostelId) };
    if (blockIds) match.block = { $in: blockIds.map(oid) };

    const out = await builder({ hostelId, match, range, blockIds, scope });
    if (out.forbidden) return res.status(403).json({ message: "Only the head office can see profit." });
    const hostel = await Hostel.findById(hostelId).select("name").lean();
    const title = `${hostel?.name || "Hostel"} — ${req.params.report}`;
    const subtitle = `${range.fromKey} to ${range.toKey}${blockIds ? " · selected block(s)" : ""} · generated ${clock.dayKey(clock.now())}`;
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.report}-${range.fromKey}-${range.toKey}.csv"`);
      return res.send(toCsv(out.rows, out.columns));
    }
    if (format === "pdf") return pdfTable(res, { title, subtitle, columns: out.columns, rows: out.rows, summary: out.summary });
    return res.json({ report: req.params.report, range: { from: range.fromKey, to: range.toKey }, scope, summary: out.summary, rows: out.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
