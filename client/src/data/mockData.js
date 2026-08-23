export const roomImages = [
  "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
];

export const hostels = [
  {
    id: "h1",
    name: "Cozy Boys Hostel F-10",
    slug: "cozy-boys-hostel-f-10",
    type: "Boys",
    city: "Islamabad",
    area: "F-10/4",
    address: "Plot 45, Street 12, F-10/4, Islamabad",
    distance: "15 min",
    distanceLabel: "NUST H-12",
    description:
      "Strategically located in the heart of F-10, Cozy Boys Hostel offers premium living experiences for students from NUST, FAST, and Bahria University. The hostel combines secure living with modern amenities so you can focus on your studies.",
    image: roomImages[0],
    gallery: [roomImages[0], roomImages[1], roomImages[2], roomImages[5]],
    images: [roomImages[0], roomImages[1], roomImages[2], roomImages[5]],
    price: 18000,
    maxPrice: 25000,
    rating: 4.8,
    reviews: 124,
    verified: true,
    featured: true,
    left: 2,
    amenities: ["50Mbps WiFi", "3 Meals/Day", "24/7 Security", "Power Backup", "Laundry Svc", "Air Conditioned", "Daily Cleaning", "RO Water"],
    tags: ["WiFi", "Mess", "AC"],
    universities: ["NUST", "FAST-NU", "Bahria University"],
    coordinates: { lat: 33.6938, lng: 73.0139 }
  },
  {
    id: "h2",
    name: "Pine Crest Boys Hostel",
    slug: "pine-crest-boys-hostel",
    type: "Boys",
    city: "Islamabad",
    area: "H-13",
    address: "Sector H-13, near NUST",
    distance: "10 min",
    distanceLabel: "FAST-NU",
    description: "Bright shared rooms, strong WiFi, AC options, and quick access to NUST and FAST.",
    image: roomImages[2],
    gallery: [roomImages[2], roomImages[0], roomImages[4]],
    images: [roomImages[2], roomImages[0], roomImages[4]],
    price: 12500,
    maxPrice: 22000,
    rating: 4.8,
    reviews: 89,
    verified: true,
    left: 5,
    amenities: ["High-speed WiFi", "Full AC", "3 Meals/Day", "CCTV Security", "Gym"],
    tags: ["WiFi", "AC", "3 Meals"],
    universities: ["NUST", "FAST-NU"],
    coordinates: { lat: 33.6427, lng: 72.9915 }
  },
  {
    id: "h3",
    name: "Elite Executive Hostel",
    slug: "elite-executive-hostel",
    type: "Boys",
    city: "Islamabad",
    area: "E-11/3",
    address: "Sector E-11, Islamabad",
    distance: "05 min",
    distanceLabel: "F-10 Markaz",
    description: "Premium rooms with secure entry, laundry, quiet study areas, and excellent Host response time.",
    image: roomImages[1],
    gallery: [roomImages[1], roomImages[3], roomImages[5]],
    images: [roomImages[1], roomImages[3], roomImages[5]],
    price: 18000,
    maxPrice: 28000,
    rating: 4.9,
    reviews: 76,
    verified: true,
    featured: true,
    left: 2,
    amenities: ["Laundry", "Security", "Gym", "WiFi", "Daily Cleaning"],
    tags: ["Laundry", "Security", "Gym"],
    universities: ["Bahria University", "Air University"],
    coordinates: { lat: 33.7006, lng: 72.9747 }
  },
  {
    id: "h4",
    name: "Green Valley Residency",
    slug: "green-valley-residency",
    type: "Girls",
    city: "Islamabad",
    area: "G-10",
    address: "Near International Islamic University",
    distance: "18 min",
    distanceLabel: "IIUI",
    description: "Verified girls residency with comfortable rooms, 24/7 CCTV, female staff, and clean meals.",
    image: roomImages[4],
    gallery: [roomImages[4], roomImages[3], roomImages[5]],
    images: [roomImages[4], roomImages[3], roomImages[5]],
    price: 15000,
    maxPrice: 24000,
    rating: 4.9,
    reviews: 68,
    verified: true,
    left: 4,
    amenities: ["WiFi", "AC", "Mess", "CCTV", "Laundry", "Parking"],
    tags: ["WiFi", "AC", "Mess"],
    universities: ["IIUI", "NUST"],
    coordinates: { lat: 33.675, lng: 73.0146 }
  },
  {
    id: "h5",
    name: "LUMS Proximity Suites",
    slug: "lums-proximity-suites",
    type: "Mixed",
    city: "Lahore",
    area: "DHA Phase 5",
    address: "DHA Phase 5, Lahore",
    distance: "12 min",
    distanceLabel: "LUMS",
    description: "Modern suites close to LUMS with separate wings, AC rooms, secure access, and daily cleaning.",
    image: roomImages[5],
    gallery: [roomImages[5], roomImages[2], roomImages[3]],
    images: [roomImages[5], roomImages[2], roomImages[3]],
    price: 28000,
    maxPrice: 42000,
    rating: 4.9,
    reviews: 92,
    verified: true,
    featured: true,
    left: 2,
    amenities: ["WiFi", "AC", "Mess", "Laundry", "Security", "Gym"],
    tags: ["Laundry", "24/7 Security", "Gym"],
    universities: ["LUMS"],
    coordinates: { lat: 31.4697, lng: 74.4091 }
  },
  {
    id: "h6",
    name: "Gulberg Elite Home",
    slug: "gulberg-elite-home",
    type: "Girls",
    city: "Lahore",
    area: "Gulberg III",
    address: "Gulberg III, Lahore",
    distance: "20 min",
    distanceLabel: "Punjab University",
    description: "Study lounge, backup generator, polished shared rooms, and safe route access.",
    image: roomImages[3],
    gallery: [roomImages[3], roomImages[1], roomImages[4]],
    images: [roomImages[3], roomImages[1], roomImages[4]],
    price: 22000,
    maxPrice: 30000,
    rating: 4.6,
    reviews: 55,
    verified: true,
    left: 6,
    amenities: ["Parking", "Backup Generator", "Daily Cleaning"],
    tags: ["Parking", "Backup Generator", "Daily Cleaning"],
    universities: ["Punjab University"],
    coordinates: { lat: 31.5204, lng: 74.3587 }
  }
];

