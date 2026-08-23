const scoreChecklist = ({ hostel = {}, rooms = [], reviews = [] } = {}) => {
  const source = hostel.toObject ? hostel.toObject() : hostel;
  const images = source.images || source.photos || [];
  const amenities = source.amenities || [];
  const docs = source.ownerVerification || {};
  const agreement = docs.agreement || {};

  return [
    { key: "photos", label: "At least 3 clear room/property photos", points: 15, passed: images.length >= 3 },
    { key: "pricing", label: "Transparent min/max pricing", points: 12, passed: Number(source.minPrice || source.pricePerBed || 0) > 0 && Number(source.maxPrice || source.pricePerRoom || source.minPrice || 0) > 0 },
    { key: "location", label: "City, area, address, and coordinates", points: 12, passed: Boolean(source.city && source.area && source.address && (source.location || source.coordinates)) },
    { key: "amenities", label: "Amenity list includes WiFi, security, and mess/laundry details", points: 14, passed: amenities.length >= 5 },
    { key: "rules", label: "House rules are declared", points: 8, passed: (source.rules || []).length > 0 },
    { key: "verification", label: "Host identity/property proofs and agreement", points: 18, passed: Boolean(source.isVerified || docs.identityDocument || docs.propertyDocument || agreement.accepted) },
    { key: "rooms", label: "Active room inventory exists", points: 12, passed: rooms.length > 0 },
    { key: "reviews", label: "Recent verified reviews improve trust", points: 9, passed: reviews.length > 0 || Number(source.rating?.count || 0) > 0 }
  ];
};

const calculateListingQuality = ({ hostel, rooms = [], reviews = [] }) => {
  const checklist = scoreChecklist({ hostel, rooms, reviews });
  const score = checklist.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
  const label = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "needs_work" : "at_risk";
  const missing = checklist.filter((item) => !item.passed).map((item) => item.label);
  return { score, label, checklist, missing };
};

module.exports = { calculateListingQuality };
