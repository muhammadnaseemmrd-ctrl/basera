import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
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
  const totalPkr = nights * Number(property.nightlyRatePkr || 0);

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
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="badge bg-primary-700 text-white">{property.propertyType === "hotel" ? "Hotel" : "Guest House"}</span>
          {property.isVerified !== false && <span className="badge bg-accent-700 text-white"><ShieldCheck size={14} /> Verified</span>}
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-5 md:grid-cols-[1fr_300px]">
            <img src={(property.images || [property.image])[0]} alt={property.name} className="h-[380px] w-full rounded-xl border border-line object-cover" />
            <div className="grid gap-5">
              {(property.images || []).slice(1, 3).map((photo) => (
                <img key={photo} src={photo} alt={property.name} className="h-full min-h-[180px] w-full rounded-xl border border-line object-cover" />
              ))}
            </div>
          </div>

          <aside className="panel h-fit p-6 lg:sticky lg:top-28">
            <h1 className="text-2xl font-extrabold">{property.name}</h1>
            <p className="mt-3 flex items-center gap-2 text-slate-700"><MapPin size={18} /> {property.area}, {property.city}</p>
            <p className="mt-2 flex items-center gap-2 text-slate-700"><Users size={16} /> Up to {property.maxGuests} guests</p>
            <p className="mt-1 text-sm text-slate-600">Check-in {property.checkInTime} - Check-out {property.checkOutTime}</p>
            <div className="my-5 border-t border-line" />
            <p className="text-2xl font-extrabold text-primary-800">{currency(property.nightlyRatePkr)}<span className="text-sm font-semibold text-slate-600"> /night</span></p>

            {booking ? (
              <div className="mt-5 rounded-lg bg-accent-50 p-4 text-accent-700">
                <p className="font-bold">Booking {booking.status}</p>
                <p className="mt-1 text-sm">{nights} night(s) - {currency(booking.totalPkr ?? totalPkr)} total</p>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="mt-5 grid gap-4">
                <label className="grid gap-2 font-semibold">
                  Check-in
                  <input type="date" className="input" min={todayIso()} value={form.checkInDate} onChange={(event) => setForm((p) => ({ ...p, checkInDate: event.target.value }))} required />
                </label>
                <label className="grid gap-2 font-semibold">
                  Check-out
                  <input type="date" className="input" min={form.checkInDate} value={form.checkOutDate} onChange={(event) => setForm((p) => ({ ...p, checkOutDate: event.target.value }))} required />
                </label>
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
                <div className="rounded-lg bg-primary-50 p-4 text-sm text-primary-800">
                  <p className="flex items-center gap-2 font-bold"><CalendarDays size={16} /> {nights} night(s)</p>
                  <p className="mt-1">Total: <strong>{currency(totalPkr)}</strong></p>
                </div>
                <p className="flex items-start gap-2 text-xs text-slate-600">
                  <Phone size={14} className="mt-0.5 shrink-0" /> Short stays share your contact number with the property right away so they can confirm your check-in -- unlike Basera's monthly student bookings, this isn't gated behind a paid confirmation.
                </p>
                <button type="submit" className="btn-primary w-full">Book This Stay</button>
              </form>
            )}
            {message && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
          </aside>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="panel p-6">
              <h2 className="text-xl font-bold">About this stay</h2>
              <p className="mt-3 text-slate-700">{property.description}</p>
            </section>
            <section className="panel p-6">
              <h2 className="text-xl font-bold">Facilities</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(property.facilities || []).map((facility) => <span key={facility} className="chip">{facility}</span>)}
              </div>
            </section>
          </div>
          <aside className="panel h-fit p-6">
            <h2 className="text-lg font-bold">{property.address}</h2>
            <p className="mt-2 text-sm text-slate-700">{property.city}</p>
          </aside>
        </section>
      </main>
    </>
  );
}
