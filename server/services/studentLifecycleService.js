const { pseudoPois } = require("./geoService");

const buildDirectionsUrl = ({ originLat, originLng, destinationLat, destinationLng, destinationName = "destination" }) => {
  const origin = `${originLat},${originLng}`;
  const destination = `${destinationLat},${destinationLng}`;
  const query = [
    ["origin", origin],
    ["destination", destination],
    ["destination_place_id", destinationName],
    ["travelmode", "driving"]
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `https://www.google.com/maps/dir/?api=1&${query}`;
};

const FACILITY_LABELS = {
  pharmacy: "Pharmacy",
  hospital: "Hospital / Clinic",
  atm: "ATM / Bank",
  grocery: "Grocery Store",
  mosque: "Mosque",
  transport: "Bus / Rickshaw Stop"
};

const nearestFacility = ({ center, category = "pharmacy", radius = 1500 }) => {
  const pois = pseudoPois(center, radius);
  const candidates = pois.filter((poi) => poi.category === category);
  const pool = candidates.length ? candidates : pois;
  return pool.slice().sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
};

const resolveDirections = ({ center, category = "pharmacy", originLat, originLng }) => {
  const facility = nearestFacility({ center, category });
  const usedFallbackOrigin = !originLat || !originLng;
  const origin = { lat: Number(originLat) || center.lat, lng: Number(originLng) || center.lng };
  const destinationName = `${FACILITY_LABELS[category] || "Nearby facility"}${facility?.name ? ` - ${facility.name}` : ""}`;
  const directionsUrl = buildDirectionsUrl({
    originLat: origin.lat,
    originLng: origin.lng,
    destinationLat: facility.lat,
    destinationLng: facility.lng,
    destinationName
  });
  return {
    directionsUrl,
    destinationName,
    category,
    origin,
    destination: { lat: facility.lat, lng: facility.lng },
    usedFallbackOrigin
  };
};

const calculateMonthlyStudentCommission = ({ duration, status, studentPlatformFee } = {}) => {
  if (String(duration || "").toLowerCase() !== "monthly") return 0;
  if (String(status || "").toLowerCase() !== "active") return 0;
  const fee = Number(studentPlatformFee);
  return fee > 0 ? fee : 200;
};

const getLifecycleLabel = (status = "") => {
  const map = {
    none: "No pending request",
    active: "Active stay",
    switch_requested: "Switch requested",
    switch_approved: "Switch approved",
    leave_requested: "Leave requested",
    leave_approved: "Leave approved",
    completed: "Completed"
  };

  return map[String(status).toLowerCase()] || "Pending";
};

module.exports = {
  buildDirectionsUrl,
  nearestFacility,
  resolveDirections,
  calculateMonthlyStudentCommission,
  getLifecycleLabel,
  FACILITY_LABELS
};
