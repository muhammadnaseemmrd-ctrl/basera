const roomImages = [
  "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
];

const users = [
  {
    id: "u-student",
    name: "Ali Ahmed",
    email: "student@basera.pk",
    phone: "+923001234567",
    password: "password123",
    role: "student",
    university: "NUST",
    city: "Islamabad",
    gender: "male",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    emergencyContact: {
      name: "Ahmed Khan",
      relationship: "Father",
      phone: "+923001112222",
      city: "Rawalpindi"
    },
    guardianConsent: {
      required: false,
      accepted: true
    },
    occupantProfile: {
      occupantType: "student",
      fieldOrSubject: "Computer Science",
      studyLevel: "Undergraduate",
      bio: "Focused, keeps the room tidy, doesn't mind an evening study group.",
      visibleToProspectiveRoommates: true
    }
  },
  {
    id: "u-teacher",
    name: "Waqas Ali",
    email: "waqas.ali@basera.pk",
    phone: "+923219871234",
    password: "password123",
    role: "student",
    city: "Islamabad",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80",
    occupantProfile: {
      occupantType: "teacher",
      fieldOrSubject: "Mathematics",
      bio: "Quiet, early sleeper, can help with calculus.",
      visibleToProspectiveRoommates: true
    }
  },
  {
    id: "u-owner",
    name: "Alex Rivera",
    email: "owner@basera.pk",
    phone: "+923451112233",
    password: "password123",
    role: "owner",
    city: "Islamabad",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "u-landlord",
    name: "Sara Malik",
    email: "landlord@basera.pk",
    phone: "+923211234567",
    password: "password123",
    role: "landlord",
    city: "Lahore",
    isVerified: false,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    landlordProfile: {
      listerType: "individual_landlord",
      verificationTier: "identity_verified",
      agreementAccepted: true,
      agreementSignedBy: "Sara Malik",
      commissionAcknowledged: true,
      reviewStatus: "pending"
    }
  },
  {
    id: "u-admin",
    name: "Super Admin",
    email: "admin@basera.pk",
    phone: "+923009998877",
    password: "password123",
    role: "admin",
    isVerified: true
  },
  {
    id: "u-warden",
    name: "Imran Warden",
    email: "warden@basera.pk",
    phone: "+923221239988",
    password: "password123",
    role: "warden",
    city: "Islamabad",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80"
  }
];

