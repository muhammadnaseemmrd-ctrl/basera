import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Download, Map, ShieldCheck, WalletCards } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

const fallbackAffordability = {
  points: [
    { id: "r1", title: "Premium Single Seater near NUST", medianRent: 25000, totalMonthlyCost: 35500, affordabilityScore: 72 },
    { id: "r4", title: "NUST Double Sharing", medianRent: 12500, totalMonthlyCost: 23500, affordabilityScore: 88 }
  ],
  farePerKm: 28
};

const fallbackIsochrones = {
  university: { name: "NUST", city: "Islamabad" },
  rings: [
    { minutes: 10, radiusMeters: 750 },
    { minutes: 20, radiusMeters: 1500 },
    { minutes: 30, radiusMeters: 2250 }
  ]
};

const fallbackSafety = {
  cells: [
    { id: "safe-1", score: 86, confidence: 0.88, drivers: ["verified listings", "POI density"] },
    { id: "safe-2", score: 79, confidence: 0.8, drivers: ["admin flags", "incident history"] }
  ]
};

const fallbackDemand = {
  points: [
    { id: "demand-1", searchCount: 130, saveCount: 42, waitlistCount: 16, demandScore: 95 },
    { id: "demand-2", searchCount: 112, saveCount: 36, waitlistCount: 13, demandScore: 89 }
  ]
};

const fallbackParent = {
  score: 84,
  safety: { label: "Parent-safe summary", score: 84, notes: ["Verified listing data", "Contact gating active", "Deposit policy visible"] },
  paymentProtection: ["Escrow hold", "QR receipt verification", "Dispute support"],
  pois: [
    { id: "poi-1", name: "Pharmacy", category: "pharmacy", distanceMeters: 420 },
    { id: "poi-2", name: "Transport stop", category: "transport", distanceMeters: 260 }
  ]
};

const fallbackPack = {
  pack: {
    universityName: "NUST",
    city: "Islamabad",
    tileVersion: "osm-v1",
    sizeEstimateMb: 14,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    pois: fallbackParent.pois
  }
};

function average(rows, field) {
  if (!rows?.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) / rows.length);
}

