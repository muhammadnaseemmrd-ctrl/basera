import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronDown, Grid2X2, ListFilter, Map, MapPin, RefreshCw, ShieldCheck } from "lucide-react";
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
        className="bg-canvas py-10 lg:py-14"
        initial={motionSafe ? "hidden" : false}
        animate={motionSafe ? "show" : undefined}
        variants={motionSafe ? stagger() : undefined}
      >
      <div className="container-page">
        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="badge bg-primary-50 text-primary-700"><ShieldCheck size={14} /> Verified hostels</span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-on-surface">Find Student Housing</h1>
          </div>
          {/* View toggle, matching the List/Map segmented control from the search_results_map_view mockup */}
          <div className="flex w-fit items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
                view === "grid" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <Grid2X2 size={18} /> Grid
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
                view === "map" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <Map size={18} /> Map
            </button>
          </div>
        </motion.div>

        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit min-w-0 rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-28">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-on-surface">Filters</h2>
              <button type="button" onClick={clearFilters} className="btn-ghost -mr-2">Clear</button>
            </div>
            <div className="grid min-w-0 gap-6">
              <label className="grid gap-2 text-sm font-semibold text-on-surface">
                City
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
                  <select value={city} onChange={(event) => { setLoading(true); setCity(event.target.value); }} className="input pl-11">
                    <option>Islamabad</option>
                    <option>Lahore</option>
                    <option>Karachi</option>
                    <option>Rawalpindi</option>
                  </select>
                </div>
              </label>

              <div>
                <p className="mb-2 text-sm font-semibold text-on-surface">Hostel Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Boys", "Girls"].map((value) => (
                    <button
                      key={value}
                      onClick={() => { setLoading(true); setType(value); }}
                      className={`rounded border px-4 py-2.5 text-sm font-semibold ${
                        type === value ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line bg-surface text-on-surface-variant"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-sm font-semibold text-on-surface">Room Type</p>
                <div className="flex flex-wrap gap-2">
                  {roomTypeOptions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoomType(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${roomType === value ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line bg-surface-container-low text-on-surface-variant"}`}
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
                <div className="mb-3 flex justify-between text-sm font-semibold text-on-surface">
                  <span>Price Range</span>
                  <span className="font-bold text-primary-600">PKR 5k - {Math.round(maxPrice / 1000)}k</span>
                </div>
                <input value={maxPrice} onChange={(event) => { setLoading(true); setMaxPrice(Number(event.target.value)); }} type="range" min="5000" max="100000" className="w-full accent-primary-600" />
              </div>

              <label className="grid gap-2 text-sm font-semibold text-on-surface">
                Near University
                <select className="input">
                  <option>Near NUST (H-12)</option>
                  <option>Near FAST-NU</option>
                  <option>Near LUMS</option>
                </select>
              </label>

              <div>
                <p className="mb-3 text-sm font-semibold text-on-surface">Amenities</p>
                <div className="grid grid-cols-2 gap-3">
                  {amenityOptions.map((amenity) => (
                    <label key={amenity} className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={amenities.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                        className="h-4 w-4 accent-primary-600"
                      />
                      {amenity}
                    </label>
                  ))}
                </div>
              </div>

              <button className="rounded bg-primary-600 px-5 py-3 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">
                <ListFilter size={18} className="mr-2 inline" /> Apply Filters
              </button>
            </div>
          </aside>

          <section>
            <div className="mb-6 flex flex-col gap-5 rounded-lg border border-line bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-on-surface-variant">{loading ? "Loading hostels..." : <>Showing <strong className="text-on-surface">{filtered.length}</strong> results</>}</p>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span>Sort by:</span>
                <button className="flex items-center gap-2 font-semibold text-primary-700">
                  Price: Low to High <ChevronDown size={16} />
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
              <p className="mt-5 italic text-on-surface-variant">Showing {filtered.length} of {total} hostels in {city}</p>
            </div>
          </section>
        </motion.div>
      </div>
      </motion.main>
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="h-64 bg-surface-container-low" />
      <div className="space-y-4 p-6">
        <div className="h-6 w-2/3 rounded bg-surface-container-low" />
        <div className="h-4 w-1/2 rounded bg-surface-container-low" />
        <div className="flex gap-3">
          <div className="h-8 w-16 rounded-full bg-surface-container-low" />
          <div className="h-8 w-20 rounded-full bg-surface-container-low" />
        </div>
        <div className="flex justify-between border-t border-line pt-5">
          <div className="h-10 w-28 rounded bg-surface-container-low" />
          <div className="h-10 w-24 rounded bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}
