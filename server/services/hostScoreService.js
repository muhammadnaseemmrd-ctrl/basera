const { hostels, rooms, reviews } = require("../data/mockData");

const scoreHostel = ({ hostel, roomCount = 0, reviewCount = 0, maintenanceResolved = 0, responseMinutes = 45, riskScore = 25 } = {}) => {
  const ratingAverage = Number(hostel?.rating?.average || 4.4);
  const ratingScore = Math.round((ratingAverage / 5) * 30);
  const verificationScore = hostel?.isVerified ? 20 : 8;
  const inventoryScore = Math.min(15, roomCount * 3);
  const reviewScore = Math.min(15, reviewCount * 3);
  const maintenanceScore = Math.min(10, maintenanceResolved * 2 + 4);
  const responseScore = responseMinutes <= 30 ? 10 : responseMinutes <= 90 ? 7 : 4;
  const riskPenalty = Math.round(Number(riskScore || 0) / 10);
  const score = Math.max(30, Math.min(100, ratingScore + verificationScore + inventoryScore + reviewScore + maintenanceScore + responseScore - riskPenalty));
  const label = score >= 90 ? "superhost" : score >= 78 ? "trusted" : score >= 65 ? "stable" : "needs_attention";

  return {
    score,
    label,
    factors: [
      { label: "Rating", value: `${ratingAverage.toFixed(1)}/5`, points: ratingScore },
      { label: "Verification", value: hostel?.isVerified ? "Verified" : "Pending", points: verificationScore },
      { label: "Inventory", value: `${roomCount} active rooms`, points: inventoryScore },
      { label: "Reviews", value: `${reviewCount} reviews`, points: reviewScore },
      { label: "Maintenance SLA", value: `${maintenanceResolved} resolved`, points: maintenanceScore },
      { label: "Response", value: `${responseMinutes} min avg`, points: responseScore },
      { label: "Risk Penalty", value: `-${riskPenalty}`, points: -riskPenalty }
    ]
  };
};

const demoHostLeaderboard = () =>
  hostels
    .map((hostel) => {
      const roomCount = rooms.filter((room) => room.hostel === hostel.id).length;
      const reviewCount = reviews.filter((review) => review.hostel === hostel.id).length || Number(hostel.rating?.count || 0);
      const score = scoreHostel({ hostel, roomCount, reviewCount, maintenanceResolved: hostel.id === "h1" ? 7 : 3, responseMinutes: hostel.id === "h1" ? 25 : 55 });
      return {
        id: hostel.id,
        name: hostel.name,
        city: hostel.city,
        area: hostel.area,
        rating: hostel.rating?.average || 4.5,
        roomCount,
        reviewCount,
        image: hostel.images?.[0],
        ...score
      };
    })
    .sort((a, b) => b.score - a.score);

module.exports = { scoreHostel, demoHostLeaderboard };
