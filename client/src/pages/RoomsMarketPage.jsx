import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Filter, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";
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
      <main className="container-page py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="badge bg-accent-50 text-accent-700"><Building2 size={14} /> Room Marketplace v3</span>
            <h1 className="mt-4 text-4xl font-extrabold">Find Rooms, PGs, Shared Beds, and Floors</h1>
            <p className="mt-3 max-w-3xl text-slate-700">Pakistan-native room types with live bed availability, meal plans, curfew details, and verified Hosts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/landlord/onboarding" className="btn-primary">List a Room</Link>
            {["grid", "map"].map((mode) => (
              <button key={mode} type="button" onClick={() => setView(mode)} className={`btn-secondary capitalize ${view === mode ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}>{mode}</button>
            ))}
          </div>
        </div>

        <section className="panel mb-7 p-5">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)_180px_220px] lg:items-end">
            <label className="grid gap-2 font-semibold">
              City
              <select className="input" value={city} onChange={(event) => updateFilters({ city: event.target.value })}>
                <option>Islamabad</option>
                <option>Lahore</option>
                <option>Karachi</option>
                <option>Peshawar</option>
              </select>
            </label>
            <label className="grid gap-2 font-semibold">
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
              <p className="mb-2 font-semibold">Room Type</p>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {roomTypes.map((type) => (
                  <button key={type} type="button" onClick={() => updateFilters({ roomType: type })} className={`chip shrink-0 ${roomType === type ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}>
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-2 font-semibold">
              Gender
              <select className="input" value={gender} onChange={(event) => updateFilters({ gender: event.target.value })}>
                <option value="any">Any</option>
                <option value="boys">Boys</option>
                <option value="girls">Female only</option>
                <option value="professionals">Professionals</option>
              </select>
            </label>
            <label className="grid gap-2 font-semibold">
              Budget: PKR {Number(maxPrice).toLocaleString("en-PK")}
              <input type="range" min="5000" max="90000" step="1000" value={maxPrice} onChange={(event) => updateFilters({ maxPrice: Number(event.target.value) })} className="accent-primary-700" />
            </label>
          </div>
          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0">
              <p className="mb-2 font-semibold">Listing Category</p>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {listingCategories.map((category) => (
                  <button key={category} type="button" onClick={() => updateFilters({ listingCategory: category })} className={`chip shrink-0 ${listingCategory === category ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}>
                    {category.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-primary-50 p-4 text-sm text-slate-700">
              <strong className="text-ink">{filtered.length}</strong> matching rooms with bed-level availability.
              {university && <span className="mt-1 flex items-center gap-1 font-semibold text-primary-800"><Sparkles size={14} /> Ranked near {university}</span>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
            <button type="button" onClick={() => updateFilters({ city: "Islamabad", university: "NUST", roomType: "ALL", maxPrice: 45000 })} className="chip"><MapPin size={14} /> Near NUST</button>
            <button type="button" onClick={() => updateFilters({ city: "Lahore", university: "LUMS", roomType: "PG", listingCategory: "PG_ACCOMMODATION" })} className="chip">Near LUMS</button>
            <button type="button" onClick={() => updateFilters({ gender: "girls" })} className="chip">Female-only</button>
            <button type="button" onClick={() => updateFilters({ maxPrice: 15000 })} className="chip">Under 15K</button>
            <button type="button" onClick={() => updateFilters({ budgetMode: !budgetMode })} className={`chip ${budgetMode ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}>Budget mode {budgetMode ? "On" : "Off"}</button>
            <button type="button" onClick={() => updateFilters({ university: "" })} className="chip"><Sparkles size={14} /> Clear ranking</button>
            <span className="chip"><Filter size={14} /> Live availability</span>
            <span className="chip"><SlidersHorizontal size={14} /> Instalments</span>
          </div>
        </section>

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
          <section className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((room) => <RoomCard key={room.id} room={room} />)}
            {!filtered.length && (
              <div className="panel p-8 md:col-span-2 xl:col-span-3">
                <h2 className="text-xl font-bold">No rooms match these filters</h2>
                <p className="mt-2 text-slate-700">Try a higher budget, another city, or clear the room category filter.</p>
                <button type="button" onClick={() => updateFilters({ city: "Islamabad", roomType: "ALL", listingCategory: "ALL", gender: "any", maxPrice: 90000 })} className="btn-secondary mt-5">
                  Clear Room Filters
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
