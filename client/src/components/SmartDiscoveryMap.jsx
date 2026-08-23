import { useState } from "react";
import { Link } from "react-router-dom";
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Edit3, Layers, LocateFixed, ShieldCheck, X } from "lucide-react";
import { RoomCard } from "./RoomCard";
import { currency } from "../utils/formatters";
import "leaflet/dist/leaflet.css";

const roomColor = (room) => {
  if (String(room.genderPolicy).includes("GIRLS")) return "#9D174D";
  if (room.roomType === "SINGLE") return "#1B2A4A";
  if (room.roomType === "DOUBLE") return "#0E7490";
  if (room.roomType === "PG") return "#6C2BD9";
  if (room.roomType === "BUNK_DORM") return "#D03801";
  return "#F0512E";
};

const priceLabel = (value) => `PKR ${Math.round(Number(value || 0) / 1000)}K`;
const coordsOf = (room) => {
  if (room.coordinates?.lat && room.coordinates?.lng) return room.coordinates;
  if (Array.isArray(room.location?.coordinates)) return { lat: room.location.coordinates[1], lng: room.location.coordinates[0] };
  if (room.location?.lat && room.location?.lng) return room.location;
  return null;
};

const priceIcon = (room, selected) => L.divIcon({
  className: "hh-price-marker",
  html: `<span style="--marker:${roomColor(room)}" class="${selected ? "selected" : ""}">${room.availableBeds <= 0 ? "Locked" : priceLabel(room.pricePerHead || room.pricePerBed)}</span>${room.instantBooking ? "<i>⚡</i>" : ""}`,
  iconSize: [74, 34],
  iconAnchor: [37, 17]
});

