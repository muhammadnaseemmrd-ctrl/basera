// Lightweight i18n dictionary for Basera's site-wide English/Urdu toggle.
// Deliberately focused on the most visible UI text (main nav, homepage hero, common
// dashboard chrome, parent portal) rather than a full app-wide translation -- see
// useLocaleStore.js for the toggle mechanism that consumes this dictionary.

export const en = {
  // Main navigation
  navFindHousing: "Find Housing",
  navListings: "Listings",
  navRooms: "Rooms",
  navStays: "Hotels & Stays",
  navCompare: "Compare",
  navDashboard: "Dashboard",
  navAboutUs: "About Us",
  navLogin: "Login / Sign up",
  navLogout: "Logout",
  langToggleLabel: "اردو",

  // Homepage hero + search
  heroTitle: "Find Your Perfect Home Away From Home",
  heroSubtitle: "Secure rooms, PG accommodation, hostel seats, and shared living spaces across Pakistan's major cities.",
  heroLocation: "Location",
  heroType: "Type",
  heroCategory: "Category",
  heroBudget: "Budget",
  heroBoys: "Boys",
  heroGirls: "Girls",
  heroMixed: "Mixed",
  heroAllRooms: "All rooms",
  heroSearchRooms: "Search",
  heroOpenMapSearch: "Open Map Search",
  trustVerified: "Verified Properties",
  trustSecure: "Secure Payments",
  trustSupport: "24/7 Support",
  trustPlaced: "Student-Focused Platform",

  // Common actions used across cards/buttons
  bookNow: "Book Now",
  save: "Save",
  saved: "Saved",
  viewRoom: "View Room",
  login: "Login",
  logout: "Logout",

  // Student dashboard nav / common labels
  dashOverview: "Overview",
  dashBookings: "Bookings",
  dashSaved: "Saved",
  dashPayments: "Payments",
  dashServices: "Services",
  dashSupport: "Support",
  dashProfile: "Profile",
  dashCommunity: "Community",
  dashChat: "Chat",
  dashExplore: "Explore & Activities",

  // Parent portal (migrated from the page's old local urdu toggle)
  parentPortalGuardianView: "Guardian view",
  parentPortalTitleFor: "Parent portal for {name}",
  parentPortalSubtitle: "This limited link shows booking, payment, safety, and latest check-in status.",
  parentPortalBooking: "Booking",
  parentPortalPayment: "Payment",
  parentPortalMoveIn: "Move-in",
  parentPortalTodayStatus: "Today status",
  parentPortalLocation: "Location",
  parentPortalSafety: "Safety",
  parentPortalRent: "Rent",
  parentPortalRequestCheckIn: "Request Check-in",
  parentPortalSafetySummary: "Safety Summary",
  parentPortalSafetyScore: "Safety score",
  parentPortalPaymentSnapshot: "Payment Snapshot",
  parentPortalDepositNote: "Deposits are tracked separately and should only be released after move-out inspection and dispute clearance.",
  parentPortalAcknowledge: "Acknowledge Guardian View",
  parentPortalAcknowledgedDemo: "Acknowledged in demo mode.",
  parentPortalAcknowledgedLive: "Guardian acknowledgement saved.",
  parentPortalCheckInDemo: "Check-in request queued in demo mode.",
  parentPortalCheckInLive: "Student check-in request sent.",
  parentPortalPaid: "Paid",
  parentPortalDue: "Due"
};