export const roomOptions = [
  { id: "single", name: "Premium Single Room", desc: "Private bathroom, study desk, and wardrobe.", price: 25000, deposit: "1 Month Rent", left: 2 },
  { id: "double", name: "Standard Double", desc: "Shared with one resident, study desk, WiFi, and AC option.", price: 18500, deposit: "PKR 5,000", left: 4 },
  { id: "triple", name: "Triple Sharing", desc: "Budget-friendly room with lockers and shared bathroom.", price: 15000, deposit: "PKR 5,000", left: 6 },
  { id: "dorm", name: "Dormitory", desc: "Four-bed room with lockers and common lounge access.", price: 12000, deposit: "PKR 3,500", left: 8 }
];

export const roomListings = [
  {
    id: "r1",
    title: "Premium Single Seater near NUST",
    roomNumber: "101",
    roomType: "SINGLE",
    listingCategory: "HOSTEL_ROOM",
    city: "Islamabad",
    area: "F-10/4",
    address: "Plot 45, Street 12, F-10/4, Islamabad",
    totalBeds: 1,
    availableBeds: 1,
    pricePerHead: 25000,
    pricePerRoom: 25000,
    securityDeposit: 25000,
    mealPlan: "FULL_BOARD",
    mealCost: 9000,
    genderPolicy: "BOYS_ONLY",
    curfewTime: "10:30 PM",
    amenities: ["WiFi", "AC", "Study Table", "Attached Bath", "CCTV"],
    photos: [roomImages[0], roomImages[1], roomImages[2], roomImages[5]],
    image: roomImages[0],
    nearestUniversity: "NUST",
    distanceToUniversity: 15,
    instantBooking: true,
    trialStayAvailable: true,
    lister: { name: "Alex Rivera", role: "Verified Hostel Host", verificationTier: "property_verified" },
    coordinates: { lat: 33.6938, lng: 73.0139 }
  },
  {
    id: "r6",
    title: "Girls Double Seater with Female Staff",
    roomNumber: "G10-05",
    roomType: "DOUBLE",
    listingCategory: "SHARED_ROOM",
    city: "Islamabad",
    area: "G-10",
    totalBeds: 2,
    availableBeds: 1,
    pricePerHead: 15000,
    pricePerRoom: 29000,
    securityDeposit: 5000,
    mealPlan: "FULL_BOARD",
    mealCost: 8500,
    genderPolicy: "GIRLS_ONLY",
    curfewTime: "9:30 PM",
    amenities: ["AC", "CCTV", "Mess", "Laundry"],
    photos: [roomImages[4], roomImages[3], roomImages[5], roomImages[0]],
    image: roomImages[4],
    nearestUniversity: "IIUI",
    distanceToUniversity: 18,
    instantBooking: true,
    trialStayAvailable: false,
    lister: { name: "Green Valley Residency", role: "Verified Hostel Host", verificationTier: "property_verified" },
    coordinates: { lat: 33.675, lng: 73.0146 },
    // Demo "who will be my roommate" data: this room's one occupied bed belongs to a
    // working professional who opted in to share category-level info. Never a name,
    // email, or phone -- matches the shape the server returns from GET /rooms/:id.
    occupants: [
      {
        bedIndex: 1,
        occupantType: "working_professional",
        fieldOrSubject: "Chemistry (Lab Instructor)",
        bio: "Loves early mornings, keeps her side of the room tidy."
      }
    ]
  },
  {
    id: "r7",
    title: "Family PG Room with Breakfast",
    roomNumber: "PG-1",
    roomType: "PG",
    listingCategory: "PG_ACCOMMODATION",
    city: "Lahore",
    area: "DHA Phase 5",
    totalBeds: 1,
    availableBeds: 1,
    pricePerHead: 32000,
    pricePerRoom: 32000,
    securityDeposit: 15000,
    mealPlan: "BREAKFAST",
    mealCost: 3500,
    genderPolicy: "GIRLS_ONLY",
    curfewTime: "9:00 PM",
    amenities: ["WiFi", "Geyser", "Kitchen Access", "Laundry"],
    photos: [roomImages[5], roomImages[3], roomImages[1], roomImages[4]],
    image: roomImages[5],
    nearestUniversity: "LUMS",
    distanceToUniversity: 12,
    instantBooking: false,
    trialStayAvailable: true,
    lister: { name: "Sara Malik", role: "Verified Individual Host", verificationTier: "identity_verified" },
    coordinates: { lat: 31.4697, lng: 74.4091 }
  },
  {
    id: "r8",
    title: "Self-Contained Studio for Professional",
    roomNumber: "ST-2",
    roomType: "STUDIO",
    listingCategory: "PRIVATE_ROOM",
    city: "Karachi",
    area: "Gulshan-e-Iqbal",
    totalBeds: 1,
    availableBeds: 1,
    pricePerHead: 42000,
    pricePerRoom: 42000,
    securityDeposit: 42000,
    mealPlan: "NONE",
    mealCost: 0,
    genderPolicy: "PROFESSIONALS",
    curfewTime: null,
    amenities: ["WiFi", "Attached Bath", "Kitchen Access", "Parking"],
    photos: [roomImages[3], roomImages[1], roomImages[2], roomImages[5]],
    image: roomImages[3],
    nearestUniversity: "IBA",
    distanceToUniversity: 20,
    instantBooking: true,
    trialStayAvailable: false,
    lister: { name: "Sara Malik", role: "Verified Individual Host", verificationTier: "identity_verified" },
    coordinates: { lat: 24.918, lng: 67.097 }
  }
];

