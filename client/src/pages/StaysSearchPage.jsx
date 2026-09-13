import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { BedDouble, MapPin, ShieldCheck, Star, Users } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { stayProperties } from "../data/mockData";
import { currency } from "../utils/formatters";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const cities = ["Murree", "Naran", "Islamabad", "Lahore", "Karachi"];

const todayIso = () => new Date().toISOString().slice(0, 10);
const tomorrowIso = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function StayCard({ property }) {
  return (
    <div className="panel group h-full overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-50">
        <img src={property.image || property.images?.[0]} alt={property.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="badge bg-primary-700 text-white">{property.propertyType === "hotel" ? "Hotel" : "Guest House"}</span>
          {property.isVerified !== false && (
            <span className="badge bg-accent-700 text-white"><ShieldCheck size={14} /> Verified</span>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{property.name}</h3>
          <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-[#9B1C1C]">
            <Star size={16} /> {Number(property.rating?.average ?? property.rating ?? 4.5).toFixed(1)}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <MapPin size={16} /> {property.area}, {property.city}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <Users size={16} /> Up to {property.maxGuests} guests
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(property.facilities || []).slice(0, 3).map((facility) => (
            <span key={facility} className="chip">{facility}</span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
          <p>
            <span className="text-xl font-extrabold text-primary-800">{currency(property.nightlyRatePkr)}</span>
            <span className="text-sm text-slate-600"> /night</span>
          </p>
          <Link to={`/stays/${property.id || property._id}`} className="btn-primary px-4 py-2.5">
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

export function StaysSearchPage() {
  useDocumentTitle("Hotels & Guest Houses | Basera Stays");
  const [searchParams] = useSearchParams();
  // Homepage's unified search bar (Type = Hotel Room / Guest House) links here with a
  // ?city= param -- honor it if it matches one of our supported stay cities, otherwise
  // fall back to the original Murree default.
  const requestedCity = searchParams.get("city");
  const initialCity = cities.find((item) => item.toLowerCase() === (requestedCity || "").toLowerCase()) || "Murree";
  const [city, setCity] = useState(initialCity);
  const [checkInDate, setCheckInDate] = useState(todayIso());
  const [checkOutDate, setCheckOutDate] = useState(tomorrowIso());
  const [guestCount, setGuestCount] = useState(2);
  const [results, setResults] = useState(stayProperties);
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);

  const runSearch = () => {
    setLoading(true);
    safeRequest(
      () => api.get("/stays/properties", { params: { city, checkInDate, checkOutDate, guestCount } }),
      { results: stayProperties.filter((property) => property.city.toLowerCase() === city.toLowerCase()), demo: true }
    ).then((data) => {
      setResults(data.results || []);
      setDemo(Boolean(data.demo));
      setLoading(false);
    });
  };

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Helmet>
        <title>Hotels & Guest Houses | Basera Stays</title>
        <meta name="description" content="Book hotels and guest houses across Pakistan for short tourist stays -- nightly rates, date-range booking, no student contact-gating friction." />
      </Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">Hotels & Guest Houses</h1>
          <p className="mt-2 text-slate-700">Short tourist stays, priced per night -- separate from Basera's monthly student housing.</p>
        </div>

        <section className="panel mb-8 grid gap-4 p-6 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
          <label className="grid gap-2 font-semibold">
            City
            <select className="input" value={city} onChange={(event) => setCity(event.target.value)}>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-2 font-semibold">
            Check-in
            <input type="date" className="input" value={checkInDate} min={todayIso()} onChange={(event) => setCheckInDate(event.target.value)} />
          </label>
          <label className="grid gap-2 font-semibold">
            Check-out
            <input type="date" className="input" value={checkOutDate} min={checkInDate} onChange={(event) => setCheckOutDate(event.target.value)} />
          </label>
          <label className="grid gap-2 font-semibold">
            Guests
            <input type="number" min={1} max={20} className="input" value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value || 1))} />
          </label>
          <button type="button" className="btn-primary h-fit px-8 py-3" onClick={runSearch}>Search</button>
        </section>

        <p className="mb-5 text-slate-700">
          {loading ? "Searching..." : <>Showing <strong>{results.length}</strong> properties in {city}</>}
          {demo && <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-primary-800">Demo data</span>}
        </p>

        {results.length ? (
          <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {results.map((property) => (
              <StayCard key={property.id || property._id} property={property} />
            ))}
          </div>
        ) : (
          <div className="panel flex flex-col items-center gap-3 p-14 text-center text-slate-700">
            <BedDouble size={32} />
            <p>No properties match those dates yet. Try a different city or date range.</p>
          </div>
        )}
      </main>
    </>
  );
}
