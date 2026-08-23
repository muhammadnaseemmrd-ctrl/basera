const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLeaveSettlement } = require('../services/refundPolicyService');

test('calculateLeaveSettlement prorates the unused portion of the current billing cycle', () => {
  const settlement = calculateLeaveSettlement({
    booking: { totalRent: 30000, securityDeposit: 15000, nextRentDueDate: '2026-08-01' },
    moveOutDate: '2026-07-16',
    now: new Date('2026-07-16')
  });
  assert.ok(settlement.unusedDays > 0);
  assert.equal(settlement.securityDeposit, 15000);
  assert.equal(settlement.estimatedTotalRefund, settlement.proratedRentRefund + 15000);
});

test('calculateLeaveSettlement returns zero unused days when moving out on the cycle end date', () => {
  const settlement = calculateLeaveSettlement({
    booking: { totalRent: 30000, securityDeposit: 0, nextRentDueDate: '2026-08-01' },
    moveOutDate: '2026-08-01',
    now: new Date('2026-07-01')
  });
  assert.equal(settlement.unusedDays, 0);
  assert.equal(settlement.proratedRentRefund, 0);
});

test('calculateLeaveSettlement falls back to a 30-day cycle when nextRentDueDate is missing', () => {
  const settlement = calculateLeaveSettlement({
    booking: { totalRent: 30000, securityDeposit: 0 },
    now: new Date('2026-07-01')
  });
  assert.equal(settlement.totalCycleDays, 30);
});
