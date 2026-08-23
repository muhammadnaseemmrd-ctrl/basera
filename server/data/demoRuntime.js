const nowIso = () => new Date().toISOString();
const hoursFromNow = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const demoPlatformSettings = {
  hostManagementMonthlyFee: 1000,
  loyaltyReferralPoints: 1000,
  loyaltyClaimThreshold: 5000,
  loyaltyDiscountMin: 5,
  loyaltyDiscountMax: 10,
  alertDisplayHours: 48,
  studentMonthlyPlatformFeePkr: 200
};

const demoLoyaltyAccount = {
  id: "loyalty-u-student",
  student: "u-student",
  referralCode: "HH-ALI-2026",
  pointsBalance: 4000,
  lifetimePoints: 4000,
  pointsRedeemed: 0,
  referralCount: 4,
  referrals: [
    { id: "ref-1", referredName: "Hamza Sheikh", referredEmail: "hamza@example.com", status: "completed", pointsAwarded: 1000, awardedAt: nowIso() },
    { id: "ref-2", referredName: "Noor Fatima", referredEmail: "noor@example.com", status: "completed", pointsAwarded: 1000, awardedAt: nowIso() },
    { id: "ref-3", referredName: "Bilal Khan", referredEmail: "bilal@example.com", status: "completed", pointsAwarded: 1000, awardedAt: nowIso() },
    { id: "ref-4", referredName: "Sarah Malik", referredEmail: "sarah@example.com", status: "completed", pointsAwarded: 1000, awardedAt: nowIso() }
  ]
};

const demoLoyaltyClaims = [
  {
    id: "claim-demo-approved",
    student: "u-student",
    studentName: "Ali Ahmed",
    requestedPoints: 5000,
    status: "approved",
    approvedDiscountPercent: 7,
    couponCode: "LOYALTY7",
    adminNote: "Approved for next verified room booking.",
    createdAt: nowIso(),
    approvedAt: nowIso()
  }
];

const demoGlobalAlerts = [
  {
    id: "alert-demo-1",
    title: "F-10 hostel safety advisory",
    message: "A nearby road closure may affect hostel commute timings today. Students should confirm route access before late travel.",
    category: "safety",
    severity: "warning",
    audience: "all",
    city: "Islamabad",
    university: "NUST",
    ackRequired: true,
    status: "published",
    submittedByName: "Basera Admin",
    submittedByRole: "admin",
    publishedAt: nowIso(),
    expiresAt: hoursFromNow(48),
    createdAt: nowIso()
  }
];

const demoAlertAcknowledgements = [];

const demoAuditLogs = [
  {
    id: "AUD-DEMO-1",
    actorName: "Super Admin",
    actorRole: "admin",
    action: "platform.settings.saved",
    entityType: "PlatformSetting",
    entityId: "platformControls",
    status: "success",
    metadata: { hostManagementMonthlyFee: 1000 },
    createdAt: nowIso()
  },
  {
    id: "AUD-DEMO-2",
    actorName: "Basera System",
    actorRole: "system",
    action: "alert.expiry.scheduled",
    entityType: "GlobalAlert",
    entityId: "alert-demo-1",
    status: "success",
    metadata: { expiresInHours: 48 },
    createdAt: nowIso()
  }
];

const demoMaintenanceTickets = [
  {
    id: "MT-DEMO-1",
    student: "u-student",
    studentName: "Ali Ahmed",
    host: "u-owner",
    hostName: "Alex Rivera",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    room: "r2",
    roomNumber: "204",
    title: "WiFi speed drops after 9 PM",
    description: "The room router becomes slow during evening study hours.",
    category: "wifi",
    priority: "medium",
    status: "in_progress",
    slaDueAt: hoursFromNow(24),
    updates: [
      { byName: "Alex Rivera", byRole: "owner", status: "in_progress", note: "ISP visit scheduled for tonight.", createdAt: nowIso() }
    ],
    createdAt: nowIso()
  },
  {
    id: "MT-DEMO-2",
    student: "u-student",
    studentName: "Ali Ahmed",
    host: "u-owner",
    hostName: "Alex Rivera",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    room: "r1",
    roomNumber: "101",
    title: "Washroom tap leakage",
    description: "Minor leakage near basin.",
    category: "plumbing",
    priority: "low",
    status: "open",
    slaDueAt: hoursFromNow(48),
    updates: [],
    createdAt: nowIso()
  }
];

