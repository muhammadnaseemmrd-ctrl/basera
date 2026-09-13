import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Camera,
  CreditCard,
  Headphones,
  Home,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users
} from "lucide-react";
import { HostelCard } from "../components/HostelCard";
import { RoomCard } from "../components/RoomCard";
import { MotionSection } from "../components/MotionSection";
import { hostels, roomListings, stories } from "../data/mockData";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { normalizeHostels, normalizeRooms } from "../utils/normalize";
import { useToast } from "../components/ui";
import { useLocaleStore } from "../store/useLocaleStore";

const stats = [
  ["500+", "Rooms & Hostels"],
  ["4", "Major Cities"],
  ["10k+", "Students Placed"],
  ["100%", "Vetted Listings"]
];

// Unified "Type" field for the Gold Standard search bar. Hostel Room / PG / Shared /
// Private map onto the student room-marketplace search at /rooms (with a listingCategory
// filter, and roomType=PG for the PG case so RoomsMarketPage's chips line up). Guest House
// and Hotel Room are a different backend/booking flow entirely (nightly stays, not monthly
// room leases) so they route to /stays instead of being force-merged into /rooms.
const typeOptions = [
  { value: "HOSTEL_ROOM", label: "Hostel Room" },
  { value: "PG", label: "PG" },
  { value: "SHARED", label: "Shared" },
  { value: "PRIVATE", label: "Private" },
  { value: "GUEST_HOUSE", label: "Guest House" },
  { value: "HOTEL_ROOM", label: "Hotel Room" }
];

const stayTypes = new Set(["GUEST_HOUSE", "HOTEL_ROOM"]);

function buildSearchHref({ city, type, category, maxPrice }) {
  if (stayTypes.has(type)) {
    return `/stays?city=${encodeURIComponent(city)}`;
  }
  const params = new URLSearchParams({ city, maxPrice: String(maxPrice) });
  if (type === "HOSTEL_ROOM") params.set("listingCategory", "HOSTEL_ROOM");
  else if (type === "PG") {
    params.set("listingCategory", "PG_ACCOMMODATION");
    params.set("roomType", "PG");
  } else if (type === "SHARED") params.set("listingCategory", "SHARED_ROOM");
  else if (type === "PRIVATE") params.set("listingCategory", "PRIVATE_ROOM");
  if (category !== "mixed") params.set("gender", category);
  return `/rooms?${params.toString()}`;
}

