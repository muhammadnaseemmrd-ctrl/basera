const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const { hostels, rooms, bookings, ownerDashboard, adminDashboard, users } = require("../data/mockData");
const User = require("../models/User");
const Hostel = require("../models/Hostel");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const Dispute = require("../models/Dispute");
const EscrowTransaction = require("../models/EscrowTransaction");
const Discount = require("../models/Discount");
const LoyaltyAccount = require("../models/LoyaltyAccount");
const LoyaltyClaim = require("../models/LoyaltyClaim");
const { calculateHostRisk, demoHostRisk } = require("../services/riskService");
const { summarizeLedger, recordHostManagementFeeLedger } = require("../services/ledgerService");
const { calculatePL, cashflowForecast, portfolioFinance } = require("../services/financeIntelligenceService");
const { getPlatformSettings, savePlatformSettings } = require("../services/platformSettingsService");
const { calculateMonthlyStudentCommission } = require("../services/studentLifecycleService");
const { demoLoyaltyAccount, demoLoyaltyClaims, demoPlatformSettings } = require("../data/demoRuntime");

const router = express.Router();

const demoStudent = () => users.find((u) => u.role === "student") || users[0];

const shapeStudentBooking = (booking) => {
  const hostel = hostels.find((h) => h.id === booking.hostel) || hostels[0];
  return {
    id: booking.id,
    hostelId: hostel.id,
    hostelName: hostel.name,
    roomId: booking.room,
    stayPeriod: `${booking.checkIn} (${booking.duration})`,
    amount: `PKR ${booking.totalAmount.toLocaleString("en-PK")}`,
    status: booking.status === "confirmed" ? "Confirmed" : booking.status,
    lifecycleStatus: booking.lifecycleStatus || "none",
    lifecycleReason: booking.lifecycleReason,
    plannedMoveOutDate: booking.plannedMoveOutDate,
    leaveSettlement: booking.leaveSettlement,
    monthlyPlatformFee: calculateMonthlyStudentCommission({ duration: booking.duration, status: booking.status, studentPlatformFee: demoPlatformSettings.studentMonthlyPlatformFeePkr })
  };
};

const shapeStudentBookingFromDoc = (booking, monthlyFeePkr) => {
  const source = booking.toObject ? booking.toObject() : booking;
  return {
    id: String(source._id),
    hostelId: String(source.hostel?._id || source.hostel || ""),
    hostelName: source.hostel?.name || "Hostel",
    roomId: String(source.room?._id || source.room || ""),
    stayPeriod: `${new Date(source.checkIn).toISOString().slice(0, 10)} (${source.duration})`,
    amount: `PKR ${Number(source.totalAmount || 0).toLocaleString("en-PK")}`,
    status: source.status === "confirmed" ? "Confirmed" : source.status,
    lifecycleStatus: source.lifecycleStatus || "none",
    lifecycleReason: source.lifecycleReason,
    plannedMoveOutDate: source.plannedMoveOutDate,
    leaveSettlement: source.leaveSettlement,
    monthlyPlatformFee: calculateMonthlyStudentCommission({ duration: source.duration, status: source.status, studentPlatformFee: monthlyFeePkr })
  };
};

const demoOwnerHostelIds = () => hostels.filter((hostel) => hostel.owner === "u-owner").map((hostel) => hostel.id);

const shapeOwnerTenant = (booking) => {
  const hostel = hostels.find((h) => h.id === booking.hostel) || hostels[0];
  const student = users.find((user) => user.id === booking.student) || users[0];
  const room = rooms.find((item) => item.id === booking.room) || rooms[0];
  return {
    id: booking.id,
    studentName: student.name,
    university: student.university || "NUST",
    hostelName: hostel.name,
    room: room.roomNumber,
    stayPeriod: `${booking.checkIn} (${booking.duration})`,
    amount: `PKR ${booking.totalAmount.toLocaleString("en-PK")}`,
    status: booking.status
  };
};

const protectOrDemoStudent = (req, res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (token) return protect(req, res, next);

  req.user = demoStudent();
  return next();
};

const hostPlanMeta = {
  STARTER: {
    label: "Starter",
    monthlyFee: 0,
    commissionRate: 7,
    features: ["Verified listing", "Escrow collection", "Basic support"]
  },
  PRO: {
    label: "Pro",
    monthlyFee: 4999,
    commissionRate: 5,
    features: ["Priority listing", "Risk monitoring", "Monthly payout statement", "Faster verification queue"]
  },
  PREMIUM: {
    label: "Premium",
    monthlyFee: 9999,
    commissionRate: 4,
    features: ["Featured placement", "Dedicated account review", "Bulk tenant messaging", "Advanced finance exports"]
  }
};