const demoBedBlocks = [
  {
    id: "BB-DEMO-1",
    room: "r3",
    bedIndex: 4,
    from: nowIso(),
    to: hoursFromNow(72),
    reason: "deep_cleaning",
    note: "Deep cleaning after maintenance ticket.",
    status: "active",
    createdAt: nowIso()
  }
];

const demoHostelGroups = [
  {
    id: "grp-royal",
    name: "Royal Group of Hostels",
    slug: "royal-group-of-hostels",
    description: "A trusted multi-branch student housing brand operating verified boys and girls hostels across Islamabad and Lahore.",
    logoUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=300&q=80",
    ownerId: "u-owner",
    verified: true,
    foundedYear: 2015,
    citiesPresent: ["Islamabad", "Lahore"],
    createdAt: nowIso()
  }
];

const demoBlocks = [
  {
    id: "blk-h1-a",
    hostelId: "h1",
    name: "Block A",
    wardenId: "u-warden",
    floorCount: 3,
    notes: "Main block, ground to 3rd floor.",
    createdAt: nowIso()
  },
  {
    id: "blk-h1-b",
    hostelId: "h1",
    name: "Block B",
    wardenId: null,
    floorCount: 2,
    notes: "Overflow block, warden not yet assigned.",
    createdAt: nowIso()
  }
];

const demoCommunityPosts = [
  {
    id: "post-demo-1",
    author: "u-student",
    authorName: "Ali Ahmed",
    authorRole: "student",
    scope: "university",
    city: "Islamabad",
    university: "NUST",
    type: "study_group",
    title: "Evening study group near F-10",
    body: "Looking for 3-4 students for a focused exam prep session in the common room tonight.",
    likes: 12,
    commentsCount: 4,
    status: "published",
    createdAt: nowIso()
  },
  {
    id: "post-demo-2",
    author: "u-owner",
    authorName: "Alex Rivera",
    authorRole: "owner",
    scope: "hostel",
    city: "Islamabad",
    university: "NUST",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    type: "announcement",
    title: "Mess timing updated for Friday",
    body: "Dinner will be served from 8:30 PM to 10:00 PM this Friday due to kitchen maintenance.",
    likes: 8,
    commentsCount: 1,
    status: "published",
    createdAt: nowIso()
  }
];

const demoRoommateRequests = [
  {
    id: "rr-demo-1",
    requester: "u-student",
    requesterName: "Ali Ahmed",
    targetName: "Hamza Sheikh",
    room: "r2",
    roomTitle: "Standard Double Seater F-10",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    city: "Islamabad",
    university: "NUST",
    compatibilityScore: 91,
    message: "We both prefer quiet study hours and mess food.",
    status: "pending",
    createdAt: nowIso()
  }
];

const demoVisitRequests = [
  {
    id: "visit-demo-1",
    student: "u-student",
    studentName: "Ali Ahmed",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    preferredDate: "2026-06-07",
    preferredTime: "17:30",
    note: "I want to inspect double sharing rooms.",
    status: "confirmed",
    createdAt: nowIso()
  }
];

const demoMoveInChecklists = [
  {
    id: "checklist-b1",
    bookingRef: "b1",
    hostelName: "Cozy Boys Hostel F-10",
    roomNumber: "204",
    status: "student_ready",
    items: [
      { key: "identity_uploaded", label: "Identity and university proof uploaded", completed: true },
      { key: "payment_confirmed", label: "Booking payment confirmed", completed: true },
      { key: "emergency_contact", label: "Emergency contact added", completed: true },
      { key: "rules_accepted", label: "Hostel rules accepted", completed: false },
      { key: "condition_photos", label: "Room condition photos uploaded", completed: false }
    ],
    roomConditionPhotos: []
  }
];

const demoHostelPolls = [
  {
    id: "poll-demo-1",
    createdBy: "u-owner",
    createdByName: "Alex Rivera",
    audience: "students",
    city: "Islamabad",
    university: "NUST",
    hostel: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    title: "Saturday dinner menu",
    description: "Vote for this weekend's mess special.",
    category: "mess",
    options: [
      { id: "opt-biryani", label: "Chicken biryani", votes: 18 },
      { id: "opt-karahi", label: "Chicken karahi", votes: 11 },
      { id: "opt-pasta", label: "Pasta night", votes: 6 }
    ],
    status: "active",
    closesAt: hoursFromNow(72),
    createdAt: nowIso()
  }
];

