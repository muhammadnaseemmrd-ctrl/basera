const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv, csvToRecords, validateResident, inFileDuplicates, CSV_TEMPLATE } = require("../services/residentRules");

test("csv: quotes, escaped quotes, embedded commas/newlines, CRLF and BOM", () => {
  const rows = parseCsv('﻿name,addr\r\n"Ali, Jr","said ""hi""\nthere"\r\nSara,x\r\n\r\n');
  assert.deepEqual(rows, [["name", "addr"], ["Ali, Jr", 'said "hi"\nthere'], ["Sara", "x"]]);
});

test("csv: header is case-insensitive; missing required columns are reported", () => {
  const ok = csvToRecords("NAME,Phone,roomNumber,BED,monthlyRent\nAli,03001234567,A1,1,8000\n");
  assert.equal(ok.records.length, 1);
  assert.equal(ok.records[0].roomNumber, "A1");
  assert.equal(ok.records[0]._line, 2);
  assert.match(csvToRecords("name,phone\nAli,0300\n").error, /roomnumber, bed, monthlyrent/);
  assert.match(csvToRecords("").error, /empty/);
});

test("csv: the downloadable template parses and validates cleanly", () => {
  const { records } = csvToRecords(CSV_TEMPLATE);
  const { errors, value } = validateResident(records[0]);
  assert.deepEqual(errors, []);
  assert.equal(value.bedIndex, 0); // CSV beds are 1-based
  assert.equal(value.depositCollected, true);
  assert.equal(value.guardians[0].relation, "father");
});

test("resident: required fields, whole-rupee money, formats", () => {
  const bad = validateResident({ name: "A", phone: "123", cnic: "12", email: "x@", monthlyRent: "8000.5", securityDeposit: -1, roomNumber: "A1", bed: 0, gender: "x", dob: "2026-02-31" });
  assert.ok(bad.errors.length >= 8, bad.errors.join(" | "));
  const good = validateResident({ name: "Ali Raza", phone: "0300-1234567", roomId: "r1", bedIndex: 1, monthlyRent: 8000, guardians: [{ name: "Dad", phone: "03007654321" }] });
  assert.deepEqual(good.errors, []);
  assert.equal(good.value.phoneKey, "3001234567");
  assert.equal(good.value.emergencyContact.phone, "03007654321");
  assert.equal(good.value.login, false); // login is opt-in
});

test("resident: only real hosted URLs are kept for photo / CNIC uploads", () => {
  const v = validateResident({ name: "Ali", phone: "03001234567", roomId: "r", bedIndex: 0, monthlyRent: 1, photoUrl: "demo-upload://x", cnicDocUrl: "https://res.cloudinary.com/x.pdf" }).value;
  assert.equal(v.photoUrl, undefined);
  assert.equal(v.cnicDocUrl, "https://res.cloudinary.com/x.pdf");
});

test("import: duplicate phone and duplicate seat inside one file are detected", () => {
  const v = (phone, room, bed) => validateResident({ name: "X Y", phone, roomNumber: room, bed, monthlyRent: 1 }).value;
  const { dupPhone, dupSeat } = inFileDuplicates([v("03001111111", "A1", 1), v("0300-1111111", "A1", 2), v("03002222222", "A1", 1)]);
  assert.deepEqual([...dupPhone], [1]);
  assert.deepEqual([...dupSeat], [2]);
});