const hostels = [
  {
    id: "h1",
    owner: "u-owner",
    name: "Cozy Boys Hostel F-10",
    slug: "cozy-boys-hostel-f-10",
    type: "boys",
    city: "Islamabad",
    area: "F-10/4",
    address: "Plot 45, Street 12, F-10/4, Islamabad",
    description: "Strategically located in F-10, this verified boys hostel offers calm rooms, high-speed WiFi, reliable mess, security, and fast access to NUST, FAST, and Bahria University.",
    location: { lat: 33.6938, lng: 73.0139 },
    nearbyUniversities: [
      { name: "NUST", distanceKm: 3.2 },
      { name: "FAST-NU", distanceKm: 2.8 },
      { name: "F-10 Markaz", distanceKm: 0.8 }
    ],
    images: [roomImages[0], roomImages[1], roomImages[2], roomImages[5]],
    amenities: ["WiFi", "Mess", "AC", "CCTV Security", "Laundry", "UPS Backup", "RO Water", "Free Parking", "Daily Cleaning"],
    rules: ["Students only", "No smoking indoors", "Visitors allowed in lounge until 8 PM"],
    isVerified: true,
    isFeatured: true,
    rating: { average: 4.8, count: 124 },
    minPrice: 18000,
    maxPrice: 25000,
    availabilityLeft: 2,
    contactPhone: "+923001234567",
    contactWhatsApp: "+923001234567",
    messMenu: {
      breakfast: ["Eggs, Paratha, Tea", "Omelet, Bread, Butter", "Halwa Puri Special"],
      lunch: ["Chicken karahi with roti", "Daal chawal with salad", "Vegetable pulao"],
      dinner: ["Biryani", "Qeema with paratha", "Chicken handi"]
    }
  },
  {
    id: "h2",
    owner: "u-owner",
    name: "Pine Crest Boys Hostel",
    slug: "pine-crest-boys-hostel",
    type: "boys",
    city: "Islamabad",
    area: "H-13",
    address: "Street 6, Sector H-13, near NUST, Islamabad",
    description: "Bright shared rooms, study desks, AC options, and a direct route to NUST. Designed for students who need quiet routines and reliable amenities.",
    location: { lat: 33.6427, lng: 72.9915 },
    nearbyUniversities: [{ name: "NUST", distanceKm: 0.7 }, { name: "FAST-NU", distanceKm: 1.9 }],
    images: [roomImages[2], roomImages[0], roomImages[4]],
    amenities: ["WiFi", "AC", "Mess", "CCTV Security", "Gym"],
    rules: ["Quiet hours after 11 PM", "No subletting"],
    isVerified: true,
    isFeatured: false,
    rating: { average: 4.8, count: 89 },
    minPrice: 12500,
    maxPrice: 22000,
    availabilityLeft: 5,
    contactPhone: "+923335551111",
    contactWhatsApp: "+923335551111",
    messMenu: {
      breakfast: ["Tea, omelet, toast"],
      lunch: ["Chicken qorma", "Daal fry"],
      dinner: ["Chapli kebab", "Rice and curry"]
    }
  },
  {
    id: "h3",
    owner: "u-owner",
    name: "Elite Executive Hostel",
    slug: "elite-executive-hostel",
    type: "boys",
    city: "Islamabad",
    area: "E-11/3",
    address: "Main Margalla Road, Sector E-11/3, Islamabad",
    description: "Premium executive rooms with secure entry, laundry, quiet study areas, and high Host response rate.",
    location: { lat: 33.7006, lng: 72.9747 },
    nearbyUniversities: [{ name: "Bahria University", distanceKm: 2.4 }, { name: "Air University", distanceKm: 3.6 }],
    images: [roomImages[1], roomImages[3], roomImages[5]],
    amenities: ["Laundry", "CCTV Security", "Gym", "WiFi", "Daily Cleaning"],
    rules: ["Security gate closes at midnight"],
    isVerified: true,
    isFeatured: true,
    rating: { average: 4.9, count: 76 },
    minPrice: 18000,
    maxPrice: 28000,
    availabilityLeft: 2,
    contactPhone: "+923221110909",
    contactWhatsApp: "+923221110909",
    messMenu: {
      breakfast: ["Paratha, chana, tea"],
      lunch: ["Chicken pulao", "Seasonal vegetables"],
      dinner: ["BBQ night", "Daal mash"]
    }
  },
  {
    id: "h4",
    owner: "u-owner",
    name: "Green Valley Residency",
    slug: "green-valley-residency",
    type: "girls",
    city: "Islamabad",
    area: "G-10",
    address: "House 23, G-10/2, Islamabad",
    description: "Verified girls residency with comfortable shared rooms, attached baths, 24/7 CCTV, and female staff.",
    location: { lat: 33.675, lng: 73.0146 },
    nearbyUniversities: [{ name: "International Islamic University", distanceKm: 2.2 }],
    images: [roomImages[4], roomImages[3], roomImages[5]],
    amenities: ["WiFi", "AC", "Mess", "CCTV Security", "Laundry", "Free Parking"],
    rules: ["Female guests only", "Guardian contact required"],
    isVerified: true,
    isFeatured: false,
    rating: { average: 4.9, count: 68 },
    minPrice: 15000,
    maxPrice: 24000,
    availabilityLeft: 4,
    contactPhone: "+923445552222",
    contactWhatsApp: "+923445552222",
    messMenu: {
      breakfast: ["Tea, eggs, toast"],
      lunch: ["Chicken curry", "Rice"],
      dinner: ["Pasta", "Roti salan"]
    }
  },
  {
    id: "h5",
    owner: "u-owner",
    name: "LUMS Proximity Suites",
    slug: "lums-proximity-suites",
    type: "mixed",
    city: "Lahore",
    area: "DHA Phase 5",
    address: "Phase 5, DHA, Lahore",
    description: "Modern suites close to LUMS with separate wings, AC rooms, secure access, and daily cleaning.",
    location: { lat: 31.4697, lng: 74.4091 },
    nearbyUniversities: [{ name: "LUMS", distanceKm: 1.2 }],
    images: [roomImages[5], roomImages[2], roomImages[3]],
    amenities: ["WiFi", "AC", "Mess", "Laundry", "CCTV Security", "Gym"],
    rules: ["Separate wings", "ID verification required"],
    isVerified: true,
    isFeatured: true,
    rating: { average: 4.9, count: 92 },
    minPrice: 28000,
    maxPrice: 42000,
    availabilityLeft: 2,
    contactPhone: "+923118887777",
    contactWhatsApp: "+923118887777",
    messMenu: {
      breakfast: ["Continental breakfast"],
      lunch: ["Rice bowl", "Chicken handi"],
      dinner: ["BBQ platter", "Daal makhni"]
    }
  },
  {
    id: "h6",
    owner: "u-owner",
    name: "Gulberg Elite Home",
    slug: "gulberg-elite-home",
    type: "girls",
    city: "Lahore",
    area: "Gulberg III",
    address: "Gulberg III, Lahore",
    description: "Polished living space with study lounge, backup generator, and strong route access to Lahore universities.",
    location: { lat: 31.5204, lng: 74.3587 },
    nearbyUniversities: [{ name: "Punjab University", distanceKm: 4.4 }],
    images: [roomImages[3], roomImages[1], roomImages[4]],
    amenities: ["WiFi", "Mess", "Backup Generator", "Daily Cleaning", "Parking"],
    rules: ["Visitors by appointment"],
    isVerified: true,
    isFeatured: false,
    rating: { average: 4.6, count: 55 },
    minPrice: 22000,
    maxPrice: 30000,
    availabilityLeft: 6,
    contactPhone: "+923334445555",
    contactWhatsApp: "+923334445555",
    messMenu: {
      breakfast: ["Paratha and tea"],
      lunch: ["Chicken rice"],
      dinner: ["Karahi and naan"]
    }
  },
  {
    id: "h7",
    owner: "u-owner",
    groupId: "grp-royal",
    name: "Royal Hostel F-10",
    slug: "royal-hostel-f-10",
    type: "boys",
    city: "Islamabad",
    area: "F-10 Markaz",
    address: "Street 3, F-10 Markaz, Islamabad",
    description: "Flagship branch of the Royal Group of Hostels, offering premium boys accommodation minutes from F-10 Markaz.",
    location: { lat: 33.6952, lng: 73.0114 },
    nearbyUniversities: [{ name: "NUST", distanceKm: 3.0 }, { name: "FAST-NU", distanceKm: 2.5 }],
    images: [roomImages[0], roomImages[4]],
    amenities: ["WiFi", "Mess", "AC", "CCTV Security", "Laundry", "Free Parking"],
    rules: ["Students only", "Visitors allowed in lounge until 8 PM"],
    isVerified: true,
    isFeatured: true,
    rating: { average: 4.7, count: 58 },
    minPrice: 19000,
    maxPrice: 26000,
    availabilityLeft: 3,
    contactPhone: "+923001239900",
    contactWhatsApp: "+923001239900",
    messMenu: {
      breakfast: ["Paratha, tea"],
      lunch: ["Chicken karahi"],
      dinner: ["Biryani"]
    }
  },
  {
    id: "h8",
    owner: "u-owner",
    groupId: "grp-royal",
    name: "Royal Hostel G-9",
    slug: "royal-hostel-g-9",
    type: "boys",
    city: "Islamabad",
    area: "G-9/1",
    address: "Street 18, G-9/1, Islamabad",
    description: "Second Royal Group branch, close to G-9 markaz with the same verified staff and mess standards.",
    location: { lat: 33.6996, lng: 73.0362 },
    nearbyUniversities: [{ name: "Quaid-i-Azam University", distanceKm: 4.1 }],
    images: [roomImages[1], roomImages[3]],
    amenities: ["WiFi", "Mess", "CCTV Security", "Laundry"],
    rules: ["Students only", "Quiet hours after 11 PM"],
    isVerified: true,
    isFeatured: false,
    rating: { average: 4.5, count: 31 },
    minPrice: 17000,
    maxPrice: 23000,
    availabilityLeft: 5,
    contactPhone: "+923001239901",
    contactWhatsApp: "+923001239901",
    messMenu: {
      breakfast: ["Omelet, bread"],
      lunch: ["Daal chawal"],
      dinner: ["Qeema paratha"]
    }
  },
  {
    id: "h9",
    owner: "u-owner",
    groupId: "grp-royal",
    name: "Royal Hostel Lahore",
    slug: "royal-hostel-lahore",
    type: "boys",
    city: "Lahore",
    area: "Gulberg III",
    address: "Main Boulevard, Gulberg III, Lahore",
    description: "Royal Group's Lahore branch, serving Punjab University and FCCU students with the same trusted brand standards.",
    location: { lat: 31.5204, lng: 74.3587 },
    nearbyUniversities: [{ name: "Punjab University", distanceKm: 3.8 }, { name: "FCCU", distanceKm: 2.9 }],
    images: [roomImages[2], roomImages[5]],
    amenities: ["WiFi", "Mess", "Backup Generator", "Parking"],
    rules: ["Students only"],
    isVerified: true,
    isFeatured: false,
    rating: { average: 4.6, count: 22 },
    minPrice: 20000,
    maxPrice: 27000,
    availabilityLeft: 4,
    contactPhone: "+923001239902",
    contactWhatsApp: "+923001239902",
    messMenu: {
      breakfast: ["Paratha, tea"],
      lunch: ["Chicken rice"],
      dinner: ["Karahi"]
    }
  }
];

