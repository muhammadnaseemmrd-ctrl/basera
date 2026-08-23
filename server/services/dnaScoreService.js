const mongoose = require("mongoose");
const HostelDNAScore = require("../models/HostelDNAScore");
const { hostels, rooms, reviews } = require("../data/mockData");
const { getOrSet, ttl } = require("./cacheService");

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

const dimensionsFor = ({ hostel = {}, hostelRooms = [], hostelReviews = [] }) => {
  const amenityCount = (hostel.amenities || []).length + hostelRooms.reduce((sum, room) => sum + (room.amenities || room.facilities || []).length, 0);
  const rating = Number(hostel.rating?.average || hostel.rating || 4.5);
  const minPrice = Number(hostel.minPrice || hostel.price || hostelRooms[0]?.pricePerHead || 18000);
  const averageAreaPrice = hostel.city === "Islamabad" ? 22000 : hostel.city === "Lahore" ? 20000 : 19000;
  const reviewCount = Number(hostel.rating?.count || hostel.reviews || hostelReviews.length || 10);
  return [
    { name: "Safety", score: clamp((hostel.isVerified ? 82 : 62) + (amenityCount > 8 ? 8 : 0)), basis: "Verification, CCTV/security amenities, incident history" },
    { name: "Cleanliness", score: clamp(rating * 17 + Math.min(reviewCount, 20) / 2), basis: "Review sentiment and maintenance resolution" },
    { name: "Value", score: clamp(85 - ((minPrice - averageAreaPrice) / averageAreaPrice) * 30 + amenityCount), basis: "Price against area average and amenities" },
    { name: "Connectivity", score: clamp(70 + (hostel.nearbyUniversities?.length || 1) * 6), basis: "Campus proximity and transport access" },
    { name: "Comfort", score: clamp(62 + amenityCount * 2 + (hostel.messMenu ? 5 : 0)), basis: "Room type, amenities, mess availability" },
    { name: "Host Quality", score: clamp((hostel.isVerified ? 80 : 60) + rating * 3), basis: "Response time, dispute record, payout punctuality" },
    { name: "Community", score: clamp(58 + Math.min(reviewCount, 30) + (hostelRooms.length > 2 ? 6 : 0)), basis: "Reviews, activities, study/community activity" },
    { name: "Location", score: clamp(65 + (hostel.area ? 12 : 0) + (hostel.nearbyUniversities?.length || 1) * 4), basis: "Neighbourhood score and campus access" }
  ];
};

const demoDnaScore = (id) => {
  const hostel = hostels.find((item) => item.id === id || item.slug === id) || hostels[0];
  const hostelRooms = rooms.filter((room) => room.hostel === hostel.id);
  const hostelReviews = reviews.filter((review) => review.hostel === hostel.id);
  const dimensions = dimensionsFor({ hostel, hostelRooms, hostelReviews });
  return {
    hostelId: hostel.id,
    hostelName: hostel.name,
    dimensions,
    overallScore: clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
    computedAt: new Date().toISOString(),
    demo: true
  };
};

const getDnaScore = async (id, { hostel, hostelRooms = [], hostelReviews = [] } = {}) =>
  getOrSet(`dna:${id}`, ttl.dna, async () => {
    if (mongoose.connection.readyState !== 1) return demoDnaScore(id);
    const record = await HostelDNAScore.findOne({ $or: [{ hostel: id }, { hostelRef: id }] }).sort({ computedAt: -1 }).lean();
    if (record) return record;
    const dimensions = dimensionsFor({ hostel, hostelRooms, hostelReviews });
    return {
      hostelId: id,
      dimensions,
      overallScore: clamp(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
      computedAt: new Date().toISOString()
    };
  });

module.exports = { dimensionsFor, demoDnaScore, getDnaScore };
