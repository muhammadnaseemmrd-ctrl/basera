const express = require("express");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const { bookings, rooms } = require("../data/mockData");
const { buildPdf, formatCurrency, receiptIdFor } = require("../services/pdfService");

const router = express.Router();

const csv = (rows) => rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

const sendCsv = (res, rows, filename) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  return res.send(csv(rows));
};

const sendPdf = async (res, { title, subtitle, rows, filename, receiptId }) => {
  const buffer = await buildPdf({ title, subtitle, rows, receiptId });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  return res.send(buffer);
};

const loadBookings = async () => {
  if (mongoose.connection.readyState !== 1) return bookings;
  return Booking.find().populate("student hostel room").sort({ createdAt: -1 });
};

router.get("/commission", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const results = await loadBookings();
    const rows = results.map((booking) => [
      booking._id || booking.id,
      booking.hostel?.name || booking.hostel || "Basera property",
      booking.paymentStatus,
      Number(booking.totalRent || 0),
      Number(booking.commission || 0),
      Number(booking.ownerReceives || 0)
    ]);
    const header = ["Booking", "Property", "Payment Status", "Gross Rent", "Commission", "Host Payout"];
    const format = String(req.query.format || "json").toLowerCase();

    if (format === "csv") return sendCsv(res, [header, ...rows], "basera-commission-report.csv");
    if (format === "pdf") {
      const totalCommission = results.reduce((sum, booking) => sum + Number(booking.commission || 0), 0);
      return sendPdf(res, {
        title: "Commission Report",
        subtitle: "Admin finance export",
        rows: [
          ["Bookings", results.length],
          ["Total Commission", formatCurrency(totalCommission)],
          ...rows.slice(0, 20).map((row) => [row[0], `${row[1]} - ${formatCurrency(row[4])}`])
        ],
        filename: "basera-commission-report.pdf",
        receiptId: receiptIdFor("HH-ADM-COM", Date.now())
      });
    }

    return res.json({
      summary: {
        bookings: results.length,
        grossRent: results.reduce((sum, booking) => sum + Number(booking.totalRent || 0), 0),
        commission: results.reduce((sum, booking) => sum + Number(booking.commission || 0), 0),
        hostPayout: results.reduce((sum, booking) => sum + Number(booking.ownerReceives || 0), 0)
      },
      results: rows.map((row) => ({
        booking: row[0],
        property: row[1],
        paymentStatus: row[2],
        grossRent: row[3],
        commission: row[4],
        hostPayout: row[5]
      })),
      demo: mongoose.connection.readyState !== 1
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/overdue", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const results = (await loadBookings()).filter((booking) => booking.status === "overdue" || Number(booking.lateFee || 0) > 0);
    const rows = results.map((booking) => [
      booking._id || booking.id,
      booking.student?.name || booking.student || "Student",
      booking.hostel?.name || booking.hostel || "Basera property",
      Number(booking.totalRent || booking.totalAmount || 0),
      Number(booking.lateFee || 0),
      booking.nextRentDueDate || booking.checkIn
    ]);
    const header = ["Booking", "Student", "Property", "Rent", "Late Fee", "Due Date"];
    const format = String(req.query.format || "json").toLowerCase();

    if (format === "csv") return sendCsv(res, [header, ...rows], "basera-overdue-report.csv");
    if (format === "pdf") {
      return sendPdf(res, {
        title: "Overdue Bookings Report",
        subtitle: "Admin finance export",
        rows: [
          ["Overdue Bookings", results.length],
          ["Total Overdue Rent", formatCurrency(results.reduce((sum, booking) => sum + Number(booking.totalRent || booking.totalAmount || 0), 0))],
          ["Total Late Fees", formatCurrency(results.reduce((sum, booking) => sum + Number(booking.lateFee || 0), 0))],
          ...rows.slice(0, 20).map((row) => [row[0], `${row[1]} - ${formatCurrency(row[3])}`])
        ],
        filename: "basera-overdue-report.pdf",
        receiptId: receiptIdFor("HH-ADM-OD", Date.now())
      });
    }

    return res.json({
      summary: {
        overdueBookings: results.length,
        overdueRent: results.reduce((sum, booking) => sum + Number(booking.totalRent || booking.totalAmount || 0), 0),
        lateFees: results.reduce((sum, booking) => sum + Number(booking.lateFee || 0), 0)
      },
      results: rows.map((row) => ({ booking: row[0], student: row[1], property: row[2], rent: row[3], lateFee: row[4], dueDate: row[5] })),
      demo: mongoose.connection.readyState !== 1
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/city-performance", protect, authorize("admin", "finance"), async (req, res, next) => {
  try {
    const sourceRooms = mongoose.connection.readyState !== 1 ? rooms : await Room.find();
    const byCity = sourceRooms.reduce((acc, room) => {
      const city = room.city || "Unknown";
      acc[city] = acc[city] || { city, listings: 0, availableBeds: 0, averageRent: 0, totalRent: 0 };
      acc[city].listings += 1;
      acc[city].availableBeds += Number(room.availableBeds || 0);
      acc[city].totalRent += Number(room.pricePerBed || room.pricePerHead || 0);
      acc[city].averageRent = Math.round(acc[city].totalRent / acc[city].listings);
      return acc;
    }, {});
    return res.json({ results: Object.values(byCity), demo: mongoose.connection.readyState !== 1 });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
