import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Droplets,
  Flame,
  Info,
  MapPin,
  Phone,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Utensils,
  Wifi,
  Wind,
  Zap
} from "lucide-react";
import { api, safeRequest } from "../services/api";
import { stayProperties } from "../data/mockData";
import { currency } from "../utils/formatters";
import { useAuthStore } from "../store/useAuthStore";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const todayIso = () => new Date().toISOString().slice(0, 10);
const tomorrowIso = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const nightsBetween = (checkIn, checkOut) => {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86400000));
};

export function StayDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const fallback = useMemo(() => stayProperties.find((item) => item.id === id) || stayProperties[0], [id]);
  const [property, setProperty] = useState(fallback);
  const [form, setForm] = useState({
    checkInDate: todayIso(),
    checkOutDate: tomorrowIso(),
    guestCount: 2,
    contactPhone: user?.phone || "",
    specialRequests: ""
  });
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(null);
  useDocumentTitle(`${property.name} | Basera Stays`);

  useEffect(() => {
    let ignore = false;
    safeRequest(() => api.get(`/stays/properties/${id}`), { property: fallback }).then((result) => {
      if (!ignore) setProperty(result.property || fallback);
    });
    return () => {
      ignore = true;
    };
  }, [fallback, id]);

  const nights = nightsBetween(form.checkInDate, form.checkOutDate);
  const subtotal = nights * Number(property.nightlyRatePkr || 0);
  const serviceFee = Math.round(subtotal * 0.05);
  const taxes = Math.round(subtotal * 0.1);
  const totalPkr = subtotal + serviceFee + taxes;

  const galleryPhotos = (property.images?.length ? property.images : [property.image]).filter(Boolean);
  const visibleGallery = galleryPhotos.slice(0, 4);
  const extraPhotoCount = Math.max(0, galleryPhotos.length - visibleGallery.length);

  const submitBooking = async (event) => {
    event.preventDefault();
    if (!user) {
      setMessage("Login to book a stay.");
      return;
    }
    if (!form.contactPhone) {
      setMessage("A contact phone number is required so the property can reach you about check-in.");
      return;
    }
    setMessage("Submitting booking...");
    const result = await safeRequest(
      () =>
        api.post("/stays/bookings", {
          propertyId: property.id || property._id,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          guestCount: form.guestCount,
          contactPhone: form.contactPhone,
          specialRequests: form.specialRequests
        }),
      { booking: { id: `stay-demo-${Date.now()}`, status: "confirmed", nights, totalPkr }, demo: true }
    );
    if (result.message && !result.booking) {
      setMessage(result.message);
      return;
    }
    setBooking(result.booking);
    setMessage(result.demo ? "Booking confirmed in demo mode." : "Booking submitted.");
  };

  return (
    <>
      <Helmet>
        <title>{property.name} | Basera Stays</title>
        <meta name="description" content={`Book ${property.name} in ${property.area}, ${property.city} -- ${currency(property.nightlyRatePkr)} per night.`} />
      </Helmet>
      <main className="container-page pb-24 pt-8 lg:pb-10">
        <Link to="/stays" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-800">
          <ArrowLeft size={18} /> Back to search
        </Link>

        {/* Title */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">{property.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
              <MapPin size={17} /> {property.address}
              <span className="link text-sm">View on map</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-primary-700 text-white">{property.propertyType === "hotel" ? "Hotel" : "Guest House"}</span>
            {property.rating && (
              <span className="badge bg-surface-container-high text-ink">
                <Star size={14} className="text-tertiary" fill="currentColor" /> {Number(property.rating).toFixed(1)}
                {property.reviews ? <span className="text-slate-600"> ({property.reviews})</span> : null}
              </span>
            )}
            {property.isVerified !== false && (
              <span className="inline-flex items-center gap-1 rounded border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-800">
                <ShieldCheck size={14} /> Verified Property
              </span>
            )}
          </div>
        </div>

        {/* Gallery */}
        {visibleGallery.length > 1 ? (
          <section className="mb-10 grid h-[300px] grid-cols-2 gap-2 overflow-hidden rounded-xl border border-line sm:h-[420px] md:grid-cols-4 md:grid-rows-2 md:gap-2">
            {visibleGallery.map((photo, index) => (
              <div key={photo} className={`relative ${index === 0 ? "col-span-2 row-span-2" : "hidden md:block"}`}>
                <img src={photo} alt={`${property.name} ${index + 1}`} className="h-full w-full object-cover" />
                {index === visibleGallery.length - 1 && extraPhotoCount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white">
                    +{extraPhotoCount} more photos
                  </div>
                )}
              </div>
            ))}
          </section>
        ) : (
          <section className="mb-10 h-[300px] overflow-hidden rounded-xl border border-line sm:h-[420px]">
            {visibleGallery[0] && <img src={visibleGallery[0]} alt={property.name} className="h-full w-full object-cover" />}
          </section>
        )}

        <div className="flex flex-col gap-gutter lg:flex-row">
          {/* Main content */}
          <div className="flex-1 space-y-8">
            <section className="panel p-6">
              <h2 className="mb-4 border-b border-line pb-3 text-xl font-bold">About this stay</h2>
              <p className="leading-7 text-slate-700">{property.description}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-container-lowest p-4">
                  <Sparkles size={22} className="mt-0.5 shrink-0 text-primary-700" />
                  <div>
                    <p className="font-semibold text-ink">Premium quality</p>
                    <p className="mt-1 text-sm text-slate-600">Clean, well-kept rooms verified by the Basera team.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-container-lowest p-4">
                  <Phone size={22} className="mt-0.5 shrink-0 text-primary-700" />
                  <div>
                    <p className="font-semibold text-ink">Direct property contact</p>
                    <p className="mt-1 text-sm text-slate-600">Speak to the property directly once your booking is confirmed.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="mb-4 border-b border-line pb-3 text-xl font-bold">Facilities</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(property.facilities || []).map((facility) => {
                  const key = facility.toLowerCase();
                  const Icon = key.includes("wifi")
                    ? Wifi
                    : key.includes("parking")
                    ? Car
                    : key.includes("hot water")
                    ? Droplets
                    : key.includes("bonfire")
                    ? Flame
                    : key.includes("generator") || key.includes("power")
                    ? Zap
                    : key.includes("family")
                    ? Users
                    : key.includes("airport")
                    ? PlaneTakeoff
                    : key.includes("service") || key.includes("breakfast")
                    ? Utensils
                    : key.includes("ac") || key.includes("air")
                    ? Wind
                    : ShieldCheck;
                  return (
                    <div key={facility} className="flex items-center gap-3 text-slate-700">
                      <Icon size={20} className="text-primary-700" />
                      <span className="text-sm font-medium">{facility}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="mb-4 border-b border-line pb-3 text-xl font-bold">Location</h2>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-container-lowest p-4">
                <MapPin size={22} className="text-primary-700" />
                <div>
                  <p className="font-semibold text-ink">{property.address}</p>
                  <p className="text-sm text-slate-600">{property.area}, {property.city}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Booking sidebar */}
          <aside className="w-full shrink-0 lg:w-[380px]">
            <div className="panel sticky top-28 p-6">
              <div className="mb-5 flex items-end justify-between border-b border-line pb-4">
                <div>
                  <p className="text-sm text-slate-600">Price</p>
                  <p className="text-2xl font-extrabold text-ink">{currency(property.nightlyRatePkr)}<span className="text-sm font-semibold text-slate-600"> / night</span></p>
                </div>
                <p className="flex items-center gap-1 text-sm text-slate-700"><Users size={16} /> Up to {property.maxGuests}</p>
              </div>
              <p className="mb-4 text-sm text-slate-600">Check-in {property.checkInTime} - Check-out {property.checkOutTime}</p>

              {booking ? (
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-primary-800">
                  <p className="font-bold">Booking {booking.status}</p>
                  <p className="mt-1 text-sm">{nights} night(s) - {currency(booking.totalPkr ?? totalPkr)} total</p>
                </div>
              ) : (
                <form onSubmit={submitBooking} className="grid gap-4">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-container-lowest p-1">
                    <label className="border-r border-line p-2 text-sm">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">Check-in</span>
                      <input type="date" className="w-full border-none bg-transparent p-0 font-medium text-ink outline-none" min={todayIso()} value={form.checkInDate} onChange={(event) => setForm((p) => ({ ...p, checkInDate: event.target.value }))} required />
                    </label>
                    <label className="p-2 text-sm">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">Check-out</span>
                      <input type="date" className="w-full border-none bg-transparent p-0 font-medium text-ink outline-none" min={form.checkInDate} value={form.checkOutDate} onChange={(event) => setForm((p) => ({ ...p, checkOutDate: event.target.value }))} required />
                    </label>
                  </div>
                  <label className="grid gap-2 font-semibold">
                    Guests
                    <input type="number" min={1} max={property.maxGuests} className="input" value={form.guestCount} onChange={(event) => setForm((p) => ({ ...p, guestCount: Number(event.target.value || 1) }))} />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Contact phone
                    <input className="input" placeholder="03xx-xxxxxxx" value={form.contactPhone} onChange={(event) => setForm((p) => ({ ...p, contactPhone: event.target.value }))} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Special requests (optional)
                    <textarea className="input min-h-[70px]" value={form.specialRequests} onChange={(event) => setForm((p) => ({ ...p, specialRequests: event.target.value }))} />
                  </label>

                  <div className="space-y-2 border-t border-line pt-4 text-sm text-slate-700">
                    <div className="flex justify-between"><span>{currency(property.nightlyRatePkr)} x {nights} night(s)</span><span>{currency(subtotal)}</span></div>
                    <div className="flex justify-between"><span>Service fee (5%)</span><span>{currency(serviceFee)}</span></div>
                    <div className="flex justify-between"><span>Taxes (10%)</span><span>{currency(taxes)}</span></div>
                    <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink"><span>Total</span><span>{currency(totalPkr)}</span></div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-tertiary/20 bg-tertiary/5 p-3 text-xs text-ink">
                    <Info size={16} className="mt-0.5 shrink-0 text-tertiary" />
                    <p><strong>Instant contact:</strong> unlike Basera's monthly student bookings, short-stay host and property contact details are shared with you right away so they can confirm your check-in -- this isn't gated behind a paid confirmation.</p>
                  </div>

                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-accent-700">
                    Book This Stay <ArrowRight size={16} />
                  </button>
                  <p className="text-center text-xs text-slate-600">You won't be charged yet.</p>
                </form>
              )}
              {message && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
