const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { bookings, rooms, hostels } = require("../data/mockData");
const { getOrSet, ttl } = require("./cacheService");
const { buildPdf, formatCurrency, receiptIdFor } = require("./pdfService");

const commissionRate = () => Number(process.env.COMMISSION_RATE_DEFAULT || 0.07);
const taxRate = () => Number(process.env.FBR_WITHHOLDING_TAX_RATE || 0.05);
const managementFee = () => Number(process.env.BASERA_MANAGEMENT_FEE_PKR || 1000);

const monthBounds = (month = new Date().getMonth() + 1, year = new Date().getFullYear()) => {
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
  return { start, end };
};

const demoHostBookings = () => bookings.filter((booking) => ["paid", "confirmed"].includes(booking.paymentStatus) || ["confirmed", "active", "completed"].includes(booking.status));

const calculatePL = async ({ hostId = "u-landlord", month, year } = {}) =>
  getOrSet(`finance:pl:${hostId}:${month || "now"}:${year || "now"}`, ttl.finance, async () => {
    const period = monthBounds(month, year);
    const rows = mongoose.connection.readyState === 1
      ? await Booking.find({ createdAt: { $gte: period.start, $lte: period.end } }).populate("room hostel").lean()
      : demoHostBookings();
    const grossRent = rows.reduce((sum, booking) => sum + Number(booking.totalRent || booking.totalAmount || 0), 0);
    const commission = rows.reduce((sum, booking) => sum + Number(booking.commission || Number(booking.totalRent || booking.totalAmount || 0) * commissionRate()), 0);
    const lateFeeIncome = rows.reduce((sum, booking) => sum + Number(booking.lateFee || 0), 0);
    const maintenanceExpenses = 8500;
    const saasSubscriptionFee = managementFee();
    const totalBeds = rooms.reduce((sum, room) => sum + Number(room.totalBeds || 0), 0) || 1;
    const vacantBeds = rooms.reduce((sum, room) => sum + Number(room.availableBeds || 0), 0);
    const occupancyRate = Math.round(((totalBeds - vacantBeds) / totalBeds) * 100);
    const vacantBedLoss = Math.round(vacantBeds * 18000 * 0.55);
    const netOperatingIncome = grossRent - commission - maintenanceExpenses - saasSubscriptionFee + lateFeeIncome;
    return {
      hostId,
      period: { month: Number(month || new Date().getMonth() + 1), year: Number(year || new Date().getFullYear()) },
      lines: {
        grossRentCollected: grossRent,
        platformCommissionPaid: Math.round(commission),
        saasSubscriptionFee,
        lateFeeIncome,
        maintenanceExpenses,
        netOperatingIncome,
        vacantBedLoss,
        occupancyRate,
        averageRevenuePerBed: Math.round(netOperatingIncome / totalBeds),
        yoyComparison: "+12%"
      },
      tax: {
        withholdingRate: taxRate(),
        estimatedAnnualLiability: Math.round(grossRent * 12 * taxRate()),
        quarterlyEstimate: Math.round(grossRent * 3 * taxRate()),
        disclaimer: "This is an estimate only. Consult your tax advisor for exact liability."
      }
    };
  });

const cashflowForecast = async ({ hostId = "u-landlord" } = {}) =>
  getOrSet(`finance:cashflow:${hostId}`, ttl.finance, async () => {
    const base = mongoose.connection.readyState === 1
      ? (await Booking.find({ status: { $in: ["confirmed", "active"] } }).lean()).reduce((sum, booking) => sum + Number(booking.totalRent || booking.totalAmount || 0), 0)
      : 118000;
    return {
      hostId,
      guaranteedIncome: base,
      projectedIncome: Math.round(base * 1.22),
      projection: [0, 1, 2].map((offset) => {
        const date = new Date();
        date.setMonth(date.getMonth() + offset);
        const guaranteed = Math.round(base * (1 - offset * 0.04));
        const projected = Math.round(guaranteed + base * (0.12 + offset * 0.03));
        return {
          month: date.toLocaleString("en-US", { month: "short" }),
          year: date.getFullYear(),
          guaranteed,
          projected,
          vacancyProbability: Math.round(18 + offset * 6)
        };
      })
    };
  });

const portfolioFinance = async ({ hostId = "u-landlord" } = {}) => {
  const properties = hostels.slice(0, 3).map((hostel, index) => ({
    hostelId: hostel.id,
    name: hostel.name,
    city: hostel.city,
    monthlyIncome: [72000, 48000, 36000][index] || 24000,
    occupancyRate: [92, 81, 76][index] || 70
  }));
  const totalIncome = properties.reduce((sum, item) => sum + item.monthlyIncome, 0);
  return {
    hostId,
    totalIncome,
    totalPortfolioOccupancy: Math.round(properties.reduce((sum, item) => sum + item.occupancyRate, 0) / properties.length),
    consolidatedPayout: Math.round(totalIncome * (1 - commissionRate())),
    properties: properties.map((item) => ({ ...item, contributionPercent: Math.round((item.monthlyIncome / totalIncome) * 100) }))
  };
};

const buildPLPdf = async ({ hostId, month, year }) => {
  const pl = await calculatePL({ hostId, month, year });
  const rows = [
    ["Period", `${pl.period.month}/${pl.period.year}`],
    ["Gross rent collected", formatCurrency(pl.lines.grossRentCollected)],
    ["Platform commission paid", formatCurrency(pl.lines.platformCommissionPaid)],
    ["SaaS subscription fee", formatCurrency(pl.lines.saasSubscriptionFee)],
    ["Late fee income", formatCurrency(pl.lines.lateFeeIncome)],
    ["Maintenance expenses", formatCurrency(pl.lines.maintenanceExpenses)],
    ["Net operating income", formatCurrency(pl.lines.netOperatingIncome)],
    ["Vacant bed loss", formatCurrency(pl.lines.vacantBedLoss)],
    ["Occupancy rate", `${pl.lines.occupancyRate}%`],
    ["Average revenue per bed", formatCurrency(pl.lines.averageRevenuePerBed)],
    ["Estimated annual withholding tax", formatCurrency(pl.tax.estimatedAnnualLiability)],
    ["Tax disclaimer", pl.tax.disclaimer]
  ];
  return buildPdf({
    title: "Host Smart Profit & Loss Statement",
    subtitle: "Monthly P&L and tax helper estimate",
    rows,
    receiptId: receiptIdFor("HH-PL", `${hostId}-${month || "m"}-${year || "y"}`)
  });
};

module.exports = { buildPLPdf, calculatePL, cashflowForecast, portfolioFinance, taxRate };