// Hotels & guest houses for the short-stay tourist booking vertical (/stays). Separate
// from `hostels`/`roomListings` above, which model monthly student housing.
export const stayProperties = [
  {
    id: "prop-murree-1",
    propertyType: "guest_house",
    name: "Pine View Guest House",
    slug: "pine-view-guest-house-mall-road-murree",
    city: "Murree",
    area: "Mall Road",
    address: "Near Mall Road, Murree",
    description: "Family-friendly guest house with mountain views, a bonfire area, and a five-minute walk to Mall Road. Popular with families visiting for a weekend.",
    image: roomImages[4],
    images: [roomImages[4], roomImages[0], roomImages[5]],
    facilities: ["Parking", "Hot Water", "Family Rooms", "Bonfire Area", "Generator Backup"],
    nightlyRatePkr: 12000,
    maxGuests: 5,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    totalRooms: 6,
    rating: 4.6,
    reviews: 38
  },
  {
    id: "prop-naran-1",
    propertyType: "hotel",
    name: "Naran Riverside Hotel",
    slug: "naran-riverside-hotel-naran",
    city: "Naran",
    area: "Kaghan Road",
    address: "Kaghan Road, Naran",
    description: "Riverside hotel rooms with valley views, generator backup, and family rooms for tourist groups heading to Saif-ul-Malook.",
    image: roomImages[2],
    images: [roomImages[2], roomImages[3], roomImages[1]],
    facilities: ["Parking", "Hot Water", "Generator Backup", "Family Rooms", "Room Service"],
    nightlyRatePkr: 18000,
    maxGuests: 4,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    totalRooms: 20,
    rating: 4.4,
    reviews: 52
  },
  {
    id: "prop-isb-1",
    propertyType: "hotel",
    name: "Basera Boutique Hotel Islamabad",
    slug: "basera-boutique-hotel-blue-area-islamabad",
    city: "Islamabad",
    area: "Blue Area",
    address: "Jinnah Avenue, Blue Area, Islamabad",
    description: "Business-friendly boutique hotel in Blue Area, walking distance from Jinnah Avenue offices.",
    image: roomImages[1],
    images: [roomImages[1], roomImages[5], roomImages[2]],
    facilities: ["WiFi", "Parking", "Hot Water", "Room Service", "Airport Pickup"],
    nightlyRatePkr: 22000,
    maxGuests: 3,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    totalRooms: 15,
    rating: 4.7,
    reviews: 64
  }
];

