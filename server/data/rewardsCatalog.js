// Redeemable rewards for the student loyalty/referral points marketplace.
// Partner names below are illustrative placeholders for the demo/pitch build -- swap in
// real partner integrations (top-up APIs, voucher providers, etc.) before going live.
const rewardsCatalog = [
  {
    id: "reward-mobile-topup-200",
    name: "PKR 200 Mobile Top-up",
    partner: "Jazz / Zong / Telenor (illustrative)",
    description: "Instant balance top-up for any major Pakistani network.",
    category: "mobile",
    pointsCost: 1000,
    icon: "smartphone"
  },
  {
    id: "reward-food-delivery-voucher",
    name: "PKR 500 Food Delivery Voucher",
    partner: "Foodpanda (illustrative)",
    description: "Voucher code for a discount on your next food delivery order.",
    category: "food",
    pointsCost: 2200,
    icon: "utensils"
  },
  {
    id: "reward-bookstore-discount",
    name: "15% Off Campus Bookstore",
    partner: "Liberty Books (illustrative)",
    description: "Discount code for textbooks and stationery at partner bookstores.",
    category: "study",
    pointsCost: 1500,
    icon: "book-open"
  },
  {
    id: "reward-rideshare-credit",
    name: "PKR 300 Ride-share Credit",
    partner: "Careem / InDrive (illustrative)",
    description: "Credit toward your next campus commute or airport run.",
    category: "transport",
    pointsCost: 1800,
    icon: "car"
  },
  {
    id: "reward-laundry-pack",
    name: "Free Laundry Pack (5 loads)",
    partner: "Basera partner hostels (illustrative)",
    description: "Five free laundry loads redeemable at participating partner hostels.",
    category: "living",
    pointsCost: 1200,
    icon: "shirt"
  },
  {
    id: "reward-mess-meal-voucher",
    name: "3 Free Mess Meals",
    partner: "Basera partner mess (illustrative)",
    description: "Three complimentary meals at a participating hostel mess.",
    category: "food",
    pointsCost: 900,
    icon: "utensils-crossed"
  },
  {
    id: "reward-booking-discount-5",
    name: "5% Next Booking Discount",
    partner: "Basera",
    description: "5% off your next room booking, applied at checkout.",
    category: "booking",
    pointsCost: 5000,
    icon: "badge-percent"
  },
  {
    id: "reward-printing-credit",
    name: "PKR 400 Printing/Photocopy Credit",
    partner: "Campus print shops (illustrative)",
    description: "Credit for assignments, reports, and photocopying near campus.",
    category: "study",
    pointsCost: 800,
    icon: "printer"
  }
];

module.exports = { rewardsCatalog };
