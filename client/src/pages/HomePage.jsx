import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Camera, Home, Mail, Search, ShieldCheck, Star } from "lucide-react";
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

export function HomePage() {
  const motionSafe = useMotionSafe();
  const t = useLocaleStore((state) => state.t);
  const [city, setCity] = useState("Islamabad");
  const [gender, setGender] = useState("boys");
  const [roomType, setRoomType] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState(25000);
  const searchPath = `/rooms?city=${encodeURIComponent(city)}&gender=${gender}&roomType=${roomType}&maxPrice=${maxPrice}`;
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

      <section className="bg-[linear-gradient(120deg,#087A55,#004DA3)] text-white">
        <motion.div
          className="container-page py-20 text-center lg:py-28"
          initial={motionSafe ? "hidden" : false}
          animate={motionSafe ? "show" : undefined}
          variants={motionSafe ? stagger() : undefined}
        >
          <motion.h1 variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </motion.h1>
          <motion.p variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mx-auto mt-7 max-w-3xl text-base font-medium text-white/90 sm:text-lg">
            {t("heroSubtitle")}
          </motion.p>

          <HeroRoomPreview rooms={featuredRooms} motionSafe={motionSafe} />

          <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mx-auto mt-10 max-w-5xl rounded-2xl border border-white/25 bg-white p-4 text-left shadow-soft">
            <div className="grid gap-3 md:grid-cols-[1.1fr_1.1fr_1fr_1fr_1.2fr] md:items-end">
              <label className="grid gap-2 text-xs font-semibold text-neutral-600">
                {t("heroLocation")}
                <select value={city} onChange={(event) => setCity(event.target.value)} className="input">
                  <option>Islamabad</option>
                  <option>Lahore</option>
                  <option>Karachi</option>
                  <option>Peshawar</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold text-neutral-600">
                {t("heroRoomType")}
                <select value={roomType} onChange={(event) => setRoomType(event.target.value)} className="input">
                  <option value="ALL">{t("heroAllRooms")}</option>
                  <option value="SINGLE">Single</option>
                  <option value="DOUBLE">Double</option>
                  <option value="BUNK_DORM">Bunk dorm</option>
                  <option value="PG">PG</option>
                  <option value="STUDIO">Studio</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold text-neutral-600">
                {t("heroGender")}
                <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
                  <button
                    type="button"
                    onClick={() => setGender("boys")}
                    className={`rounded-lg px-3 py-3 ${gender === "boys" ? "bg-white text-ink shadow-card" : "text-neutral-700"}`}
                  >
                    {t("heroBoys")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("girls")}
                    className={`rounded-lg px-3 py-3 ${gender === "girls" ? "bg-white text-ink shadow-card" : "text-neutral-700"}`}
                  >
                    {t("heroGirls")}
                  </button>
                </div>
              </label>
              <label className="grid gap-2 text-xs font-semibold text-neutral-600">
                {t("heroBudget")}
                <div className="rounded-xl bg-neutral-100 px-3 py-3">
                  <div className="flex justify-between text-[11px] text-neutral-700">
                    <span>PKR 5k</span>
                    <span>PKR {Math.round(maxPrice / 1000)}k</span>
                  </div>
                  <input value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} type="range" min="5000" max="90000" step="1000" className="mt-2 w-full accent-primary-700" />
                </div>
              </label>
              <Link to={searchPath} className="btn-primary h-[52px]">
                <Search size={18} /> {t("heroSearchRooms")}
              </Link>
            </div>
          </motion.div>

          <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {["Islamabad 130", "Lahore 200", "Private Rooms", "PG Accommodation"].map((pill) => (
              <Link key={pill} to="/rooms" className="rounded-full border border-white/40 px-6 py-2 text-sm font-semibold text-white/95 transition duration-250 ease-smooth hover:bg-white/10">
                {pill}
              </Link>
            ))}
            <Link to={`${searchPath}&view=map`} className="rounded-full border border-white/40 bg-white/10 px-6 py-2 text-sm font-semibold text-white transition duration-250 ease-smooth hover:bg-white/20">
              {t("heroOpenMapSearch")} <ArrowRight size={14} className="inline" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <section className="bg-primary-800 text-white">
        <div className="container-page grid grid-cols-2 gap-6 py-8 text-center md:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label}>
              <p className="text-3xl font-extrabold">{value}</p>
              <p className="text-xs text-white/80">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <MotionSection className="container-page py-16">
        <div className="mb-8 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-3xl font-extrabold">Featured Rooms and PGs</h2>
            <p className="mt-3 text-slate-700">Live availability, meal plans, gender policy, and verified Host details.</p>
          </div>
          <Link to="/rooms" className="hidden items-center gap-2 text-sm font-semibold text-primary-800 sm:flex">
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
            <h2 className="text-2xl font-extrabold">Verified Hostel Properties</h2>
            <p className="mt-3 text-slate-700">Browse full hostel profiles when you prefer managed hostel accommodation.</p>
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

      <section className="bg-[#EAF0FE] py-16">
        <div className="container-page text-center">
          <h2 className="text-3xl font-extrabold">How It Works</h2>
          <p className="mt-3 text-slate-700">Your journey to a better living space in three simple steps.</p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[ 
              [Search, "Search & Filter", "Browse by city, room type, price, gender, meals, and availability."],
              [Camera, "Visit or Trial", "Request a walkthrough, 3-day trial stay, or join the waitlist for full rooms."],
              [ShieldCheck, "Book Securely", "Pay token or instalments, receive receipts, and manage disputes through the platform."]
            ].map(([Icon, title, text]) => (
              <div key={title} className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-800 text-white shadow-card">
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-700">{text}</p>
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
          <h2 className="text-3xl font-extrabold">Student Stories</h2>
          <p className="mt-3 text-slate-700">Join thousands of students who found their home through us.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stories.map((story) => (
            <article key={story.name} className="panel p-7">
              <div className="mb-5 flex text-accent-700">
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} />)}
              </div>
              <p className="text-sm italic leading-7 text-slate-800">"{story.text}"</p>
              <div className="mt-6 flex items-center gap-3">
                <img src={story.image} alt={story.name} className="h-11 w-11 rounded-full object-cover" />
                <div>
                  <p className="font-semibold">{story.name}</p>
                  <p className="text-xs text-slate-600">{story.meta}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </MotionSection>

      <section className="bg-primary-50 py-12">
        <div className="container-page flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="badge bg-accent-50 text-accent-700"><BadgeCheck size={14} /> Identity and property verification</span>
            <h2 className="mt-4 text-2xl font-extrabold">List a private room, PG, studio, or hostel bed</h2>
            <p className="mt-3 max-w-2xl text-slate-700">Hosts complete CNIC proof, property proof, utility/license upload, and the digital Host agreement before admin review.</p>
          </div>
          <Link to="/landlord/onboarding" className="btn-primary shrink-0">Start Host Onboarding</Link>
        </div>
      </section>

      <section className="bg-primary-800 py-14 text-white">
        <div className="container-page flex flex-col items-center gap-5 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
            <Mail size={22} />
          </span>
          <h2 className="text-2xl font-extrabold sm:text-3xl">Get notified about new listings and price drops</h2>
          <p className="max-w-xl text-white/85">Leave your email and we'll message you when rooms matching your city go live or drop in price.</p>
          <form onSubmit={subscribeToAlerts} className="mt-2 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              placeholder="you@example.com"
              className="input flex-1 border-none bg-white text-ink"
            />
            <select
              value={newsletterCity}
              onChange={(event) => setNewsletterCity(event.target.value)}
              className="input w-full border-none bg-white text-ink sm:w-40"
            >
              <option value="">Any city</option>
              <option>Islamabad</option>
              <option>Lahore</option>
              <option>Karachi</option>
              <option>Peshawar</option>
            </select>
            <button type="submit" disabled={subscribing} className="btn-primary shrink-0 bg-white text-primary-800 hover:bg-white/90 hover:text-primary-800 disabled:opacity-70">
              {subscribing ? "Subscribing..." : "Get Notified"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function HeroRoomPreview({ rooms, motionSafe }) {
  const positions = [
    { left: "4%", top: "20px", width: "36%", rotateY: -16, rotateX: 4, z: 0 },
    { left: "32%", top: "0px", width: "40%", rotateY: 0, rotateX: 0, z: 18 },
    { left: "64%", top: "24px", width: "32%", rotateY: 16, rotateX: 4, z: 0 }
  ];

  return (
    <motion.div
      variants={motionSafe ? fadeUp : undefined}
      transition={motionSafe ? transitions.base : undefined}
      className="mx-auto mt-10 hidden h-56 max-w-5xl lg:block"
      style={{ perspective: 1200 }}
      aria-hidden="true"
    >
      <div className="relative h-full" style={{ transformStyle: "preserve-3d" }}>
        {rooms.map((room, index) => {
          const position = positions[index] || positions[1];
          return (
            <motion.div
              key={room.id}
              className="absolute overflow-hidden rounded-2xl border border-white/35 bg-white/10 shadow-soft"
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                height: index === 1 ? "220px" : "188px",
                transformStyle: "preserve-3d",
                zIndex: index === 1 ? 2 : 1
              }}
              initial={motionSafe ? { opacity: 0, y: 18, rotateY: position.rotateY, rotateX: position.rotateX } : undefined}
              animate={motionSafe ? {
                opacity: 1,
                y: [0, index === 1 ? -8 : -4, 0],
                rotateY: [position.rotateY, position.rotateY + (index === 0 ? 3 : index === 2 ? -3 : 0), position.rotateY],
                rotateX: [position.rotateX, position.rotateX - 2, position.rotateX],
                z: position.z
              } : undefined}
              transition={motionSafe ? {
                opacity: transitions.base,
                duration: 5 + index,
                repeat: Infinity,
                ease: "easeInOut"
              } : undefined}
            >
              <img src={room.image} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 text-left">
                <p className="text-sm font-bold text-white">{room.title}</p>
                <p className="mt-1 text-xs text-white/80">{room.area}, {room.city}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Lightweight loading placeholder for the Featured Rooms / Verified Hostels grids while
// the live API request is in flight, matching the skeleton conventions used elsewhere
// (see ListingsPage's SkeletonCard).
function SkeletonListingCard() {
  return (
    <div className="panel overflow-hidden">
      <div className="h-56 animate-pulse bg-primary-50" />
      <div className="space-y-4 p-6">
        <div className="h-6 w-2/3 animate-pulse rounded bg-primary-50" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-primary-50" />
        <div className="flex gap-3">
          <div className="h-8 w-16 animate-pulse rounded-full bg-primary-50" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-primary-50" />
        </div>
      </div>
    </div>
  );
}
