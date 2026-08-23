const round = (value, decimals = 2) => Number(Number(value || 0).toFixed(decimals));
const rad = (value) => (Number(value) * Math.PI) / 180;

const distanceKm = (from, to) => {
  if (!from || !to) return 0;
  const radius = 6371;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const pointAt = ({ lat, lng }, distanceMeters, bearingDegrees) => {
  const radius = 6378137;
  const angular = distanceMeters / radius;
  const bearing = rad(bearingDegrees);
  const lat1 = rad(lat);
  const lng1 = rad(lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: round((lat2 * 180) / Math.PI, 6), lng: round((lng2 * 180) / Math.PI, 6) };
};

const pseudoPois = (center, radius = 1000) => {
  const definitions = [
    ["university", "Campus gate", 260, 20],
    ["mosque", "Neighbourhood mosque", 340, 85],
    ["food", "Student food street", 420, 150],
    ["transport", "Bus / rickshaw stop", 520, 210],
    ["pharmacy", "Medical store", 680, 285],
    ["hospital", "Clinic / hospital", 900, 200],
    ["atm", "ATM / bank branch", 760, 330],
    ["grocery", "General store", 840, 250],
    ["library", "Study library", 920, 115]
  ];
  return definitions.map(([category, name, distance, bearing], index) => ({
    id: `poi-${category}-${index}`,
    category,
    name,
    distanceMeters: Math.min(radius, distance),
    walkingMinutes: Math.max(2, Math.round(distance / 80)),
    ...pointAt(center, distance, bearing)
  }));
};

const cityCenter = (city = "Islamabad") => {
  const map = {
    Islamabad: { lat: 33.6844, lng: 73.0479 },
    Lahore: { lat: 31.5204, lng: 74.3587 },
    Karachi: { lat: 24.8607, lng: 67.0011 },
    Peshawar: { lat: 34.0151, lng: 71.5249 },
    Rawalpindi: { lat: 33.5651, lng: 73.0169 }
  };
  return map[city] || map.Islamabad;
};

const pointFrom = (item = {}) => {
  if (item.coordinates?.lat && item.coordinates?.lng) return item.coordinates;
  if (Array.isArray(item.location?.coordinates)) return { lat: item.location.coordinates[1], lng: item.location.coordinates[0] };
  if (item.location?.lat && item.location?.lng) return item.location;
  return null;
};

const roomCoords = (room = {}) => room.coordinates || (room.location?.coordinates ? { lat: room.location.coordinates[1], lng: room.location.coordinates[0] } : cityCenter(room.city));

module.exports = { round, rad, distanceKm, pointAt, pseudoPois, cityCenter, pointFrom, roomCoords };
