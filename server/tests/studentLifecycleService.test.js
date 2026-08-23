const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDirectionsUrl, calculateMonthlyStudentCommission, getLifecycleLabel } = require('../services/studentLifecycleService');

test('buildDirectionsUrl returns Google Maps directions for a pharmacy destination', () => {
  const url = buildDirectionsUrl({
    originLat: 33.6844,
    originLng: 73.0479,
    destinationLat: 33.6862,
    destinationLng: 73.0521,
    destinationName: 'City Pharmacy'
  });

  assert.match(url, /google\.com\/maps\/dir/);
  assert.match(url, /33\.6844/);
  assert.match(url, /City%20Pharmacy/);
});

test('calculateMonthlyStudentCommission charges the monthly platform fee for active monthly bookings', () => {
  const fee = calculateMonthlyStudentCommission({ duration: 'monthly', status: 'active', studentPlatformFee: 0 });
  assert.equal(fee, 200);
});

test('calculateMonthlyStudentCommission skips the fee for non-monthly stays or inactive bookings', () => {
  assert.equal(calculateMonthlyStudentCommission({ duration: 'semester', status: 'active', studentPlatformFee: 0 }), 0);
  assert.equal(calculateMonthlyStudentCommission({ duration: 'monthly', status: 'cancelled', studentPlatformFee: 0 }), 0);
});

test('getLifecycleLabel maps switch and leave requests into human-readable states', () => {
  assert.equal(getLifecycleLabel('switch_requested'), 'Switch requested');
  assert.equal(getLifecycleLabel('leave_requested'), 'Leave requested');
});
