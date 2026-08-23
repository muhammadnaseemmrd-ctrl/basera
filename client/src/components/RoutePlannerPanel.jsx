import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { Clock, MapPinned, Navigation, Plus, Route, Save, Share2, Trash2 } from "lucide-react";
import L from "leaflet";
import { api, safeRequest } from "../services/api";
import "leaflet/dist/leaflet.css";

const defaultStops = [
  { label: "NUST H-12 Gate", lat: 33.642, lng: 72.9908 },
  { label: "Cozy Boys Hostel F-10", lat: 33.6938, lng: 73.0139 },
  { label: "F-10 Markaz", lat: 33.6964, lng: 73.0091 }
];

const pointIcon = L.divIcon({
  className: "hh-cluster-marker",
  html: "<span style='background:#F0512E'>P</span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const fallbackRoute = {
  title: "Sample campus route",
  mode: "walking",
  totalDistanceKm: 2.4,
  totalDurationMin: 29,
  waypoints: defaultStops,
  geometry: defaultStops.map((stop) => [stop.lat, stop.lng]),
  shareCode: "HHROUTE-DEMO"
};

export function RoutePlannerPanel() {
  const [title, setTitle] = useState("Campus to hostel route");
  const [mode, setMode] = useState("walking");
  const [stops, setStops] = useState(defaultStops);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(fallbackRoute);
  const [message, setMessage] = useState("");

  useEffect(() => {
    safeRequest(() => api.get("/map/routes"), { results: [fallbackRoute] }).then((result) => {
      const rows = result.results || [fallbackRoute];
      setSavedRoutes(rows);
      if (rows[0]) setActiveRoute(rows[0]);
    });
  }, []);

  const center = useMemo(() => {
    const first = activeRoute?.waypoints?.[0] || stops[0] || defaultStops[0];
    return [Number(first.lat), Number(first.lng)];
  }, [activeRoute, stops]);

  const updateStop = (index, field, value) => {
    setStops((current) => current.map((stop, stopIndex) => (stopIndex === index ? { ...stop, [field]: field === "label" ? value : Number(value) } : stop)));
  };

  const addStop = () => {
    if (stops.length >= 6) return;
    setStops((current) => [...current, { label: `Stop ${current.length + 1}`, lat: 33.6844, lng: 73.0479 }]);
  };

  const removeStop = (index) => {
    if (stops.length <= 2) return;
    setStops((current) => current.filter((_, stopIndex) => stopIndex !== index));
  };

  const saveRoute = async (event) => {
    event.preventDefault();
    setMessage("Calculating route...");
    const result = await safeRequest(
      () => api.post("/map/route", { title, mode, waypoints: stops, save: true }),
      { route: { ...fallbackRoute, id: `route-${Date.now()}`, title, mode, waypoints: stops }, demo: true }
    );
    setActiveRoute(result.route || fallbackRoute);
    setSavedRoutes((current) => [result.route || fallbackRoute, ...current.filter((route) => (route.id || route._id) !== (result.route?.id || result.route?._id))]);
    setMessage(result.demo ? "Route saved in demo mode." : "Route saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  const geometry = activeRoute?.geometry?.length ? activeRoute.geometry : (activeRoute?.waypoints || stops).map((stop) => [Number(stop.lat), Number(stop.lng)]);

  return (
    <section className="grid gap-6 xl:grid-cols-[440px_1fr]">
      <form onSubmit={saveRoute} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Route size={22} /> Multi-stop Route Planner</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">Plan campus, hostel, market, and move-in stops. Routes are saved through the v5 map API and can be shared with family or roommates.</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Route Title
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Travel Mode
            <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="walking">Walking</option>
              <option value="driving">Rickshaw / Car</option>
              <option value="cycling">Bike</option>
            </select>
          </label>
          <div className="grid gap-3">
            {stops.map((stop, index) => (
              <div key={`${stop.label}-${index}`} className="rounded-lg border border-line bg-canvas p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-primary-800">Stop {index + 1}</p>
                  <button type="button" onClick={() => removeStop(index)} className="rounded-md p-2 text-slate-600 hover:bg-primary-50" aria-label="Remove stop"><Trash2 size={16} /></button>
                </div>
                <input className="input mb-2" value={stop.label} onChange={(event) => updateStop(index, "label", event.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="input" type="number" step="0.0001" value={stop.lat} onChange={(event) => updateStop(index, "lat", event.target.value)} />
                  <input className="input" type="number" step="0.0001" value={stop.lng} onChange={(event) => updateStop(index, "lng", event.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStop} className="btn-secondary"><Plus size={18} /> Add Stop</button>
          <button type="submit" className="btn-primary"><Save size={18} /> Save Route</button>
          {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
        </div>
      </form>

      <div className="space-y-6">
        <section className="panel overflow-hidden">
          <div className="grid gap-5 p-6 md:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Active route</p>
              <h3 className="mt-2 text-xl font-extrabold">{activeRoute?.title || "Route preview"}</h3>
            </div>
            <Metric icon={Navigation} label="Distance" value={`${activeRoute?.totalDistanceKm || 0} km`} />
            <Metric icon={Clock} label="Duration" value={`${activeRoute?.totalDurationMin || 0} min`} />
          </div>
          <div className="h-[420px] border-t border-line">
            <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={geometry} pathOptions={{ color: "#F0512E", weight: 5 }} />
              {(activeRoute?.waypoints || stops).map((stop, index) => (
                <Marker key={`${stop.label}-${index}`} position={[Number(stop.lat), Number(stop.lng)]} icon={pointIcon}>
                  <Popup>{stop.label}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned size={22} /> Saved Routes</h3>
            <span className="badge bg-primary-50 text-primary-800">{savedRoutes.length} saved</span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {(savedRoutes.length ? savedRoutes : [fallbackRoute]).map((route) => (
              <button key={route.id || route._id || route.shareCode} type="button" onClick={() => setActiveRoute(route)} className="rounded-lg border border-line bg-canvas p-4 text-left transition hover:border-primary-700 hover:bg-primary-50">
                <p className="font-bold">{route.title}</p>
                <p className="mt-1 text-sm text-slate-700">{route.totalDistanceKm || 0} km - {route.totalDurationMin || 0} min - {route.mode}</p>
                <p className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary-800"><Share2 size={14} /> {route.shareCode || "Share ready"}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <Icon className="text-primary-800" size={22} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
