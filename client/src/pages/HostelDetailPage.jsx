import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Heart,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  ShieldCheck,
  Video,
  Star,
  Wifi,
  Utensils,
  Zap,
  Car,
  Camera,
  Lock
} from "lucide-react";
import { HostelCard } from "../components/HostelCard";
import { HostelMap } from "../components/HostelMap";
import { AlumniNetworkPanel, HostelDnaScore, HostelPulseWidget, MessMenuWidget } from "../components/HostelIntelligencePanel";
import { NeighbourhoodIntelligence } from "../components/NeighbourhoodIntelligence";
import { hostels, reviews, roomOptions } from "../data/mockData";
import { currency, rating } from "../utils/formatters";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { normalizeHostel, normalizeHostels } from "../utils/normalize";

const iconMap = [Wifi, Utensils, Lock, Zap, Camera, CheckCircle2, Car, ShieldCheck];

export function HostelDetailPage() {
  const { slug } = useParams();
  const fallbackHostel = hostels.find((item) => item.slug === slug) || hostels[0];
  const [detail, setDetail] = useState({
    hostel: fallbackHostel,
    rooms: roomOptions,
    reviews,
    nearby: hostels.filter((item) => item.id !== fallbackHostel.id).slice(0, 3)
  });
  const [dnaScore, setDnaScore] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [messMenu, setMessMenu] = useState(null);
  const [alumni, setAlumni] = useState(null);
  const [visitMessage, setVisitMessage] = useState("");
  const hostel = detail.hostel;
  const nearby = detail.nearby;
  const visibleReviews = detail.reviews;
  const motionSafe = useMotionSafe();
  useDocumentTitle(`${hostel.name} - ${hostel.type} Hostel | Basera`);

  useEffect(() => {
    let ignore = false;
    safeRequest(() => api.get(`/hostels/${slug}`), null).then((data) => {
      if (ignore || !data?.hostel) return;
      const normalizedHostel = normalizeHostel(data.hostel);
      const normalizedNearby = normalizeHostels(data.nearby || []);
      const normalizedReviews = (data.reviews || reviews).map((review) => ({
        name: review.student?.name || review.student || review.name || "Verified Student",
        meta: review.student?.university || review.university || review.meta || "Verified stay",
        text: review.comment || review.text,
        mediaUrl: review.mediaUrl || null,
        mediaType: review.mediaType || null
      }));
      const normalizedRooms = (data.rooms || []).map((room) => ({
        id: room.id || room._id || room.type,
        name: `${room.type?.[0]?.toUpperCase() || ""}${room.type?.slice(1) || "Room"} Room`,
        desc: (room.facilities || []).join(", ") || "Shared room with study desk and WiFi.",
        price: room.pricePerBed || normalizedHostel.price,
        deposit: room.pricePerBed ? "1 Month Rent" : "PKR 5,000",
        left: room.availableBeds || 1
      }));

      setDetail({
        hostel: normalizedHostel,
        rooms: normalizedRooms.length ? normalizedRooms : roomOptions,
        reviews: normalizedReviews.length ? normalizedReviews : reviews,
        nearby: normalizedNearby.length ? normalizedNearby : hostels.filter((item) => item.id !== normalizedHostel.id).slice(0, 3)
      });
    });

    safeRequest(() => api.get(`/hostels/${slug}/dna-score`), { score: null }).then((data) => {
      if (!ignore) setDnaScore(data?.score || null);
    });
    safeRequest(() => api.get(`/hostels/${slug}/pulse`), { pulse: null }).then((data) => {
      if (!ignore) setPulse(data?.pulse || null);
    });
    safeRequest(() => api.get(`/hostels/${slug}/mess-menu`), { menu: null }).then((data) => {
      if (!ignore) setMessMenu(data?.menu || null);
    });
    safeRequest(() => api.get(`/hostels/${slug}/alumni`), { summary: null }).then((data) => {
      if (!ignore) setAlumni(data?.summary || null);
    });

    return () => {
      ignore = true;
    };
  }, [slug]);

  const topRooms = useMemo(() => detail.rooms.slice(0, 2), [detail.rooms]);

  const requestVisit = async (visitType = "virtual") => {
    setVisitMessage("Submitting visit request...");
    const nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await safeRequest(
      () => api.post(`/hostels/${hostel.id}/visit-request`, { visitType, preferredDate: nextDate }),
      { demo: true }
    );
    setVisitMessage(result.demo ? "Visit request saved in demo mode." : "Visit request submitted. The Host will confirm the slot.");
  };

  return (
    <>
      <Helmet>
        <title>{hostel.name} - {hostel.type} Hostel near {hostel.universities[0]} | Basera</title>
        <meta name="description" content={`Book verified ${hostel.type.toLowerCase()} hostel in ${hostel.area}, ${hostel.city}. ${currency(hostel.price)}/month with WiFi, mess, CCTV, and instant booking.`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LodgingBusiness",
            name: hostel.name,
            address: hostel.address,
            priceRange: `${currency(hostel.price)} - ${currency(hostel.maxPrice)}`,
            aggregateRating: { "@type": "AggregateRating", ratingValue: hostel.rating, reviewCount: hostel.reviews }
          })}
        </script>
      </Helmet>

      <motion.main
        className="container-page py-8"
        initial={motionSafe ? "hidden" : false}
        animate={motionSafe ? "show" : undefined}
        variants={motionSafe ? stagger() : undefined}
      >
        <Link to="/hostels" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-800">
          <ArrowLeft size={18} /> Back to listings
        </Link>

        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-5 md:grid-cols-[1fr_320px]">
            <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-line">
              <img src={hostel.gallery[0]} alt={hostel.name} className="h-full min-h-[360px] w-full object-cover" />
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                <span className="badge bg-accent-700 text-white"><ShieldCheck size={14} /> Verified Hostel</span>
                <span className="badge bg-white text-slate-700">Islamabad, F-10</span>
              </div>
            </div>
            <div className="grid gap-5">
              {hostel.gallery.slice(1, 3).map((image, index) => (
                <div key={image} className="relative overflow-hidden rounded-lg border border-line">
                  <img src={image} alt={`${hostel.name} gallery ${index + 1}`} className="h-full min-h-[170px] w-full object-cover" />
                  {index === 1 && <div className="absolute inset-0 grid place-items-center bg-black/30 text-xl font-bold text-white">+12 more</div>}
                </div>
              ))}
            </div>
          </div>

          <BookingCard hostel={hostel} onVisitRequest={requestVisit} visitMessage={visitMessage} />
        </motion.div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-12">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold">{hostel.name}</h1>
                  <p className="mt-2 flex items-center gap-2 text-slate-700">
                    <Star size={17} className="text-primary-800" /> {rating(hostel.rating)} ({hostel.reviews} reviews)
                    <span className="hidden sm:inline">-</span>
                    <MapPin size={17} /> {hostel.address}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-primary-800"><Share2 size={18} /></button>
                  <button className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-primary-800"><Heart size={18} /></button>
                  <Link to={`/hostels/${slug}/live-board`} className="btn-secondary py-2"><Video size={16} /> Live Board</Link>
                </div>
              </div>
              <p className="mt-7 max-w-4xl leading-8 text-slate-700">{hostel.description}</p>
            </div>

            <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
              <HostelDnaScore score={dnaScore} />
              <div className="grid gap-6">
                <HostelPulseWidget pulse={pulse} />
                <AlumniNetworkPanel alumni={alumni} />
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-xl font-bold">Top Amenities</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {hostel.amenities.slice(0, 8).map((amenity, index) => {
                  const Icon = iconMap[index % iconMap.length];
                  return (
                    <div key={amenity} className="flex items-center gap-3 rounded-md border border-line bg-white p-4 text-sm shadow-card">
                      <Icon size={18} className="text-primary-800" /> {amenity}
                    </div>
                  );
                })}
                <button className="rounded-md border border-dashed border-primary-700 bg-white p-4 text-sm font-semibold text-primary-800">View 20+ More</button>
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-xl font-bold">Room Options</h2>
              <div className="mb-4 flex border-b border-line text-sm">
                {["Single Room", "Double Sharing", "Dormitory"].map((tab, index) => (
                  <button key={tab} className={`px-5 py-3 ${index === 0 ? "border-b-2 border-primary-700 text-primary-800" : "text-slate-600"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="grid gap-4">
                {topRooms.map((room) => (
                  <div key={room.id} className="panel p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold">{room.name}</h3>
                        <p className="mt-1 text-sm text-slate-700">{room.desc}</p>
                      </div>
                      <span className="badge bg-[#FEE2E2] text-[#9B1C1C]">Only {room.left} left</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
                      <div><p className="text-slate-600">Monthly Rent</p><p className="font-bold text-primary-800">{currency(room.price)}</p></div>
                      <div><p className="text-slate-600">Security Deposit</p><p className="font-bold">{room.deposit}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-xl font-bold">Weekly Mess Menu</h2>
              <MessMenuWidget menu={messMenu} onRated={(meal, value) => {
                setMessMenu((current) => current ? {
                  ...current,
                  meals: current.meals.map((item) => item.mealId === meal.mealId ? { ...item, rating: value, ratingCount: Number(item.ratingCount || 0) + 1 } : item)
                } : current);
              }} />
              <div className="mt-5">
              {["Breakfast (7:30 AM - 9:00 AM)", "Lunch (1:30 PM - 2:30 PM)", "Dinner (8:00 PM - 9:30 PM)"].map((meal, index) => (
                <details key={meal} open={index === 0} className="mb-3 rounded-md border border-line bg-white p-4 shadow-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                    <span>{meal}</span><ChevronDown size={18} />
                  </summary>
                  <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    {["Eggs, Paratha, Tea", "Omelet, Bread, Butter", "Halwa Puri Special"].map((item, itemIndex) => (
                      <p key={item}><span>{item}</span><span className="float-right font-semibold text-primary-800">{["Mon/Wed/Fri", "Tue/Thu/Sat", "Sun"][itemIndex]}</span></p>
                    ))}
                  </div>
                </details>
              ))}
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Location & Neighborhood</h2>
                <button className="text-sm font-semibold text-primary-800">Get Directions</button>
              </div>
              <HostelMap hostels={[hostel]} height="288px" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  ["15 min", "NUST H-12"],
                  ["10 min", "FAST-NU"],
                  ["05 min", "F-10 Markaz"]
                ].map(([time, label]) => (
                  <div key={label} className="rounded-md bg-primary-50 p-4 text-center">
                    <p className="font-bold text-primary-800">{time}</p>
                    <p className="text-xs text-slate-700">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            <NeighbourhoodIntelligence entity={hostel} title="Hostel Neighbourhood Intelligence" />

            <section>
              <h2 className="mb-5 text-xl font-bold">Student Reviews</h2>
              <div className="panel mb-5 grid gap-6 p-6 md:grid-cols-[160px_1fr]">
                <div className="rounded-lg bg-primary-700 p-6 text-center text-white">
                  <p className="text-4xl font-extrabold">{rating(hostel.rating)}</p>
                  <p className="mt-2 text-sm">Based on {hostel.reviews} reviews</p>
                </div>
                <div className="grid content-center gap-3 text-sm">
                  {[85, 10, 3].map((value, index) => (
                    <div key={value} className="grid grid-cols-[60px_1fr_42px] items-center gap-3">
                      <span>{5 - index} Star</span>
                      <div className="h-2 rounded bg-primary-100"><div className="h-2 rounded bg-primary-800" style={{ width: `${value}%` }} /></div>
                      <span>{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4">
                {visibleReviews.map((review) => (
                  <article key={review.name} className="panel p-5">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">{review.name}</p>
                        <p className="text-xs text-slate-600">{review.meta}</p>
                      </div>
                      <span className="text-primary-800">* * * * *</span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{review.text}</p>
                    {review.mediaUrl && review.mediaType === "video" && (
                      <video controls className="mt-4 w-full max-w-md rounded-lg border border-line" preload="metadata">
                        <source src={review.mediaUrl} />
                        Your browser does not support embedded video.
                      </video>
                    )}
                    {review.mediaUrl && review.mediaType === "audio" && (
                      <audio controls className="mt-4 w-full max-w-md" preload="metadata">
                        <source src={review.mediaUrl} />
                        Your browser does not support embedded audio.
                      </audio>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>

        <motion.section variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mt-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Similar Hostels Nearby</h2>
            <div className="flex gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white">&lt;</button>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white">&gt;</button>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {nearby.map((item) => <HostelCard key={item.id} hostel={item} compact />)}
          </div>
        </motion.section>
      </motion.main>
    </>
  );
}

function BookingCard({ hostel, onVisitRequest, visitMessage }) {
  return (
    <aside className="panel h-fit p-6 lg:sticky lg:top-28">
      <div className="mb-4 flex items-baseline justify-between">
        <p><span className="text-2xl font-extrabold">{currency(hostel.price)}</span><span className="text-sm text-slate-600"> /mo</span></p>
        <span className="text-sm text-primary-800">Starts from</span>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-medium">
        Move-in Date
        <div className="relative">
          <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-800" size={18} />
          <input type="date" className="input pl-11" />
        </div>
      </label>
      <label className="mt-4 grid gap-2 text-sm font-medium">
        Room Type
        <select className="input">
          <option>Standard Double</option>
          <option>Premium Single</option>
          <option>Dormitory</option>
        </select>
      </label>
      <div className="mt-5 rounded-md bg-primary-50 p-4 text-sm">
        <div className="flex justify-between"><span>Monthly Rent</span><strong>{currency(hostel.price)}</strong></div>
        <div className="mt-2 flex justify-between"><span>Security Deposit</span><strong>PKR 5,000</strong></div>
        <div className="mt-3 flex justify-between border-t border-line pt-3"><span>Total due now</span><strong>PKR 23,500</strong></div>
      </div>
      <Link to={`/booking?hostel=${hostel.slug}`} className="btn-primary mt-5 w-full">Book Now</Link>
      <button type="button" onClick={() => onVisitRequest("virtual")} className="btn-secondary mt-3 w-full">
        <Video size={16} /> Request Virtual Tour
      </button>
      <button type="button" onClick={() => onVisitRequest("physical")} className="btn-secondary mt-3 w-full">
        <CalendarDays size={16} /> Schedule Physical Visit
      </button>
      <button className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary-800">
        <MessageSquare size={16} /> Chat with Manager
      </button>
      <button className="btn-secondary mt-3 w-full">
        <Phone size={16} /> Contact Host
      </button>
      <p className="mt-4 text-center text-xs text-slate-600">You will not be charged yet. Management will contact you to confirm details.</p>
      {visitMessage && <p className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-center text-xs font-semibold text-primary-800">{visitMessage}</p>}
      <div className="mt-5 rounded-md bg-primary-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-primary-800">Why book via Basera?</p>
        <p className="mt-2">Secure payments with money-back guarantee and zero hidden charges.</p>
      </div>
    </aside>
  );
}