const rooms = [
  {
    id: "r1",
    hostel: "h1",
    blockId: "blk-h1-a",
    listedBy: "u-owner",
    roomNumber: "101",
    title: "Premium Single Seater near NUST",
    type: "single",
    roomType: "SINGLE",
    listingCategory: "HOSTEL_ROOM",
    city: "Islamabad",
    area: "F-10/4",
    address: "Plot 45, Street 12, F-10/4, Islamabad",
    coordinates: { lat: 33.6938, lng: 73.0139 },
    totalBeds: 1,
    availableBeds: 1,
    pricePerBed: 25000,
    pricePerHead: 25000,
    pricePerRoom: 25000,
    securityDeposit: 25000,
    pricePerSemester: 135000,
    mealPlan: "FULL_BOARD",
    mealCost: 9000,
    genderPolicy: "BOYS_ONLY",
    curfewTime: "10:30 PM",
    facilities: ["Study desk", "Wardrobe", "Attached bath"],
    amenities: ["WiFi", "AC", "Study Table", "Attached Bath", "CCTV"],
    photos: [roomImages[0], roomImages[1], roomImages[2], roomImages[5]],
    images: [roomImages[0]],
    floor: 1,
    floorNumber: 1,
    nearestUniversity: "NUST",
    distanceToUniversity: 15,
    instantBooking: true,
    trialStayAvailable: true,
    status: "ACTIVE"
  },
  {
    id: "r2",
    hostel: "h1",
    blockId: "blk-h1-a",
    listedBy: "u-owner",
    roomNumber: "204",
    title: "Standard Double Seater F-10",
    type: "double",
    roomType: "DOUBLE",
    listingCategory: "SHARED_ROOM",
    city: "Islamabad",
    area: "F-10/4",
    address: "Plot 45, Street 12, F-10/4, Islamabad",
    coordinates: { lat: 33.6938, lng: 73.0139 },
    totalBeds: 2,
    availableBeds: 1,
    pricePerBed: 18500,
    pricePerHead: 18500,
    pricePerRoom: 36000,
    securityDeposit: 5000,
    pricePerSemester: 98000,
    mealPlan: "FULL_BOARD",
    mealCost: 8000,
    genderPolicy: "BOYS_ONLY",
    curfewTime: "10:30 PM",
    facilities: ["AC", "WiFi", "Study desk"],
    amenities: ["WiFi", "AC", "Study Table", "CCTV"],
    photos: [roomImages[1], roomImages[0], roomImages[3], roomImages[5]],
    images: [roomImages[1]],
    floor: 2,
    floorNumber: 2,
    nearestUniversity: "FAST-NU",
    distanceToUniversity: 10,
    instantBooking: false,
    trialStayAvailable: true,
    status: "ACTIVE"
  },
  {
    id: "r3",
    hostel: "h1",
    blockId: "blk-h1-b",
    listedBy: "u-owner",
    roomNumber: "305",
    title: "Budget Bunk Dorm with Lockers",
    type: "dorm",
    roomType: "BUNK_DORM",
    listingCategory: "HOSTEL_ROOM",
    city: "Islamabad",
    area: "F-10/4",
    totalBeds: 6,
    availableBeds: 2,
    pricePerBed: 15000,
    pricePerHead: 15000,
    securityDeposit: 3500,
    pricePerSemester: 78000,
    mealPlan: "TWO_MEALS",
    mealCost: 6000,
    genderPolicy: "BOYS_ONLY",
    curfewTime: "11:00 PM",
    facilities: ["WiFi", "Locker", "Shared bath"],
    amenities: ["WiFi", "Locker", "Laundry"],
    photos: [roomImages[2], roomImages[0], roomImages[4], roomImages[5]],
    images: [roomImages[2]],
    floor: 3,
    floorNumber: 3,
    nearestUniversity: "NUST",
    distanceToUniversity: 15,
    instantBooking: false,
    trialStayAvailable: false,
    status: "ACTIVE"
  },
  { id: "r4", hostel: "h2", listedBy: "u-owner", roomNumber: "H13-12", title: "NUST Double Sharing", type: "double", roomType: "DOUBLE", listingCategory: "SHARED_ROOM", city: "Islamabad", area: "H-13", totalBeds: 2, availableBeds: 1, pricePerBed: 12500, pricePerHead: 12500, pricePerRoom: 24000, securityDeposit: 5000, pricePerSemester: 65000, mealPlan: "FULL_BOARD", mealCost: 7500, genderPolicy: "BOYS_ONLY", curfewTime: "10:00 PM", facilities: ["WiFi", "Mess"], amenities: ["WiFi", "Mess", "CCTV"], photos: [roomImages[2], roomImages[0], roomImages[4], roomImages[1]], images: [roomImages[2]], floor: 1, nearestUniversity: "NUST", distanceToUniversity: 8, instantBooking: true, trialStayAvailable: true, status: "ACTIVE" },
  { id: "r5", hostel: "h3", listedBy: "u-owner", roomNumber: "E11-08", title: "Executive Triple Sharing", type: "triple", roomType: "TRIPLE", listingCategory: "SHARED_ROOM", city: "Islamabad", area: "E-11/3", totalBeds: 3, availableBeds: 2, pricePerBed: 18000, pricePerHead: 18000, pricePerRoom: 52000, securityDeposit: 7000, pricePerSemester: 95000, mealPlan: "TWO_MEALS", mealCost: 7000, genderPolicy: "BOYS_ONLY", curfewTime: "11:00 PM", facilities: ["Laundry", "Security"], amenities: ["Laundry", "CCTV", "Gym"], photos: [roomImages[1], roomImages[3], roomImages[5], roomImages[0]], images: [roomImages[1]], floor: 2, nearestUniversity: "Bahria University", distanceToUniversity: 12, instantBooking: false, trialStayAvailable: true, status: "ACTIVE" },
  { id: "r6", hostel: "h4", listedBy: "u-owner", roomNumber: "G10-05", title: "Girls Double Seater with Female Staff", type: "double", roomType: "DOUBLE", listingCategory: "SHARED_ROOM", city: "Islamabad", area: "G-10", totalBeds: 2, availableBeds: 1, pricePerBed: 15000, pricePerHead: 15000, pricePerRoom: 29000, securityDeposit: 5000, pricePerSemester: 79000, mealPlan: "FULL_BOARD", mealCost: 8500, genderPolicy: "GIRLS_ONLY", curfewTime: "9:30 PM", facilities: ["AC", "CCTV", "Mess"], amenities: ["AC", "CCTV", "Mess", "Laundry"], photos: [roomImages[4], roomImages[3], roomImages[5], roomImages[0]], images: [roomImages[4]], floor: 1, nearestUniversity: "IIUI", distanceToUniversity: 18, instantBooking: true, trialStayAvailable: false, status: "ACTIVE" },
  { id: "r7", listedBy: "u-landlord", roomNumber: "PG-1", title: "Family PG Room with Breakfast", type: "pg", roomType: "PG", listingCategory: "PG_ACCOMMODATION", city: "Lahore", area: "DHA Phase 5", address: "DHA Phase 5, near LUMS, Lahore", coordinates: { lat: 31.4697, lng: 74.4091 }, totalBeds: 1, availableBeds: 1, pricePerBed: 32000, pricePerHead: 32000, pricePerRoom: 32000, securityDeposit: 15000, mealPlan: "BREAKFAST", mealCost: 3500, genderPolicy: "GIRLS_ONLY", curfewTime: "9:00 PM", facilities: ["Breakfast", "WiFi", "Family host"], amenities: ["WiFi", "Geyser", "Kitchen Access", "Laundry"], photos: [roomImages[5], roomImages[3], roomImages[1], roomImages[4]], images: [roomImages[5]], floorNumber: 1, nearestUniversity: "LUMS", distanceToUniversity: 12, instantBooking: false, trialStayAvailable: true, status: "ACTIVE" },
  { id: "r8", listedBy: "u-landlord", roomNumber: "ST-2", title: "Self-Contained Studio for Professional", type: "studio", roomType: "STUDIO", listingCategory: "PRIVATE_ROOM", city: "Karachi", area: "Gulshan-e-Iqbal", address: "Block 13D, Gulshan-e-Iqbal, Karachi", coordinates: { lat: 24.918, lng: 67.097 }, totalBeds: 1, availableBeds: 1, pricePerBed: 42000, pricePerHead: 42000, pricePerRoom: 42000, securityDeposit: 42000, mealPlan: "NONE", mealCost: 0, genderPolicy: "PROFESSIONALS", curfewTime: null, facilities: ["Private bath", "Kitchenette", "WiFi"], amenities: ["WiFi", "Attached Bath", "Kitchen Access", "Parking"], photos: [roomImages[3], roomImages[1], roomImages[2], roomImages[5]], images: [roomImages[3]], floorNumber: 2, nearestUniversity: "IBA", distanceToUniversity: 20, instantBooking: true, trialStayAvailable: false, status: "ACTIVE" },
  { id: "r9", listedBy: "u-landlord", roomNumber: "FL-1", title: "Entire Floor for Group Students", type: "floor", roomType: "ENTIRE_FLOOR", listingCategory: "ENTIRE_FLOOR", city: "Peshawar", area: "University Town", address: "University Town, Peshawar", coordinates: { lat: 34.0043, lng: 71.5448 }, totalBeds: 4, availableBeds: 4, pricePerBed: 18000, pricePerHead: 18000, pricePerRoom: 68000, securityDeposit: 35000, mealPlan: "KITCHEN_ACCESS", mealCost: 1500, genderPolicy: "BOYS_ONLY", curfewTime: "11:30 PM", facilities: ["Kitchen", "Generator", "Parking"], amenities: ["WiFi", "Generator", "Parking", "Kitchen Access"], photos: [roomImages[0], roomImages[5], roomImages[3], roomImages[2]], images: [roomImages[0]], floorNumber: 1, nearestUniversity: "University of Peshawar", distanceToUniversity: 9, instantBooking: false, trialStayAvailable: true, status: "ACTIVE" }
];

