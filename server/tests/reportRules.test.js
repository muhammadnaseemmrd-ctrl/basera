const test = require("node:test");
const assert = require("node:assert/strict");
const clock = require("../services/clock");
const R = require("../services/reportRules");

test("csv: BOM, CRLF, escaping and formula-injection guard", () => {
  const csv = R.toCsv([{ a: 'He said "hi", ok', b: "=HYPERLINK(1)", c: -500, d: clock.karachiDate(2026, 11, 5) }], [
    { label: "A", key: "a" },
    { label: "B", key: "b" },
    { label: "C", key: "c" },
    { label: "D", key: "d" }
  ]);
  assert.ok(csv.startsWith("﻿A,B,C,D\r\n"));
  assert.ok(csv.includes('"He said ""hi"", ok"'));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes(",-500,")); // negative numbers stay numbers
  assert.ok(csv.includes("2026-11-05"));
});

test("report range: inclusive Karachi days, defaults to this month, sane limits", () => {
  const r = R.reportRange("2026-11-01", "2026-11-30");
  assert.equal(r.fromKey, "2026-11-01");
  assert.equal(clock.dayKey(r.toExclusive), "2026-12-01");
  const d = R.reportRange(undefined, undefined, clock.karachiDate(2026, 11, 17));
  assert.equal(d.fromKey, "2026-11-01");
  assert.equal(d.toKey, "2026-11-17");
  assert.match(R.reportRange("2026-11-10", "2026-11-01").error, /before/);
  assert.match(R.reportRange("2025-01-01", "2026-11-01").error, /366/);
  assert.match(R.reportRange("bad", "2026-11-01").error, /YYYY/);
});

test("complaint turnaround and median", () => {
  assert.equal(R.turnaroundHours({ createdAt: "2026-11-01T00:00:00Z", resolvedAt: "2026-11-02T06:00:00Z" }), 30);
  assert.equal(R.turnaroundHours({ createdAt: "2026-11-01T00:00:00Z" }), null);
  assert.equal(R.median([5, 1, 3]), 3);
  assert.equal(R.median([4, 1, 3, 10]), 4); // (3+4)/2 rounded
  assert.equal(R.median([]), null);
});

test("profit = collections − expenses per month, newest first", () => {
  const rows = R.profitByMonth([{ month: "2026-10", total: 50000 }, { month: "2026-11", total: 80000 }], [{ month: "2026-11", total: 30000 }, { month: "2026-09", total: 1000 }]);
  assert.deepEqual(rows.map((r) => [r.month, r.profit]), [["2026-11", 50000], ["2026-10", 50000], ["2026-09", -1000]]);
});

test("expense and visitor validation", () => {
  assert.deepEqual(R.validateExpense({ category: "utilities", amount: 12000, note: "Electricity bill", spentOn: "2026-11-03" }), []);
  assert.equal(R.validateExpense({ category: "x", amount: 1.5 }).length, 3);
  assert.deepEqual(R.validateVisitor({ visitorName: "Uncle Rashid", cnicLast4: "1234", purpose: "Family visit" }), []);
  assert.equal(R.validateVisitor({ visitorName: "U", cnicLast4: "12345", purpose: "" }).length, 3);
});

test("seats owned are summed across rooms", () => {
  assert.equal(R.totalSeats([{ totalBeds: 2 }, { totalBeds: 3 }, {}]), 5);
});
