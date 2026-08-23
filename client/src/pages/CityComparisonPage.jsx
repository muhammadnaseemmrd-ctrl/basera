import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { BarChart3, Building2, MapPinned, ShieldCheck, Users } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import "leaflet/dist/leaflet.css";

const fallbackCities = [
  { city: "Islamabad", center: { lat: 33.6844, lng: 73.0479 }, roomCount: 48, averagePrice: 22000, safetyScore: 84, femaleOnlyAvailability: 12, topUniversity: "NUST", availabilityScore: 78 },
  { city: "Lahore", center: { lat: 31.5204, lng: 74.3587 }, roomCount: 64, averagePrice: 19500, safetyScore: 76, femaleOnlyAvailability: 18, topUniversity: "LUMS", availabilityScore: 82 },
  { city: "Karachi", center: { lat: 24.8607, lng: 67.0011 }, roomCount: 42, averagePrice: 21000, safetyScore: 68, femaleOnlyAvailability: 14, topUniversity: "IBA", availabilityScore: 70 }
];

export function CityComparisonPage() {
  useDocumentTitle("Compare Cities | Basera");
  const [cities, setCities] = useState(fallbackCities);
  const [selected, setSelected] = useState("Islamabad,Lahore,Karachi");

  useEffect(() => {
    safeRequest(() => api.get("/map/city-comparison", { params: { cities: selected } }), { results: fallbackCities }).then((result) => {
      setCities(result.results?.length ? result.results : fallbackCities);
    });
  }, [selected]);

  const center = useMemo(() => {
    const city = cities[0]?.center || fallbackCities[0].center;
    return [city.lat, city.lng];
  }, [cities]);

  return (
    <>
      <Helmet>
        <title>Compare Cities | Basera</title>
        <meta name="description" content="Compare hostel prices, student availability, safety scores, and university proximity across Pakistani cities." />
      </Helmet>
      <main className="container-page py-10">
        <section className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="badge bg-primary-50 text-primary-800"><BarChart3 size={16} /> City comparison v5</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Choose the best city for your student housing plan</h1>
            <p className="mt-4 max-w-3xl text-slate-700">Compare rent, hostel supply, female-only availability, and safety context before selecting listings.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setSelected("Islamabad,Lahore,Karachi")} className="btn-primary">Major Cities</button>
              <button type="button" onClick={() => setSelected("Islamabad,Rawalpindi,Lahore")} className="btn-secondary">North Cluster</button>
              <Link to="/rooms?view=map" className="btn-secondary"><MapPinned size={18} /> Open Room Map</Link>
            </div>
          </div>
          <div className="panel overflow-hidden">
            <div className="h-[360px]">
              <MapContainer center={center} zoom={6} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {cities.map((city) => (
                  <CircleMarker
                    key={city.city}
                    center={[city.center.lat, city.center.lng]}
                    radius={Math.max(14, Math.round(city.availabilityScore / 3))}
                    pathOptions={{ color: "#F0512E", fillColor: city.safetyScore >= 80 ? "#057A55" : city.safetyScore >= 70 ? "#F59E0B" : "#B91C1C", fillOpacity: 0.35 }}
                  >
                    <Popup>
                      <strong>{city.city}</strong><br />
                      {city.roomCount} rooms<br />
                      Average {currency(city.averagePrice)}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {cities.map((city) => (
            <article key={city.city} className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold">{city.city}</h2>
                  <p className="mt-1 text-sm text-slate-700">Top campus: {city.topUniversity}</p>
                </div>
                <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={14} /> {city.safetyScore}</span>
              </div>
              <div className="mt-6 grid gap-3">
                <Metric icon={Building2} label="Available Rooms" value={city.roomCount} />
                <Metric icon={BarChart3} label="Average Rent" value={currency(city.averagePrice)} />
                <Metric icon={Users} label="Female-only Options" value={city.femaleOnlyAvailability} />
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-600">
                  <span>Availability</span>
                  <span>{city.availabilityScore}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-primary-50">
                  <div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.min(100, city.availabilityScore)}%` }} />
                </div>
              </div>
              <Link to={`/rooms?city=${city.city}`} className="btn-primary mt-6 w-full">Browse {city.city}</Link>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <Icon className="text-primary-800" size={20} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
