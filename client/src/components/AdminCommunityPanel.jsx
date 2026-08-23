import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, MapPinned, Megaphone, Package, RefreshCw, Search, ShieldCheck, Trophy, X } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { ConfirmButton } from "./ui";
import { SmartDiscoveryMap } from "./SmartDiscoveryMap";

const idOf = (item) => item?.id || item?._id || item?.title;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-PK", { month: "short", day: "2-digit", year: "numeric" }) : "Not set");

export function AdminCommunityPanel() {
  const [message, setMessage] = useState("");
  const [queue, setQueue] = useState({ posts: [], marketplace: [], lostFound: [], visits: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [cityAnalytics, setCityAnalytics] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [complaintsHeatmap, setComplaintsHeatmap] = useState([]);
  const [platformHealthScore, setPlatformHealthScore] = useState(92);

  useEffect(() => {
    Promise.all([
      safeRequest(() => api.get("/community/admin/moderation"), { posts: [], marketplace: [], lostFound: [], visits: [] }),
      safeRequest(() => api.get("/community/leaderboard"), { results: [] }),
      safeRequest(() => api.get("/map/city-comparison"), { results: [] }),
      safeRequest(() => api.get("/map/heatmap", { params: { city: "Islamabad", type: "availability" } }), { points: [] }),
      safeRequest(() => api.get("/map/heatmap", { params: { city: "Islamabad", type: "complaints" } }), { points: [], platformHealthScore: 92 })
    ]).then(([queueResult, leaderboardResult, cityResult, heatmapResult, complaintsResult]) => {
      setQueue({
        posts: queueResult.posts || [],
        marketplace: queueResult.marketplace || [],
        lostFound: queueResult.lostFound || [],
        visits: queueResult.visits || []
      });
      setLeaderboard(leaderboardResult.results || []);
      setCityAnalytics(cityResult.results || []);
      setHeatmap(heatmapResult.points || []);
      setComplaintsHeatmap(complaintsResult.points || []);
      setPlatformHealthScore(complaintsResult.platformHealthScore || 92);
    });
  }, []);

  const notify = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2600);
  };

  const moderatePost = async (post, status) => {
    const result = await safeRequest(() => api.put(`/community/feed/${idOf(post)}/moderate`, { status, note: `Admin marked ${status}` }), { post: { ...post, status }, demo: true });
    setQueue((current) => ({
      ...current,
      posts: current.posts.map((entry) => (idOf(entry) === idOf(post) ? result.post : entry))
    }));
    notify(result.demo ? "Post moderated in demo mode." : "Post moderation saved.");
  };

  const updateVisit = async (visit, status) => {
    const result = await safeRequest(() => api.put(`/community/visits/${idOf(visit)}/status`, { status }), { visit: { ...visit, status }, demo: true });
    setQueue((current) => ({
      ...current,
      visits: current.visits.map((entry) => (idOf(entry) === idOf(visit) ? result.visit : entry))
    }));
    notify(result.demo ? "Visit updated in demo mode." : "Visit updated.");
  };

  const updateMarketplace = async (item, status) => {
    const result = await safeRequest(() => api.put(`/community/marketplace/${idOf(item)}/status`, { status }), { item: { ...item, status }, demo: true });
    setQueue((current) => ({
      ...current,
      marketplace: current.marketplace.map((entry) => (idOf(entry) === idOf(item) ? result.item : entry))
    }));
    notify("Marketplace status updated.");
  };

  const resolveLostFound = async (item) => {
    const result = await safeRequest(() => api.put(`/community/lost-found/${idOf(item)}/claim`, { status: "claimed", claimNote: "Resolved by admin." }), { item: { ...item, status: "claimed" }, demo: true });
    setQueue((current) => ({
      ...current,
      lostFound: current.lostFound.map((entry) => (idOf(entry) === idOf(item) ? result.item : entry))
    }));
    notify("Lost and found report resolved.");
  };

  const invalidateMapCache = async () => {
    const result = await safeRequest(() => api.post("/map/cache/invalidate"), { invalidated: true, demo: true });
    notify(result.demo ? "Map cache invalidated in demo mode." : "Map cache invalidated.");
  };

  const pendingPosts = queue.posts.filter((post) => post.status === "pending").length;
  const openLost = queue.lostFound.filter((item) => item.status === "open").length;
  const pendingVisits = queue.visits.filter((visit) => visit.status === "pending").length;

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold">Community Moderation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Approve community posts, supervise hostel activity flows, and monitor automated host scores.</p>
        </div>
        <span className="badge bg-primary-50 text-primary-800"><ShieldCheck size={16} /> admin review required</span>
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <div className="grid gap-5 md:grid-cols-4">
        <Metric icon={Megaphone} label="Pending posts" value={pendingPosts} />
        <Metric icon={Search} label="Open lost/found" value={openLost} />
        <Metric icon={CalendarDays} label="Pending visits" value={pendingVisits} />
        <Metric icon={Trophy} label="Scored hostels" value={leaderboard.length} />
        <Metric icon={ShieldCheck} label="Health score" value={`${platformHealthScore}%`} />
      </div>

      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="panel p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned className="text-primary-800" /> Admin City Analytics Map</h3>
              <p className="mt-1 text-sm text-slate-700">Availability intensity and city-level market quality from the v5 map APIs.</p>
            </div>
            <button type="button" onClick={invalidateMapCache} className="btn-secondary py-2"><RefreshCw size={16} /> Clear Cache</button>
          </div>
          <SmartDiscoveryMap
            cards={false}
            height="360px"
            heatmap={heatmap}
            rooms={(cityAnalytics.length ? cityAnalytics : [{ city: "Islamabad", center: { lat: 33.6844, lng: 73.0479 }, averagePrice: 22000, roomCount: 48, availabilityScore: 78 }]).map((city) => ({
              id: city.city,
              title: `${city.city} market`,
              city: city.city,
              area: city.topUniversity || "Student cluster",
              coordinates: city.center,
              pricePerHead: city.averagePrice,
              availableBeds: city.roomCount,
              totalBeds: 100,
              roomType: "CITY",
              genderPolicy: "ADMIN"
            }))}
          />
        </div>
        <aside className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><BarChart3 className="text-primary-800" /> City Market Scores</h3>
          <div className="mt-5 grid gap-4">
            {(cityAnalytics.length ? cityAnalytics : [{ city: "Islamabad", averagePrice: 22000, safetyScore: 84, availabilityScore: 78, roomCount: 48 }]).map((city) => (
              <article key={city.city} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{city.city}</p>
                  <span className="badge bg-primary-50 text-primary-800">{city.roomCount} rooms</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">Average rent PKR {Number(city.averagePrice || 0).toLocaleString("en-PK")} - safety {city.safetyScore}/100</p>
                <div className="mt-3 h-2 rounded-full bg-primary-50">
                  <div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.min(100, Number(city.availabilityScore || 0))}%` }} />
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned className="text-primary-800" /> Complaints Heatmap</h3>
          <p className="mt-1 text-sm text-slate-700">Admin-curated complaint density by area. Hostels with chronic upheld complaints enter improvement mode.</p>
          <div className="mt-5">
            <SmartDiscoveryMap
              cards={false}
              height="320px"
              heatmap={complaintsHeatmap}
              rooms={(complaintsHeatmap.length ? complaintsHeatmap : [{ lat: 33.6844, lng: 73.0479, title: "F-10 improvement cluster", area: "F-10", complaints: 3 }]).map((point, index) => ({
                id: `complaint-${index}`,
                title: point.title || `${point.area} complaints`,
                city: "Islamabad",
                area: point.area || "Student cluster",
                coordinates: { lat: point.lat, lng: point.lng },
                pricePerHead: Number(point.complaints || 0),
                availableBeds: Number(point.complaints || 0),
                totalBeds: 10,
                roomType: "COMPLAINTS",
                genderPolicy: point.underImprovement ? "IMPROVEMENT" : "HEALTHY"
              }))}
            />
          </div>
        </div>
        <aside className="panel p-6">
          <h3 className="text-xl font-bold">Improvement Mode</h3>
          <div className="mt-5 grid gap-3">
            {(complaintsHeatmap.length ? complaintsHeatmap : [{ area: "F-10", complaints: 3, underImprovement: true }, { area: "G-11", complaints: 1, underImprovement: false }]).slice(0, 5).map((point) => (
              <article key={`${point.area}-${point.title}`} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{point.area || point.title}</p>
                  <span className={`badge ${point.underImprovement ? "bg-[#FEF3C7] text-[#92400E]" : "bg-accent-50 text-accent-700"}`}>{point.underImprovement ? "Improvement" : "Healthy"}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{point.complaints || 0} complaint signals in this area.</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="panel overflow-hidden">
          <div className="p-6">
            <h3 className="text-xl font-bold">Community Post Queue</h3>
            <p className="mt-1 text-sm text-slate-700">Student-submitted content remains pending until approved.</p>
          </div>
          <div className="grid gap-4 p-5">
            {(queue.posts.length ? queue.posts : [{ id: "post-empty", title: "No posts", body: "Community queue is empty.", status: "published", authorName: "System" }]).map((post) => (
              <article key={idOf(post)} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`badge ${post.status === "published" ? "bg-accent-50 text-accent-700" : post.status === "rejected" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{post.status}</span>
                      <span className="chip">{post.authorName || "Student"}</span>
                    </div>
                    <h4 className="mt-3 text-lg font-bold">{post.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{post.body}</p>
                  </div>
                  {post.status === "pending" && (
                    <div className="flex gap-2 lg:grid">
                      <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject post" onConfirm={() => moderatePost(post, "rejected")}><X size={16} /> Reject</ConfirmButton>
                      <button type="button" className="btn-primary py-2" onClick={() => moderatePost(post, "published")}><CheckCircle2 size={16} /> Approve</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Trophy className="text-primary-800" /> Host Leaderboard</h3>
          <div className="mt-5 grid gap-3">
            {(leaderboard.length ? leaderboard : [{ id: "leader-empty", name: "No scored hostels", score: 0, label: "waiting for data" }]).slice(0, 5).map((hostel, index) => (
              <div key={idOf(hostel)} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-canvas p-4">
                <div>
                  <p className="font-bold">#{index + 1} {hostel.name}</p>
                  <p className="mt-1 text-sm text-slate-700">{hostel.label || "host score"}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-50 font-extrabold text-accent-700">{hostel.score}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-7 xl:grid-cols-3">
        <QueueCard title="Marketplace Moderation" icon={Package}>
          {(queue.marketplace.length ? queue.marketplace : [{ id: "market-empty", title: "No marketplace items", sellerName: "System", price: 0, status: "active" }]).slice(0, 5).map((item) => (
            <article key={idOf(item)} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{item.title}</h4>
                  <p className="mt-1 text-sm text-slate-700">{item.sellerName || "Student"} - PKR {Number(item.price || 0).toLocaleString("en-PK")}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-800">{item.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="btn-secondary py-2" onClick={() => updateMarketplace(item, "hidden")}>Hide</button>
                <button type="button" className="btn-primary py-2" onClick={() => updateMarketplace(item, "active")}>Approve</button>
              </div>
            </article>
          ))}
        </QueueCard>

        <QueueCard title="Lost & Found Oversight" icon={Search}>
          {(queue.lostFound.length ? queue.lostFound : [{ id: "lost-empty", itemName: "No lost/found reports", location: "-", status: "closed" }]).slice(0, 5).map((item) => (
            <article key={idOf(item)} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{item.itemName}</h4>
                  <p className="mt-1 text-sm text-slate-700">{item.location}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-800">{item.status}</span>
              </div>
              {item.status === "open" && <button type="button" className="btn-primary mt-4 w-full py-2" onClick={() => resolveLostFound(item)}>Resolve</button>}
            </article>
          ))}
        </QueueCard>

        <QueueCard title="Visit Oversight" icon={CalendarDays}>
          {(queue.visits.length ? queue.visits : [{ id: "visit-empty", studentName: "No visits", hostelName: "All hostels", status: "none" }]).slice(0, 5).map((visit) => (
            <article key={idOf(visit)} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{visit.studentName || "Student"}</h4>
                  <p className="mt-1 text-sm text-slate-700">{visit.hostelName} - {formatDate(visit.preferredDate)}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-800">{visit.status}</span>
              </div>
              {visit.status === "pending" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Decline" onConfirm={() => updateVisit(visit, "declined")}>Decline</ConfirmButton>
                  <button type="button" className="btn-primary py-2" onClick={() => updateVisit(visit, "confirmed")}>Confirm</button>
                </div>
              )}
            </article>
          ))}
        </QueueCard>
      </section>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
          <p className="mt-3 text-3xl font-extrabold">{value}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-50 text-primary-800"><Icon /></span>
      </div>
    </article>
  );
}

function QueueCard({ title, icon: Icon, children }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold"><Icon className="text-primary-800" /> {title}</h3>
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </section>
  );
}
