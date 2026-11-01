const express = require("express");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const FeeInvoice = require("../models/FeeInvoice");
const FeePayment = require("../models/FeePayment");
const Hostel = require("../models/Hostel");
const Block = require("../models/Block");
const User = require("../models/User");
const clock = require("../services/clock");
const { FeeError, present, refreshInvoice, refreshOpenInvoices, createInvoice, recordPayment, reversePaymentOnInvoice, applyWaiver, DUE_EXPR } = require("../services/feeService");
const { reserveAutoOffers, reverseRedemptionsForPayment, eligibleOffersFor } = require("../services/offerService");
const { emitInvoiceIssued, emitPaymentReceived, emitToFamily } = require("../services/hostelEvents");
const { protect, authorize, canonicalRole } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const { recordAudit } = require("../services/auditService");
const { buildReceiptWhatsApp } = require("../services/hostelOpsRules");
const { canManageHostel, staffScope, recordScope, wardenBlocks, residents, parentStudentIds, blockInHostel, isId, uid } = require("../services/hostelAccess");

const router = express.Router();

const audit = async (req, payload) => {
  try {
    await recordAudit(req, payload);
  } catch {
    /* never break the operation */
  }
};

const money = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const apiBase = (req) => (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const verifyUrl = (req, receiptNo) => `${apiBase(req)}/api/v1/fees/verify/${encodeURIComponent(receiptNo)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- public receipt verification (no login; no phone numbers or proof links) ----------
router.get("/verify/:receiptNo", requireDb, async (req, res, next) => {
  try {
    const payment = await FeePayment.findOne({ receiptNo: req.params.receiptNo }).populate("student", "name").populate("hostel", "name").lean();
    if (!payment) {
      if (req.query.format === "json") return res.status(404).json({ valid: false });
      return res.status(404).type("html").send("<h2>Receipt not found</h2><p>This receipt number was not issued by Basera.</p>");
    }
    const info = {
      valid: payment.status === "confirmed",
      receiptNo: payment.receiptNo,
      status: payment.status,
      hostel: payment.hostel?.name,
      student: payment.student?.name,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.paidAt
    };
    if (req.query.format === "json") return res.json(info);
    return res.type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${esc(info.receiptNo)}</title>
<body style="font-family:Arial,sans-serif;max-width:480px;margin:32px auto;padding:0 16px;color:#0f172a">
<h2 style="color:${info.valid ? "#047857" : "#b91c1c"}">${info.valid ? "Valid receipt" : "VOIDED receipt"}</h2>
<p><b>${esc(info.receiptNo)}</b></p>
<table cellpadding="6"><tr><td>Hostel</td><td>${esc(info.hostel)}</td></tr><tr><td>Student</td><td>${esc(info.student)}</td></tr>
<tr><td>Amount</td><td>${esc(money(info.amount))}</td></tr><tr><td>Method</td><td>${esc(info.method)}</td></tr>
<tr><td>Date</td><td>${esc(new Date(info.paidAt).toLocaleDateString("en-GB"))}</td></tr></table>
<p style="color:#64748b;font-size:12px">Issued by Basera. Only this page confirms a payment — a screenshot or paper copy alone is not proof.</p></body>`);
  } catch (error) {
    return next(error);
  }
});

router.use(protect, requireDb);

const shape = (doc) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return { ...o, id: String(o._id) };
};

// ---------- invoices ----------

// Resolve student + stay and make sure the caller may bill them.
async function stayForBilling(req, hostelId, studentId) {
  const rows = await residents({ hostelId });
  const row = rows.find((r) => r.student && String(r.student._id) === String(studentId));
  if (!row) return { error: { code: 404, message: "That student has no active stay in this hostel." } };
  const blockId = row.room?.blockId ? String(row.room.blockId) : null;
  const scope = await recordScope(req.user, { hostelId, blockId });
  if (!scope) return { error: { code: 403, message: "You cannot bill students outside your hostel/block." } };
  return { row, blockId };
}

