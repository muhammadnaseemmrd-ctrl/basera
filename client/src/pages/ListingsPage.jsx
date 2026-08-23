import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronDown, Grid2X2, ListFilter, Map, MapPin, RefreshCw } from "lucide-react";
import { HostelCard } from "../components/HostelCard";
import { HostelMap } from "../components/HostelMap";
import { hostels } from "../data/mockData";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { normalizeHostels } from "../utils/normalize";

const amenityOptions = ["WiFi", "AC", "Mess", "Parking", "CCTV", "Laundry"];
const roomTypeOptions = ["ALL", "SINGLE", "DOUBLE", "BUNK_DORM", "PG", "STUDIO"];

export function ListingsPage() {
  const [city, setCity] = useState("Islamabad");
  const [type, setType] = useState("Boys");
  const [roomType, setRoomType] = useState("ALL");
  const [maxPrice, setMaxPrice] = useState(25000);
  const [amenities, setAmenities] = useState(["WiFi", "Mess", "CCTV"]);
  const [view, setView] = useState("grid");
  const [items, setItems] = useState(hostels);
  const [total, setTotal] = useState(hostels.length);
  const [loading, setLoading] = useState(true);
  const motionSafe = useMotionSafe();
  useDocumentTitle(`Hostel Listings in ${city} | Basera`);

  useEffect(() => {
    let ignore = false;
    safeRequest(
      () =>
        api.get("/hostels", {
          params: {
            city,
            type: type.toLowerCase(),
            maxPrice,
            amenities: amenities.join(",")
          }
        }),
      { results: hostels }
    ).then((data) => {
      if (!ignore) {
        setItems(normalizeHostels(data.results || hostels));
        setTotal(data.total ?? data.results?.length ?? hostels.length);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [city, type, maxPrice, amenities]);

  const filtered = useMemo(() => {
    return items
      .filter((hostel) => hostel.city === city)
      .filter((hostel) => hostel.type === type || hostel.type === "Mixed")
      .filter((hostel) => hostel.price <= maxPrice)
      .sort((a, b) => a.price - b.price);
  }, [city, type, maxPrice, items]);

  const toggleAmenity = (amenity) => {
    setLoading(true);
    setAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]
    );
  };

  const clearFilters = () => {
    setLoading(true);
    setCity("Islamabad");
    setType("Boys");
    setRoomType("ALL");
    setMaxPrice(25000);
    setAmenities(["WiFi", "Mess", "CCTV"]);
  };

  return (
    <>
      <Helmet>
        <title>Hostel Listings in {city} | Basera</title>
        <meta name="description" content={`Browse verified student hostels in ${city} with filters for gender, budget, amenities, and university.`} />
      </Helmet>
      <motion.main
        className="container-page py-10 lg:py-14"
        initial={motionSafe ? "hidden" : false}
        animate={motionSafe ? "show" : undefined}
        variants={motionSafe ? stagger() : undefined}
      >
        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-4xl font-extrabold tracking-tight">Find Student Housing</h1>
          <div className="relative isolate inline-flex w-fit rounded-2xl border border-line bg-neutral-50 p-1 shadow-card">
            <motion.span
              layoutId="listingsViewPill"
              className={`absolute inset-y-1 z-0 w-[calc(50%-4px)] rounded-xl bg-white shadow-card ${view === "grid" ? "left-1" : "right-1"}`}
              transition={motionSafe ? { type: "spring", stiffness: 520, damping: 38 } : undefined}
            />
            <button
              onClick={() => setView("grid")}
              className={`relative z-10 flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition duration-250 ease-smooth ${
                view === "grid" ? "text-ink" : "text-neutral-700 hover:text-ink"
              }`}
            >
              <Grid2X2 size={19} /> Grid
            </button>
            <button
              onClick={() => setView("map")}
              className={`relative z-10 flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition duration-250 ease-smooth ${
                view === "map" ? "text-ink" : "text-neutral-700 hover:text-ink"
              }`}
            >
              <Map size={19} /> Map
            </button>
          </div>
        </motion.div>

        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="panel h-fit min-w-0 p-7 lg:sticky lg:top-28">
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase tracking-wide">Filters</h2>
              <button type="button" onClick={clearFilters} className="btn-ghost -mr-2">Clear</button>
            </div>
            <div className="grid min-w-0 gap-7">
              <label className="grid gap-3 font-medium">
                City
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                  <select value={city} onChange={(event) => { setLoading(true); setCity(event.target.value); }} className="input pl-12">
                    <option>Islamabad</option>
                    <option>Lahore</option>
                    <option>Karachi</option>
                    <option>Rawalpindi</option>
                  </select>
                </div>
              </label>

              <div>
                <p className="mb-3 font-medium">Hostel Type</p>
                <div className="grid grid-cols-2 gap-3">
                  {["Boys", "Girls"].map((value) => (
                    <button
                      key={value}
                      onClick={() => { setLoading(true); setType(value); }}
                      className={`rounded-md border px-4 py-3 font-semibold ${
                        type === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white text-slate-800"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <p className="mb-3 font-medium">Room Type</p>
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {roomTypeOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoomType(value)}
                      className={`chip shrink-0 ${roomType === value ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}
                    >
                      {value.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <Link
                  to={`/rooms?city=${encodeURIComponent(city)}&gender=${type === "Girls" ? "girls" : "boys"}&roomType=${roomType}&maxPrice=${maxPrice}`}
                  className="btn-secondary mt-4 w-full"
                >
                  Search Room-Level Inventory
                </Link>
              </div>

              <div>
                <div className="mb-4 flex justify-between font-medium">
                  <span>Price Range</span>
                  <span className="font-bold text-primary-800">PKR 5k - {Math.round(maxPrice / 1000)}k</span>
                </div>
                <input value={maxPrice} onChange={(event) => { setLoading(true); setMaxPrice(Number(event.target.value)); }} type="range" min="5000" max="100000" className="w-full accent-primary-700" />
              </div>

              <label className="grid gap-3 font-medium">
                Near University
                <select className="input">
                  <option>Near NUST (H-12)</option>
                  <option>Near FAST-NU</option>
                  <option>Near LUMS</option>
                </select>
              </label>

              <div>
                <p className="mb-4 font-medium">Amenities</p>
                <div className="grid grid-cols-2 gap-3">
                  {amenityOptions.map((amenity) => (
                    <label key={amenity} className="flex items-center gap-3 text-slate-800">
                      <input
                        type="checkbox"
                        checked={amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="h-5 w-5 accent-primary-700"
                      />
                      {amenity}
                    </label>
                  ))}
                </div>
              </div>

              <button className="btn-primary w-full">
                <ListFilter size={18} /> Apply Filters
              </button>
            </div>
          </aside>

          <section>
            <div className="panel mb-7 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg">{loading ? "Loading hostels..." : <>Showing <strong>{filtered.length}</strong> results</>}</p>
              <div className="flex items-center gap-4">
                <span>Sort by:</span>
                <button className="flex items-center gap-2 font-semibold text-primary-800">
                  Price: Low to High <ChevronDown size={18} />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {view === "map" ? (
                <motion.div
                  key="map"
                  initial={motionSafe ? { opacity: 0, y: 10 } : false}
                  animate={motionSafe ? { opacity: 1, y: 0 } : undefined}
                  exit={motionSafe ? { opacity: 0, y: -8 } : undefined}
                  transition={motionSafe ? transitions.base : undefined}
                >
                  <HostelMap hostels={filtered} height="560px" />
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={motionSafe ? { opacity: 0, y: 10 } : false}
                  animate={motionSafe ? { opacity: 1, y: 0 } : undefined}
                  exit={motionSafe ? { opacity: 0, y: -8 } : undefined}
                  transition={motionSafe ? transitions.base : undefined}
                  className="grid gap-7 md:grid-cols-2 xl:grid-cols-3"
                >
                  {filtered.map((hostel) => (
                    <HostelCard key={hostel.id} hostel={hostel} />
                  ))}
                  {loading && (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-16 text-center">
              <button className="btn-secondary rounded-full px-10">
                Load More <RefreshCw size={18} />
              </button>
              <p className="mt-5 italic text-slate-700">Showing {filtered.length} of {total} hostels in {city}</p>
            </div>
          </section>
        </motion.div>
      </motion.main>
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="panel overflow-hidden">
      <div className="h-64 bg-primary-50" />
      <div className="space-y-4 p-6">
        <div className="h-6 w-2/3 rounded bg-primary-50" />
        <div className="h-4 w-1/2 rounded bg-primary-50" />
        <div className="flex gap-3">
          <div className="h-8 w-16 rounded-full bg-primary-50" />
          <div className="h-8 w-20 rounded-full bg-primary-50" />
        </div>
        <div className="flex justify-between border-t border-line pt-5">
          <div className="h-10 w-28 rounded bg-primary-50" />
          <div className="h-10 w-24 rounded bg-primary-50" />
        </div>
      </div>
    </div>
  );
}
