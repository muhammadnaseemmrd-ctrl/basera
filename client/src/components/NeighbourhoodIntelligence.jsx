import { useEffect, useMemo, useState } from "react";
import { Bike, BookOpen, Bus, Camera, Clock, Landmark, MapPinned, Navigation, ShieldCheck, Utensils } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

const coordsOf = (entity = {}) => {
  if (entity.coordinates?.lat && entity.coordinates?.lng) return entity.coordinates;
  if (Array.isArray(entity.location?.coordinates)) return { lat: entity.location.coordinates[1], lng: entity.location.coordinates[0] };
  if (entity.location?.lat && entity.location?.lng) return entity.location;
  return { lat: 33.6844, lng: 73.0479 };
};

const fallbackNearby = {
  score: 82,
  label: "Strong",
  categoryScores: { university: 88, food: 78, transport: 84, pharmacy: 75, atm: 80, mosque: 86 },
  pois: [
    { id: "poi-campus", category: "university", name: "Campus gate", walkingMinutes: 9, distanceMeters: 520 },
    { id: "poi-food", category: "food", name: "Student food street", walkingMinutes: 7, distanceMeters: 430 },
    { id: "poi-stop", category: "transport", name: "Bus and rickshaw stop", walkingMinutes: 5, distanceMeters: 290 }
  ]
};

const fallbackCommute = {
  to: { label: "NUST" },
  walking: { distanceKm: 1.4, durationMin: 18 },
  driving: { distanceKm: 1.8, durationMin: 7, fareMin: 45, fareMax: 70 },
  bus: { distanceKm: 1.8, durationMin: 13 }
};

const iconFor = (category) => {
  const map = {
    university: Landmark,
    food: Utensils,
    transport: Bus,
    library: BookOpen,
    mosque: Landmark
  };
  return map[category] || MapPinned;
};

export function NeighbourhoodIntelligence({ entity = {}, title = "Neighbourhood Intelligence" }) {
  const coords = useMemo(() => coordsOf(entity), [entity]);
  const city = entity.city || "Islamabad";
  const university = entity.nearestUniversity || entity.universities?.[0] || "NUST";
  const hostelRef = entity.hostel || entity.hostelId || entity.id || entity._id || entity.slug;
  const [nearby, setNearby] = useState(fallbackNearby);
  const [commute, setCommute] = useState(fallbackCommute);
  const [stories, setStories] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const [nearbyResult, commuteResult, storyResult, photoResult] = await Promise.all([
        safeRequest(() => api.get("/map/nearby", { params: { lat: coords.lat, lng: coords.lng, city } }), fallbackNearby),
        safeRequest(() => api.get("/map/commute", { params: { fromLat: coords.lat, fromLng: coords.lng, university, city } }), fallbackCommute),
        safeRequest(() => api.get("/map/stories", { params: { hostelId: hostelRef } }), { results: [] }),
        hostelRef ? safeRequest(() => api.get(`/hostels/${hostelRef}/photos`), { results: [] }) : Promise.resolve({ results: [] })
      ]);
      if (ignore) return;
      setNearby(nearbyResult || fallbackNearby);
      setCommute(commuteResult || fallbackCommute);
      setStories(storyResult.results || []);
      setPhotos(photoResult.results || []);
    };
    load();
    return () => {
      ignore = true;
    };
  }, [city, coords.lat, coords.lng, hostelRef, university]);

  const scoreEntries = Object.entries(nearby.categoryScores || fallbackNearby.categoryScores).slice(0, 6);
  const topPois = (nearby.pois || fallbackNearby.pois).slice(0, 8);
  const score = Number(nearby.score || 0);

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="badge bg-primary-50 text-primary-800"><MapPinned size={16} /> OSM neighbourhood layer</p>
            <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Nearby facilities, campus commute, safety context, and host-created map stories are loaded from the v5 map APIs.</p>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Area score</p>
            <p className="mt-2 text-4xl font-extrabold text-primary-800">{score}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{nearby.label || "Mapped"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Walk to campus", `${commute.walking?.durationMin || "-"} min`, `${commute.walking?.distanceKm || "-"} km`, Navigation],
            ["Rickshaw fare", `${currency(commute.driving?.fareMin || 0)}-${currency(commute.driving?.fareMax || 0)}`, `${commute.driving?.durationMin || "-"} min`, Bike],
            ["Public route", `${commute.bus?.durationMin || "-"} min`, commute.to?.label || university, Bus]
          ].map(([label, value, helper, Icon]) => (
            <article key={label} className="rounded-lg border border-line bg-surface p-4">
              <Icon className="text-primary-800" size={22} />
              <p className="mt-3 text-sm font-bold uppercase tracking-widest text-slate-600">{label}</p>
              <p className="mt-1 text-xl font-extrabold">{value}</p>
              <p className="mt-1 text-sm text-slate-700">{helper}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scoreEntries.map(([label, value]) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-600">
                <span>{label}</span>
                <span>{value}/100</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-primary-50">
                <div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.min(100, Number(value || 0))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Landmark size={22} /> Nearby Facilities</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {topPois.map((poi) => {
              const Icon = iconFor(poi.category);
              return (
                <article key={poi.id || poi.name} className="rounded-lg border border-line bg-canvas p-4">
                  <Icon className="text-primary-800" size={20} />
                  <p className="mt-3 font-bold">{poi.name}</p>
                  <p className="mt-1 text-sm text-slate-700">{poi.category} - {poi.walkingMinutes} min walk - {Math.round(poi.distanceMeters || 0)}m</p>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={22} /> Facilities Score Strip</h3>
            <div className="mt-5 grid gap-3">
              {["university", "transport", "food", "pharmacy"].map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3">
                  <span className="text-sm font-bold capitalize">{key}</span>
                  <span className="font-extrabold text-primary-800">{nearby.categoryScores?.[key] || 0}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Camera size={22} /> Photo Feed</h3>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(photos.length ? photos : [{ url: entity.image || entity.photos?.[0] || entity.gallery?.[0], caption: entity.name || entity.title }]).filter((photo) => photo.url).slice(0, 6).map((photo, index) => (
                <img key={`${photo.url}-${index}`} src={photo.url} alt={photo.caption || "Hostel photo"} className="aspect-square rounded-lg border border-line object-cover" />
              ))}
            </div>
            {!photos.length && <p className="mt-3 text-sm text-slate-700">Hostel photo API is ready. Upload real hostel feed photos to fill this grid.</p>}
          </section>
        </aside>
      </div>

      <section className="panel p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Clock size={22} /> Map Stories</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(stories.length ? stories : [{ id: "story-empty", title: "Neighbourhood tour not published yet", stops: [{ title: "Campus route", note: "Host can publish walking route highlights from the dashboard." }] }]).map((story) => (
            <article key={story.id || story._id || story.title} className="rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">{story.title}</p>
              <div className="mt-3 grid gap-2">
                {(story.stops || []).slice(0, 4).map((stop, index) => (
                  <p key={`${story.title}-${index}`} className="text-sm text-slate-700">
                    <span className="font-bold text-primary-800">{index + 1}.</span> {stop.title || stop.name || "Tour stop"} {stop.note ? `- ${stop.note}` : ""}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
