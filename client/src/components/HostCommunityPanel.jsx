import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, FileSignature, MapPinned, Megaphone, Plus, Route, ShieldCheck, Trophy, Users } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { ConfirmButton } from "./ui";
import { SmartDiscoveryMap } from "./SmartDiscoveryMap";

const idOf = (item) => item?.id || item?._id || item?.title;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-PK", { month: "short", day: "2-digit", year: "numeric" }) : "Not set");

export function HostCommunityPanel({ title = "Community Operations", hostName = "Host" }) {
  const [notice, setNotice] = useState("");
  const [visits, setVisits] = useState([]);
  const [posts, setPosts] = useState([]);
  const [polls, setPolls] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [agreement, setAgreement] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [stories, setStories] = useState([]);
  const [postForm, setPostForm] = useState({ title: "Hostel update", body: "", type: "news", scope: "hostel", hostelId: "h1", hostelName: "Cozy Boys Hostel F-10" });
  const [pollForm, setPollForm] = useState({ title: "Mess menu feedback", description: "", options: "More rice options, Healthier breakfast, More tea timings", hostelId: "h1", hostelName: "Cozy Boys Hostel F-10" });
  const [storyForm, setStoryForm] = useState({
    hostelRef: "h1",
    hostelName: "Cozy Boys Hostel F-10",
    title: "F-10 walking tour",
    stopOneTitle: "Campus route",
    stopOneNote: "Best evening route from NUST shuttle stop.",
    stopTwoTitle: "Food street",
    stopTwoNote: "Affordable dinner options near the hostel."
  });

  useEffect(() => {
    Promise.all([
      safeRequest(() => api.get("/community/visits"), { results: [] }),
      safeRequest(() => api.get("/community/feed"), { results: [] }),
      safeRequest(() => api.get("/community/polls"), { results: [] }),
      safeRequest(() => api.get("/community/leaderboard"), { results: [] }),
      safeRequest(() => api.get("/community/agreements/b1"), { agreement: null }),
      safeRequest(() => api.get("/map/host-portfolio"), { results: [] }),
      safeRequest(() => api.get("/map/stories"), { results: [] })
    ]).then(([visitResult, feedResult, pollResult, leaderboardResult, agreementResult, portfolioResult, storyResult]) => {
      setVisits(visitResult.results || []);
      setPosts(feedResult.results || []);
      setPolls(pollResult.results || []);
      setLeaderboard(leaderboardResult.results || []);
      setAgreement(agreementResult.agreement);
      setPortfolio(portfolioResult.results || []);
      setStories(storyResult.results || []);
    });
  }, []);

  const hostRank = useMemo(() => leaderboard[0] || { name: "Cozy Boys Hostel F-10", score: 84, label: "strong operations" }, [leaderboard]);
  const pendingVisits = visits.filter((visit) => visit.status === "pending").length;
  const portfolioRooms = useMemo(
    () =>
      (portfolio.length ? portfolio : [{ id: "h1", name: "Cozy Boys Hostel F-10", city: "Islamabad", area: "F-10", lat: 33.6938, lng: 73.0139, occupancy: 86, availableBeds: 2, totalBeds: 14, monthlyRevenue: 280000, pendingRequests: 3, status: "available" }]).map((hostel) => ({
        id: hostel.id,
        title: hostel.name,
        city: hostel.city,
        area: hostel.area,
        coordinates: { lat: hostel.lat, lng: hostel.lng },
        pricePerHead: hostel.monthlyRevenue,
        availableBeds: hostel.availableBeds,
        totalBeds: hostel.totalBeds,
        roomType: hostel.status,
        genderPolicy: "HOST_PORTFOLIO",
        photos: []
      })),
    [portfolio]
  );

  const notify = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateVisit = async (visit, status) => {
    const result = await safeRequest(() => api.put(`/community/visits/${idOf(visit)}/status`, { status }), { visit: { ...visit, status }, demo: true });
    setVisits((current) => current.map((entry) => (idOf(entry) === idOf(visit) ? result.visit : entry)));
    notify(result.demo ? "Visit updated in demo mode." : "Visit status updated.");
  };

  const publishPost = async (event) => {
    event.preventDefault();
    if (!postForm.title.trim() || !postForm.body.trim()) return notify("Post title and body are required.");
    const result = await safeRequest(() => api.post("/community/feed", postForm), {
      post: { id: `host-post-${Date.now()}`, ...postForm, authorName: hostName, authorRole: "host", status: "published", createdAt: new Date().toISOString() },
      demo: true
    });
    setPosts((current) => [result.post, ...current]);
    setPostForm((current) => ({ ...current, body: "" }));
    notify(result.requiresApproval ? "Post submitted for admin approval." : "Community post published.");
  };

  const createPoll = async (event) => {
    event.preventDefault();
    const options = pollForm.options.split(",").map((item) => item.trim()).filter(Boolean);
    if (!pollForm.title.trim() || options.length < 2) return notify("Poll title and two options are required.");
    const result = await safeRequest(() => api.post("/community/polls", { ...pollForm, options, audience: "students" }), {
      poll: { id: `host-poll-${Date.now()}`, ...pollForm, options: options.map((label, index) => ({ id: `opt-${index}`, label, votes: 0 })), status: "active" },
      demo: true
    });
    setPolls((current) => [result.poll, ...current]);
    notify(result.demo ? "Poll created in demo mode." : "Poll created for students.");
  };

  const publishStory = async (event) => {
    event.preventDefault();
    const stops = [
      { title: storyForm.stopOneTitle, note: storyForm.stopOneNote, lat: 33.6938, lng: 73.0139 },
      { title: storyForm.stopTwoTitle, note: storyForm.stopTwoNote, lat: 33.6964, lng: 73.0091 }
    ].filter((stop) => stop.title.trim());
    const result = await safeRequest(() => api.post("/map/stories", { ...storyForm, stops }), {
      story: { id: `story-${Date.now()}`, ...storyForm, stops, status: "published" },
      demo: true
    });
    setStories((current) => [result.story, ...current]);
    notify(result.demo ? "Map story published in demo mode." : "Map story published.");
  };

  const signAgreement = async () => {
    const result = await safeRequest(() => api.post(`/community/agreements/${agreement?.bookingRef || "b1"}/sign`, { name: hostName }), {
      agreement: { ...(agreement || {}), hostSignature: { name: hostName, signedAt: new Date().toISOString() }, status: "host_signed" },
      demo: true
    });
    setAgreement(result.agreement);
    notify(result.demo ? "Host agreement signature saved in demo mode." : "Host agreement signed.");
  };

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Manage student visits, hostel polls, public posts, digital agreement signatures, and automated host score.</p>
        </div>
        <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={16} /> community controls active</span>
      </div>

      {notice && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{notice}</p>}

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard icon={CalendarDays} label="Pending visits" value={pendingVisits} />
        <StatCard icon={Megaphone} label="Published posts" value={posts.length} />
        <StatCard icon={Trophy} label="Host score" value={`${hostRank.score}/100`} />
      </div>

      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="panel p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned className="text-primary-800" /> Host Portfolio Map</h3>
              <p className="mt-1 text-sm text-slate-700">Occupancy, revenue, and request density across your hostel locations.</p>
            </div>
            <span className="chip">{portfolioRooms.length} mapped properties</span>
          </div>
          <SmartDiscoveryMap rooms={portfolioRooms} cards={false} height="360px" />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(portfolio.length ? portfolio : portfolioRooms).slice(0, 3).map((hostel) => (
              <article key={hostel.id} className="rounded-lg border border-line bg-canvas p-4">
                <p className="font-bold">{hostel.name || hostel.title}</p>
                <p className="mt-1 text-sm text-slate-700">{hostel.area}, {hostel.city}</p>
                <p className="mt-3 text-sm font-semibold text-primary-800">Occupancy {hostel.occupancy || 0}%</p>
              </article>
            ))}
          </div>
        </div>

        <form onSubmit={publishStory} className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Route className="text-primary-800" /> Publish Map Story</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">Create a short neighbourhood tour for students reviewing this hostel.</p>
          <div className="mt-5 grid gap-4">
            <input className="input" value={storyForm.title} onChange={(event) => setStoryForm((current) => ({ ...current, title: event.target.value }))} placeholder="Story title" />
            <input className="input" value={storyForm.hostelName} onChange={(event) => setStoryForm((current) => ({ ...current, hostelName: event.target.value }))} placeholder="Hostel name" />
            <input className="input" value={storyForm.stopOneTitle} onChange={(event) => setStoryForm((current) => ({ ...current, stopOneTitle: event.target.value }))} placeholder="Stop one title" />
            <textarea className="input min-h-20" value={storyForm.stopOneNote} onChange={(event) => setStoryForm((current) => ({ ...current, stopOneNote: event.target.value }))} />
            <input className="input" value={storyForm.stopTwoTitle} onChange={(event) => setStoryForm((current) => ({ ...current, stopTwoTitle: event.target.value }))} placeholder="Stop two title" />
            <textarea className="input min-h-20" value={storyForm.stopTwoNote} onChange={(event) => setStoryForm((current) => ({ ...current, stopTwoNote: event.target.value }))} />
            <button className="btn-primary" type="submit"><Plus size={18} /> Publish Story</button>
          </div>
          <div className="mt-5 grid gap-3">
            {(stories.length ? stories : [{ id: "story-empty", title: "No map stories yet", stops: [] }]).slice(0, 2).map((story) => (
              <article key={idOf(story)} className="rounded-lg border border-line bg-canvas p-3">
                <p className="font-bold">{story.title}</p>
                <p className="mt-1 text-xs text-slate-700">{(story.stops || []).length} stops</p>
              </article>
            ))}
          </div>
        </form>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="panel overflow-hidden">
          <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Visit Requests</h3>
              <p className="mt-1 text-sm text-slate-700">Confirm or decline walkthrough requests before students arrive.</p>
            </div>
            <span className="chip">{visits.length} total</span>
          </div>
          <div className="grid gap-4 p-5">
            {(visits.length ? visits : [{ id: "visit-empty", studentName: "No pending visits", hostelName: "All hostels", preferredDate: "", preferredTime: "", status: "none" }]).map((visit) => (
              <article key={idOf(visit)} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`badge ${visit.status === "confirmed" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{visit.status}</span>
                      <span className="chip">{formatDate(visit.preferredDate)} {visit.preferredTime}</span>
                    </div>
                    <h4 className="mt-3 text-lg font-bold">{visit.studentName || "Student"}</h4>
                    <p className="mt-1 text-sm text-slate-700">{visit.hostelName}</p>
                    {visit.note && <p className="mt-2 text-sm leading-6 text-slate-700">{visit.note}</p>}
                  </div>
                  {visit.status !== "none" && (
                    <div className="flex gap-2 lg:grid">
                      <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Decline" onConfirm={() => updateVisit(visit, "declined")}>Decline</ConfirmButton>
                      <button type="button" className="btn-primary py-2" onClick={() => updateVisit(visit, "confirmed")}>Confirm</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid gap-5">
          <section className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold"><Trophy className="text-primary-800" /> Automated Host Score</h3>
                <p className="mt-2 text-sm text-slate-700">{hostRank.name} is currently rated {hostRank.label || "competitive"}.</p>
              </div>
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-accent-50 text-xl font-extrabold text-accent-700">{hostRank.score}</span>
            </div>
            <div className="mt-5 h-2 rounded-full bg-primary-50">
              <div className="h-2 rounded-full bg-accent-700" style={{ width: `${Math.min(100, hostRank.score || 0)}%` }} />
            </div>
          </section>
          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><FileSignature className="text-primary-800" /> Move-in Agreement</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <Signature label="Student" signed={agreement?.studentSignature?.signedAt} />
              <Signature label="Host" signed={agreement?.hostSignature?.signedAt} />
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={signAgreement}>Sign as Host</button>
          </section>
        </aside>
      </section>

      <section className="grid gap-7 xl:grid-cols-2">
        <form onSubmit={publishPost} className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Megaphone className="text-primary-800" /> Publish Hostel Update</h3>
          <div className="mt-5 grid gap-4">
            <input className="input" value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} />
            <textarea className="input min-h-32 resize-none" value={postForm.body} onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))} placeholder="Mess timing, maintenance notice, activity plan, or hostel news." />
            <button className="btn-primary" type="submit"><Plus size={18} /> Publish Update</button>
          </div>
        </form>

        <form onSubmit={createPoll} className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardCheck className="text-primary-800" /> Create Student Poll</h3>
          <div className="mt-5 grid gap-4">
            <input className="input" value={pollForm.title} onChange={(event) => setPollForm((current) => ({ ...current, title: event.target.value }))} />
            <textarea className="input min-h-24 resize-none" value={pollForm.description} onChange={(event) => setPollForm((current) => ({ ...current, description: event.target.value }))} placeholder="Poll description" />
            <input className="input" value={pollForm.options} onChange={(event) => setPollForm((current) => ({ ...current, options: event.target.value }))} placeholder="Comma separated options" />
            <button className="btn-primary" type="submit"><Plus size={18} /> Create Poll</button>
          </div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold">Active Polls and Posts</h3>
            <p className="mt-1 text-sm text-slate-700">Quick visibility into student engagement assets created for your hostel.</p>
          </div>
          <span className="chip"><Users size={14} /> {polls.length} polls</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {polls.slice(0, 4).map((poll) => (
            <article key={idOf(poll)} className="rounded-lg border border-line bg-canvas p-4">
              <h4 className="font-bold">{poll.title}</h4>
              <p className="mt-2 text-sm text-slate-700">{(poll.options || []).map((option) => option.label).join(" / ")}</p>
            </article>
          ))}
          {posts.slice(0, 4).map((post) => (
            <article key={idOf(post)} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-bold">{post.title}</h4>
                <span className="badge bg-primary-50 text-primary-800">{post.status}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{post.body}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function StatCard({ icon: Icon, label, value }) {
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

function Signature({ label, signed }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-4 py-3">
      <span className="font-semibold">{label}</span>
      <span className={`badge ${signed ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>
        {signed ? <CheckCircle2 size={14} /> : null}
        {signed ? "Signed" : "Pending"}
      </span>
    </div>
  );
}
