const express = require("express");
const { body } = require("express-validator");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const Dispute = require("../models/Dispute");
const EscrowTransaction = require("../models/EscrowTransaction");
const DepositCase = require("../models/DepositCase");
const TenancyAgreement = require("../models/TenancyAgreement");
const CheckInVerification = require("../models/CheckInVerification");
const validate = require("../middleware/validate");
const { protect, authorize } = require("../middleware/auth");
const { initiateJazzCash, initiateEasypaisa, createStripeIntent } = require("../services/paymentService");
const { buildReceiptPdf } = require("../services/receiptService");
const { generateInstalments } = require("../services/instalmentService");
const { calculateEscrowBreakdown, createEscrowForBooking, releaseAfterFor } = require("../services/escrowService");
const { recordBookingPaymentLedger, recordCommissionLedger, recordDepositResolutionLedger, recordHostPayoutLedger, recordStudentMonthlyFeeLedger } = require("../services/ledgerService");
const { publicHostProfile } = require("../services/contactGatingService");
const { calculateAvailability } = require("../middleware/availability");
const { calculateRefundPreview, calculateLeaveSettlement } = require("../services/refundPolicyService");
const { recordAudit } = require("../services/auditService");
const { buildPdf, receiptIdFor } = require("../services/pdfService");
const { calculateMonthlyStudentCommission, getLifecycleLabel, resolveDirections } = require("../services/studentLifecycleService");
const { roomCoords, pointFrom, cityCenter } = require("../services/geoService");
const { getPlatformSettings } = require("../services/platformSettingsService");
const { bookings, rooms, hostels, users } = require("../data/mockData");
const PDFDocument = require("pdfkit");

const router = express.Router();

const normalizeBookingType = (value, duration = "monthly") => {
  const map = {
    advance_reserve: "ADVANCE_RESERVE",
    monthly: "MONTHLY",
    semester: "SEMESTER",
    annual: "ANNUAL",
    daily: "DAILY",
    trial: "TRIAL"
  };
  return String(value || map[duration] || "MONTHLY").toUpperCase();
};

const normalizeInstalmentPlan = (value, bookingType = "MONTHLY") => {
  const map = {
    full: "FULL",
    two_part: "TWO_PART",
    semester_4x: "SEMESTER_4X",
    token_balance: "TOKEN_BALANCE"
  };
  if (value) return map[String(value).toLowerCase()] || String(value).toUpperCase();
  if (bookingType === "ADVANCE_RESERVE") return "TOKEN_BALANCE";
  if (bookingType === "SEMESTER") return "SEMESTER_4X";
  return "FULL";
};

const paymentInit = async ({ paymentMethod, totalAmount, mobileNo, bookingId }) => {
  if (paymentMethod === "easypaisa") return initiateEasypaisa({ amount: totalAmount, mobileNo, bookingId });
  if (paymentMethod === "stripe") return createStripeIntent({ amount: totalAmount, bookingId });
  if (paymentMethod === "cash") return { provider: "cash", status: "visit-booked", bookingId };
  return initiateJazzCash({ amount: totalAmount, mobileNo, bookingId });
};

const packingChecklistFor = ({ booking = {}, room = {} }) => {
  const amenities = room.amenities || room.facilities || [];
  const mealPlan = room.mealPlan || "FULL_BOARD";
  const genderPolicy = room.genderPolicy || "BOYS_ONLY";
  const roomType = room.roomType || room.type || "DOUBLE";
  const items = [
    "CNIC / student ID and printed booking confirmation",
    "Two passport-size photos",
    "Bedsheet, pillow cover, towel, and basic toiletries",
    "Personal lock for cupboard or drawer",
    "Extension board and phone/laptop chargers",
    "Emergency contact details shared with Basera",
    "Basic medicines and first-aid items",
    "Reusable water bottle"
  ];
  if (mealPlan === "NONE" || mealPlan === "KITCHEN_ACCESS") items.push("Cooking utensils, plate, mug, and tiffin box");
  if (!amenities.some((item) => String(item).toLowerCase().includes("geyser"))) items.push("Seasonal warm clothing and bathing essentials");
  if (String(genderPolicy).includes("GIRLS")) items.push("Personal door lock and guardian contact copy");
  if (["DOUBLE", "TRIPLE", "QUAD", "BUNK_DORM", "double", "triple", "dorm"].includes(roomType)) items.push("Roommate shelf/storage consent and labelled storage bags");
  if (!amenities.some((item) => String(item).toLowerCase().includes("laundry"))) items.push("Laundry bag and detergent sachets");
  return {
    bookingId: booking.id || booking._id || "booking",
    roomTitle: room.title || "Selected room",
    roomType,
    mealPlan,
    genderPolicy,
    progress: 0,
    items: items.map((label, index) => ({ key: `pack-${index + 1}`, label, completed: false }))
  };
};