const reviews = [
  {
    id: "rev1",
    hostel: "h1",
    student: "Ali Ahmed",
    university: "NUST Student",
    rating: 5,
    comment: "Best hostel in F-10. The food is actually good compared to other places, and the high-speed internet never goes down.",
    mediaUrl: "https://res.cloudinary.com/demo/video/upload/v1690000000/samples/elephants.mp4",
    mediaType: "video"
  },
  {
    id: "rev2",
    hostel: "h1",
    student: "Hamza Sheikh",
    university: "Medical Intern",
    rating: 4,
    comment: "Very clean rooms. The staff is professional and they take complaints seriously. AC cooling is great during summer."
  },
  {
    id: "rev3",
    hostel: "h2",
    student: "Bilal Khan",
    university: "FAST Student",
    rating: 5,
    comment: "Close to classes and easy to commute. Booking through Basera saved a lot of calls."
  }
];

const bookings = [
  {
    id: "b1",
    student: "u-student",
    hostel: "h1",
    room: "r2",
    checkIn: "2026-06-08",
    duration: "monthly",
    totalAmount: 20350,
    commission: 1850,
    ownerReceives: 18500,
    paymentMethod: "jazzcash",
    paymentStatus: "paid",
    status: "confirmed"
  },
  {
    // Demo occupant for the "who will be my roommate" feature: fills one of the two
    // occupied beds in r5 (Executive Triple Sharing, 3 total / 2 available) so a
    // prospective tenant browsing that room sees a concrete "1 teacher (Mathematics)"
    // roommate summary. See roomRoutes.js buildOccupantSummaries().
    id: "b2",
    student: "u-teacher",
    hostel: "h3",
    room: "r5",
    checkIn: "2026-05-01",
    duration: "monthly",
    totalAmount: 19800,
    commission: 1800,
    ownerReceives: 18000,
    paymentMethod: "easypaisa",
    paymentStatus: "paid",
    status: "confirmed"
  }
];