const clusterIcon = (count) => {
  const color = count < 10 ? "#057A55" : count <= 30 ? "#F59E0B" : "#B91C1C";
  return L.divIcon({
    className: "hh-cluster-marker",
    html: `<span style="background:${color}">${count}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
};

function MapEvents({ onBoundsChange, drawMode, setDrawPoints, setZoom }) {
  useMapEvents({
    moveend(event) {
      const bounds = event.target.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onBoundsChange?.(`${sw.lat.toFixed(5)},${sw.lng.toFixed(5)},${ne.lat.toFixed(5)},${ne.lng.toFixed(5)}`);
    },
    zoomend(event) {
      setZoom(event.target.getZoom());
    },
    click(event) {
      if (drawMode) setDrawPoints((current) => [...current, [event.latlng.lat, event.latlng.lng]]);
    },
    dblclick() {
      if (drawMode) setDrawPoints((current) => current.length >= 3 ? current : []);
    }
  });
  return null;
}

function groupedMarkers(rooms, zoom) {
  if (zoom > 11) return null;
  const groups = new Map();
  rooms.forEach((room) => {
    const coords = coordsOf(room);
    if (!coords) return;
    const key = `${Math.round(coords.lat * 6) / 6}:${Math.round(coords.lng * 6) / 6}`;
    const current = groups.get(key) || { lat: coords.lat, lng: coords.lng, count: 0 };
    current.count += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

export function SmartDiscoveryMap({
  rooms = [],
  cards = true,
  heatmap = [],
  safety = [],
  campus,
  height = "680px",
  onBoundsChange,
  onPolygonChange
}) {
  const [selectedId, setSelectedId] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [overlay, setOverlay] = useState("availability");
  const [zoom, setZoom] = useState(12);
  const validRooms = rooms.filter((room) => coordsOf(room)?.lat && coordsOf(room)?.lng);
  const center = coordsOf(validRooms[0]) || { lat: 33.6844, lng: 73.0479 };
  const clusters = groupedMarkers(validRooms, zoom);

  const selectedRoom = validRooms.find((room) => (room.id || room._id) === selectedId);

  const finishShape = () => {
    if (drawPoints.length >= 3) {
      onPolygonChange?.(JSON.stringify(drawPoints));
      setDrawMode(false);
    }
  };

  const clearShape = () => {
    setDrawPoints([]);
    onPolygonChange?.("");
  };

  const map = (
    <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-line bg-surface shadow-card" style={{ minHeight: height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom className="h-full min-h-[inherit] w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapEvents onBoundsChange={onBoundsChange} drawMode={drawMode} setDrawPoints={setDrawPoints} setZoom={setZoom} />

        {overlay === "availability" && heatmap.map((point, index) => (
          <CircleMarker key={`heat-${index}`} center={[point.lat, point.lng]} radius={Math.max(8, point.intensity * 28)} pathOptions={{ color: "#F0512E", fillColor: point.intensity > 0.7 ? "#EF4444" : point.intensity > 0.4 ? "#10B981" : "#3730A3", fillOpacity: 0.28, weight: 1 }} />
        ))}

        {overlay === "safety" && safety.map((cell) => (
          <CircleMarker key={cell.id} center={[cell.lat, cell.lng]} radius={34} pathOptions={{ color: cell.score >= 80 ? "#057A55" : cell.score >= 60 ? "#F59E0B" : "#B91C1C", fillOpacity: 0.18 }}>
            <Popup>{cell.label} - {cell.score}/100</Popup>
          </CircleMarker>
        ))}

        {campus?.polygon?.length ? (
          <>
            <Polygon positions={campus.polygon.map((point) => [point.lat, point.lng])} pathOptions={{ color: "#1B2A4A", fillColor: "#1B2A4A", fillOpacity: 0.08 }} />
            {campus.rings?.map((ring) => <Circle key={ring.label} center={[campus.university.lat, campus.university.lng]} radius={ring.radiusMeters} pathOptions={{ color: "#1B2A4A", dashArray: "6 6", fillOpacity: 0 }} />)}
          </>
        ) : null}

        {drawPoints.length >= 2 && <Polygon positions={drawPoints} pathOptions={{ color: "#F0512E", fillColor: "#F0512E", fillOpacity: 0.12 }} />}

        {clusters?.length ? clusters.map((cluster, index) => (
          <Marker key={`cluster-${index}`} position={[cluster.lat, cluster.lng]} icon={clusterIcon(cluster.count)}>
            <Popup>{cluster.count} listings in this area</Popup>
          </Marker>
        )) : validRooms.map((room) => {
          const coords = coordsOf(room);
          const id = room.id || room._id;
          return (
            <Marker key={id} position={[coords.lat, coords.lng]} icon={priceIcon(room, selectedId === id)} eventHandlers={{ click: () => setSelectedId(id), mouseover: () => setSelectedId(id) }}>
              <Popup>
                <div className="w-64">
                  {(room.photo || room.photos?.[0] || room.image) && <img src={room.photo || room.photos?.[0] || room.image} alt={room.title} className="mb-3 h-28 w-full rounded-md object-cover" />}
                  <p className="font-bold">{room.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{room.area}, {room.city}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="chip">{room.roomType}</span>
                    <span className="chip">{room.availableBeds}/{room.totalBeds} beds</span>
                  </div>
                  <Link to={`/rooms/${id}`} className="btn-primary mt-3 w-full py-2">View Details</Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute left-4 top-4 z-[500] flex flex-wrap gap-2">
        <button type="button" className={`rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-card ${drawMode ? "text-primary-800" : "text-slate-700"}`} onClick={() => setDrawMode((current) => !current)}><Edit3 size={15} className="inline" /> Draw</button>
        <button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-card" onClick={() => setOverlay((current) => current === "availability" ? "safety" : "availability")}><Layers size={15} className="inline" /> {overlay === "availability" ? "Availability" : "Safety"}</button>
        {drawPoints.length >= 3 && <button type="button" className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-bold text-white shadow-card" onClick={finishShape}>Search Shape</button>}
        {drawPoints.length > 0 && <button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-card" onClick={clearShape}><X size={15} className="inline" /> Clear</button>}
      </div>

      {selectedRoom && (
        <div className="absolute bottom-4 left-4 z-[500] hidden w-72 rounded-xl border border-line bg-white p-4 shadow-float lg:block">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-800">Selected listing</p>
          <h3 className="mt-2 font-bold">{selectedRoom.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{currency(selectedRoom.pricePerHead || selectedRoom.pricePerBed)} - {selectedRoom.availableBeds} beds left</p>
        </div>
      )}
    </div>
  );

  if (!cards) return map;

  return (
    <section className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
      <aside className="max-h-[680px] overflow-y-auto pr-1">
        <div className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">{validRooms.length} results in this area</p>
            <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={14} /> OSM powered</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">Pan, zoom, draw a preferred area, or click a price marker.</p>
        </div>
        <div className="grid gap-4">
          {validRooms.map((room) => (
            <div key={room.id || room._id} onMouseEnter={() => setSelectedId(room.id || room._id)} onFocus={() => setSelectedId(room.id || room._id)}>
              <RoomCard room={room} />
            </div>
          ))}
        </div>
      </aside>
      {map}
      <div className="xl:hidden">
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700"><LocateFixed size={16} /> Tap cards above to inspect matching pins.</p>
      </div>
    </section>
  );
}