router.post("/invoices", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, studentId, title, amount, kind = "rent", period, dueDate } = req.body;
    if (!isId(hostelId) || !isId(studentId)) return res.status(400).json({ message: "hostelId and studentId are required." });
    if (!title || !Number.isInteger(amount) || amount <= 0) return res.status(400).json({ message: "A title and a positive whole-number amount are required." });
    const found = await stayForBilling(req, hostelId, studentId);
    if (found.error) return res.status(found.error.code).json({ message: found.error.message });
    const invoice = await createInvoice({ hostel: hostelId, block: found.blockId, room: found.row.room?._id, bedIndex: found.row.bedIndex, student: studentId, booking: found.row._id, title, kind, period, amount, dueDate, createdBy: uid(req.user) });
    await audit(req, { action: "fee.invoice.created", entityType: "FeeInvoice", entityId: invoice._id, metadata: { amount, kind, period, finePerDay: invoice.finePerDay, dueDate: invoice.dueDate } });
    await emitInvoiceIssued(invoice);
    return res.status(201).json({ invoice: present(invoice) });
  } catch (error) {
    if (error instanceof FeeError) return res.status(error.code).json({ message: error.message });
    return next(error);
  }
});

// Bill every resident (hostel or one block) in one go. Head office only.
router.post("/invoices/bulk", authorize("host", "admin"), async (req, res, next) => {
  try {
    const { hostelId, blockId, title, amount, kind = "rent", period, dueDate } = req.body;
    if (!isId(hostelId) || !(await canManageHostel(req.user, hostelId))) return res.status(403).json({ message: "You do not manage this hostel." });
    if (!title || !Number.isInteger(amount) || amount <= 0) return res.status(400).json({ message: "A title and a positive whole-number amount are required." });
    if (!period) return res.status(400).json({ message: "period (e.g. 2026-11) is required for bulk billing to prevent double charging." });
    if (blockId && !(await blockInHostel(blockId, hostelId))) return res.status(400).json({ message: "That block does not belong to this hostel." });
    const rows = (await residents({ hostelId, blockId: blockId && isId(blockId) ? blockId : undefined })).filter((r) => r.student);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        const invoice = await createInvoice({ hostel: hostelId, block: row.room?.blockId || null, room: row.room?._id, bedIndex: row.bedIndex, student: row.student._id, booking: row._id, title, kind, period, amount, dueDate, createdBy: uid(req.user) });
        await emitInvoiceIssued(invoice);
        created += 1;
      } catch (error) {
        if (error instanceof FeeError && error.code === 409) skipped += 1;
        else throw error;
      }
    }
    await audit(req, { action: "fee.invoice.bulk", entityType: "Hostel", entityId: hostelId, metadata: { created, skipped, amount, period } });
    return res.status(201).json({ created, skipped, residents: rows.length });
  } catch (error) {
    if (error instanceof FeeError) return res.status(error.code).json({ message: error.message });
    return next(error);
  }
});

/** Hostel query for a staff list, narrowed to a warden's own blocks. Returns null when forbidden. */
async function staffListQuery(req, hostelId, blockId) {
  const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
  if (!scope) return null;
  const query = { hostel: hostelId };
  if (scope === "warden") {
    const own = (await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => b._id);
    if (blockId && isId(blockId) && !own.some((b) => String(b) === String(blockId))) return null;
    query.block = blockId && isId(blockId) ? blockId : { $in: own };
  } else if (blockId && isId(blockId)) {
    query.block = blockId;
  }
  return query;
}

router.get("/invoices", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId, status, studentId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const query = await staffListQuery(req, hostelId, blockId);
    if (!query) return res.status(403).json({ message: "No access to this hostel/block." });
    if (studentId && isId(studentId)) query.student = studentId;
    await refreshOpenInvoices(query);
    if (status) query.status = status;
    const results = await FeeInvoice.find(query).populate("student", "name phone").sort({ dueDate: 1, createdAt: -1 }).limit(500).lean();
    return res.json({ results: results.map((i) => present(i)) });
  } catch (error) {
    return next(error);
  }
});

