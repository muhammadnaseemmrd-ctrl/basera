// Pure rules for registering residents (single form and CSV bulk import). No DB access.
const clock = require("./clock");
const { phoneKey } = require("./hostelOpsRules");

const GENDERS = ["male", "female", "other"];
const BILLING_PLANS = ["monthly", "semester", "custom"];

const CSV_COLUMNS = [
  "name",
  "phone",
  "cnic",
  "email",
  "gender",
  "dob",
  "university",
  "homeAddress",
  "guardianName",
  "guardianRelation",
  "guardianPhone",
  "roomNumber",
  "bed",
  "monthlyRent",
  "securityDeposit",
  "depositCollected",
  "joinDate",
  "billingPlan"
];

const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}\n"Ali Raza",03001234567,35202-1234567-1,,male,2005-04-12,"NUST","House 1, Street 2, Lahore","Raza Khan",father,03007654321,A1,1,8000,10000,yes,2026-11-01,monthly\n`;

/** RFC-4180-ish CSV parser: quotes, escaped quotes, commas/newlines inside quotes, CRLF, BOM. */
function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/** CSV text → array of objects keyed by header (header names are case-insensitive). */
function csvToRecords(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { error: "The file is empty." };
  const header = rows[0].map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const missing = ["name", "phone", "roomnumber", "bed", "monthlyrent"].filter((c) => !lower.includes(c));
  if (missing.length) return { error: `Missing required column(s): ${missing.join(", ")}. Download the template.` };
  const canon = lower.map((h) => CSV_COLUMNS.find((c) => c.toLowerCase() === h) || null);
  const records = rows.slice(1).map((cells, i) => {
    const rec = { _line: i + 2 };
    canon.forEach((key, j) => {
      if (key) rec[key] = String(cells[j] ?? "").trim();
    });
    return rec;
  });
  return { records };
}

const yes = (v) => ["yes", "y", "true", "1"].includes(String(v || "").trim().toLowerCase());
const blank = (v) => v === undefined || v === null || String(v).trim() === "";
const asInt = (v) => (blank(v) ? undefined : Number(String(v).replace(/,/g, "")));

/**
 * Normalise + validate one resident (form body or CSV record).
 * Seat is identified by roomId+bedIndex (form, 0-based) or roomNumber+bed (CSV, 1-based).
 * @returns {{ value?: object, errors: string[] }}
 */
function validateResident(input = {}) {
  const errors = [];
  const name = String(input.name || "").trim();
  const phone = String(input.phone || "").trim();
  if (name.length < 2 || name.length > 80) errors.push("Name is required (2–80 characters).");
  if (phoneKey(phone).length < 10 || String(phone).replace(/\D/g, "").length > 13) errors.push("A valid phone number is required.");
  const cnic = String(input.cnic || "").trim();
  if (cnic && !/^\d{5}-?\d{7}-?\d$/.test(cnic)) errors.push("CNIC must be 13 digits (e.g. 35202-1234567-1).");
  const email = String(input.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email is not valid.");
  const gender = String(input.gender || "").trim().toLowerCase();
  if (gender && !GENDERS.includes(gender)) errors.push(`Gender must be one of: ${GENDERS.join(", ")}.`);
  const dob = blank(input.dob) ? null : clock.parseDay(input.dob);
  if (!blank(input.dob) && !dob) errors.push("Date of birth must be YYYY-MM-DD.");
  const joinDate = blank(input.joinDate) ? null : clock.parseDay(input.joinDate);
  if (!blank(input.joinDate) && !joinDate) errors.push("Join date must be YYYY-MM-DD.");
  const billingPlan = String(input.billingPlan || "monthly").trim().toLowerCase();
  if (!BILLING_PLANS.includes(billingPlan)) errors.push(`Billing plan must be one of: ${BILLING_PLANS.join(", ")}.`);

  const monthlyRent = asInt(input.monthlyRent);
  if (!Number.isInteger(monthlyRent) || monthlyRent < 0) errors.push("Monthly rent must be a whole number of rupees.");
  const securityDeposit = asInt(input.securityDeposit) ?? 0;
  if (!Number.isInteger(securityDeposit) || securityDeposit < 0) errors.push("Security deposit must be a whole number of rupees.");

  let bedIndex;
  if (input.bedIndex !== undefined && input.bedIndex !== "") bedIndex = Number(input.bedIndex);
  else if (!blank(input.bed)) bedIndex = Number(input.bed) - 1;
  if (!Number.isInteger(bedIndex) || bedIndex < 0) errors.push("Seat/bed number is required (beds start at 1).");
  if (!input.roomId && blank(input.roomNumber)) errors.push("Room is required.");

  const guardians = [];
  const g = Array.isArray(input.guardians) ? input.guardians : [{ name: input.guardianName, relation: input.guardianRelation, phone: input.guardianPhone }];
  g.forEach((x, i) => {
    if (blank(x?.phone) && blank(x?.name)) return;
    if (phoneKey(x.phone).length < 10) errors.push(`Guardian ${i + 1} needs a valid phone number.`);
    else guardians.push({ name: String(x.name || "").trim(), relation: String(x.relation || "guardian").trim(), phone: String(x.phone).trim() });
  });
  const url = (v) => (typeof v === "string" && /^https?:\/\//i.test(v) ? v : undefined);

  return {
    errors,
    value: errors.length
      ? undefined
      : {
          name,
          phone,
          phoneKey: phoneKey(phone),
          cnic: cnic || undefined,
          email: email || undefined,
          gender: gender || undefined,
          dob,
          university: String(input.university || "").trim() || undefined,
          employer: String(input.employer || "").trim() || undefined,
          homeAddress: String(input.homeAddress || "").trim() || undefined,
          guardians,
          emergencyContact: input.emergencyContact?.phone ? { name: input.emergencyContact.name, relationship: input.emergencyContact.relationship, phone: input.emergencyContact.phone } : guardians[0] ? { name: guardians[0].name, relationship: guardians[0].relation, phone: guardians[0].phone } : undefined,
          photoUrl: url(input.photoUrl),
          cnicDocUrl: url(input.cnicDocUrl),
          roomId: input.roomId,
          roomNumber: blank(input.roomNumber) ? undefined : String(input.roomNumber).trim(),
          bedIndex,
          monthlyRent,
          securityDeposit,
          depositCollected: typeof input.depositCollected === "boolean" ? input.depositCollected : yes(input.depositCollected),
          depositMethod: input.depositMethod || "cash",
          joinDate,
          billingPlan,
          login: Boolean(input.login)
        }
  };
}

/** Rows that repeat a phone or a seat inside the same file (first one wins). */
function inFileDuplicates(values) {
  const phones = new Map();
  const seats = new Map();
  const dupPhone = new Set();
  const dupSeat = new Set();
  values.forEach((v, i) => {
    if (!v) return;
    if (phones.has(v.phoneKey)) dupPhone.add(i);
    else phones.set(v.phoneKey, i);
    const seat = `${v.roomNumber || v.roomId}#${v.bedIndex}`;
    if (seats.has(seat)) dupSeat.add(i);
    else seats.set(seat, i);
  });
  return { dupPhone, dupSeat };
}

module.exports = { CSV_COLUMNS, CSV_TEMPLATE, parseCsv, csvToRecords, validateResident, inFileDuplicates, GENDERS, BILLING_PLANS };