const shapeHostPlan = (tier = "STARTER", settings = demoPlatformSettings) => {
  const normalized = String(tier || "STARTER").toUpperCase();
  return {
    tier: normalized,
    ...(hostPlanMeta[normalized] || hostPlanMeta.STARTER),
    managementFeeMonthly: Number(settings.hostManagementMonthlyFee || 1000),
    managementFeeLabel: `PKR ${Number(settings.hostManagementMonthlyFee || 1000).toLocaleString("en-PK")}/month management system fee`
  };
};

const couponCodeForClaim = (claim, percent) => `LOYALTY${percent}-${String(claim._id || claim.id || Date.now()).slice(-5).toUpperCase()}`;

const shapeLoyaltyClaim = (claim) => {
  const source = claim.toObject ? claim.toObject() : claim;
  return {
    ...source,
    id: String(source._id || source.id),
    studentName: source.student?.name || source.studentName || "Student",
    studentEmail: source.student?.email || source.studentEmail
  };
};

router.get("/student", protect, (req, res) => {
  res.json({
    stats: { activeBookings: 1, savedHostels: 12, totalReviews: 4 },
    activeBooking: {
      hostel: hostels[0],
      roomType: "Premium Double",
      expiryDate: "2026-12-15",
      status: "Current Stay"
    },
    recentBookings: bookings.map(shapeStudentBooking)
  });
});

router.get("/student/bookings", protectOrDemoStudent, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const userId = req.user?._id || req.user?.id || "u-student";
      const items = bookings.filter((b) => b.student === userId).map(shapeStudentBooking);
      return res.json({ bookings: items });
    }
    const settings = await getPlatformSettings();
    const results = await Booking.find({ student: req.user._id || req.user.id }).populate("hostel room").sort({ createdAt: -1 });
    return res.json({ bookings: results.map((booking) => shapeStudentBookingFromDoc(booking, settings.studentMonthlyPlatformFeePkr)) });
  } catch (error) {
    return next(error);
  }
});

router.get("/student/saved", protectOrDemoStudent, (req, res) => {
  // Demo: return a stable shortlist. In real DB mode, this should come from user profile.
  res.json({ savedIds: ["h1", "h3"] });
});

router.get("/student/profile", protectOrDemoStudent, (req, res) => {
  const user = req.user || demoStudent();
  res.json({
    profile: {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      university: user.university,
      gender: user.gender,
      avatar: user.avatar,
      studentId: user.studentId,
      isVerified: user.isVerified,
      emergencyContact: user.emergencyContact || {},
      guardianConsent: user.guardianConsent || { required: false, accepted: false },
      verificationDocuments: user.verificationDocuments || [],
      occupantProfile: user.occupantProfile || { visibleToProspectiveRoommates: true }
    }
  });
});