// Residents the caller may bill / invite parents for (wardens: own blocks only), with open balance.
router.get("/students", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const scope = await staffScope(req.user, { hostelId, blockId: blockId && isId(blockId) ? blockId : undefined });
    if (!scope) return res.status(403).json({ message: "No access to this hostel/block." });
    let rows = (await residents({ hostelId, blockId: blockId && isId(blockId) ? blockId : undefined })).filter((r) => r.student);
    if (scope === "warden") {
      const own = new Set((await wardenBlocks(req.user)).filter((b) => String(b.hostelId) === String(hostelId)).map((b) => String(b._id)));
      rows = rows.filter((r) => r.room?.blockId && own.has(String(r.room.blockId)));
    }
    const studentIds = rows.map((r) => r.student._id);
    await refreshOpenInvoices({ hostel: hostelId, student: { $in: studentIds } });
    const due = await FeeInvoice.aggregate([
      { $match: { hostel: new mongoose.Types.ObjectId(hostelId), student: { $in: studentIds }, status: { $in: ["unpaid", "partial"] } } },
      { $group: { _id: "$student", due: { $sum: DUE_EXPR } } }
    ]);
    const dueBy = Object.fromEntries(due.map((d) => [String(d._id), d.due]));
    const users = await User.find({ _id: { $in: studentIds } }).select("loginEnabled").lean();
    const loginBy = Object.fromEntries(users.map((u) => [String(u._id), u.loginEnabled !== false]));
    return res.json({
      results: rows.map((r) => ({
        studentId: String(r.student._id),
        name: r.student.name,
        phone: r.student.phone,
        roomNumber: r.room?.roomNumber,
        blockId: r.room?.blockId ? String(r.room.blockId) : null,
        bedIndex: r.bedIndex ?? null,
        source: r.source || "online",
        loginEnabled: loginBy[String(r.student._id)] ?? true,
        balanceDue: dueBy[String(r.student._id)] || 0
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/invoices/:id/void", authorize("host", "admin"), async (req, res, next) => {
  try {
    const invoice = isId(req.params.id) ? await FeeInvoice.findById(req.params.id) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (!(await canManageHostel(req.user, invoice.hostel))) return res.status(403).json({ message: "You do not manage this hostel." });
    if (!String(req.body.reason || "").trim()) return res.status(400).json({ message: "A reason is required." });
    const updated = await FeeInvoice.findOneAndUpdate({ _id: invoice._id, paidAmount: 0, finePaid: 0, status: { $ne: "void" } }, { status: "void", voidReason: req.body.reason }, { new: true });
    if (!updated) return res.status(409).json({ message: "Only unpaid invoices can be voided. Void the payments first." });
    await audit(req, { action: "fee.invoice.voided", entityType: "FeeInvoice", entityId: invoice._id, metadata: { reason: req.body.reason } });
    return res.json({ invoice: present(updated) });
  } catch (error) {
    return next(error);
  }
});

/** Who may see an invoice: its student, a linked parent, or staff of that block. */
async function invoiceAccess(req, invoice) {
  const studentId = String(invoice.student?._id || invoice.student);
  if (studentId === uid(req.user)) return "student";
  if (canonicalRole(req.user.role) === "parent") return (await parentStudentIds(req.user)).includes(studentId) ? "parent" : null;
  return recordScope(req.user, { hostelId: invoice.hostel, blockId: invoice.block });
}

// Exact amount to clear everything today, and tomorrow (fine may grow overnight).
router.get("/invoices/:id/quote", async (req, res, next) => {
  try {
    let invoice = isId(req.params.id) ? await FeeInvoice.findById(req.params.id) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (!(await invoiceAccess(req, invoice))) return res.status(403).json({ message: "No access to this invoice." });
    invoice = await refreshInvoice(invoice);
    const offers = await eligibleOffersFor(invoice).catch(() => []);
    return res.json({ invoice: present(invoice), eligibleOffers: offers });
  } catch (error) {
    return next(error);
  }
});

// Head office waives a fine without a request (reason mandatory, audited).
router.post("/invoices/:id/waive", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const invoice = isId(req.params.id) ? await FeeInvoice.findById(req.params.id) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (!(await canManageHostel(req.user, invoice.hostel))) return res.status(403).json({ message: "Only the head office can waive fines." });
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required." });
    const amount = req.body.amount === undefined || req.body.amount === "all" ? "all" : Number(req.body.amount);
    const { invoice: updated, amount: waived } = await applyWaiver({ invoiceId: invoice._id, amount, freeze: Boolean(req.body.freeze) });
    await audit(req, { action: "fee.fine.waived", entityType: "FeeInvoice", entityId: invoice._id, metadata: { amount: waived, freeze: Boolean(req.body.freeze), reason, proactive: true } });
    await emitToFamily({ student: invoice.student, hostel: invoice.hostel, type: "fine_waived", title: "Fine waived", message: `PKR ${waived} of the fine on "${invoice.title}" was waived by the hostel office. ${reason}` });
    return res.json({ invoice: present(updated), waived });
  } catch (error) {
    if (error instanceof FeeError) return res.status(error.code).json({ message: error.message });
    return next(error);
  }
});

// ---------- payments ----------

router.post("/invoices/:id/payments", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const invoice = isId(req.params.id) ? await FeeInvoice.findById(req.params.id) : null;
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    const scope = await recordScope(req.user, { hostelId: invoice.hostel, blockId: invoice.block });
    if (!scope) return res.status(403).json({ message: "You cannot collect fees for this block." });

    const { amount, method, transactionId, screenshotUrl, bankName, note, paidAt } = req.body;
    const { payment, invoice: updated } = await recordPayment({
      invoiceId: invoice._id,
      actor: req.user,
      actorRole: canonicalRole(req.user.role),
      amount,
      method,
      transactionId,
      screenshotUrl,
      bankName,
      note,
      paidAt,
      beforeAllocate: (inv) => reserveAutoOffers(inv, { amount: Number(amount), actor: req.user })
    });
    const view = present(updated);
    await audit(req, { action: "fee.payment.recorded", entityType: "FeePayment", entityId: payment._id, metadata: { amount: payment.amount, method, receiptNo: payment.receiptNo, invoice: String(invoice._id), rentPortion: payment.rentPortion, finePortion: payment.finePortion, discount: payment.discountApplied } });
    await emitPaymentReceived(payment, view);
    return res.status(201).json({ payment: shape(payment), invoice: view, balance: view.totalDue, receiptNo: payment.receiptNo });
  } catch (error) {
    if (error instanceof FeeError) return res.status(error.code).json({ message: error.message });
    return next(error);
  }
});

