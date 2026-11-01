// The single source of "today" for hostel-operations business dates (fines, notice
// periods, offers, reminders). Asia/Karachi is UTC+5 all year (no DST), so calendar-day
// maths is done on a +5h-shifted epoch instead of relying on the host's timezone.
//
// Outside production QA can time-travel: CLOCK_OFFSET_DAYS (env) plus a runtime offset
// set via POST /api/v1/dev/clock. Both are ignored when NODE_ENV=production.

const DAY = 86400000;
const PKT_OFFSET = 5 * 3600000;

let runtimeOffsetMs = 0;

const isProduction = () => process.env.NODE_ENV === "production";

function offsetMs() {
  if (isProduction()) return 0;
  const envDays = Number(process.env.CLOCK_OFFSET_DAYS || 0);
  return (Number.isFinite(envDays) ? envDays * DAY : 0) + runtimeOffsetMs;
}

/** Current business time (a Date). */
function now() {
  return new Date(Date.now() + offsetMs());
}

/** Set the runtime offset (non-production only). Accepts days and/or extra ms. */
function setOffset({ days = 0, ms = 0 } = {}) {
  if (isProduction()) throw new Error("Clock control is disabled in production.");
  runtimeOffsetMs = Math.round(Number(days) * DAY + Number(ms));
  return clockInfo();
}

function clockInfo() {
  return { now: now().toISOString(), today: dayKey(now()), offsetMs: offsetMs(), envOffsetDays: Number(process.env.CLOCK_OFFSET_DAYS || 0), runtimeOffsetMs, production: isProduction() };
}

const toDate = (d) => (d instanceof Date ? d : new Date(d));

/** 00:00 Asia/Karachi of the calendar day containing `date`, as a UTC Date. */
function startOfDayKarachi(date = now()) {
  const t = toDate(date).getTime() + PKT_OFFSET;
  return new Date(Math.floor(t / DAY) * DAY - PKT_OFFSET);
}

/** { y, m (1-12), d, dow (0=Sun) } of `date` in Karachi. */
function karachiParts(date = now()) {
  const s = new Date(toDate(date).getTime() + PKT_OFFSET);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(), dow: s.getUTCDay() };
}

/** 00:00 Karachi on y-m-d (month 1-12). Day is clamped to the month's length. */
function karachiDate(y, m, d) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(Math.max(1, d), last)) - PKT_OFFSET);
}

/** Whole Karachi calendar days from a to b (negative if b is earlier). */
function daysBetween(a, b) {
  return Math.round((startOfDayKarachi(b).getTime() - startOfDayKarachi(a).getTime()) / DAY);
}

function addDays(date, n) {
  return new Date(toDate(date).getTime() + n * DAY);
}

/** "YYYY-MM-DD" in Karachi. */
function dayKey(date = now()) {
  const { y, m, d } = karachiParts(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "YYYY-MM" in Karachi. */
function monthKey(date = now()) {
  return dayKey(date).slice(0, 7);
}

/**
 * Parse a business day. "YYYY-MM-DD" is read as that Karachi calendar day (not UTC
 * midnight); anything else goes through Date and is snapped to its Karachi day.
 * Returns null for invalid input.
 */
function parseDay(value) {
  if (value === undefined || value === null || value === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = karachiDate(y, mo, d);
    return karachiParts(date).d === d ? date : null; // reject 2026-02-31
  }
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? null : startOfDayKarachi(date);
}

/** Due date (00:00 Karachi) for a "YYYY-MM" period and due day; clamps to month end. */
function dueDateFor(period, dueDayOfMonth) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ""));
  if (!m) return null;
  return karachiDate(Number(m[1]), Number(m[2]), Number(dueDayOfMonth));
}

module.exports = { DAY, now, setOffset, clockInfo, startOfDayKarachi, karachiParts, karachiDate, daysBetween, addDays, dayKey, monthKey, parseDay, dueDateFor };
