// Pure helpers for reports, exports, visitors, transfers and profit. No DB access.
const clock = require("./clock");

/** CSV (Excel-friendly: BOM, CRLF, quotes escaped, formula injection neutralised). */
function toCsv(rows, columns) {
  const cell = (v) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? clock.dayKey(v) : String(v);
    // a leading = + - @ would be run as a formula by Excel/Sheets
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(typeof c.value === "function" ? c.value(r) : r[c.key])).join(","));
  return `﻿${[head, ...body].join("\r\n")}\r\n`;
}

/**
 * Inclusive Karachi date range from "YYYY-MM-DD" strings; defaults to the current month.
 * Returns { from, toExclusive, fromKey, toKey } or { error }.
 */
function reportRange(fromStr, toStr, now = clock.now()) {
  const { y, m } = clock.karachiParts(now);
  const from = fromStr ? clock.parseDay(fromStr) : clock.karachiDate(y, m, 1);
  const to = toStr ? clock.parseDay(toStr) : clock.startOfDayKarachi(now);
  if (!from || !to) return { error: "from/to must be YYYY-MM-DD." };
  if (to < from) return { error: "to cannot be before from." };
  if (clock.daysBetween(from, to) > 366) return { error: "A report can cover at most 366 days." };
  return { from, toExclusive: clock.addDays(to, 1), fromKey: clock.dayKey(from), toKey: clock.dayKey(to) };
}

/** Hours from raised to resolved for resolved complaints; null when not resolved. */
function turnaroundHours(complaint) {
  if (!complaint.resolvedAt) return null;
  return Math.round((new Date(complaint.resolvedAt) - new Date(complaint.createdAt)) / 36e5);
}

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

/** Collections − expenses per month; months with only one side still appear. */
function profitByMonth(collections, expenses) {
  const months = new Map();
  const add = (list, key) =>
    list.forEach((r) => {
      const row = months.get(r.month) || { month: r.month, collections: 0, expenses: 0 };
      row[key] += r.total;
      months.set(r.month, row);
    });
  add(collections, "collections");
  add(expenses, "expenses");
  return [...months.values()].sort((a, b) => (a.month < b.month ? 1 : -1)).map((r) => ({ ...r, profit: r.collections - r.expenses }));
}

const EXPENSE_CATEGORIES = ["salaries", "utilities", "maintenance", "food", "supplies", "rent", "taxes", "marketing", "other"];

function validateExpense(b = {}) {
  const errors = [];
  if (!EXPENSE_CATEGORIES.includes(b.category)) errors.push(`Category must be one of: ${EXPENSE_CATEGORIES.join(", ")}.`);
  if (!Number.isInteger(b.amount) || b.amount <= 0) errors.push("Amount must be a positive whole number of rupees.");
  if (b.spentOn !== undefined && !clock.parseDay(b.spentOn)) errors.push("spentOn must be YYYY-MM-DD.");
  if (!String(b.note || b.description || "").trim()) errors.push("Describe the expense.");
  return errors;
}

function validateVisitor(b = {}) {
  const errors = [];
  const name = String(b.visitorName || "").trim();
  if (name.length < 2 || name.length > 80) errors.push("Visitor name is required (2–80 characters).");
  if (!/^\d{4}$/.test(String(b.cnicLast4 || ""))) errors.push("Enter the last 4 digits of the visitor's CNIC.");
  if (!String(b.purpose || "").trim()) errors.push("Purpose of visit is required.");
  return errors;
}

/** SaaS seats currently owned: sum of beds across rooms. */
const totalSeats = (rooms) => rooms.reduce((s, r) => s + (Number(r.totalBeds) || 0), 0);

module.exports = { toCsv, reportRange, turnaroundHours, median, profitByMonth, EXPENSE_CATEGORIES, validateExpense, validateVisitor, totalSeats };