const ownerDashboard = {
  revenue: [5200, 6500, 8900, 5900, 7600, 9400],
  occupancyRate: 85,
  occupiedBeds: 42,
  totalBeds: 50,
  roomGrid: [
    { number: "101", status: "occupied" }, { number: "102", status: "occupied" }, { number: "103", status: "available" },
    { number: "104", status: "occupied" }, { number: "105", status: "maintenance" }, { number: "201", status: "occupied" },
    { number: "202", status: "available" }, { number: "203", status: "occupied" }, { number: "204", status: "occupied" },
    { number: "205", status: "available" }, { number: "301", status: "occupied" }, { number: "302", status: "occupied" },
    { number: "303", status: "occupied" }, { number: "304", status: "available" }, { number: "305", status: "occupied" },
    { number: "401", status: "occupied" }, { number: "402", status: "maintenance" }, { number: "403", status: "occupied" },
    { number: "404", status: "occupied" }, { number: "405", status: "available" }
  ],
  requests: [
    { name: "Jessica Pearson", room: "Standard Shared Room (404)", dates: "Nov 01 - Dec 31" },
    { name: "Liam Wilson", room: "Private Studio (101)", dates: "Nov 15 - Jan 15" }
  ],
  payments: [
    { tenant: "Sarah Jenkins", room: "302", amount: 450, status: "Paid", date: "Today, 10:45 AM" },
    { tenant: "Michael Chen", room: "104", amount: 380, status: "Paid", date: "Yesterday" },
    { tenant: "Elena Rodriguez", room: "205", amount: 520, status: "Pending", date: "Oct 24, 2024" }
  ]
};