export function HomePage() {
  const motionSafe = useMotionSafe();
  const t = useLocaleStore((state) => state.t);
  const [city, setCity] = useState("Islamabad");
  const [type, setType] = useState("HOSTEL_ROOM");
  const [category, setCategory] = useState("boys");
  const [maxPrice, setMaxPrice] = useState(25000);
  const searchPath = buildSearchHref({ city, type, category, maxPrice });
  const isStaySearch = stayTypes.has(type);
  const toast = useToast();

  // Featured rooms and verified hostels are fetched live from the API so the homepage
  // reflects real listings once the backend/MongoDB has data. mockData's arrays are only
  // used as the fallback (offline/API-down/demo mode), via the same safeRequest pattern
  // used on ListingsPage and RoomsMarketPage.
  const [featuredRooms, setFeaturedRooms] = useState(roomListings.slice(0, 3));
  const [featuredHostels, setFeaturedHostels] = useState(hostels.filter((hostel) => hostel.featured).slice(0, 3));
  const [listingsLoading, setListingsLoading] = useState(true);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterCity, setNewsletterCity] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      safeRequest(() => api.get("/rooms"), { results: roomListings }),
      safeRequest(() => api.get("/hostels", { params: { sort: "rating", limit: 12 } }), { results: hostels })
    ]).then(([roomData, hostelData]) => {
      if (ignore) return;
      const rooms = normalizeRooms(roomData.results || roomListings).slice(0, 3);
      setFeaturedRooms(rooms.length ? rooms : roomListings.slice(0, 3));

      const normalizedHostels = normalizeHostels(hostelData.results || hostels);
      const featured = normalizedHostels.filter((hostel) => hostel.featured).slice(0, 3);
      setFeaturedHostels(featured.length ? featured : normalizedHostels.slice(0, 3));

      setListingsLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const subscribeToAlerts = async (event) => {
    event.preventDefault();
    if (!newsletterEmail.trim()) {
      toast.error("Enter an email address to get notified.");
      return;
    }
    setSubscribing(true);
    try {
      const data = await safeRequest(
        () => api.post("/newsletter/subscribe", { email: newsletterEmail.trim(), city: newsletterCity || undefined }),
        { message: "You're on the list. We'll email you when new listings and price drops match your search.", demo: true }
      );
      toast.success(data.message || "You're subscribed for new listing alerts.");
      setNewsletterEmail("");
    } catch {
      toast.error("Could not subscribe right now. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Basera Pakistan - Verified Student Rooms and Hostels</title>
        <meta name="description" content="Find verified hostel seats, private rooms, PG accommodation, studios, and shared rooms near Pakistan's major universities." />
      </Helmet>

      {/* Hero -- flat off-white surface, Deep Teal display headline, bordered search card.
          Matches the Gold Standard landing mockup (stitch_basera_customer_housing_marketplace/
          landing_home_page_marketing) rather than the previous gradient hero. */}
      <section className="border-b border-line bg-canvas">
        <motion.div
          className="container-page py-16 text-center lg:py-24"
          initial={motionSafe ? "hidden" : false}
          animate={motionSafe ? "show" : undefined}
          variants={motionSafe ? stagger() : undefined}
        >
          <motion.h1
            variants={motionSafe ? fadeUp : undefined}
            transition={motionSafe ? transitions.base : undefined}
            className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-primary-600 sm:text-5xl"
          >
            {t("heroTitle")}
          </motion.h1>
          <motion.p
            variants={motionSafe ? fadeUp : undefined}
            transition={motionSafe ? transitions.base : undefined}
            className="mx-auto mt-6 max-w-2xl text-base text-on-surface-variant sm:text-lg"
          >
            {t("heroSubtitle")}
          </motion.p>

          <motion.div
            variants={motionSafe ? fadeUp : undefined}
            transition={motionSafe ? transitions.base : undefined}
            className="mx-auto mt-10 max-w-5xl rounded-xl border border-line bg-surface p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <div className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_1fr_1.1fr_auto] md:items-end">
              <label className="grid gap-1.5 rounded border border-line bg-surface-container-low p-3 transition focus-within:border-primary-600">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <MapPin size={13} /> {t("heroLocation")}
                </span>
                <select value={city} onChange={(event) => setCity(event.target.value)} className="w-full cursor-pointer border-none bg-transparent p-0 text-sm font-medium text-on-surface outline-none">
                  <option>Islamabad</option>
                  <option>Lahore</option>
                  <option>Karachi</option>
                  <option>Peshawar</option>
                </select>
              </label>
              <label className="grid gap-1.5 rounded border border-line bg-surface-container-low p-3 transition focus-within:border-primary-600">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <BedDouble size={13} /> {t("heroType")}
                </span>
                <select value={type} onChange={(event) => setType(event.target.value)} className="w-full cursor-pointer border-none bg-transparent p-0 text-sm font-medium text-on-surface outline-none">
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 rounded border border-line bg-surface-container-low p-3 transition focus-within:border-primary-600">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <Users size={13} /> {t("heroCategory")}
                </span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full cursor-pointer border-none bg-transparent p-0 text-sm font-medium text-on-surface outline-none">
                  <option value="boys">{t("heroBoys")}</option>
                  <option value="girls">{t("heroGirls")}</option>
                  <option value="mixed">{t("heroMixed")}</option>
                </select>
              </label>
              <label className={`grid gap-1.5 rounded border border-line bg-surface-container-low p-3 transition focus-within:border-primary-600 ${isStaySearch ? "opacity-40" : ""}`}>
                <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <span>{t("heroBudget")}</span>
                  <span className="text-primary-600">PKR {Math.round(maxPrice / 1000)}k</span>
                </span>
                <input
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Number(event.target.value))}
                  type="range"
                  min="5000"
                  max="90000"
                  step="1000"
                  disabled={isStaySearch}
                  className="mt-1 w-full accent-primary-600"
                />
              </label>
              <Link to={searchPath} className="flex h-[52px] items-center justify-center gap-2 rounded bg-primary-600 px-8 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">
                <Search size={18} /> {t("heroSearchRooms")}
              </Link>
            </div>
          </motion.div>

          <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {[
              ["Islamabad", "/rooms?city=Islamabad"],
              ["Lahore", "/rooms?city=Lahore"],
              ["Private Rooms", "/rooms?listingCategory=PRIVATE_ROOM"],
              ["PG Accommodation", "/rooms?listingCategory=PG_ACCOMMODATION&roomType=PG"]
            ].map(([label, href]) => (
              <Link key={label} to={href} className="rounded-full border border-line bg-surface-container-low px-4 py-1.5 text-sm font-semibold text-on-surface-variant transition duration-250 ease-smooth hover:border-primary-600 hover:text-primary-600">
                {label}
              </Link>
            ))}
            {!isStaySearch && (
              <Link to={`${searchPath}&view=map`} className="rounded-full border border-primary-600 bg-primary-50 px-4 py-1.5 text-sm font-semibold text-primary-700 transition duration-250 ease-smooth hover:bg-primary-100">
                {t("heroOpenMapSearch")} <ArrowRight size={14} className="inline" />
              </Link>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Trust badges strip -- the Gold Standard's signature "Verification Badge" component
          (shield/check icon + uppercase label) repeated for the platform's core trust claims. */}
      <section className="border-b border-line bg-surface">
        <div className="container-page grid grid-cols-2 gap-4 py-8 md:grid-cols-4">
          {[
            [ShieldCheck, t("trustVerified")],
            [CreditCard, t("trustSecure")],
            [Headphones, t("trustSupport")],
            [Users, t("trustPlaced")]
          ].map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-line bg-surface-container-low px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-600">
                <Icon size={18} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary-600 text-white">
        <div className="container-page grid grid-cols-2 gap-6 py-8 text-center md:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <p className="font-display text-3xl font-bold">{value}</p>
              <p className="text-xs text-white/80">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <MotionSection className="container-page py-16">
        <div className="mb-8 flex items-end justify-between gap-5">
          <div>
            <span className="badge bg-primary-50 text-primary-700"><ShieldCheck size={14} /> Verified listings</span>
            <h2 className="mt-4 font-display text-3xl font-bold text-on-surface">Featured Rooms and PGs</h2>
            <p className="mt-3 text-on-surface-variant">Live availability, meal plans, gender policy, and verified Host details.</p>
          </div>
          <Link to="/rooms" className="hidden items-center gap-2 text-sm font-semibold text-primary-700 sm:flex">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {listingsLoading
            ? Array.from({ length: 3 }).map((_, index) => <SkeletonListingCard key={index} />)
            : featuredRooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </MotionSection>

      <MotionSection className="container-page py-4">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold text-on-surface">Verified Hostel Properties</h2>
            <p className="mt-3 text-on-surface-variant">Browse full hostel profiles when you prefer managed hostel accommodation.</p>
          </div>
          <Link to="/hostels" className="btn-secondary w-full lg:w-auto">
            <Home size={18} /> Browse Hostels
          </Link>
        </div>
        <div className="mt-7 grid gap-6 md:grid-cols-3">
          {listingsLoading
            ? Array.from({ length: 3 }).map((_, index) => <SkeletonListingCard key={index} />)
            : featuredHostels.map((hostel) => <HostelCard key={hostel.id} hostel={hostel} compact />)}
        </div>
      </MotionSection>

      <section className="bg-surface-container-low py-16">
        <div className="container-page text-center">
          <h2 className="font-display text-3xl font-bold text-on-surface">How It Works</h2>
          <p className="mt-3 text-on-surface-variant">Your journey to a better living space in three simple steps.</p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              [Search, "Search & Filter", "Browse by city, room type, price, gender, meals, and availability."],
              [Camera, "Visit or Trial", "Request a walkthrough, 3-day trial stay, or join the waitlist for full rooms."],
              [ShieldCheck, "Book Securely", "Pay token or instalments, receive receipts, and manage disputes through the platform."]
            ].map(([Icon, title, text]) => (
              <div key={title} className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-600 text-white shadow-card">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-bold text-on-surface">{title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-on-surface-variant">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Student Stories still use the curated mockData.stories array -- there's no real
          testimonials/reviews endpoint suited to a homepage highlight reel yet, so this
          section intentionally stays static rather than wiring up a fake endpoint. */}
      <MotionSection className="container-page py-16">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-on-surface">Student Stories</h2>
          <p className="mt-3 text-on-surface-variant">Join thousands of students who found their home through us.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stories.map((story) => (
            <article key={story.name} className="rounded-lg border border-line bg-surface p-7 shadow-card">
              <div className="mb-5 flex text-accent-600">
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} fill="currentColor" />)}
              </div>
              <p className="text-sm italic leading-7 text-on-surface">"{story.text}"</p>
              <div className="mt-6 flex items-center gap-3">
                <img src={story.image} alt={story.name} className="h-11 w-11 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-on-surface">{story.name}</p>
                  <p className="text-xs text-on-surface-variant">{story.meta}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </MotionSection>

      <section className="bg-primary-50 py-12">
        <div className="container-page flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="badge bg-surface text-primary-700"><BadgeCheck size={14} /> Identity and property verification</span>
            <h2 className="mt-4 font-display text-2xl font-bold text-on-surface">List a private room, PG, studio, or hostel bed</h2>
            <p className="mt-3 max-w-2xl text-on-surface-variant">Hosts complete CNIC proof, property proof, utility/license upload, and the digital Host agreement before admin review.</p>
          </div>
          <Link to="/landlord/onboarding" className="shrink-0 rounded bg-primary-600 px-6 py-3 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">Start Host Onboarding</Link>
        </div>
      </section>

      <section className="bg-primary-700 py-14 text-white">
        <div className="container-page flex flex-col items-center gap-5 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
            <Mail size={22} />
          </span>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Get notified about new listings and price drops</h2>
          <p className="max-w-xl text-white/85">Leave your email and we'll message you when rooms matching your city go live or drop in price.</p>
          <form onSubmit={subscribeToAlerts} className="mt-2 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="w-full flex-1 rounded border-none bg-white px-4 py-3 text-sm text-ink outline-none"
            />
            <select
              value={newsletterCity}
              onChange={(event) => setNewsletterCity(event.target.value)}
              aria-label="City for listing alerts"
              className="w-full rounded border-none bg-white px-4 py-3 text-sm text-ink outline-none sm:w-40"
            >
              <option value="">Any city</option>
              <option>Islamabad</option>
              <option>Lahore</option>
              <option>Karachi</option>
              <option>Peshawar</option>
            </select>
            <button type="submit" disabled={subscribing} className="shrink-0 rounded bg-white px-6 py-3 text-sm font-bold text-primary-700 transition duration-250 ease-smooth hover:bg-white/90 disabled:opacity-70">
              {subscribing ? "Subscribing..." : "Get Notified"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

// Lightweight loading placeholder for the Featured Rooms / Verified Hostels grids while
// the live API request is in flight, matching the skeleton conventions used elsewhere
// (see ListingsPage's SkeletonCard).
function SkeletonListingCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="h-56 animate-pulse bg-surface-container-low" />
      <div className="space-y-4 p-6">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-container-low" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-surface-container-low" />
        <div className="flex gap-3">
          <div className="h-8 w-16 animate-pulse rounded-full bg-surface-container-low" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}