export const ur = {
  navFindHousing: "رہائش تلاش کریں",
  navListings: "فہرست",
  navRooms: "کمرے",
  navStays: "ہوٹل اور گیسٹ ہاؤس",
  navCompare: "موازنہ",
  navDashboard: "ڈیش بورڈ",
  navAboutUs: "ہمارے بارے میں",
  navLogin: "لاگ ان / سائن اپ",
  navLogout: "لاگ آؤٹ",
  langToggleLabel: "English",

  heroTitle: "اپنا مثالی گھر تلاش کریں",
  heroSubtitle: "پاکستان کے بڑے شہروں میں محفوظ کمرے، پی جی رہائش، ہاسٹل نشستیں اور مشترکہ رہائش دستیاب ہیں۔",
  heroLocation: "مقام",
  heroType: "قسم",
  heroCategory: "زمرہ",
  heroBudget: "بجٹ",
  heroBoys: "لڑکے",
  heroGirls: "لڑکیاں",
  heroMixed: "مخلوط",
  heroAllRooms: "تمام کمرے",
  heroSearchRooms: "تلاش کریں",
  heroOpenMapSearch: "نقشے پر تلاش کریں",
  trustVerified: "تصدیق شدہ پراپرٹیز",
  trustSecure: "محفوظ ادائیگیاں",
  trustSupport: "24/7 معاونت",
  trustPlaced: "طلبہ پر مرکوز پلیٹ فارم",

  bookNow: "ابھی بک کریں",
  save: "محفوظ کریں",
  saved: "محفوظ شدہ",
  viewRoom: "کمرہ دیکھیں",
  login: "لاگ ان",
  logout: "لاگ آؤٹ",

  dashOverview: "جائزہ",
  dashBookings: "بکنگز",
  dashSaved: "محفوظ شدہ",
  dashPayments: "ادائیگیاں",
  dashServices: "خدمات",
  dashSupport: "مدد",
  dashProfile: "پروفائل",
  dashCommunity: "کمیونٹی",
  dashChat: "چیٹ",
  dashExplore: "دریافت اور سرگرمیاں",

  parentPortalGuardianView: "سرپرست منظر",
  parentPortalTitleFor: "{name} کے لیے والدین پورٹل",
  parentPortalSubtitle: "یہ محدود لنک بکنگ، ادائیگی، حفاظت اور تازہ ترین چیک اِن صورتحال دکھاتا ہے۔",
  parentPortalBooking: "رہائش",
  parentPortalPayment: "ادائیگی",
  parentPortalMoveIn: "شفٹنگ کی تاریخ",
  parentPortalTodayStatus: "آج کی صورتحال",
  parentPortalLocation: "مقام",
  parentPortalSafety: "حفاظت",
  parentPortalRent: "کرایہ",
  parentPortalRequestCheckIn: "چیک اِن درخواست",
  parentPortalSafetySummary: "حفاظتی خلاصہ",
  parentPortalSafetyScore: "حفاظتی اسکور",
  parentPortalPaymentSnapshot: "ادائیگی کا خلاصہ",
  parentPortalDepositNote: "ڈپازٹس الگ سے ٹریک کیے جاتے ہیں اور صرف نکاسی کے معائنے اور تنازعہ کی صفائی کے بعد جاری کیے جانے چاہئیں۔",
  parentPortalAcknowledge: "سرپرست منظر کی توثیق کریں",
  parentPortalAcknowledgedDemo: "ڈیمو موڈ میں توثیق ہوگئی۔",
  parentPortalAcknowledgedLive: "سرپرست کی توثیق محفوظ ہوگئی۔",
  parentPortalCheckInDemo: "چیک اِن درخواست ڈیمو موڈ میں قطار میں لگا دی گئی۔",
  parentPortalCheckInLive: "طالب علم کی چیک اِن درخواست بھیج دی گئی۔",
  parentPortalPaid: "ادا شدہ",
  parentPortalDue: "باقی"
};

// Resolves a dictionary key for the given locale, falling back to English, then to the
// raw key itself so a missing translation never renders blank. Supports simple
// "{varName}" interpolation for the handful of strings that need a dynamic value
// (e.g. the parent portal's student name).
export const translate = (locale, key, vars = {}) => {
  const dict = locale === "ur" ? ur : en;
  let text = dict[key] ?? en[key] ?? key;
  Object.entries(vars).forEach(([varKey, value]) => {
    text = text.replaceAll(`{${varKey}}`, value);
  });
  return text;
};