const adminDashboard = {
  stats: [
    { label: "Total Users", value: "24,592", trend: "+12%" },
    { label: "Verified Hostels", value: "1,840", trend: "+5%" },
    { label: "Gross Merch Volume", value: "$1.2M", trend: "-2%" }
  ],
  verificationQueue: [
    { name: "The Grand Oak Residency", city: "London, UK", units: 40, plan: "Standard", image: roomImages[1] },
    { name: "Metro Heights Hostel", city: "Berlin, Germany", units: 12, plan: "Premium", image: roomImages[5] }
  ],
  payouts: [
    { recipient: "CityDorm LLC", hostelId: "#1029", amount: 3240 },
    { recipient: "UrbanStay Group", hostelId: "#9942", amount: 12800 },
    { recipient: "GreenLeaf Suites", hostelId: "#4481", amount: 1450 }
  ],
  disputes: [
    { priority: "High Priority", id: "#DIS-449", title: "Refund Request: Dirty Room", user: "James Wilson vs SkyHub", status: "Pending Admin Review" },
    { priority: "Medium", id: "#DIS-450", title: "Booking Overlap", user: "Sarah Chen vs ZenHostel", status: "Awaiting Merchant Response" },
    { priority: "Medium", id: "#DIS-451", title: "Facility Discrepancy", user: "Mike Ross vs CityHub", status: "Gathering Evidence" }
  ]
};

