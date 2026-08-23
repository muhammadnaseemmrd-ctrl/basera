const test = require('node:test');
const assert = require('node:assert/strict');
const { pseudoPois, distanceKm } = require('../services/geoService');

test('pseudoPois includes a hospital category for directions lookups', () => {
  const pois = pseudoPois({ lat: 33.6844, lng: 73.0479 }, 1500);
  assert.ok(pois.some((poi) => poi.category === 'hospital'));
});

test('pseudoPois offsets points away from the center coordinate', () => {
  const center = { lat: 33.6844, lng: 73.0479 };
  const pois = pseudoPois(center, 1500);
  pois.forEach((poi) => {
    assert.notEqual(poi.lat, center.lat);
    assert.notEqual(poi.lng, center.lng);
  });
});

test('distanceKm returns 0 for identical points', () => {
  const point = { lat: 33.6844, lng: 73.0479 };
  assert.equal(distanceKm(point, point), 0);
});