export const reviews = [
  {
    name: "Ali Ahmed",
    meta: "Student at NUST",
    text: "Best hostel in F-10. The food is actually good compared to other places, and the high-speed internet never goes down.",
    mediaUrl: "https://res.cloudinary.com/demo/video/upload/v1690000000/samples/elephants.mp4",
    mediaType: "video"
  },
  {
    name: "Hamza Sheikh",
    meta: "Medical Intern",
    text: "Very safe and clean. The staff is professional and they take complaints seriously. AC cooling is great during summer."
  }
];

export const stories = [
  {
    name: "Ahmed Khan",
    meta: "NUST Student",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=140&q=80",
    text: "Finding a hostel in Islamabad was so stressful until Basera. The verified listings gave me confidence to book from Lahore."
  },
  {
    name: "Sarah Malik",
    meta: "LUMS Student",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=140&q=80",
    text: "The search filters are excellent. I found AC and mess near DHA Lahore without calling ten Hosts."
  },
  {
    name: "Zain Raza",
    meta: "IBA Student",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=140&q=80",
    text: "Basera made my move to Karachi much easier. The property descriptions are accurate and support was helpful."
  }
];

export const ownerDashboard = {
  revenue: [5200, 6500, 8900, 5900, 7600, 9400],
  rooms: [
    ["101", "occupied"], ["102", "occupied"], ["103", "available"], ["104", "occupied"], ["105", "maintenance"],
    ["201", "occupied"], ["202", "available"], ["203", "occupied"], ["204", "occupied"], ["205", "available"],
    ["301", "occupied"], ["302", "occupied"], ["303", "occupied"], ["304", "available"], ["305", "occupied"],
    ["401", "occupied"], ["402", "maintenance"], ["403", "occupied"], ["404", "occupied"], ["405", "available"]
  ],
  requests: [
    { name: "Jessica Pearson", room: "Standard Shared Room (404)", dates: "Nov 01 - Dec 31" },
    { name: "Liam Wilson", room: "Private Studio (101)", dates: "Nov 15 - Jan 15" }
  ],
  payments: [
    { tenant: "Sarah Jenkins", room: "302", amount: "$450.00", status: "Paid", date: "Today, 10:45 AM" },
    { tenant: "Michael Chen", room: "104", amount: "$380.00", status: "Paid", date: "Yesterday" },
    { tenant: "Elena Rodriguez", room: "205", amount: "$520.00", status: "Pending", date: "Oct 24, 2024" }
  ]
};

export const adminDashboard = {
  stats: [
    { label: "Total Users", value: "24,592", trend: "+12%", tone: "blue" },
    { label: "Verified Hostels", value: "1,840", trend: "+5%", tone: "green" },
    { label: "Gross Merch Volume", value: "$1.2M", trend: "-2%", tone: "red" }
  ],
  verifications: [
    { name: "The Grand Oak Residency", city: "London, UK", units: "40 Units", plan: "Standard", image: roomImages[1] },
    { name: "Metro Heights Hostel", city: "Berlin, Germany", units: "12 Units", plan: "Premium", image: roomImages[5] }
  ],
  payouts: [
    { recipient: "CityDorm LLC", id: "#1029", amount: "$3,240.00" },
    { recipient: "UrbanStay Group", id: "#9942", amount: "$12,800.00" },
    { recipient: "GreenLeaf Suites", id: "#4481", amount: "$1,450.00" }
  ],
  disputes: [
    { priority: "High Priority", id: "#DIS-449", title: "Refund Request: Dirty Room", user: "James Wilson vs SkyHub", status: "Pending Admin Review" },
    { priority: "Medium", id: "#DIS-450", title: "Booking Overlap", user: "Sarah Chen vs ZenHostel", status: "Awaiting Merchant Response" },
    { priority: "Medium", id: "#DIS-451", title: "Facility Discrepancy", user: "Mike Ross vs CityHub", status: "Gathering Evidence" }
  ]
};
