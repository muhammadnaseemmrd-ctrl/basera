import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { currency, rating } from "../utils/formatters";

const markerIcon = L.divIcon({
  className: "hostel-map-marker",
  html: "<span></span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

function FitBounds({ points }) {
  const map = useMap();

  useMemo(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 14 });
  }, [map, points]);

  return null;
}

export function HostelMap({ hostels = [], className = "", height = "520px" }) {
  const validHostels = hostels.filter((hostel) => hostel.coordinates?.lat && hostel.coordinates?.lng);
  const points = validHostels.map((hostel) => [hostel.coordinates.lat, hostel.coordinates.lng]);
  const center = points[0] || [33.6844, 73.0479];

  return (
    <div className={`overflow-hidden rounded-lg border border-line bg-surface shadow-card ${className}`} style={{ minHeight: height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full min-h-[inherit] w-full">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {validHostels.map((hostel) => (
          <Marker key={hostel.id || hostel.slug} position={[hostel.coordinates.lat, hostel.coordinates.lng]} icon={markerIcon}>
            <Popup>
              <div className="w-56">
                <img src={hostel.image} alt={hostel.name} className="mb-3 h-24 w-full rounded-md object-cover" />
                <p className="font-bold">{hostel.name}</p>
                <p className="mt-1 text-sm text-slate-600">{hostel.area}, {hostel.city}</p>
                <p className="mt-2 text-sm"><strong>{currency(hostel.price)}</strong> /mo - {rating(hostel.rating)} rating</p>
                <Link to={hostel.detailUrl || `/hostels/${hostel.slug}`} className="mt-3 inline-flex font-semibold text-primary-800">
                  View details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
