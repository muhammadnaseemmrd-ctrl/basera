const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDirections, nearestFacility } = require('../services/studentLifecycleService');

const islamabad = { lat: 33.6844, lng: 73.0479 };

test('nearestFacility finds a pharmacy near the given center', () => {
  const facility = nearestFacility({ center: islamabad, category: 'pharmacy' });
  assert.equal(facility.category, 'pharmacy');
});

test('resolveDirections uses the provided origin when geolocation coordinates are supplied', () => {
  const result = resolveDirections({ center: islamabad, category: 'hospital', originLat: 33.7, originLng: 73.05 });
  assert.equal(result.usedFallbackOrigin, false);
  assert.equal(result.origin.lat, 33.7);
  assert.match(result.directionsUrl, /google\.com\/maps\/dir/);
});

test('resolveDirections falls back to the center coordinate when no origin is supplied', () => {
  const result = resolveDirections({ center: islamabad, category: 'atm' });
  assert.equal(result.usedFallbackOrigin, true);
  assert.equal(result.origin.lat, islamabad.lat);
});