router.put("/student/profile", protectOrDemoStudent, async (req, res, next) => {
  try {
    const user = req.user || demoStudent();
    const payload = req.body || {};

    if (mongoose.connection.readyState === 1 && user._id) {
      ["name", "phone", "city", "university", "gender", "avatar", "studentId"].forEach((field) => {
        if (payload[field] !== undefined) user[field] = payload[field];
      });
      if (payload.emergencyContact) user.emergencyContact = payload.emergencyContact;
      if (payload.guardianConsent) {
        user.guardianConsent = {
          ...user.guardianConsent,
          ...payload.guardianConsent,
          acceptedAt: payload.guardianConsent.accepted ? new Date() : user.guardianConsent?.acceptedAt
        };
      }
      if (payload.occupantProfile) {
        user.occupantProfile = { ...(user.occupantProfile?.toObject?.() || user.occupantProfile || {}), ...payload.occupantProfile };
      }
      await user.save();
    }

    res.json({
      saved: true,
      profile: {
        id: user._id || user.id,
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        phone: payload.phone ?? user.phone,
        city: payload.city ?? user.city,
        university: payload.university ?? user.university,
        gender: payload.gender ?? user.gender,
        avatar: payload.avatar ?? user.avatar,
        studentId: payload.studentId ?? user.studentId,
        isVerified: user.isVerified,
        emergencyContact: payload.emergencyContact ?? user.emergencyContact ?? {},
        guardianConsent: payload.guardianConsent ?? user.guardianConsent ?? { required: false, accepted: false },
        verificationDocuments: user.verificationDocuments || [],
        occupantProfile: payload.occupantProfile
          ? { ...(user.occupantProfile?.toObject?.() || user.occupantProfile || {}), ...payload.occupantProfile }
          : user.occupantProfile || { visibleToProspectiveRoommates: true }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/student/verification-documents", protectOrDemoStudent, async (req, res, next) => {
  try {
    const document = {
      type: req.body.type,
      url: req.body.url,
      originalName: req.body.originalName,
      status: "pending",
      uploadedAt: new Date()
    };

    if (!["cnic", "university_id"].includes(document.type) || !document.url) {
      return res.status(400).json({ message: "Valid document type and URL are required." });
    }

    if (mongoose.connection.readyState === 1 && req.user?._id) {
      req.user.verificationDocuments = [
        ...(req.user.verificationDocuments || []).filter((item) => item.type !== document.type),
        document
      ];
      req.user.isVerified = false;
      await req.user.save();
    }

    return res.status(201).json({ document, verificationStatus: "pending", demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/owner", protect, authorize("host", "admin"), (req, res) => {
  res.json(ownerDashboard);
});

router.get("/owner/rooms", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: rooms });
    const ownerHostels = await Hostel.find({ owner: req.user._id || req.user.id }).select("_id");
    const results = await Room.find({ hostel: { $in: ownerHostels.map((hostel) => hostel._id) } }).sort({ roomNumber: 1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/owner/tenants", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: bookings.filter((booking) => demoOwnerHostelIds().includes(booking.hostel)).map(shapeOwnerTenant)
      });
    }

    const ownerHostels = await Hostel.find({ owner: req.user._id || req.user.id }).select("_id name");
    const results = await Booking.find({ hostel: { $in: ownerHostels.map((hostel) => hostel._id) } })
      .populate("student", "name university isVerified")
      .populate("hostel", "name")
      .populate("room", "roomNumber")
      .sort({ createdAt: -1 });

    return res.json({
      results: results.map((booking) => ({
        id: booking._id,
        studentName: booking.student?.name || "Student",
        university: booking.student?.university || "Unknown",
        hostelName: booking.hostel?.name || "Hostel",
        room: booking.room?.roomNumber || "-",
        stayPeriod: `${booking.checkIn?.toISOString?.().slice(0, 10)} (${booking.duration})`,
        amount: `PKR ${booking.totalAmount.toLocaleString("en-PK")}`,
        status: booking.status,
        verifiedStudent: Boolean(booking.student?.isVerified)
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/owner/reports", protect, authorize("host", "admin"), (req, res) => {
  const paid = ownerDashboard.payments.filter((payment) => payment.status === "Paid");
  const pending = ownerDashboard.payments.filter((payment) => payment.status !== "Paid");
  res.json({
    revenue: ownerDashboard.revenue,
    occupancyRate: ownerDashboard.occupancyRate,
    pendingPayouts: pending.length,
    receivedPayments: paid.length,
    exportReady: true,
    summary: "Monthly report can be exported as PDF/Excel from the Host dashboard."
  });
});

router.post("/owner/bulk-message", protect, authorize("host", "admin"), (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ message: "Message is required." });
  res.status(201).json({
    queued: true,
    recipients: 42,
    message,
    channel: req.body.channel || "in-app"
  });
});

router.get("/host", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const hostRooms = rooms.filter((room) => room.listedBy === "u-landlord" || room.hostel === "h1");
      return res.json({
        stats: {
          rooms: hostRooms.length,
          occupiedBeds: hostRooms.reduce((sum, room) => sum + Number(room.totalBeds - room.availableBeds), 0),
          vacantBeds: hostRooms.reduce((sum, room) => sum + Number(room.availableBeds), 0),
          monthlyEarnings: 118000,
          overdueTenants: 1
        },
        rooms: hostRooms,
        finance: {
          grossRent: 118000,
          commissionDeducted: 8260,
          netEarnings: 109740,
          escrowHeld: 47000,
          payoutPending: 109740
        },
        overdue: [{ tenant: "Danish Raza", room: "ST-2", amount: "PKR 42,000", daysOverdue: 3 }]
      });
    }

    const hostRooms = await Room.find({ listedBy: req.user._id || req.user.id }).sort({ createdAt: -1 });
    const hostBookings = await Booking.find({ room: { $in: hostRooms.map((room) => room._id) } }).populate("student room").sort({ createdAt: -1 });
    return res.json({
      stats: {
        rooms: hostRooms.length,
        occupiedBeds: hostRooms.reduce((sum, room) => sum + Number(room.totalBeds - room.availableBeds), 0),
        vacantBeds: hostRooms.reduce((sum, room) => sum + Number(room.availableBeds), 0),
        monthlyEarnings: hostBookings.reduce((sum, booking) => sum + Number(booking.ownerReceives || 0), 0),
        overdueTenants: hostBookings.filter((booking) => booking.status === "overdue").length
      },
      rooms: hostRooms,
      bookings: hostBookings
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/plan", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        plan: shapeHostPlan("PRO", settings),
        billingStatus: "demo-active",
        nextInvoiceAt: "2026-07-01",
        demo: true
      });
    }

    const user = await User.findById(req.user._id || req.user.id).select("hostProfile landlordProfile");
    const tier = user?.hostProfile?.saasPlan?.tier || user?.landlordProfile?.saasPlan?.tier || "STARTER";
    return res.json({
      plan: shapeHostPlan(tier, settings),
      billingStatus: user?.hostProfile?.saasPlan?.billingStatus || user?.landlordProfile?.saasPlan?.billingStatus || "trial",
      nextInvoiceAt: user?.hostProfile?.saasPlan?.nextInvoiceAt || user?.landlordProfile?.saasPlan?.nextInvoiceAt || null
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/host/plan", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const tier = String(req.body.tier || "STARTER").toUpperCase();
    if (!hostPlanMeta[tier]) return res.status(400).json({ message: "Unknown plan tier." });
    if (mongoose.connection.readyState !== 1) return res.json({ plan: shapeHostPlan(tier, settings), billingStatus: "demo-active", demo: true });

    const path = req.user.landlordProfile ? "landlordProfile.saasPlan" : "hostProfile.saasPlan";
    const user = await User.findByIdAndUpdate(
      req.user._id || req.user.id,
      {
        [path]: {
          tier,
          billingStatus: "active",
          startedAt: new Date(),
          nextInvoiceAt: tier === "STARTER" ? null : new Date(new Date().setMonth(new Date().getMonth() + 1))
        }
      },
      { new: true }
    ).select("hostProfile landlordProfile");
    const savedTier = user?.hostProfile?.saasPlan?.tier || user?.landlordProfile?.saasPlan?.tier || tier;
    return res.json({ plan: shapeHostPlan(savedTier, settings), billingStatus: "active" });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/risk", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    const risk = await calculateHostRisk(req.user._id || req.user.id || "u-landlord");
    return res.json({ risk });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/cashflow-forecast", protect, authorize("host", "owner", "landlord", "admin", "finance"), async (req, res, next) => {
  try {
    const forecast = await cashflowForecast({ hostId: req.user._id || req.user.id || "u-landlord" });
    return res.json({ forecast, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/pl-statement", protect, authorize("host", "owner", "landlord", "admin", "finance"), async (req, res, next) => {
  try {
    const statement = await calculatePL({
      hostId: req.user._id || req.user.id || "u-landlord",
      month: req.query.month,
      year: req.query.year
    });
    return res.json({ statement, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/portfolio-finance", protect, authorize("host", "owner", "landlord", "admin", "finance"), async (req, res, next) => {
  try {
    const portfolio = await portfolioFinance({ hostId: req.user._id || req.user.id || "u-landlord" });
    return res.json({ portfolio, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/tenants", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: [
          { id: "t1", tenant: "Noor Fatima", room: "PG-1", rentStatus: "PAID", dueDate: "2026-07-01", amount: "PKR 32,000", lifecycleStatus: "none" },
          { id: "t2", tenant: "Danish Raza", room: "ST-2", rentStatus: "OVERDUE", dueDate: "2026-06-01", amount: "PKR 42,000", lifecycleStatus: "leave_requested", lifecycleReason: "Relocating closer to campus", plannedMoveOutDate: "2026-07-31" }
        ]
      });
    }
    const hostRooms = await Room.find({ listedBy: req.user._id || req.user.id }).select("_id");
    const results = await Booking.find({ room: { $in: hostRooms.map((room) => room._id) } }).populate("student room switchTargetRoom").sort({ nextRentDueDate: 1 });
    return res.json({
      results: results.map((booking) => ({
        id: booking._id,
        tenant: booking.student?.name || "Student",
        room: booking.room?.title || booking.room?.roomNumber || "Room",
        rentStatus: booking.paymentStatus === "paid" ? "PAID" : booking.status === "overdue" ? "OVERDUE" : "PENDING",
        dueDate: booking.nextRentDueDate,
        amount: `PKR ${Number(booking.totalRent || booking.totalAmount).toLocaleString("en-PK")}`,
        lifecycleStatus: booking.lifecycleStatus || "none",
        lifecycleReason: booking.lifecycleReason,
        plannedMoveOutDate: booking.plannedMoveOutDate,
        switchTargetRoomTitle: booking.switchTargetRoom?.title || booking.switchTargetRoom?.roomNumber
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/host/finance", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        summary: { grossRent: 118000, commissionDeducted: 8260, netEarnings: 109740, escrowHeld: 47000, payoutPending: 109740 },
        payouts: [
          { id: "p1", tenant: "Noor Fatima", rentCollected: "PKR 32,000", commission: "PKR 2,240", netPayout: "PKR 29,760", status: "Released" },
          { id: "p2", tenant: "Danish Raza", rentCollected: "PKR 42,000", commission: "PKR 3,360", netPayout: "PKR 38,640", status: "Held in escrow" }
        ]
      });
    }
    const hostRooms = await Room.find({ listedBy: req.user._id || req.user.id }).select("_id");
    const bookings = await Booking.find({ room: { $in: hostRooms.map((room) => room._id) } }).sort({ createdAt: -1 });
    const escrows = await EscrowTransaction.find({ bookingId: { $in: bookings.map((booking) => booking._id) } }).sort({ createdAt: -1 });
    return res.json({
      summary: {
        grossRent: bookings.reduce((sum, booking) => sum + Number(booking.totalRent || 0), 0),
        commissionDeducted: bookings.reduce((sum, booking) => sum + Number(booking.commission || 0), 0),
        netEarnings: bookings.reduce((sum, booking) => sum + Number(booking.ownerReceives || 0), 0),
        escrowHeld: escrows.filter((escrow) => escrow.status === "HELD").reduce((sum, escrow) => sum + Number(escrow.totalAmount || 0), 0),
        payoutPending: escrows.filter((escrow) => escrow.status === "HELD").reduce((sum, escrow) => sum + Number(escrow.hostPayoutAmount || 0), 0)
      },
      payouts: escrows
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/landlord", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const landlordRooms = rooms.filter((room) => room.listedBy === "u-landlord");
      return res.json({
        stats: {
          rooms: landlordRooms.length,
          activeRooms: landlordRooms.filter((room) => room.status === "ACTIVE").length,
          pendingRequests: 3,
          monthlyEarnings: 118000
        },
        rooms: landlordRooms,
        requests: [
          { id: "b-landlord-1", tenant: "Noor Fatima", room: "Family PG Room with Breakfast", dates: "Jul 01 - Dec 31", status: "pending" },
          { id: "b-landlord-2", tenant: "Danish Raza", room: "Self-Contained Studio for Professional", dates: "Jun 15 - Sep 15", status: "pending" }
        ],
        earnings: [
          { month: "April", amount: 86000 },
          { month: "May", amount: 118000 },
          { month: "June", amount: 124000 }
        ],
        verificationTier: "Identity Verified"
      });
    }

    const landlordRooms = await Room.find({ listedBy: req.user._id || req.user.id }).sort({ createdAt: -1 });
    const landlordBookings = await Booking.find({ room: { $in: landlordRooms.map((room) => room._id) } })
      .populate("student", "name university isVerified")
      .populate("room", "title roomNumber pricePerHead")
      .sort({ createdAt: -1 });

    return res.json({
      stats: {
        rooms: landlordRooms.length,
        activeRooms: landlordRooms.filter((room) => room.status === "ACTIVE").length,
        pendingRequests: landlordBookings.filter((booking) => booking.status === "pending").length,
        monthlyEarnings: landlordBookings.reduce((sum, booking) => sum + Number(booking.ownerReceives || 0), 0)
      },
      rooms: landlordRooms,
      requests: landlordBookings.slice(0, 8).map((booking) => ({
        id: booking._id,
        tenant: booking.student?.name || "Tenant",
        room: booking.room?.title || booking.room?.roomNumber || "Room",
        dates: `${booking.moveInDate?.toISOString?.().slice(0, 10) || booking.checkIn?.toISOString?.().slice(0, 10)} - ${booking.moveOutDate?.toISOString?.().slice(0, 10) || "Rolling"}`,
        status: booking.status
      })),
      earnings: [],
      verificationTier: req.user.landlordProfile?.verificationTier || "unverified"
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/landlord/ledger", protect, authorize("host", "admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: [
          { bookingId: "b1", tenant: "Noor Fatima", room: "PG-1", month: "June 2026", rent: "PKR 32,000", status: "Paid", receipt: "HH-PG-001" },
          { bookingId: "b1", tenant: "Danish Raza", room: "ST-2", month: "June 2026", rent: "PKR 42,000", status: "Pending", receipt: "HH-ST-002" },
          { bookingId: "b1", tenant: "Bilal Khan", room: "FL-1", month: "June 2026", rent: "PKR 68,000", status: "Paid", receipt: "HH-FL-003" }
        ]
      });
    }

    const landlordRooms = await Room.find({ listedBy: req.user._id || req.user.id }).select("_id");
    const bookings = await Booking.find({ room: { $in: landlordRooms.map((room) => room._id) } })
      .populate("student", "name")
      .populate("room", "roomNumber title")
      .sort({ createdAt: -1 });

    return res.json({
      results: bookings.map((booking) => ({
        tenant: booking.student?.name || "Tenant",
        room: booking.room?.roomNumber || booking.room?.title || "Room",
        month: booking.checkIn?.toLocaleString?.("en-US", { month: "long", year: "numeric" }) || "Current",
        rent: `PKR ${Number(booking.ownerReceives || 0).toLocaleString("en-PK")}`,
        status: booking.paymentStatus === "paid" ? "Paid" : "Pending",
        bookingId: booking._id,
        receipt: booking.receiptUrl || booking._id
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json(adminDashboard);

    const [totalUsers, verifiedHostels, pendingHostels] = await Promise.all([
      User.countDocuments(),
      Hostel.countDocuments({ isVerified: true }),
      Hostel.find({ status: "pending" }).sort({ createdAt: -1 }).limit(5)
    ]);

    return res.json({
      ...adminDashboard,
      stats: [
        { label: "Total Users", value: totalUsers.toLocaleString("en-PK"), trend: "+12%" },
        { label: "Verified Hostels", value: verifiedHostels.toLocaleString("en-PK"), trend: "+5%" },
        ...adminDashboard.stats.slice(2)
      ],
      verificationQueue: pendingHostels.map((hostel) => ({
        hostelId: hostel._id.toString(),
        name: hostel.name,
        city: `${hostel.city}, Pakistan`,
        units: `${hostel.availabilityLeft || 0} Beds Left`,
        plan: hostel.isFeatured ? "Premium" : "Standard",
        image: hostel.images?.[0]?.url || hostels[0].images[0],
        verificationStatus: hostel.ownerVerification?.status || "pending",
        documentsUploaded: [
          hostel.ownerVerification?.identityDocument?.url,
          hostel.ownerVerification?.propertyDocument?.url,
          hostel.ownerVerification?.licenseDocument?.url
        ].filter(Boolean).length,
        documents: [
          hostel.ownerVerification?.identityDocument,
          hostel.ownerVerification?.propertyDocument,
          hostel.ownerVerification?.licenseDocument
        ]
          .filter((document) => document?.url)
          .map((document) => ({
            label: document.label,
            type: document.type,
            url: document.url,
            originalName: document.originalName
          })),
        documentsRequired: 2,
        agreementAccepted: Boolean(hostel.ownerVerification?.agreement?.accepted),
        signedBy: hostel.ownerVerification?.agreement?.signedBy
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/risk", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: users
          .filter((user) => ["host", "owner", "landlord"].includes(user.role))
          .map((user) => demoHostRisk(user.id)),
        demo: true
      });
    }

    const hosts = await User.find({ role: { $in: ["host", "owner", "landlord", "property_manager"] } }).select("_id name role");
    const results = await Promise.all(hosts.map((host) => calculateHostRisk(host._id)));
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/users", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          isBanned: false
        }))
      });
    }

    const results = await User.find().select("-password").sort({ createdAt: -1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/users/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ user: { id: req.params.id, ...req.body }, demo: true });
    }

    const updates = {};
    ["role", "isVerified", "isBanned"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/disputes", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: adminDashboard.disputes.map((item) => ({
          ...item,
          status: item.status,
          priority: item.priority.toLowerCase().includes("high") ? "high" : "medium"
        }))
      });
    }

    const results = await Dispute.find().populate("student owner hostel", "name email").sort({ createdAt: -1 }).limit(100);
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/disputes", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (!req.body.title) return res.status(400).json({ message: "Title is required." });
    if (mongoose.connection.readyState !== 1) {
      return res.status(201).json({ dispute: { id: `DIS-${Date.now()}`, ...req.body, status: "open" }, demo: true });
    }

    const dispute = await Dispute.create({ ...req.body, openedBy: req.user._id || req.user.id });
    return res.status(201).json({ dispute });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/disputes/:id", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ dispute: { id: req.params.id, ...req.body }, demo: true });
    const dispute = await Dispute.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dispute) return res.status(404).json({ message: "Dispute not found." });
    return res.json({ dispute });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/payouts", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ results: adminDashboard.payouts });
    const results = await Booking.find({ paymentStatus: "paid", ownerPaidOut: false })
      .populate("hostel", "name owner")
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({
      results: results.map((booking) => ({
        id: booking._id,
        recipient: booking.hostel?.name || "Hostel Host",
        amount: booking.ownerReceives,
        bookingId: booking._id,
        status: "pending"
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/finance", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const reconciliation = await summarizeLedger();
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        summary: {
          gmv: 1248000,
          commissionEarned: 87360,
          managementFeeRevenue: demoPlatformSettings.hostManagementMonthlyFee,
          escrowBalance: 214000,
          payoutQueue: 109740,
          disputeEscrow: 47000,
          overdueAmount: 64000
        },
        byCity: [
          { city: "Islamabad", gmv: 648000, commission: 45360 },
          { city: "Lahore", gmv: 382000, commission: 26740 },
          { city: "Karachi", gmv: 218000, commission: 15260 }
        ],
        overdue: [
          { bookingId: "HH-OD-1", tenant: "Danish Raza", host: "Sara Malik", amount: "PKR 42,000", days: 3 }
        ],
        reconciliation,
        demo: true
      });
    }
    const bookings = await Booking.find();
    const escrows = await EscrowTransaction.find();
    return res.json({
      summary: {
        gmv: bookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0),
        commissionEarned: bookings.reduce((sum, booking) => sum + Number(booking.commission || 0), 0),
        managementFeeRevenue: Math.abs(Number(reconciliation.balances?.platform_management_fee || 0)),
        escrowBalance: escrows.filter((escrow) => escrow.status === "HELD").reduce((sum, escrow) => sum + Number(escrow.totalAmount || 0), 0),
        payoutQueue: escrows.filter((escrow) => escrow.status === "HELD").reduce((sum, escrow) => sum + Number(escrow.hostPayoutAmount || 0), 0),
        disputeEscrow: escrows.filter((escrow) => escrow.status === "DISPUTED").reduce((sum, escrow) => sum + Number(escrow.totalAmount || 0), 0),
        overdueAmount: bookings.filter((booking) => booking.status === "overdue").reduce((sum, booking) => sum + Number(booking.totalRent || 0), 0)
      },
      escrows,
      reconciliation
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/discounts", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        results: [
          { id: "disc-semester", name: "Semester Start Special", type: "SEASONAL", value: "10%", status: "ACTIVE", usageCount: 42 },
          { id: "disc-referral", name: "Referral Code HH-2026", type: "COUPON_CODE", value: "PKR 500", status: "ACTIVE", usageCount: 18 }
        ],
        demo: true
      });
    }
    const results = await Discount.find().sort({ createdAt: -1 });
    return res.json({ results });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/loyalty-claims", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ results: demoLoyaltyClaims.map(shapeLoyaltyClaim), demo: true });
    }
    const results = await LoyaltyClaim.find()
      .populate("student", "name email")
      .populate("approvedBy", "name email")
      .sort({ status: 1, createdAt: -1 })
      .limit(100);
    return res.json({ results: results.map(shapeLoyaltyClaim) });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/loyalty-claims/:id/approve", protect, authorize("admin"), async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const percent = Math.min(
      Number(settings.loyaltyDiscountMax || 10),
      Math.max(Number(settings.loyaltyDiscountMin || 5), Number(req.body.discountPercent || settings.loyaltyDiscountMin || 5))
    );

    if (mongoose.connection.readyState !== 1) {
      const claim = demoLoyaltyClaims.find((item) => item.id === req.params.id) || demoLoyaltyClaims[0];
      const couponCode = couponCodeForClaim(claim, percent);
      Object.assign(claim, {
        status: "approved",
        approvedDiscountPercent: percent,
        couponCode,
        adminNote: req.body.adminNote || "Approved for next room booking.",
        approvedBy: req.user.id,
        approvedAt: new Date().toISOString()
      });
      return res.json({ claim: shapeLoyaltyClaim(claim), demo: true });
    }

    const claim = await LoyaltyClaim.findById(req.params.id).populate("student", "name email");
    if (!claim) return res.status(404).json({ message: "Loyalty claim not found." });
    if (claim.status !== "pending") return res.status(409).json({ message: "Only pending loyalty claims can be approved." });

    const couponCode = couponCodeForClaim(claim, percent);
    const discount = await Discount.create({
      name: `Loyalty ${percent}% room booking discount`,
      type: "LOYALTY",
      valueType: "PERCENTAGE",
      value: percent,
      couponCode,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      usageLimit: 1,
      canStack: false,
      fundedBy: "BASERA",
      status: "ACTIVE"
    });

    claim.status = "approved";
    claim.approvedDiscountPercent = percent;
    claim.couponCode = couponCode;
    claim.discount = discount._id;
    claim.adminNote = req.body.adminNote || "Approved for next room booking.";
    claim.approvedBy = req.user._id || req.user.id;
    claim.approvedAt = new Date();
    claim.expiresAt = discount.validTo;
    await claim.save();
    return res.json({ claim: shapeLoyaltyClaim(claim), discount });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/loyalty-claims/:id/reject", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const claim = demoLoyaltyClaims.find((item) => item.id === req.params.id) || demoLoyaltyClaims[0];
      if (claim.status === "pending") {
        demoLoyaltyAccount.pointsBalance += Number(claim.requestedPoints || demoPlatformSettings.loyaltyClaimThreshold);
        demoLoyaltyAccount.pointsRedeemed = Math.max(0, demoLoyaltyAccount.pointsRedeemed - Number(claim.requestedPoints || 0));
      }
      Object.assign(claim, { status: "rejected", adminNote: req.body.adminNote || "Rejected by admin." });
      return res.json({ claim: shapeLoyaltyClaim(claim), demo: true });
    }

    const claim = await LoyaltyClaim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Loyalty claim not found." });
    if (claim.status === "pending") {
      await LoyaltyAccount.findOneAndUpdate(
        { student: claim.student },
        { $inc: { pointsBalance: Number(claim.requestedPoints || 0), pointsRedeemed: -Number(claim.requestedPoints || 0) } }
      );
    }
    claim.status = "rejected";
    claim.adminNote = req.body.adminNote || "Rejected by admin.";
    await claim.save();
    return res.json({ claim: shapeLoyaltyClaim(claim) });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/platform-settings", protect, authorize("admin"), async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    return res.json({ settings, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.put("/admin/platform-settings", protect, authorize("admin"), async (req, res, next) => {
  try {
    const settings = await savePlatformSettings(req.body, req.user);
    return res.json({ settings, demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/management-fees/invoice", protect, authorize("admin"), async (req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    const amount = Number(req.body.amount || settings.hostManagementMonthlyFee || 1000);
    const period = req.body.period || new Date().toISOString().slice(0, 7);
    if (amount <= 0) return res.status(400).json({ message: "Management fee amount must be greater than zero." });

    if (mongoose.connection.readyState !== 1) {
      const host = users.find((user) => user.id === req.body.hostId) || users.find((user) => ["host", "owner", "landlord"].includes(user.role));
      const ledger = await recordHostManagementFeeLedger({ host, amount, period, paymentRef: req.body.paymentRef || `MGMT-${Date.now()}` });
      return res.status(201).json({
        invoice: {
          id: `MGMT-${Date.now()}`,
          hostId: host?.id || req.body.hostId || "u-owner",
          hostName: host?.name || req.body.hostName || "Host",
          amount,
          period,
          status: "issued"
        },
        ledger,
        demo: true
      });
    }

    const host = req.body.hostId ? await User.findById(req.body.hostId).select("name email role") : null;
    const ledger = await recordHostManagementFeeLedger({
      host: host || { id: req.body.hostId, name: req.body.hostName },
      amount,
      period,
      paymentRef: req.body.paymentRef || `MGMT-${Date.now()}`
    });
    return res.status(201).json({
      invoice: {
        hostId: host?._id || req.body.hostId,
        hostName: host?.name || req.body.hostName || "Host",
        amount,
        period,
        status: "issued"
      },
      ledger
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/payouts/batch", protect, authorize("admin"), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ processed: true, count: adminDashboard.payouts.length, demo: true });
    }

    const ids = req.body.bookingIds || [];
    const result = await Booking.updateMany({ _id: { $in: ids } }, { ownerPaidOut: true, ownerPaidOutAt: new Date() });
    return res.json({ processed: true, count: result.modifiedCount });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