router.post("/payments/:id/void", authorize("host", "admin"), async (req, res, next) => {
  try {
    const payment = isId(req.params.id) ? await FeePayment.findById(req.params.id) : null;
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (!(await canManageHostel(req.user, payment.hostel))) return res.status(403).json({ message: "You do not manage this hostel." });
    if (!String(req.body.reason || "").trim()) return res.status(400).json({ message: "A reason is required." });
    const voided = await FeePayment.findOneAndUpdate(
      { _id: payment._id, status: "confirmed" },
      { status: "void", voidReason: req.body.reason, voidedBy: uid(req.user), voidedAt: clock.now() },
      { new: true }
    );
    if (!voided) return res.status(409).json({ message: "Payment is already void." });
    const invoice = await reversePaymentOnInvoice(voided);
    const reversed = await reverseRedemptionsForPayment(voided, { actor: req.user, reason: `Payment ${voided.receiptNo} voided: ${req.body.reason}` });
    await audit(req, { action: "fee.payment.voided", entityType: "FeePayment", entityId: payment._id, metadata: { reason: req.body.reason, receiptNo: payment.receiptNo, redemptionsReversed: reversed } });
    return res.json({ payment: shape(voided), invoice: invoice ? present(invoice) : null, redemptionsReversed: reversed });
  } catch (error) {
    return next(error);
  }
});