const checklistPdf = async (checklist) => new Promise((resolve) => {
  const doc = new PDFDocument({ margin: 48 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.fontSize(22).text("Basera Move-In Checklist", { align: "center" });
  doc.moveDown();
  doc.fontSize(11).fillColor("#334155").text(`Booking: ${checklist.bookingId}`);
  doc.text(`Room: ${checklist.roomTitle}`);
  doc.text(`Room Type: ${checklist.roomType} | Meal Plan: ${checklist.mealPlan}`);
  doc.moveDown();
  doc.fillColor("#0f172a").fontSize(14).text("Packing Items", { underline: true });
  doc.moveDown(0.5);
  checklist.items.forEach((item, index) => {
    doc.fontSize(11).text(`${index + 1}. [ ] ${item.label}`, { lineGap: 4 });
  });
  doc.moveDown();
  doc.fontSize(10).fillColor("#64748b").text("Generated by Basera. Share this with parents or print before moving in.");
  doc.end();
});

const demoAgreements = [];
const demoCheckIns = [];

const loadBookingRecord = async (id) => {
  if (mongoose.connection.readyState !== 1) return bookings.find((item) => item.id === id) || bookings[0];
  return Booking.findById(id).populate("student room hostel");
};

const agreementRows = (booking = {}, agreement = {}) => {
  const room = mongoose.connection.readyState !== 1 ? rooms.find((item) => item.id === booking.room) || rooms[0] : booking.room || {};
  const student = mongoose.connection.readyState !== 1 ? users.find((item) => item.id === booking.student) || users[0] : booking.student || {};
  return [
    ["Contract ID", agreement.contractId || `HH-AGR-${booking.id || booking._id || Date.now()}`],
    ["Student", student.name || booking.studentName || "Verified student"],
    ["Room", room.title || room.roomNumber || "Booked room"],
    ["Move-in", booking.moveInDate || booking.checkIn || "-"],
    ["Monthly Rent", `PKR ${Number(booking.totalRent || booking.totalAmount || 0).toLocaleString("en-PK")}`],
    ["Security Deposit", `PKR ${Number(booking.securityDeposit || 0).toLocaleString("en-PK")}`],
    ["Platform Rule", "Confirmed booking payments and host contact must remain inside Basera."],
    ["Student Signature", agreement.studentSig?.name ? `${agreement.studentSig.name} (${agreement.studentSig.cnic || "CNIC pending"})` : "Pending"],
    ["Host Signature", agreement.hostSig?.name ? `${agreement.hostSig.name} (${agreement.hostSig.cnic || "CNIC pending"})` : "Pending"],
    ["Status", agreement.status || "generated"]
  ];
};

const buildAgreementPayload = (booking, agreement = {}) => ({
  agreement: {
    bookingId: booking._id || booking.id,
    contractId: agreement.contractId || `HH-AGR-${String(booking._id || booking.id || Date.now()).slice(-8).toUpperCase()}`,
    status: agreement.status || "generated",
    studentSig: agreement.studentSig,
    hostSig: agreement.hostSig,
    clauses: agreement.customClauses || [
      "Rent, deposit, deductions, notices, and move-out rules are governed by Basera booking policy.",
      "Any off-platform payment request must be reported in the booking screen.",
      "Host and student agree to accurate identity, move-in, and check-in verification."
    ],
    downloadUrl: `/api/v1/bookings/${booking._id || booking.id}/agreement?format=pdf`
  }
});

const createBookingRecord = async ({ studentId, input }) => {
  const paymentMethod = input.paymentMethod || "jazzcash";
  const bookingType = normalizeBookingType(input.bookingType, input.duration);
  const instalmentPlan = normalizeInstalmentPlan(input.instalmentPlan, bookingType);

  const depositProtectionOptIn = Boolean(input.depositProtectionOptIn);

  if (mongoose.connection.readyState !== 1) {
    const selectedRoom = rooms.find((room) => room.id === input.room) || rooms[0];
    const baseAmount = Number(input.totalAmount || selectedRoom.pricePerBed * (input.duration === "semester" ? 6 : 1));
    const breakdown = calculateEscrowBreakdown({
      rentAmount: baseAmount,
      securityDeposit: input.securityDeposit ?? selectedRoom.securityDeposit ?? 0,
      duration: input.duration,
      bookingType,
      discountAmount: input.discountAmount || 0,
      depositProtectionOptIn
    });
    const tokenAmount = Number(input.tokenAmount || (bookingType === "ADVANCE_RESERVE" ? Math.max(5000, Math.round(baseAmount * 0.1)) : 0));
    const host = users.find((user) => user.id === selectedRoom.listedBy) || users.find((user) => ["host", "owner", "landlord"].includes(user.role));
    const paidOnDemo = paymentMethod !== "cash";
    const booking = {
      id: `HH-${Date.now()}`,
      student: studentId,
      ...input,
      bookingType,
      bedIndex: Number.isInteger(input.bedIndex) ? input.bedIndex : 0,
      moveInDate: input.moveInDate || input.checkIn,
      moveOutDate: input.moveOutDate,
      instalmentPlan,
      instalments: generateInstalments({ totalAmount: breakdown.totalAmount, plan: instalmentPlan, startDate: input.checkIn, tokenAmount }),
      tokenAmount,
      totalRent: breakdown.rentAmount,
      totalAmount: breakdown.totalAmount,
      serviceFee: breakdown.serviceFee,
      discountAmount: breakdown.discountAmount,
      securityDeposit: breakdown.securityDeposit,
      commission: breakdown.commissionAmount,
      commissionRate: breakdown.commissionRate,
      ownerReceives: breakdown.hostPayoutAmount,
      hostReceives: breakdown.hostPayoutAmount,
      depositProtection: {
        optedIn: depositProtectionOptIn,
        feePkr: breakdown.depositProtectionFee,
        partnerStatus: "platform_backed_pending_partner"
      },
      depositProtectionClaims: [],
      escrow: {
        status: "HELD",
        releaseAfter: releaseAfterFor(input.moveInDate || input.checkIn),
        commissionAmount: breakdown.commissionAmount,
        hostPayoutAmount: breakdown.hostPayoutAmount,
        depositAmount: breakdown.depositAmount
      },
      escrowStatus: "held",
      paymentMethod,
      paymentStatus: paidOnDemo ? "paid" : "pending",
      status: paidOnDemo ? "confirmed" : "pending",
      hostContact: paidOnDemo ? publicHostProfile(host, { reveal: true }) : publicHostProfile(host)
    };
    return {
      booking,
      payment: await paymentInit({ paymentMethod, totalAmount: booking.totalAmount, mobileNo: input.mobileNo, bookingId: booking.id }),
      demo: true
    };
  }

  const room = await Room.findById(input.room);
  if (!room || room.availableBeds < (input.beds || 1)) throw Object.assign(new Error("Selected room is no longer available."), { statusCode: 409 });
  const availability = await calculateAvailability({ room, from: input.moveInDate || input.checkIn, to: input.moveOutDate || input.checkIn });
  if (!availability.isAvailable) throw Object.assign(new Error("Selected room is no longer available."), { statusCode: 409 });
  const bedIndex = Number.isInteger(input.bedIndex) ? input.bedIndex : availability.availableBedIndices[0];

  const baseAmount = Number(input.totalAmount || room.pricePerBed * (input.duration === "semester" ? 6 : 1));
  const breakdown = calculateEscrowBreakdown({
    rentAmount: baseAmount,
    securityDeposit: input.securityDeposit ?? room.securityDeposit ?? 0,
    duration: input.duration,
    bookingType,
    discountAmount: input.discountAmount || 0,
    depositProtectionOptIn
  });
  const tokenAmount = Number(input.tokenAmount || (bookingType === "ADVANCE_RESERVE" ? Math.max(5000, Math.round(baseAmount * 0.1)) : 0));
  const booking = await Booking.create({
    ...input,
    student: studentId,
    hostel: input.hostel || room.hostel,
    bookingType,
    bedIndex,
    moveInDate: input.moveInDate || input.checkIn,
    moveOutDate: input.moveOutDate,
    instalmentPlan,
    instalments: generateInstalments({ totalAmount: breakdown.totalAmount, plan: instalmentPlan, startDate: input.checkIn, tokenAmount }),
    tokenAmount,
    totalRent: breakdown.rentAmount,
    totalAmount: breakdown.totalAmount,
    serviceFee: breakdown.serviceFee,
    discountAmount: breakdown.discountAmount,
    discountCode: input.discountCode,
    securityDeposit: breakdown.securityDeposit,
    commission: breakdown.commissionAmount,
    ownerReceives: breakdown.hostPayoutAmount,
    depositProtection: {
      optedIn: depositProtectionOptIn,
      feePkr: breakdown.depositProtectionFee,
      partnerStatus: "platform_backed_pending_partner"
    },
    escrowStatus: "held",
    nextRentDueDate: input.nextRentDueDate || input.moveInDate || input.checkIn,
    paymentMethod
  });
  await Room.findByIdAndUpdate(room._id, { $inc: { availableBeds: -1 }, status: room.availableBeds <= 1 ? "FULL" : room.status });
  const escrow = await createEscrowForBooking({ booking, room });

  return {
    booking,
    escrow,
    payment: await paymentInit({ paymentMethod, totalAmount: booking.totalAmount, mobileNo: input.mobileNo, bookingId: booking._id.toString() })
  };
};

router.post(
  "/",
  protect,
  [
    body("hostel").optional().notEmpty().withMessage("Hostel must not be empty when provided."),
    body("room").notEmpty().withMessage("Room is required."),
    body("checkIn").isISO8601().withMessage("Valid check-in date is required."),
    body("duration").isIn(["monthly", "semester", "weekly", "annual", "daily", "trial"]),
    body("bookingType").optional().isIn(["ADVANCE_RESERVE", "MONTHLY", "SEMESTER", "ANNUAL", "DAILY", "TRIAL", "advance_reserve", "monthly", "semester", "annual", "daily", "trial"]),
    body("instalmentPlan").optional().isIn(["FULL", "TWO_PART", "SEMESTER_4X", "TOKEN_BALANCE", "full", "two_part", "semester_4x", "token_balance"]),
    body("paymentMethod").optional().isIn(["jazzcash", "easypaisa", "stripe", "cash"])
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await createBookingRecord({ studentId: req.user._id || req.user.id, input: req.body });
      return res.status(201).json(result);
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
      return next(error);
    }
  }
);

router.get("/admin/overdue", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ results: bookings.filter((booking) => booking.status === "overdue"), demo: true });
    }
    const results = await Booking.find({
      $or: [{ status: "overdue" }, { "instalments.status": "OVERDUE" }]
    }).populate("student hostel room").sort({ updatedAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/my", protect, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const withFee = (booking) => ({
      ...(booking.toObject ? booking.toObject() : booking),
      monthlyPlatformFee: calculateMonthlyStudentCommission({ duration: booking.duration, status: booking.status, studentPlatformFee: settings.studentMonthlyPlatformFeePkr })
    });
    if (mongoose.connection.readyState !== 1) {
      return res.json({ results: bookings.filter((booking) => booking.student === req.user.id).map(withFee) });
    }
    const results = await Booking.find({ student: req.user._id || req.user.id }).populate("hostel room").sort({ createdAt: -1 });
    return res.json({ results: results.map(withFee) });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/all", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: bookings, demo: true });
    const results = await Booking.find().populate("student hostel room").sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/hostel/:hostelId", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: bookings.filter((booking) => booking.hostel === req.params.hostelId), demo: true });
    const results = await Booking.find({ hostel: req.params.hostelId }).populate("student room").sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/refund-preview", protect, async (req, res) => {
  const preview = calculateRefundPreview({
    amount: req.query.amount,
    checkIn: req.query.checkIn,
    reason: req.query.reason || "student_cancelled"
  });
  return res.json({ preview });
});