const demoMarketplaceItems = [
  {
    id: "market-demo-1",
    seller: "u-student",
    sellerName: "Ali Ahmed",
    city: "Islamabad",
    university: "NUST",
    hostelName: "Cozy Boys Hostel F-10",
    title: "Study table with chair",
    description: "Compact desk, good for hostel rooms.",
    category: "furniture",
    price: 4500,
    condition: "good",
    images: [],
    status: "active",
    createdAt: nowIso()
  }
];

const demoLostFoundItems = [
  {
    id: "lost-demo-1",
    reporter: "u-student",
    reporterName: "Ali Ahmed",
    city: "Islamabad",
    university: "NUST",
    hostelName: "Cozy Boys Hostel F-10",
    type: "found",
    itemName: "Black wallet",
    description: "Found near common room sofa.",
    location: "F-10 common room",
    images: [],
    status: "open",
    createdAt: nowIso()
  }
];

const demoDigitalAgreements = [
  {
    id: "agreement-b1",
    bookingRef: "b1",
    hostelName: "Cozy Boys Hostel F-10",
    agreementType: "move_in",
    version: "v1",
    terms: [
      "Student agrees to follow hostel quiet hours and safety rules.",
      "Host agrees to provide the listed room, amenities, and maintenance support.",
      "Room condition photos protect the refundable security deposit."
    ],
    studentSignature: { name: "Ali Ahmed", signedAt: nowIso() },
    hostSignature: {},
    status: "student_signed",
    createdAt: nowIso()
  }
];

const demoMapStories = [
  {
    id: "story-h1",
    hostelRef: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    createdByName: "Alex Rivera",
    title: "F-10 Student Essentials Tour",
    status: "published",
    stops: [
      { title: "Hostel entrance", description: "Secure gate and main reception for student check-ins.", lat: 33.6938, lng: 73.0139, photo: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=80", order: 1 },
      { title: "F-10 Markaz", description: "Food, stationery, pharmacy, and transport access within a short ride.", lat: 33.6952, lng: 73.0114, photo: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80", order: 2 },
      { title: "Nearby study cafe", description: "Quiet late-evening study option for exam weeks.", lat: 33.6918, lng: 73.0182, photo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80", order: 3 }
    ],
    createdAt: nowIso()
  }
];

const demoSavedRoutes = [
  {
    id: "route-demo-1",
    studentRef: "u-student",
    title: "Hostel to NUST and F-10 Markaz",
    mode: "walking",
    waypoints: [
      { label: "Cozy Boys Hostel F-10", lat: 33.6938, lng: 73.0139 },
      { label: "F-10 Markaz", lat: 33.6952, lng: 73.0114 },
      { label: "NUST", lat: 33.6416, lng: 72.9864 }
    ],
    totalDistanceKm: 7.2,
    totalDurationMin: 86,
    shareCode: "HHROUTE-DEMO",
    createdAt: nowIso()
  }
];

const demoStudySessions = [
  {
    id: "study-demo-1",
    hostelRef: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    university: "NUST",
    city: "Islamabad",
    subject: "Physics exam prep",
    location: "Common Room 1",
    scheduledAt: hoursFromNow(30),
    maxParticipants: 6,
    notes: "Bring past papers and calculator.",
    sharedNotesUrl: "",
    organizerName: "Ali Ahmed",
    attendees: [{ id: "u-student", name: "Ali Ahmed", joinedAt: nowIso() }, { id: "u-demo-2", name: "Hamza Sheikh", joinedAt: nowIso() }],
    loyaltyAwarded: false,
    status: "open",
    createdAt: nowIso()
  }
];

module.exports = {
  demoPlatformSettings,
  demoLoyaltyAccount,
  demoLoyaltyClaims,
  demoGlobalAlerts,
  demoAlertAcknowledgements,
  demoAuditLogs,
  demoMaintenanceTickets,
  demoBedBlocks,
  demoHostelGroups,
  demoBlocks,
  demoCommunityPosts,
  demoRoommateRequests,
  demoVisitRequests,
  demoMoveInChecklists,
  demoHostelPolls,
  demoMarketplaceItems,
  demoLostFoundItems,
  demoDigitalAgreements,
  demoMapStories,
  demoSavedRoutes,
  demoStudySessions,
  hoursFromNow
};