router.get("/payments", authorize("host", "admin", "warden"), async (req, res, next) => {
  try {
    const { hostelId, blockId } = req.query;
    if (!isId(hostelId)) return res.status(400).json({ message: "hostelId is required." });
    const query = await staffListQuery(req, hostelId, blockId);
    if (!query) return res.status(403).json({ message: "No access to this hostel/block." });
    const results = await FeePayment.find(query).populate("student", "name").sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ results: results.map((p) => ({ ...p, id: String(p._id) })) });
  } catch (error) {
    return next(error);
  }
});

// Student: own invoices + receipts (fines refreshed as of today)
router.get("/my", async (req, res, next) => {
  try {
    await refreshOpenInvoices({ student: uid(req.user) });
    const invoices = await FeeInvoice.find({ student: uid(req.user), status: { $ne: "void" } }).sort({ dueDate: 1 }).lean();
    const payments = await FeePayment.find({ student: uid(req.user), status: "confirmed" }).sort({ paidAt: -1 }).limit(100).lean();
    const views = invoices.map((i) => present(i));
    return res.json({
      totals: {
        billed: views.reduce((s, i) => s + i.amount, 0),
        discounts: views.reduce((s, i) => s + i.discountTotal, 0),
        fines: views.reduce((s, i) => s + i.fineAccrued - i.fineWaived, 0),
        paid: views.reduce((s, i) => s + i.paidAmount + i.finePaid, 0),
        due: views.reduce((s, i) => s + i.totalDue, 0)
      },
      invoices: views,
      payments: payments.map((p) => ({ ...p, id: String(p._id), screenshotUrl: undefined }))
    });
  } catch (error) {
    return next(error);
  }
});

// Who may see a payment: the student, their linked parent, or the staff scope that owns it.
async function paymentAccess(req, payment) {
  // `student` may be populated by the caller, so always compare ids, never the document.
  const studentId = String(payment.student?._id || payment.student);
  if (studentId === uid(req.user)) return "student";
  if (canonicalRole(req.user.role) === "parent") {
    const kids = await parentStudentIds(req.user);
    if (kids.includes(studentId)) return "parent";
    return null;
  }
  return recordScope(req.user, { hostelId: payment.hostel, blockId: payment.block });
}