router.get("/:id/agreement", protect, async (req, res, next) => {
  try {
    const booking = await loadBookingRecord(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const contractId = `HH-AGR-${String(booking._id || booking.id || req.params.id).slice(-8).toUpperCase()}`;
    let agreement = mongoose.connection.readyState !== 1
      ? demoAgreements.find((item) => item.bookingRef === req.params.id) || { bookingRef: req.params.id, contractId, status: "generated" }
      : await TenancyAgreement.findOneAndUpdate(
        { $or: [{ booking: booking._id }, { bookingRef: req.params.id }] },
        { $setOnInsert: { booking: booking._id, bookingRef: req.params.id, contractId, status: "generated" } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

    if (mongoose.connection.readyState !== 1 && !demoAgreements.find((item) => item.bookingRef === req.params.id)) {
      demoAgreements.unshift(agreement);
    }

    if (req.query.format === "pdf") {
      const buffer = await buildPdf({
        title: "Digital Tenancy Agreement",
        subtitle: "Basera booking terms and e-sign record",
        rows: agreementRows(booking, agreement),
        receiptId: receiptIdFor("HH-TEN", agreement.contractId || req.params.id)
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=basera-tenancy-agreement-${req.params.id}.pdf`);
      return res.send(buffer);
    }

    return res.json({ ...buildAgreementPayload(booking, agreement), demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/agreement/sign", protect, async (req, res, next) => {
  try {
    const role = ["host", "owner", "landlord", "admin"].includes(req.user.role) ? "hostSig" : "studentSig";
    const signature = {
      name: req.body.name || req.user.name,
      cnic: req.body.cnic || req.user.cnic || req.user.studentId || "CNIC-pending",
      signedAt: new Date(),
      ipAddress: req.ip
    };
    const booking = await loadBookingRecord(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const contractId = `HH-AGR-${String(booking._id || booking.id || req.params.id).slice(-8).toUpperCase()}`;

    if (mongoose.connection.readyState !== 1) {
      const agreement = demoAgreements.find((item) => item.bookingRef === req.params.id) || { bookingRef: req.params.id, contractId, status: "generated" };
      agreement[role] = signature;
      agreement.status = agreement.studentSig && agreement.hostSig ? "fully_signed" : role === "hostSig" ? "host_signed" : "student_signed";
      agreement.signedAt = agreement.status === "fully_signed" ? new Date().toISOString() : agreement.signedAt;
      if (!demoAgreements.includes(agreement)) demoAgreements.unshift(agreement);
      return res.json({ ...buildAgreementPayload(booking, agreement), demo: true });
    }

    const update = { [role]: signature };
    const existing = await TenancyAgreement.findOne({ $or: [{ booking: booking._id }, { bookingRef: req.params.id }] });
    const nextStatus = existing?.[role === "hostSig" ? "studentSig" : "hostSig"] ? "fully_signed" : role === "hostSig" ? "host_signed" : "student_signed";
    if (nextStatus === "fully_signed") update.signedAt = new Date();
    update.status = nextStatus;
    const agreement = await TenancyAgreement.findOneAndUpdate(
      { $or: [{ booking: booking._id }, { bookingRef: req.params.id }] },
      { $set: update, $setOnInsert: { booking: booking._id, bookingRef: req.params.id, contractId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await recordAudit(req, { action: "agreement.signed", entityType: "TenancyAgreement", entityId: agreement._id, metadata: { role } });
    return res.json(buildAgreementPayload(booking, agreement));
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/checkin-verify", protect, async (req, res, next) => {
  try {
    const hasSelfie = Boolean(req.body.selfieUrl);
    const hasCnic = Boolean(req.body.cnicPhotoUrl);
    const confidence = Math.max(45, Math.min(98, Number(req.body.matchConfidence || (hasSelfie && hasCnic ? 91 : hasSelfie ? 74 : 58))));
    const status = confidence >= 85 ? "matched" : confidence >= 70 ? "manual_review" : "retry_required";
    const payload = {
      booking: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : undefined,
      bookingRef: req.params.id,
      student: req.user._id,
      studentRef: req.user.id,
      selfieUrl: req.body.selfieUrl,
      cnicPhotoUrl: req.body.cnicPhotoUrl,
      matchConfidence: confidence,
      status,
      verifiedAt: status === "matched" ? new Date() : undefined
    };
    if (mongoose.connection.readyState !== 1) {
      const verification = { id: `checkin-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      demoCheckIns.unshift(verification);
      return res.status(201).json({ verification, demo: true });
    }
    const verification = await CheckInVerification.create(payload);
    await recordAudit(req, { action: "booking.checkin_verified", entityType: "CheckInVerification", entityId: verification._id, metadata: { status, confidence } });
    return res.status(201).json({ verification });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/checklist", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      const room = rooms.find((item) => item.id === booking.room) || rooms[0];
      return res.json({ checklist: packingChecklistFor({ booking, room }), demo: true });
    }
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ checklist: packingChecklistFor({ booking, room: booking.room }) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/checklist/pdf", protect, async (req, res, next) => {
  try {
    const booking = mongoose.connection.readyState === 1 ? await Booking.findById(req.params.id).populate("room") : bookings.find((item) => item.id === req.params.id) || bookings[0];
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const room = mongoose.connection.readyState === 1 ? booking.room : rooms.find((item) => item.id === booking.room) || rooms[0];
    const buffer = await checklistPdf(packingChecklistFor({ booking, room }));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=basera-move-in-checklist-${req.params.id}.pdf`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/cancellation-preview", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      return res.json({ bookingId: req.params.id, preview: calculateRefundPreview({ booking, reason: req.query.reason || "student_cancelled" }), demo: true });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ bookingId: req.params.id, preview: calculateRefundPreview({ booking, reason: req.query.reason || "student_cancelled" }) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      const room = rooms.find((item) => item.id === booking.room) || rooms[0];
      const host = users.find((user) => user.id === room.listedBy) || users.find((user) => ["host", "owner", "landlord"].includes(user.role));
      const reveal = booking.paymentStatus === "paid" && ["confirmed", "active", "completed"].includes(booking.status);
      return res.json({ booking, hostContact: publicHostProfile(host, { reveal }), contactRevealed: reveal, demo: true });
    }

    const booking = await Booking.findById(req.params.id).populate("room").populate("hostel");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const room = booking.room;
    const hostId = room?.listedBy || booking.hostel?.owner;
    const User = require("../models/User");
    const host = hostId ? await User.findById(hostId).select("name email phone role avatar hostProfile landlordProfile") : null;
    const reveal = booking.paymentStatus === "paid" && ["confirmed", "active", "completed"].includes(booking.status);
    return res.json({ booking, hostContact: publicHostProfile(host, { reveal }), contactRevealed: reveal });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/cancel", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      const refundPreview = calculateRefundPreview({ booking, reason: req.body.reason || "student_cancelled" });
      await recordAudit(req, { action: "booking.cancelled", entityType: "Booking", entityId: req.params.id, metadata: refundPreview });
      return res.json({ id: req.params.id, status: "cancelled", cancelReason: req.body.cancelReason, refundPreview, demo: true });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const refundPreview = calculateRefundPreview({ booking, reason: req.body.reason || "student_cancelled" });
    booking.status = "cancelled";
    booking.cancelReason = req.body.cancelReason;
    booking.refundPreview = refundPreview;
    await booking.save();
    await recordAudit(req, { action: "booking.cancelled", entityType: "Booking", entityId: booking._id, metadata: refundPreview });
    return res.json({ booking, refundPreview });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/confirm", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, status: "confirmed", demo: true });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: "confirmed", paymentStatus: "paid" }, { new: true });
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/accept", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, status: "confirmed", demo: true });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: "confirmed" }, { new: true });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/decline", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, status: "declined", declineReason: req.body.reason, demo: true });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: "declined", declineReason: req.body.reason }, { new: true });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    await Room.findByIdAndUpdate(booking.room, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/token-pay", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, tokenPaid: true, demo: true });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    booking.tokenAmount = booking.tokenAmount || Number(req.body.amount || 5000);
    booking.paymentStatus = "paid";
    booking.status = "confirmed";
    booking.hostContactReleasedAt = new Date();
    booking.escrowStatus = "held";
    if (booking.instalments?.[0]) {
      booking.instalments[0].status = "PAID";
      booking.instalments[0].paidAt = new Date();
      booking.instalments[0].paymentRef = req.body.paymentRef || `token-${Date.now()}`;
    }
    await booking.save();
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/instalment/:idx", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, instalment: req.params.idx, paid: true, demo: true });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const index = Number(req.params.idx);
    if (!booking.instalments?.[index]) return res.status(404).json({ message: "Instalment not found." });
    booking.instalments[index].status = "PAID";
    booking.instalments[index].paidAt = new Date();
    booking.instalments[index].paymentRef = req.body.paymentRef || `inst-${Date.now()}`;
    if (booking.instalments.every((item) => item.status === "PAID")) booking.paymentStatus = "paid";
    await booking.save();
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/rent-pay", protect, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!amount) return res.status(400).json({ message: "Amount is required." });
    if (mongoose.connection.readyState !== 1) {
      const breakdown = calculateEscrowBreakdown({ rentAmount: amount, securityDeposit: 0, duration: "monthly", bookingType: "MONTHLY" });
      return res.json({ paid: true, bookingId: req.params.id, escrow: { status: "HELD", ...breakdown }, demo: true });
    }
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    booking.paymentStatus = "paid";
    booking.status = "active";
    booking.nextRentDueDate = req.body.nextRentDueDate || new Date(new Date().setMonth(new Date().getMonth() + 1));
    booking.totalRent = amount;
    booking.totalAmount = amount + Number(booking.serviceFee || 0);
    await booking.save();
    const rentLedgerBooking = { ...booking.toObject(), _id: booking._id, securityDeposit: 0, totalRent: amount, totalAmount: amount + Number(booking.serviceFee || 0) };
    const escrow = await createEscrowForBooking({ booking: rentLedgerBooking, room: booking.room });
    await recordBookingPaymentLedger({ booking: rentLedgerBooking, gateway: booking.paymentMethod || "manual", paymentRef: req.body.paymentRef || `rent-${Date.now()}`, idempotencyKey: `rent-paid-${booking._id}-${Date.now()}` });
    await recordCommissionLedger({ booking: rentLedgerBooking, idempotencyKey: `rent-commission-${booking._id}-${Date.now()}` });

    let monthlyPlatformFee = 0;
    if (String(booking.duration).toLowerCase() === "monthly") {
      const settings = await getPlatformSettings();
      monthlyPlatformFee = calculateMonthlyStudentCommission({ duration: booking.duration, status: booking.status, studentPlatformFee: settings.studentMonthlyPlatformFeePkr });
      if (monthlyPlatformFee > 0) {
        const period = new Date().toISOString().slice(0, 7);
        await recordStudentMonthlyFeeLedger({
          student: booking.student,
          booking: rentLedgerBooking,
          amount: monthlyPlatformFee,
          period,
          paymentRef: req.body.paymentRef || `rent-${Date.now()}`,
          idempotencyKey: `student-monthly-fee-${booking._id}-${period}`
        });
      }
    }

    return res.json({ paid: true, booking, escrow, monthlyPlatformFee });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/directions", protect, async (req, res, next) => {
  try {
    const booking = await loadBookingRecord(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const room = mongoose.connection.readyState !== 1 ? rooms.find((item) => item.id === booking.room) || rooms[0] : booking.room;
    const hostel = mongoose.connection.readyState !== 1 ? hostels.find((item) => item.id === booking.hostel) || hostels[0] : booking.hostel;
    const category = String(req.query.category || "pharmacy").toLowerCase();
    const center = (room && roomCoords(room)) || (hostel && pointFrom(hostel)) || cityCenter(hostel?.city);
    const result = resolveDirections({ center, category, originLat: req.query.originLat, originLng: req.query.originLng });
    return res.json({ ...result, bookingId: req.params.id, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/leave-preview", protect, async (req, res, next) => {
  try {
    const booking = await loadBookingRecord(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    return res.json({ bookingId: req.params.id, preview: calculateLeaveSettlement({ booking, moveOutDate: req.query.moveOutDate }), demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/switch", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        id: req.params.id,
        lifecycleStatus: "switch_requested",
        lifecycle: { status: "switch_requested", label: getLifecycleLabel("switch_requested") },
        demo: true
      });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (String(booking.student) !== String(req.user._id || req.user.id)) return res.status(403).json({ message: "Not authorized for this booking." });
    if (!["confirmed", "active"].includes(booking.status)) return res.status(409).json({ message: "Only active or confirmed bookings can request a switch." });
    if (booking.lifecycleStatus !== "none") return res.status(409).json({ message: "A lifecycle request is already pending on this booking." });
    booking.lifecycleStatus = "switch_requested";
    booking.lifecycleReason = req.body.reason || "Requested by student";
    booking.lifecycleRequestedAt = new Date();
    booking.switchTargetRoom = req.body.targetRoom || undefined;
    booking.switchTargetHostel = req.body.targetHostel || undefined;
    await booking.save();
    await recordAudit(req, { action: "booking.switch_requested", entityType: "Booking", entityId: booking._id, metadata: { targetRoom: req.body.targetRoom } });
    return res.json({ booking, lifecycle: { status: booking.lifecycleStatus, label: getLifecycleLabel(booking.lifecycleStatus) } });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/leave", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      return res.json({
        id: req.params.id,
        lifecycleStatus: "leave_requested",
        lifecycle: { status: "leave_requested", label: getLifecycleLabel("leave_requested") },
        preview: calculateLeaveSettlement({ booking, moveOutDate: req.body.moveOutDate }),
        demo: true
      });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (String(booking.student) !== String(req.user._id || req.user.id)) return res.status(403).json({ message: "Not authorized for this booking." });
    if (!["confirmed", "active", "overdue"].includes(booking.status)) return res.status(409).json({ message: "Only active bookings can request to leave." });
    if (booking.lifecycleStatus !== "none") return res.status(409).json({ message: "A lifecycle request is already pending on this booking." });
    booking.lifecycleStatus = "leave_requested";
    booking.lifecycleReason = req.body.reason || "Student requested to leave";
    booking.lifecycleRequestedAt = new Date();
    booking.plannedMoveOutDate = req.body.moveOutDate || new Date();
    await booking.save();
    await recordAudit(req, { action: "booking.leave_requested", entityType: "Booking", entityId: booking._id, metadata: { moveOutDate: booking.plannedMoveOutDate } });
    return res.json({
      booking,
      lifecycle: { status: booking.lifecycleStatus, label: getLifecycleLabel(booking.lifecycleStatus) },
      preview: calculateLeaveSettlement({ booking, moveOutDate: booking.plannedMoveOutDate })
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/lifecycle/approve", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, decision: "approve", demo: true });
    const booking = await Booking.findById(req.params.id).populate("room hostel");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (req.user.role !== "admin" && String(booking.room?.listedBy) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ message: "Not authorized for this booking." });
    }
    if (!["switch_requested", "leave_requested"].includes(booking.lifecycleStatus)) {
      return res.status(409).json({ message: "No pending lifecycle request on this booking." });
    }

    if (booking.lifecycleStatus === "switch_requested") {
      if (!booking.switchTargetRoom) return res.status(400).json({ message: "Switch request has no target room." });
      const newBookingResult = await createBookingRecord({
        studentId: booking.student,
        input: {
          room: String(booking.switchTargetRoom),
          hostel: booking.switchTargetHostel ? String(booking.switchTargetHostel) : undefined,
          duration: booking.duration,
          bookingType: booking.bookingType,
          instalmentPlan: booking.instalmentPlan,
          paymentMethod: booking.paymentMethod,
          checkIn: new Date().toISOString(),
          moveInDate: new Date().toISOString(),
          beds: booking.beds
        }
      });
      booking.status = "completed";
      booking.lifecycleStatus = "switch_approved";
      booking.lifecycleDecidedAt = new Date();
      booking.lifecycleDecidedBy = req.user._id || req.user.id;
      booking.switchNewBooking = newBookingResult.booking._id;
      booking.moveOutDate = new Date();
      await booking.save();
      await Room.findByIdAndUpdate(booking.room._id, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
      await recordAudit(req, { action: "booking.switch_approved", entityType: "Booking", entityId: booking._id, metadata: { newBooking: newBookingResult.booking._id } });
      return res.json({ oldBooking: booking, newBooking: newBookingResult.booking, escrow: newBookingResult.escrow });
    }

    const settlement = calculateLeaveSettlement({ booking, moveOutDate: booking.plannedMoveOutDate || new Date() });
    booking.status = "completed";
    booking.lifecycleStatus = "leave_approved";
    booking.lifecycleDecidedAt = new Date();
    booking.lifecycleDecidedBy = req.user._id || req.user.id;
    booking.moveOutDate = booking.plannedMoveOutDate || new Date();
    booking.leaveSettlement = { ...settlement, calculatedAt: new Date() };
    booking.nextRentDueDate = undefined;
    await booking.save();
    await Room.findByIdAndUpdate(booking.room._id, { $inc: { availableBeds: 1 }, status: "ACTIVE" });
    if (Number(booking.securityDeposit) > 0) {
      await recordDepositResolutionLedger({ booking, refundAmount: settlement.securityDeposit, deductionAmount: 0, idempotencyKey: `leave-deposit-${booking._id}` });
    }
    await recordAudit(req, { action: "booking.leave_approved", entityType: "Booking", entityId: booking._id, metadata: settlement });
    return res.json({ booking, settlement });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/lifecycle/decline", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, decision: "decline", demo: true });
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (req.user.role !== "admin" && String(booking.room?.listedBy) !== String(req.user._id || req.user.id)) {
      return res.status(403).json({ message: "Not authorized for this booking." });
    }
    if (!["switch_requested", "leave_requested"].includes(booking.lifecycleStatus)) {
      return res.status(409).json({ message: "No pending lifecycle request on this booking." });
    }
    booking.lifecycleStatus = "none";
    booking.lifecycleDeclineReason = req.body.reason || "Declined by host";
    booking.lifecycleDecidedAt = new Date();
    booking.lifecycleDecidedBy = req.user._id || req.user.id;
    await booking.save();
    await recordAudit(req, { action: "booking.lifecycle_declined", entityType: "Booking", entityId: booking._id, metadata: { reason: booking.lifecycleDeclineReason } });
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/commission", protect, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const booking = mongoose.connection.readyState !== 1
      ? bookings.find((item) => item.id === req.params.id) || bookings[0]
      : await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const commissionAmount = calculateMonthlyStudentCommission({ duration: booking.duration, status: booking.status, studentPlatformFee: req.body.studentPlatformFee || settings.studentMonthlyPlatformFeePkr });
    return res.json({ commission: commissionAmount, bookingId: req.params.id, currency: "PKR", demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/report-off-platform", protect, async (req, res, next) => {
  try {
    const payload = {
      title: "Off-platform payment request reported",
      description: req.body.description || "Student reported that a Host requested payment outside Basera.",
      category: "Payment",
      evidence: req.body.evidence || [],
      priority: "high",
      openedBy: req.user._id || req.user.id,
      raisedBy: req.user._id || req.user.id
    };
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        report: { id: `OFF-${Date.now()}`, booking: req.params.id, ...payload, status: "open" },
        studentCredit: Number(process.env.OFF_PLATFORM_REPORT_CREDIT_PKR || 500),
        demo: true
      });
    }
    const booking = await Booking.findById(req.params.id).populate("room hostel");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const dispute = await Dispute.create({
      ...payload,
      booking: booking._id,
      student: booking.student,
      hostel: booking.hostel,
      owner: booking.room?.listedBy,
      raisedAgainst: booking.room?.listedBy
    });
    booking.status = "disputed";
    booking.disputeId = dispute._id;
    booking.escrowStatus = "disputed";
    await booking.save();
    await EscrowTransaction.updateMany({ bookingId: booking._id, status: "HELD" }, { status: "DISPUTED", disputeId: dispute._id, releaseBlockedBy: "OFF_PLATFORM_REPORT" });
    return res.status(201).json({ report: dispute, studentCredit: Number(process.env.OFF_PLATFORM_REPORT_CREDIT_PKR || 500) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/dispute", protect, async (req, res, next) => {
  try {
    const payload = {
      title: req.body.title || "Booking dispute",
      description: req.body.description,
      evidence: req.body.evidence || [],
      priority: req.body.priority || "medium",
      openedBy: req.user._id || req.user.id
    };
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({ dispute: { id: `DIS-${Date.now()}`, booking: req.params.id, ...payload, status: "open" }, demo: true });
    }
    const booking = await Booking.findById(req.params.id).populate("room hostel");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const dispute = await Dispute.create({
      ...payload,
      booking: booking._id,
      student: booking.student,
      hostel: booking.hostel,
      owner: booking.room?.listedBy
    });
    booking.status = "disputed";
    booking.disputeId = dispute._id;
    booking.escrowStatus = "disputed";
    await booking.save();
    await EscrowTransaction.updateMany({ bookingId: booking._id, status: "HELD" }, { status: "DISPUTED", disputeId: dispute._id, releaseBlockedBy: "DISPUTE" });
    return res.status(201).json({ dispute });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/dispute/:disputeId/resolve", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ dispute: { id: req.params.disputeId, status: "resolved", outcome: req.body.outcome }, demo: true });
    }
    const dispute = await Dispute.findByIdAndUpdate(
      req.params.disputeId,
      { status: "resolved", outcome: req.body.outcome, resolutionNote: req.body.resolutionNote },
      { new: true }
    );
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });
    await Booking.findByIdAndUpdate(req.params.id, { status: "active", escrowStatus: "released" });
    return res.json({ dispute });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/deposit", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        deposit: {
          caseId: `HH-DEP-DEMO-${req.params.id}`,
          booking: req.params.id,
          amount: 15000,
          status: "HELD",
          dueForAutoRefundAt: new Date(Date.now() + 14 * 86400000).toISOString()
        },
        demo: true
      });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    let deposit = await DepositCase.findOne({ booking: booking._id });
    if (!deposit) {
      deposit = await DepositCase.create({
        booking: booking._id,
        student: booking.student,
        amount: booking.securityDeposit || 0,
        status: "HELD",
        dueForAutoRefundAt: new Date(Date.now() + 14 * 86400000)
      });
    }
    return res.json({ deposit });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/deposit/deduction", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const requestedDeduction = Number(req.body.amount || 0);
    if (requestedDeduction <= 0) return res.status(400).json({ message: "Deduction amount is required." });
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({
        deposit: { caseId: `HH-DEP-${Date.now()}`, booking: req.params.id, amount: 15000, requestedDeduction, status: "DEDUCTION_REQUESTED", reason: req.body.reason },
        demo: true
      });
    }
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const deposit = await DepositCase.findOneAndUpdate(
      { booking: booking._id },
      {
        booking: booking._id,
        student: booking.student,
        host: booking.room?.listedBy,
        amount: booking.securityDeposit || 0,
        requestedDeduction,
        reason: req.body.reason,
        evidence: req.body.evidence || [],
        status: "DEDUCTION_REQUESTED",
        dueForAutoRefundAt: new Date(Date.now() + 14 * 86400000)
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ deposit });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/deposit/refund", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deposit: { booking: req.params.id, status: "REFUNDED", refundAmount: 15000 }, demo: true });
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const refundAmount = Number(req.body.amount ?? booking.securityDeposit ?? 0);
    const deposit = await DepositCase.findOneAndUpdate(
      { booking: booking._id },
      {
        booking: booking._id,
        student: booking.student,
        host: booking.room?.listedBy,
        amount: booking.securityDeposit || refundAmount,
        refundAmount,
        deductionAmount: 0,
        status: "REFUNDED",
        resolvedAt: new Date(),
        resolvedBy: req.user._id || req.user.id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await recordDepositResolutionLedger({ booking, refundAmount, deductionAmount: 0, idempotencyKey: `deposit-refund-${booking._id}-${deposit._id}` });
    await Booking.findByIdAndUpdate(booking._id, { escrowStatus: "refunded" });
    return res.json({ deposit });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/deposit/accept", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deposit: { booking: req.params.id, status: "ACCEPTED" }, demo: true });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const deposit = await DepositCase.findOne({ booking: booking._id });
    if (!deposit) return res.status(404).json({ message: "Deposit case not found." });
    const deductionAmount = Math.min(Number(deposit.requestedDeduction || 0), Number(deposit.amount || 0));
    const refundAmount = Math.max(0, Number(deposit.amount || 0) - deductionAmount);
    deposit.status = "ACCEPTED";
    deposit.deductionAmount = deductionAmount;
    deposit.refundAmount = refundAmount;
    deposit.studentResponse = req.body.response || "Accepted by student";
    deposit.resolvedAt = new Date();
    await deposit.save();
    await recordDepositResolutionLedger({ booking, refundAmount, deductionAmount, idempotencyKey: `deposit-accepted-${booking._id}-${deposit._id}` });
    return res.json({ deposit });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/deposit/dispute", protect, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(201).json({ dispute: { id: `DEP-DIS-${Date.now()}`, booking: req.params.id, status: "open" }, demo: true });
    const booking = await Booking.findById(req.params.id).populate("room hostel");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const deposit = await DepositCase.findOneAndUpdate({ booking: booking._id }, { status: "DISPUTED", studentResponse: req.body.description }, { new: true });
    const dispute = await Dispute.create({
      title: "Security deposit dispute",
      description: req.body.description || "Student disputed the requested deposit deduction.",
      category: "Refund",
      evidence: req.body.evidence || [],
      priority: "high",
      booking: booking._id,
      student: booking.student,
      hostel: booking.hostel,
      owner: booking.room?.listedBy,
      openedBy: req.user._id || req.user.id
    });
    booking.status = "disputed";
    booking.disputeId = dispute._id;
    booking.escrowStatus = "disputed";
    await booking.save();
    return res.status(201).json({ dispute, deposit });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/deposit/resolve", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ deposit: { booking: req.params.id, status: req.body.deductionAmount ? "DEDUCTED" : "REFUNDED" }, demo: true });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const refundAmount = Number(req.body.refundAmount || 0);
    const deductionAmount = Number(req.body.deductionAmount || 0);
    const deposit = await DepositCase.findOneAndUpdate(
      { booking: booking._id },
      {
        refundAmount,
        deductionAmount,
        adminNote: req.body.adminNote,
        status: deductionAmount > 0 ? "DEDUCTED" : "REFUNDED",
        resolvedAt: new Date(),
        resolvedBy: req.user._id || req.user.id
      },
      { new: true }
    );
    if (!deposit) return res.status(404).json({ message: "Deposit case not found." });
    await recordDepositResolutionLedger({ booking, refundAmount, deductionAmount, idempotencyKey: `deposit-admin-${booking._id}-${deposit._id}` });
    await Booking.findByIdAndUpdate(booking._id, { escrowStatus: refundAmount > 0 && deductionAmount > 0 ? "partially_released" : "refunded" });
    return res.json({ deposit });
  } catch (error) {
    return next(error);
  }
});

// Deposit Protection claims: lets a student who opted in at booking time file
// a claim against their deposit protection fee. This does NOT pay out real
// money -- it only creates a reviewable case (status "pending_review"),
// consistent with depositProtection.partnerStatus being
// "platform_backed_pending_partner" until a licensed insurance partner is
// integrated. Dual-mode (demo vs. DB-backed) like the rest of this route file.
router.post("/:id/deposit-protection/claim", protect, async (req, res, next) => {
  try {
    const reason = (req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required to file a deposit protection claim." });
    const evidence = Array.isArray(req.body.evidence) ? req.body.evidence : [];

    if (mongoose.connection.readyState !== 1) {
      const booking = bookings.find((item) => item.id === req.params.id) || bookings[0];
      if (!booking?.depositProtection?.optedIn) {
        return res.status(409).json({ message: "This booking did not opt in to Deposit Protection." });
      }
      const claim = { id: `DPC-${Date.now()}`, bookingId: req.params.id, reason, evidence, status: "pending_review", filedAt: new Date().toISOString() };
      return res.status(201).json({ claim, demo: true });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (String(booking.student) !== String(req.user._id || req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized for this booking." });
    }
    if (!booking.depositProtection?.optedIn) {
      return res.status(409).json({ message: "This booking did not opt in to Deposit Protection." });
    }

    const claim = { reason, evidence, status: "pending_review", filedAt: new Date() };
    booking.depositProtectionClaims = booking.depositProtectionClaims || [];
    booking.depositProtectionClaims.push(claim);
    await booking.save();
    await recordAudit(req, {
      action: "booking.deposit_protection_claim_filed",
      entityType: "Booking",
      entityId: booking._id,
      status: "pending",
      metadata: { reason, evidence }
    });
    const savedClaim = booking.depositProtectionClaims[booking.depositProtectionClaims.length - 1];
    return res.status(201).json({ claim: savedClaim, booking });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/payout", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ id: req.params.id, ownerPaidOut: true, demo: true });
    const booking = await Booking.findByIdAndUpdate(req.params.id, { ownerPaidOut: true, ownerPaidOutAt: new Date() }, { new: true });
    if (booking) await recordHostPayoutLedger({ booking, paymentRef: req.body.paymentRef || `payout-${Date.now()}`, idempotencyKey: `host-payout-${booking._id}-${Date.now()}` });
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/receipt", protect, async (req, res, next) => {
  try {
    const booking = mongoose.connection.readyState === 1 ? await Booking.findById(req.params.id) : bookings.find((item) => item.id === req.params.id) || bookings[0];
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const buffer = await buildReceiptPdf(booking);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=basera-${req.params.id}.pdf`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