export function AdvancedMapLayersPanel({ city = "Islamabad", university = "NUST", rooms = [] }) {
  const [affordability, setAffordability] = useState(fallbackAffordability);
  const [isochrones, setIsochrones] = useState(fallbackIsochrones);
  const [safety, setSafety] = useState(fallbackSafety);
  const [demand, setDemand] = useState(fallbackDemand);
  const [parent, setParent] = useState(fallbackParent);
  const [pack, setPack] = useState(fallbackPack.pack);

  const referenceRoom = useMemo(() => rooms.find((room) => room.coordinates?.lat && room.coordinates?.lng) || rooms[0] || {}, [rooms]);
  const referenceLat = referenceRoom.coordinates?.lat;
  const referenceLng = referenceRoom.coordinates?.lng;
  const bestAffordable = useMemo(
    () => [...(affordability.points || [])].sort((a, b) => Number(b.affordabilityScore || 0) - Number(a.affordabilityScore || 0))[0],
    [affordability]
  );
  const safetyScore = useMemo(() => average(safety.cells || [], "score"), [safety]);
  const demandScore = useMemo(() => average(demand.points || [], "demandScore"), [demand]);
  const parentScore = useMemo(() => {
    if (typeof parent.score === "object") return parent.score?.score || parent.safety?.score || 0;
    return parent.score || parent.safety?.score || 0;
  }, [parent]);

  useEffect(() => {
    Promise.all([
      safeRequest(() => api.get("/map/affordability", { params: { city } }), fallbackAffordability),
      safeRequest(() => api.get("/map/isochrones", { params: { city, university } }), fallbackIsochrones),
      safeRequest(() => api.get("/map/safety-confidence", { params: { city } }), fallbackSafety),
      safeRequest(() => api.get("/map/demand-pulse", { params: { city } }), fallbackDemand),
      safeRequest(() => api.get("/map/parent-summary", { params: { city, lat: referenceLat, lng: referenceLng } }), fallbackParent),
      safeRequest(() => api.get(`/map/offline-pack/${encodeURIComponent(university || "NUST")}`, { params: { city } }), fallbackPack)
    ]).then(([affordabilityResult, isochroneResult, safetyResult, demandResult, parentResult, packResult]) => {
      setAffordability(affordabilityResult || fallbackAffordability);
      setIsochrones(isochroneResult || fallbackIsochrones);
      setSafety(safetyResult || fallbackSafety);
      setDemand(demandResult || fallbackDemand);
      setParent(parentResult || fallbackParent);
      setPack(packResult.pack || fallbackPack.pack);
    });
  }, [city, referenceLat, referenceLng, university]);

  return (
    <section className="panel mb-7 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><Map size={16} /> Map v6 intelligence</p>
          <h2 className="mt-4 text-2xl font-extrabold">Affordability, Commute, Safety, Demand, and Parent Context</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-700">API-bound map layers summarize what should be overlaid on the discovery map and remain readable on mobile.</p>
        </div>
        <span className="badge bg-accent-50 text-accent-700"><Download size={14} /> Offline campus pack ready</span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-line bg-canvas p-4">
          <WalletCards className="text-primary-800" size={22} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">Best affordability</p>
          <p className="mt-2 text-xl font-extrabold">{bestAffordable?.affordabilityScore || 0}/100</p>
          <p className="mt-1 text-sm text-slate-700">{bestAffordable?.title || "No room"} - {currency(bestAffordable?.totalMonthlyCost)}</p>
        </article>
        <article className="rounded-lg border border-line bg-canvas p-4">
          <Clock className="text-primary-800" size={22} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">Isochrones</p>
          <p className="mt-2 text-xl font-extrabold">{isochrones.university?.name || university}</p>
          <p className="mt-1 text-sm text-slate-700">{(isochrones.rings || []).map((ring) => `${ring.minutes}m`).join(" / ")} walking rings</p>
        </article>
        <article className="rounded-lg border border-line bg-canvas p-4">
          <ShieldCheck className="text-primary-800" size={22} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">Safety confidence</p>
          <p className="mt-2 text-xl font-extrabold">{safetyScore}/100</p>
          <p className="mt-1 text-sm text-slate-700">{safety.cells?.length || 0} confidence cells from trust signals.</p>
        </article>
        <article className="rounded-lg border border-line bg-canvas p-4">
          <Activity className="text-primary-800" size={22} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">Demand pulse</p>
          <p className="mt-2 text-xl font-extrabold">{demandScore}/100</p>
          <p className="mt-1 text-sm text-slate-700">{(demand.points || []).reduce((sum, point) => sum + Number(point.searchCount || 0), 0)} searches in tracked zones.</p>
        </article>
        <article className="rounded-lg border border-line bg-canvas p-4">
          <Download className="text-primary-800" size={22} />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">Offline pack</p>
          <p className="mt-2 text-xl font-extrabold">{pack.sizeEstimateMb || 0} MB</p>
          <p className="mt-1 text-sm text-slate-700">{pack.universityName || university} - {pack.tileVersion}</p>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <article className="rounded-lg border border-line bg-canvas p-4">
          <p className="font-bold">Parent map summary</p>
          <p className="mt-2 text-sm text-slate-700">{parent.safety?.label || "Parent-safe summary"} score {parentScore}/100.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(parent.paymentProtection || []).map((item) => <span key={item} className="chip">{item}</span>)}
          </div>
        </article>
        <article className="rounded-lg border border-line bg-canvas p-4">
          <p className="font-bold">Nearby essentials</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(parent.pois || []).slice(0, 4).map((poi) => (
              <div key={poi.id || poi.name} className="rounded-md bg-surface px-3 py-2 text-sm">
                <strong>{poi.name || poi.category}</strong>
                <span className="ml-2 text-slate-600">{poi.distanceMeters ? `${poi.distanceMeters}m` : poi.category}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