router.get("/payments/:id/receipt.pdf", async (req, res, next) => {
  try {
    const payment = isId(req.params.id) ? await FeePayment.findById(req.params.id).populate("student", "name").populate("invoice") : null;
    if (!payment) return res.status(404).json({ message: "Receipt not found." });
    if (!(await paymentAccess(req, payment))) return res.status(403).json({ message: "No access to this receipt." });

    const [hostel, block] = await Promise.all([Hostel.findById(payment.hostel).select("name address city contactPhone").lean(), payment.block ? Block.findById(payment.block).select("name").lean() : null]);
    const url = verifyUrl(req, payment.receiptNo);
    const qr = Buffer.from((await QRCode.toDataURL(url, { margin: 1, width: 160 })).split(",")[1], "base64");
    const invView = payment.invoice ? present(payment.invoice) : null;
    const balance = invView ? invView.totalDue : 0;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${payment.receiptNo}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0037b7").text("Basera", 48, 34);
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text(hostel?.name || "Hostel", 48, 60, { align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text([hostel?.address, hostel?.city].filter(Boolean).join(", "), 48, 86, { align: "center" });
    doc.font("Helvetica-Bold").fontSize(16).fillColor(payment.status === "void" ? "#b91c1c" : "#0f172a").text(payment.status === "void" ? "PAYMENT RECEIPT — VOIDED" : "PAYMENT RECEIPT", 48, 116, { align: "center" });
    doc.moveTo(48, 144).lineTo(547, 144).strokeColor("#d8dfef").stroke();

    const rows = [
      ["Receipt No.", payment.receiptNo],
      ["Date", new Date(payment.paidAt).toLocaleString("en-GB")],
      ["Student", payment.student?.name],
      ["Block", block?.name || "-"],
      ["For", [payment.invoice?.title, payment.invoice?.period].filter(Boolean).join(" · ")],
      ["Amount received", money(payment.amount)],
      ...(payment.finePortion ? [["  of which rent", money(payment.rentPortion)], ["  of which late fine", money(payment.finePortion)]] : []),
      ...(invView?.discounts || []).map((d) => [`Discount: ${d.name}`, `-${money(d.amountOff)}`]),
      ...(invView && invView.fineWaived ? [["Fine waived", `-${money(invView.fineWaived)}`]] : []),
      ["Method", String(payment.method).replace(/_/g, " ")],
      ["Transaction ID", payment.transactionId || (payment.method === "cash" ? "Cash" : "See attached screenshot")],
      ["Received by", payment.receivedByName || "-"],
      ["Balance remaining", money(balance)]
    ];
    let y = 162;
    rows.forEach(([k, v]) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#334155").text(k, 48, y, { width: 150 });
      doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(String(v ?? "-"), 210, y, { width: 330 });
      y += 26;
    });
    doc.roundedRect(48, y + 20, 499, 110, 8).strokeColor("#d8dfef").stroke();
    doc.image(qr, 460, y + 34, { width: 76, height: 76 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0037b7").text("Verify this receipt", 64, y + 36);
    doc.font("Helvetica").fontSize(9).fillColor("#334155").text(`Scan the QR code or open:\n${url}\nOnly the online page confirms a payment. Staff terminated by the hostel cannot issue valid receipts.`, 64, y + 56, { width: 380 });
    doc.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

// Staff: ready-to-send WhatsApp message for the student (wa.me deep link — no API key needed).
// GET is the documented route; POST is kept for clients built against the first version.
async function receiptWhatsApp(req, res, next) {
  try {
    const payment = isId(req.params.id) ? await FeePayment.findById(req.params.id) : null;
    if (!payment) return res.status(404).json({ message: "Receipt not found." });
    if (!(await recordScope(req.user, { hostelId: payment.hostel, blockId: payment.block }))) return res.status(403).json({ message: "No access to this receipt." });
    if (payment.status !== "confirmed") return res.status(409).json({ message: "This receipt was voided and cannot be shared." });
    const [student, hostel, invoice] = await Promise.all([User.findById(payment.student).select("name phone").lean(), Hostel.findById(payment.hostel).select("name").lean(), FeeInvoice.findById(payment.invoice).lean()]);
    const whatsapp = buildReceiptWhatsApp({
      studentPhone: student?.phone,
      studentName: student?.name,
      hostelName: hostel?.name,
      receiptNo: payment.receiptNo,
      amount: payment.amount,
      balance: invoice ? present(invoice).totalDue : 0,
      verifyUrl: verifyUrl(req, payment.receiptNo)
    });
    if (!whatsapp.number) return res.status(422).json({ message: "The student has no valid phone number on file." });
    await FeePayment.updateOne({ _id: payment._id }, { whatsappSharedAt: clock.now() });
    return res.json({ ...whatsapp, receiptNo: payment.receiptNo });
  } catch (error) {
    return next(error);
  }
}
router.get("/payments/:id/whatsapp", authorize("host", "admin", "warden"), receiptWhatsApp);
router.post("/payments/:id/whatsapp", authorize("host", "admin", "warden"), receiptWhatsApp);

module.exports = router;