// Hotels & guest houses for the short-stay tourist booking vertical (see
// server/models/Property.js). Separate from `hostels`/`rooms` above, which model
// monthly student housing.
const stayProperties = [
  {
    id: "prop-murree-1",
    owner: "u-owner",
    propertyType: "guest_house",
    name: "Pine View Guest House",
    slug: "pine-view-guest-house-mall-road-murree",
    city: "Murree",
    area: "Mall Road",
    address: "Near Mall Road, Murree",
    description: "Family-friendly guest house with mountain views, a bonfire area, and a five-minute walk to Mall Road. Popular with families visiting for a weekend.",
    location: { lat: 33.907, lng: 73.3943 },
    images: [roomImages[4], roomImages[0], roomImages[5]],
    facilities: ["Parking", "Hot Water", "Family Rooms", "Bonfire Area", "Generator Backup"],
    nightlyRatePkr: 12000,
    maxGuests: 5,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    totalRooms: 6,
    contactPhone: "+923001112223",
    isVerified: true,
    status: "active",
    rating: { average: 4.6, count: 38 }
  },
  {
    id: "prop-naran-1",
    owner: "u-owner",
    propertyType: "hotel",
    name: "Naran Riverside Hotel",
    slug: "naran-riverside-hotel-naran",
    city: "Naran",
    area: "Kaghan Road",
    address: "Kaghan Road, Naran",
    description: "Riverside hotel rooms with valley views, generator backup, and family rooms for tourist groups heading to Saif-ul-Malook.",
    location: { lat: 34.9078, lng: 73.6486 },
    images: [roomImages[2], roomImages[3], roomImages[1]],
    facilities: ["Parking", "Hot Water", "Generator Backup", "Family Rooms", "Room Service"],
    nightlyRatePkr: 18000,
    maxGuests: 4,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    totalRooms: 20,
    contactPhone: "+923451234567",
    isVerified: true,
    status: "active",
    rating: { average: 4.4, count: 52 }
  },
  {
    id: "prop-isb-1",
    owner: "u-owner",
    propertyType: "hotel",
    name: "Basera Boutique Hotel Islamabad",
    slug: "basera-boutique-hotel-blue-area-islamabad",
    city: "Islamabad",
    area: "Blue Area",
    address: "Jinnah Avenue, Blue Area, Islamabad",
    description: "Business-friendly boutique hotel in Blue Area, walking distance from Jinnah Avenue offices.",
    location: { lat: 33.7167, lng: 73.07 },
    images: [roomImages[1], roomImages[5], roomImages[2]],
    facilities: ["WiFi", "Parking", "Hot Water", "Room Service", "Airport Pickup"],
    nightlyRatePkr: 22000,
    maxGuests: 3,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    totalRooms: 15,
    contactPhone: "+923001239911",
    isVerified: true,
    status: "active",
    rating: { average: 4.7, count: 64 }
  }
];

const stayBookings = [
  {
    id: "stay-b1",
    propertyId: "prop-murree-1",
    guestUserId: "u-student",
    checkInDate: "2026-09-05",
    checkOutDate: "2026-09-07",
    guestCount: 3,
    nights: 2,
    nightlyRatePkr: 12000,
    totalPkr: 24000,
    status: "confirmed",
    contactPhone: "+923001234567",
    paymentStatus: "paid",
    paymentMethod: "jazzcash"
  }
];

module.exports = {
  users,
  hostels,
  rooms,
  reviews,
  bookings,
  ownerDashboard,
  adminDashboard,
  stayProperties,
  stayBookings
};
