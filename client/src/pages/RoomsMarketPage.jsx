import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Filter, Grid2X2, Map as MapIcon, MapPin, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { AdvancedMapLayersPanel } from "../components/AdvancedMapLayersPanel";
import { RoomCard } from "../components/RoomCard";
import { SmartDiscoveryMap } from "../components/SmartDiscoveryMap";
import { roomListings } from "../data/mockData";
import { api, safeRequest } from "../services/api";
import { normalizeRooms } from "../utils/normalize";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const roomTypes = ["ALL", "SINGLE", "DOUBLE", "TRIPLE", "BUNK_DORM", "PG", "STUDIO", "ENTIRE_FLOOR"];
const listingCategories = ["ALL", "HOSTEL_ROOM", "PRIVATE_ROOM", "PG_ACCOMMODATION", "SHARED_ROOM", "ENTIRE_FLOOR"];

export function RoomsMarketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoomType = roomTypes.includes((searchParams.get("roomType") || "ALL").toUpperCase())
    ? (searchParams.get("roomType") || "ALL").toUpperCase()
    : "ALL";
  const initialCategory = listingCategories.includes((searchParams.get("listingCategory") || "ALL").toUpperCase())
    ? (searchParams.get("listingCategory") || "ALL").toUpperCase()
    : "ALL";
  const [city, setCity] = useState(searchParams.get("city") || "Islamabad");
  const [roomType, setRoomType] = useState(initialRoomType);
  const [listingCategory, setListingCategory] = useState(initialCategory);
  const [gender, setGender] = useState(searchParams.get("gender") || "any");
  const [university, setUniversity] = useState(searchParams.get("university") || "NUST");
  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get("maxPrice") || 45000));
  const [budgetMode, setBudgetMode] = useState(searchParams.get("budgetMode") === "true");
  const [view, setView] = useState(searchParams.get("view") === "map" ? "map" : "grid");
  const [bbox, setBbox] = useState(searchParams.get("bbox") || "");
  const [polygon, setPolygon] = useState(searchParams.get("polygon") || "");
  const [heatmap, setHeatmap] = useState([]);
  const [safety, setSafety] = useState([]);
  const [campus, setCampus] = useState(null);
  const [rooms, setRooms] = useState(roomListings);
  useDocumentTitle("Rooms Marketplace | Basera");

  const updateFilters = (next) => {
    const values = { city, roomType, listingCategory, gender, university, maxPrice, budgetMode, ...next };
    setCity(values.city);
    setRoomType(values.roomType);
    setListingCategory(values.listingCategory);
    setGender(values.gender);
    setUniversity(values.university);
    setMaxPrice(Number(values.maxPrice));
    setBudgetMode(Boolean(values.budgetMode));
    setSearchParams(
      Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => value && value !== "ALL" && value !== "any")
          .map(([key, value]) => [key, String(value)])
      )
    );
  };

  useEffect(() => {
    const endpoint = bbox || polygon ? "/rooms" : university ? "/rooms/recommendations" : "/rooms";
    safeRequest(
      () =>
        api.get(endpoint, {
          params: {
            city,
            roomType: roomType === "ALL" ? undefined : roomType,
            listingCategory: listingCategory === "ALL" ? undefined : listingCategory,
            gender: gender === "any" ? undefined : gender,
            university,
            maxPrice,
            bbox: bbox || undefined,
            polygon: polygon || undefined
          }
        }),
      { results: roomListings }
    ).then((result) => setRooms(normalizeRooms(result.results || roomListings)));
  }, [bbox, city, gender, listingCategory, maxPrice, polygon, roomType, university]);

  useEffect(() => {
    Promise.all([
      safeRequest(() => api.get("/map/heatmap", { params: { city, type: "availability", maxPrice } }), { points: [] }),
      safeRequest(() => api.get("/map/safety", { params: { city } }), { cells: [] }),
      university ? safeRequest(() => api.get("/map/campus", { params: { city, university } }), null) : Promise.resolve(null)
    ]).then(([heatmapResult, safetyResult, campusResult]) => {
      setHeatmap(heatmapResult.points || []);
      setSafety(safetyResult.cells || []);
      setCampus(campusResult);
    });
  }, [city, maxPrice, university]);

  const filtered = useMemo(
    () =>
      rooms
        .filter((room) => room.city === city)
        .filter((room) => roomType === "ALL" || room.roomType === roomType)
        .filter((room) => listingCategory === "ALL" || room.listingCategory === listingCategory)
        .filter((room) => gender === "any" || room.genderPolicy?.toLowerCase().includes(gender))
        .map((room) => {
          const totalMonthlyCost = Number(room.pricePerHead || 0) + Number(room.mealCost || 0) + Math.round(Number(room.distanceToUniversity || 4) * 28 * 22) + Number(room.utilityEstimate || 1200);
          const ratio = totalMonthlyCost / Math.max(Number(maxPrice || 1), 1);
          return { ...room, totalMonthlyCost, budgetFit: ratio <= 1 ? "within" : ratio <= 1.1 ? "near" : "over" };
        })
        .filter((room) => Number(room.pricePerHead) <= maxPrice)
        .filter((room) => !budgetMode || room.totalMonthlyCost <= maxPrice),
    [budgetMode, city, gender, listingCategory, maxPrice, roomType, rooms]
  );

  return (
    <>
      <Helmet>
        <title>Rooms Marketplace | Basera</title>
        <meta name="description" content="Browse private rooms, PG accommodation, shared rooms, studios, and hostel seats in Pakistan." />
      </Helmet>
      <main className="bg-canvas">
        <div className="container-page py-10">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="badge bg-primary-50 text-primary-700"><Building2 size={14} /> Room Marketplace</span>
              <h1 className="mt-4 font-display text-4xl font-bold text-on-surface">Find Rooms, PGs, Shared Beds, and Floors</h1>
              <p className="mt-3 max-w-3xl text-on-surface-variant">Pakistan-native room types with live bed availability, meal plans, curfew details, and verified Hosts.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/landlord/onboarding" className="rounded bg-primary-600 px-5 py-3 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">List a Room</Link>
              {/* View toggle, matching the List/Map segmented control from the search_results_map_view mockup */}
              <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "grid" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"}`}
                >
                  <Grid2X2 size={16} /> List
                </button>
                <button
                  type="button"
                  onClick={() => setView("map")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${view === "map" ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-low"}`}
                >
                  <MapIcon size={16} /> Map
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
            {/* Filter sidebar, matching the bordered aside panel from search_results_map_view */}
            <aside className="rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-28">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-on-surface">Filters</h2>
                <Filter size={18} className="text-on-surface-variant" />
              </div>
              <div className="grid gap-5">
                <label className="grid gap-2 text-sm font-semibold text-on-surface">
                  City
                  <select className="input" value={city} onChange={(event) => updateFilters({ city: event.target.value })}>
                    <option>Islamabad</option>
                    <option>Lahore</option>
                    <option>Karachi</option>
                    <option>Peshawar</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-on-surface">
                  Near University
                  <select className="input" value={university} onChange={(event) => updateFilters({ university: event.target.value })}>
                    <option value="">Any</option>
                    <option>NUST</option>
                    <option>LUMS</option>
                    <option>FAST</option>
                    <option>IBA</option>
                  </select>
                </label>
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-semibold text-on-surface">Room Type</p>
                  <div className="flex flex-wrap gap-2">
                    {roomTypes.map((type) => (
                      <button key={type} type="button" onClick={() => updateFilters({ roomType: type })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${roomType === type ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line bg-surface-container-low text-on-surface-variant"}`}>
                        {type.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-on-surface">
                  Gender
                  <select className="input" value={gender} onChange={(event) => updateFilters({ gender: event.target.value })}>
                    <option value="any">Any</option>
                    <option value="boys">Boys</option>
                    <option value="girls">Female only</option>
                    <option value="professionals">Professionals</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-on-surface">
                  <span className="flex items-center justify-between">Budget <span className="text-primary-600">PKR {Number(maxPrice).toLocaleString("en-PK")}</span></span>
                  <input type="range" min="5000" max="90000" step="1000" value={maxPrice} onChange={(event) => updateFilters({ maxPrice: Number(event.target.value) })} className="accent-primary-600" />
                </label>
                <div className="min-w-0">
                  <p className="mb-2 text-sm font-semibold text-on-surface">Listing Category</p>
                  <div className="flex flex-wrap gap-2">
                    {listingCategories.map((category) => (
                      <button key={category} type="button" onClick={() => updateFilters({ listingCategory: category })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${listingCategory === category ? "border-primary-600 bg-primary-50 text-primary-700" : "border-line bg-surface-container-low text-on-surface-variant"}`}>
                        {category.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-line pt-4 text-xs">
                  <button type="button" onClick={() => updateFilters({ city: "Islamabad", university: "NUST", roomType: "ALL", maxPrice: 45000 })} className="chip"><MapPin size={13} /> Near NUST</button>
                  <button type="button" onClick={() => updateFilters({ city: "Lahore", university: "LUMS", roomType: "PG", listingCategory: "PG_ACCOMMODATION" })} className="chip">Near LUMS</button>
                  <button type="button" onClick={() => updateFilters({ gender: "girls" })} className="chip">Female-only</button>
                  <button type="button" onClick={() => updateFilters({ maxPrice: 15000 })} className="chip">Under 15K</button>
                  <button type="button" onClick={() => updateFilters({ budgetMode: !budgetMode })} className={`chip ${budgetMode ? "border-primary-600 bg-primary-50 text-primary-700" : ""}`}>Budget mode {budgetMode ? "On" : "Off"}</button>
                  <button type="button" onClick={() => updateFilters({ university: "" })} className="chip"><Sparkles size={13} /> Clear ranking</button>
                  <span className="chip"><SlidersHorizontal size={13} /> Instalments</span>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-container-low px-4 py-3">
                <p className="text-sm text-on-surface-variant">
                  <strong className="text-on-surface">{filtered.length}</strong> matching rooms with bed-level availability.
                  {university && <span className="ml-2 inline-flex items-center gap-1 font-semibold text-primary-700"><Sparkles size={14} /> Ranked near {university}</span>}
                </p>
                <span className="badge bg-surface text-primary-700"><ShieldCheck size={13} /> Verified hosts only</span>
              </div>

              <AdvancedMapLayersPanel city={city} university={university || "NUST"} rooms={filtered} />

              {view === "map" ? (
                <SmartDiscoveryMap
                  rooms={filtered}
                  heatmap={heatmap}
                  safety={safety}
                  campus={campus}
                  height="680px"
                  onBoundsChange={(next) => setBbox((current) => (current === next ? current : next))}
                  onPolygonChange={(next) => setPolygon(next)}
                />
              ) : (
                <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((room) => <RoomCard key={room.id} room={room} />)}
                  {!filtered.length && (
                    <div className="rounded-lg border border-line bg-surface p-8 md:col-span-2 xl:col-span-3">
                      <h2 className="font-display text-xl font-bold text-on-surface">No rooms match these filters</h2>
                      <p className="mt-2 text-on-surface-variant">Try a higher budget, another city, or clear the room category filter.</p>
                      <button type="button" onClick={() => updateFilters({ city: "Islamabad", roomType: "ALL", listingCategory: "ALL", gender: "any", maxPrice: 90000 })} className="btn-secondary mt-5">
                        Clear Room Filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
