import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  FileText,
  Heart,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  Users,
  WalletCards
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { api, safeRequest } from "../../services/api";
import { ConfirmButton } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const tabs = [
  "Feed",
  "Visits",
  "Move-in",
  "Polls",
  "Marketplace",
  "Lost & Found",
  "Roommates",
  "Alerts",
  "Leaderboard"
];

const idOf = (item) => item?.id || item?._id || item?.key || item?.title;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-PK", { month: "short", day: "2-digit", year: "numeric" }) : "Not set");
const percent = (value, total) => (total ? Math.round((Number(value || 0) / total) * 100) : 0);

const fallbackPost = {
  id: "post-empty",
  type: "general",
  title: "Community is ready",
  body: "Published notices, student posts, activity updates, and hostel news appear here after moderation.",
  authorName: "Basera",
  authorRole: "system",
  status: "published",
  likes: 0,
  commentsCount: 0,
  createdAt: new Date().toISOString()
};

export function StudentCommunity() {
  useDocumentTitle("Community | Basera");
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("Feed");
  const [message, setMessage] = useState("");
  const [feed, setFeed] = useState([]);
  const [visits, setVisits] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [polls, setPolls] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [lostFound, setLostFound] = useState([]);
  const [roommates, setRoommates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [badge, setBadge] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [postForm, setPostForm] = useState({ title: "", body: "", type: "general", scope: "city" });
  const [visitForm, setVisitForm] = useState({ hostelId: "h1", hostelName: "Cozy Boys Hostel F-10", preferredDate: "", preferredTime: "04:00 PM", note: "" });
  const [pollDraft, setPollDraft] = useState({ title: "Weekend activity preference", description: "", options: "Cricket night, Study circle, Movie night" });
  const [marketForm, setMarketForm] = useState({ title: "", category: "books", price: 0, condition: "good", description: "" });
  const [lostForm, setLostForm] = useState({ type: "lost", itemName: "", location: "", description: "" });
  const [roommateForm, setRoommateForm] = useState({ targetName: "Matched student", roomId: "r2", roomTitle: "Standard Double Seater F-10", hostelId: "h1", hostelName: "Cozy Boys Hostel F-10", message: "I think our routines match for room sharing." });

  const scope = useMemo(() => ({ city: user?.city || "Islamabad", university: user?.university || "NUST" }), [user?.city, user?.university]);

  useEffect(() => {
    const params = { params: scope };
    Promise.all([
      safeRequest(() => api.get("/community/feed", params), { results: [fallbackPost] }),
      safeRequest(() => api.get("/community/visits"), { results: [] }),
      safeRequest(() => api.get("/community/move-in-checklist/b1"), { checklist: null }),
      safeRequest(() => api.get("/community/agreements/b1"), { agreement: null }),
      safeRequest(() => api.get("/community/polls", params), { results: [] }),
      safeRequest(() => api.get("/community/marketplace", params), { results: [] }),
      safeRequest(() => api.get("/community/lost-found", params), { results: [] }),
      safeRequest(() => api.get("/community/roommate-requests"), { results: [] }),
      safeRequest(() => api.get("/notifications"), { results: [] }),
      safeRequest(() => api.get("/community/nudges"), { results: [], badge: null }),
      safeRequest(() => api.get("/community/verification-badge"), { badge: null }),
      safeRequest(() => api.get("/community/leaderboard"), { results: [] })
    ]).then(([feedResult, visitResult, checklistResult, agreementResult, pollResult, marketResult, lostResult, roommateResult, notificationResult, nudgeResult, badgeResult, leaderboardResult]) => {
      setFeed(feedResult.results?.length ? feedResult.results : [fallbackPost]);
      setVisits(visitResult.results || []);
      setChecklist(checklistResult.checklist);
      setAgreement(agreementResult.agreement);
      setPolls(pollResult.results || []);
      setMarketplace(marketResult.results || []);
      setLostFound(lostResult.results || []);
      setRoommates(roommateResult.results || []);
      setNotifications(notificationResult.results || []);
      setNudges(nudgeResult.results || []);
      setBadge(badgeResult.badge || nudgeResult.badge);
      setLeaderboard(leaderboardResult.results || []);
    });
  }, [scope]);

  const notify = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2600);
  };

  const submitPost = async (event) => {
    event.preventDefault();
    if (!postForm.title.trim() || !postForm.body.trim()) return notify("Post title and body are required.");
    const result = await safeRequest(() => api.post("/community/feed", { ...postForm, ...scope }), {
      post: { id: `post-${Date.now()}`, ...postForm, ...scope, authorName: user?.name || "Student", status: "pending", createdAt: new Date().toISOString() },
      requiresApproval: true,
      demo: true
    });
    setFeed((current) => [result.post, ...current]);
    setPostForm((current) => ({ ...current, title: "", body: "" }));
    notify(result.requiresApproval ? "Post submitted for admin approval." : "Post published.");
  };

  const scheduleVisit = async (event) => {
    event.preventDefault();
    if (!visitForm.preferredDate) return notify("Select a visit date first.");
    const result = await safeRequest(() => api.post("/community/visits", visitForm), {
      visit: { id: `visit-${Date.now()}`, ...visitForm, status: "pending", createdAt: new Date().toISOString() },
      demo: true
    });
    setVisits((current) => [result.visit, ...current]);
    notify(result.demo ? "Visit saved in demo mode." : "Visit request sent to Host.");
  };

  const toggleChecklistItem = async (item) => {
    if (!checklist) return;
    const nextItems = checklist.items.map((entry) => (entry.key === item.key ? { ...entry, completed: !entry.completed } : entry));
    const result = await safeRequest(() => api.put(`/community/move-in-checklist/${checklist.bookingRef || "b1"}`, { items: nextItems }), { checklist: { ...checklist, items: nextItems }, demo: true });
    setChecklist(result.checklist);
    notify("Move-in checklist updated.");
  };

  const signAgreement = async () => {
    const result = await safeRequest(() => api.post(`/community/agreements/${agreement?.bookingRef || "b1"}/sign`, { name: user?.name || "Student" }), {
      agreement: { ...(agreement || {}), status: "student_signed", studentSignature: { name: user?.name || "Student", signedAt: new Date().toISOString() } },
      demo: true
    });
    setAgreement(result.agreement);
    notify(result.demo ? "Agreement signed in demo mode." : "Agreement signed.");
  };

  const votePoll = async (poll, option) => {
    const result = await safeRequest(() => api.post(`/community/polls/${idOf(poll)}/vote`, { optionId: idOf(option), optionLabel: option.label }), {
      poll: {
        ...poll,
        options: poll.options.map((entry) => (idOf(entry) === idOf(option) ? { ...entry, votes: Number(entry.votes || 0) + 1 } : entry))
      },
      demo: true
    });
    setPolls((current) => current.map((entry) => (idOf(entry) === idOf(poll) ? result.poll : entry)));
  };

  const createPoll = async (event) => {
    event.preventDefault();
    const options = pollDraft.options.split(",").map((item) => item.trim()).filter(Boolean);
    if (!pollDraft.title.trim() || options.length < 2) return notify("Poll title and two options are required.");
    const result = await safeRequest(() => api.post("/community/polls", { ...pollDraft, options, ...scope }), {
      poll: { id: `poll-${Date.now()}`, ...pollDraft, options: options.map((label, index) => ({ id: `opt-${index}`, label, votes: 0 })), status: "active" },
      demo: true
    });
    setPolls((current) => [result.poll, ...current]);
    notify(result.demo ? "Poll created in demo mode." : "Poll created.");
  };

  const createMarketItem = async (event) => {
    event.preventDefault();
    if (!marketForm.title.trim()) return notify("Marketplace item title is required.");
    const result = await safeRequest(() => api.post("/community/marketplace", { ...marketForm, ...scope, price: Number(marketForm.price || 0) }), {
      item: { id: `market-${Date.now()}`, ...marketForm, ...scope, sellerName: user?.name || "Student", status: "active" },
      demo: true
    });
    setMarketplace((current) => [result.item, ...current]);
    setMarketForm({ title: "", category: "books", price: 0, condition: "good", description: "" });
    notify("Marketplace item listed.");
  };

  const markMarketItem = async (item, status) => {
    const result = await safeRequest(() => api.put(`/community/marketplace/${idOf(item)}/status`, { status }), { item: { ...item, status }, demo: true });
    setMarketplace((current) => current.map((entry) => (idOf(entry) === idOf(item) ? result.item : entry)));
  };

  const createLostFound = async (event) => {
    event.preventDefault();
    if (!lostForm.itemName.trim()) return notify("Item name is required.");
    const result = await safeRequest(() => api.post("/community/lost-found", { ...lostForm, ...scope }), {
      item: { id: `lost-${Date.now()}`, ...lostForm, ...scope, reporterName: user?.name || "Student", status: "open" },
      demo: true
    });
    setLostFound((current) => [result.item, ...current]);
    setLostForm({ type: "lost", itemName: "", location: "", description: "" });
    notify("Lost and found report created.");
  };

  const claimLostFound = async (item) => {
    const result = await safeRequest(() => api.put(`/community/lost-found/${idOf(item)}/claim`, { claimNote: "Claimed from student community screen." }), { item: { ...item, status: "claimed" }, demo: true });
    setLostFound((current) => current.map((entry) => (idOf(entry) === idOf(item) ? result.item : entry)));
  };

  const createRoommateRequest = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/community/roommate-requests", { ...roommateForm, ...scope, compatibilityScore: 88 }), {
      request: { id: `rr-${Date.now()}`, ...roommateForm, ...scope, requesterName: user?.name || "Student", compatibilityScore: 88, status: "pending" },
      demo: true
    });
    setRoommates((current) => [result.request, ...current]);
    notify("Roommate match request sent.");
  };

  const updateRoommate = async (request, status) => {
    const result = await safeRequest(() => api.put(`/community/roommate-requests/${idOf(request)}`, { status }), { request: { ...request, status }, demo: true });
    setRoommates((current) => current.map((entry) => (idOf(entry) === idOf(request) ? result.request : entry)));
  };

  const completedChecklist = checklist?.items?.filter((item) => item.completed).length || 0;

  return (
    <>
      <Helmet>
        <title>Community | Basera</title>
      </Helmet>

      <div className="mb-7 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-line bg-primary-800 text-white shadow-soft">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-8 top-6 hidden h-28 w-28 rounded-full border border-white/20 bg-white/10 sm:block" />
            <span className="badge bg-white/15 text-white"><ShieldCheck size={16} /> Student living network</span>
            <h2 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Community, visits, move-in, and hostel life in one workspace</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">Use this screen for moderated news, roommate matching, visits, polls, marketplace, lost and found, notifications, and agreement signing.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Badge score" value={`${badge?.score || 30}/100`} />
              <Metric label="Checklist" value={`${completedChecklist}/${checklist?.items?.length || 6}`} />
              <Metric label="Active alerts" value={notifications.length} />
            </div>
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-600">Verification badge</p>
              <h3 className="mt-2 text-2xl font-extrabold capitalize">{badge?.label || "Starter"}</h3>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-50 text-accent-700"><BadgeCheck /></span>
          </div>
          <div className="mt-5 h-2 rounded-full bg-primary-50">
            <div className="h-2 rounded-full bg-accent-700" style={{ width: `${Math.min(100, badge?.score || 30)}%` }} />
          </div>
          <div className="mt-4 grid gap-2">
            {(badge?.checklist || []).map((item) => (
              <span key={item.label} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                {item.label}
                <CheckCircle2 className={item.completed ? "text-accent-700" : "text-slate-400"} size={17} />
              </span>
            ))}
          </div>
        </section>
      </div>

      {message && <p className="mb-6 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <nav className="mb-7 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`min-w-fit rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? "bg-primary-700 text-white shadow-card" : "border border-line bg-surface text-slate-700 hover:bg-primary-50"}`}>
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Feed" && <FeedTab feed={feed} postForm={postForm} setPostForm={setPostForm} submitPost={submitPost} nudges={nudges} />}
      {activeTab === "Visits" && <VisitsTab visits={visits} visitForm={visitForm} setVisitForm={setVisitForm} scheduleVisit={scheduleVisit} />}
      {activeTab === "Move-in" && <MoveInTab checklist={checklist} agreement={agreement} toggleChecklistItem={toggleChecklistItem} signAgreement={signAgreement} />}
      {activeTab === "Polls" && <PollsTab polls={polls} votePoll={votePoll} pollDraft={pollDraft} setPollDraft={setPollDraft} createPoll={createPoll} />}
      {activeTab === "Marketplace" && <MarketplaceTab items={marketplace} form={marketForm} setForm={setMarketForm} createItem={createMarketItem} markItem={markMarketItem} />}
      {activeTab === "Lost & Found" && <LostFoundTab items={lostFound} form={lostForm} setForm={setLostForm} createItem={createLostFound} claimItem={claimLostFound} />}
      {activeTab === "Roommates" && <RoommateTab requests={roommates} form={roommateForm} setForm={setRoommateForm} createRequest={createRoommateRequest} updateRequest={updateRoommate} />}
      {activeTab === "Alerts" && <AlertsTab notifications={notifications} nudges={nudges} />}
      {activeTab === "Leaderboard" && <LeaderboardTab leaderboard={leaderboard} />}
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="flex items-center gap-2 text-2xl font-extrabold"><Icon className="text-primary-800" /> {title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{subtitle}</p>
      </div>
    </div>
  );
}

function FeedTab({ feed, postForm, setPostForm, submitPost, nudges }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-5">
        <SectionTitle icon={Megaphone} title="Community Feed" subtitle="Student posts go to admin moderation first; Host and admin posts can publish directly." />
        {feed.map((post) => (
          <article key={idOf(post)} className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge bg-primary-50 text-primary-800">{post.type || "general"}</span>
                  <span className={`badge ${post.status === "pending" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-accent-50 text-accent-700"}`}>{post.status || "published"}</span>
                </div>
                <h4 className="mt-3 text-xl font-bold">{post.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">{post.body}</p>
              </div>
              <p className="min-w-fit text-sm text-slate-600">{formatDate(post.createdAt)}</p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <span className="chip"><Users size={14} /> {post.authorName || "Community"}</span>
              <span className="chip"><Heart size={14} /> {post.likes || 0}</span>
              <span className="chip"><MessageSquare size={14} /> {post.commentsCount || 0}</span>
            </div>
          </article>
        ))}
      </div>
      <aside className="grid gap-5">
        <form onSubmit={submitPost} className="panel p-6">
          <h4 className="text-xl font-bold">Create Post</h4>
          <div className="mt-5 grid gap-4">
            <input className="input" value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} placeholder="Post title" />
            <select className="input" value={postForm.type} onChange={(event) => setPostForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="general">General</option>
              <option value="activity">Activity</option>
              <option value="safety">Safety</option>
              <option value="news">News</option>
            </select>
            <textarea className="input min-h-32 resize-none" value={postForm.body} onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))} placeholder="Write without phone numbers or off-platform payment instructions." />
            <button className="btn-primary" type="submit"><Plus size={18} /> Submit for Review</button>
          </div>
        </form>
        <section className="panel p-6">
          <h4 className="text-xl font-bold">Smart Nudges</h4>
          <div className="mt-4 grid gap-3">
            {nudges.map((nudge) => (
              <div key={nudge.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{nudge.title}</p>
                  <span className={`badge ${nudge.priority === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{nudge.priority}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{nudge.body}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

function VisitsTab({ visits, visitForm, setVisitForm, scheduleVisit }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle icon={CalendarDays} title="Visit Scheduling" subtitle="Request walkthroughs and track Host confirmations." />
        <div className="mt-5 grid gap-4">
          {(visits.length ? visits : [{ id: "visit-empty", hostelName: "No visits scheduled", preferredDate: "", preferredTime: "", status: "none", note: "Schedule your first hostel visit from the panel." }]).map((visit) => (
            <article key={idOf(visit)} className="panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className={`badge ${visit.status === "confirmed" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{visit.status}</span>
                  <h4 className="mt-3 text-xl font-bold">{visit.hostelName}</h4>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-700"><CalendarDays size={16} /> {formatDate(visit.preferredDate)} {visit.preferredTime}</p>
                  {visit.note && <p className="mt-3 text-sm leading-6 text-slate-700">{visit.note}</p>}
                </div>
                <span className="chip">Host response pending</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <form onSubmit={scheduleVisit} className="panel h-fit p-6">
        <h4 className="text-xl font-bold">Schedule Visit</h4>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Hostel<input className="input" value={visitForm.hostelName} onChange={(event) => setVisitForm((current) => ({ ...current, hostelName: event.target.value }))} /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Date<input type="date" className="input" value={visitForm.preferredDate} onChange={(event) => setVisitForm((current) => ({ ...current, preferredDate: event.target.value }))} /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Time<input className="input" value={visitForm.preferredTime} onChange={(event) => setVisitForm((current) => ({ ...current, preferredTime: event.target.value }))} /></label>
          <textarea className="input min-h-28 resize-none" value={visitForm.note} onChange={(event) => setVisitForm((current) => ({ ...current, note: event.target.value }))} placeholder="Notes for the Host" />
          <button type="submit" className="btn-primary">Request Visit</button>
        </div>
      </form>
    </section>
  );
}

function MoveInTab({ checklist, agreement, toggleChecklistItem, signAgreement }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
      <div className="panel p-6">
        <SectionTitle icon={ClipboardCheck} title="Move-in Checklist" subtitle="Complete the operational steps before room handover." />
        <div className="mt-6 grid gap-3">
          {(checklist?.items || []).map((item) => (
            <button key={item.key} type="button" onClick={() => toggleChecklistItem(item)} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-4 text-left ${item.completed ? "border-accent-700 bg-accent-50 text-accent-700" : "border-line bg-canvas text-ink"}`}>
              <span className="font-semibold">{item.label}</span>
              <CheckCircle2 size={20} />
            </button>
          ))}
        </div>
      </div>
      <aside className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-2 text-xl font-bold"><FileSignature className="text-primary-800" /> Digital Agreement</h4>
            <p className="mt-2 text-sm text-slate-700">Student and Host signatures are tracked before final move-in closure.</p>
          </div>
          <span className="badge bg-primary-50 text-primary-800">{agreement?.status || "draft"}</span>
        </div>
        <div className="mt-5 rounded-lg bg-canvas p-4 text-sm leading-6 text-slate-700">
          {(agreement?.terms || []).slice(0, 5).map((term) => <p key={term}>- {term}</p>)}
          {!agreement?.terms?.length && <p>Agreement terms load from the API. Demo mode provides a default move-in agreement.</p>}
        </div>
        <div className="mt-5 grid gap-3">
          <SignatureLine label="Student" value={agreement?.studentSignature?.signedAt} />
          <SignatureLine label="Host" value={agreement?.hostSignature?.signedAt} />
        </div>
        <button type="button" onClick={signAgreement} className="btn-primary mt-5 w-full">Sign Agreement</button>
      </aside>
    </section>
  );
}

function SignatureLine({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
      <span className="font-semibold">{label}</span>
      <span className={`badge ${value ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{value ? "Signed" : "Pending"}</span>
    </div>
  );
}

function PollsTab({ polls, votePoll, pollDraft, setPollDraft, createPoll }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle icon={FileText} title="Hostel Polls" subtitle="Vote on mess, activities, cleaning, and shared hostel decisions." />
        <div className="mt-5 grid gap-5">
          {polls.map((poll) => {
            const total = poll.options?.reduce((sum, option) => sum + Number(option.votes || 0), 0) || 0;
            return (
              <article key={idOf(poll)} className="panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="badge bg-primary-50 text-primary-800">{poll.category || "general"}</span>
                    <h4 className="mt-3 text-xl font-bold">{poll.title}</h4>
                    <p className="mt-2 text-sm text-slate-700">{poll.description}</p>
                  </div>
                  <span className="chip">{total} votes</span>
                </div>
                <div className="mt-5 grid gap-3">
                  {(poll.options || []).map((option) => (
                    <button key={idOf(option)} type="button" onClick={() => votePoll(poll, option)} className="rounded-lg border border-line bg-canvas p-3 text-left hover:border-primary-700">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span>{option.label}</span>
                        <span>{percent(option.votes, total)}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-primary-50">
                        <div className="h-2 rounded-full bg-primary-700" style={{ width: `${percent(option.votes, total)}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <form onSubmit={createPoll} className="panel h-fit p-6">
        <h4 className="text-xl font-bold">Suggest Poll</h4>
        <div className="mt-5 grid gap-4">
          <input className="input" value={pollDraft.title} onChange={(event) => setPollDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Poll title" />
          <textarea className="input min-h-24 resize-none" value={pollDraft.description} onChange={(event) => setPollDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Short description" />
          <input className="input" value={pollDraft.options} onChange={(event) => setPollDraft((current) => ({ ...current, options: event.target.value }))} placeholder="Comma separated options" />
          <button className="btn-primary" type="submit">Create Poll</button>
        </div>
      </form>
    </section>
  );
}

function MarketplaceTab({ items, form, setForm, createItem, markItem }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle icon={WalletCards} title="Student Marketplace" subtitle="Buy, sell, reserve, or mark hostel-safe items without exposing phone numbers." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={idOf(item)} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="badge bg-primary-50 text-primary-800">{item.category}</span>
                  <h4 className="mt-3 text-lg font-bold">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                </div>
                <Package className="text-primary-800" />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <strong className="text-primary-800">PKR {Number(item.price || 0).toLocaleString("en-PK")}</strong>
                <span className="chip">{item.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => markItem(item, "reserved")} className="btn-secondary py-2">Reserve</button>
                <button type="button" onClick={() => markItem(item, "sold")} className="btn-primary py-2">Sold</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <form onSubmit={createItem} className="panel h-fit p-6">
        <h4 className="text-xl font-bold">List Item</h4>
        <div className="mt-5 grid gap-4">
          <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Item title" />
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}><option value="books">Books</option><option value="electronics">Electronics</option><option value="furniture">Furniture</option><option value="other">Other</option></select>
            <input className="input" type="number" min="0" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
          </div>
          <textarea className="input min-h-28 resize-none" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <button className="btn-primary" type="submit">Publish Item</button>
        </div>
      </form>
    </section>
  );
}

function LostFoundTab({ items, form, setForm, createItem, claimItem }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle icon={Search} title="Lost & Found" subtitle="Report missing or found items and keep claims traceable." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={idOf(item)} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`badge ${item.type === "found" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{item.type}</span>
                  <h4 className="mt-3 text-lg font-bold">{item.itemName}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                </div>
                <MapPin className="text-primary-800" />
              </div>
              <p className="mt-4 text-sm text-slate-700">{item.location}</p>
              <button type="button" onClick={() => claimItem(item)} className="btn-secondary mt-4 w-full">Claim / Resolve</button>
            </article>
          ))}
        </div>
      </div>
      <form onSubmit={createItem} className="panel h-fit p-6">
        <h4 className="text-xl font-bold">Report Item</h4>
        <div className="mt-5 grid gap-4">
          <select className="input" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option value="lost">Lost</option><option value="found">Found</option></select>
          <input className="input" value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} placeholder="Item name" />
          <input className="input" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Location" />
          <textarea className="input min-h-28 resize-none" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <button className="btn-primary" type="submit">Submit Report</button>
        </div>
      </form>
    </section>
  );
}

function RoommateTab({ requests, form, setForm, createRequest, updateRequest }) {
  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <SectionTitle icon={Users} title="Roommate Match Requests" subtitle="Request a room sharing match and accept or reject incoming roommate requests." />
        <div className="mt-5 grid gap-4">
          {requests.map((request) => (
            <article key={idOf(request)} className="panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="badge bg-primary-50 text-primary-800">{request.compatibilityScore || 80}% match</span>
                  <h4 className="mt-3 text-xl font-bold">{request.targetName || request.requesterName || "Student match"}</h4>
                  <p className="mt-1 text-sm text-slate-700">{request.hostelName} - {request.roomTitle}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{request.message}</p>
                </div>
                <span className="chip">{request.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => updateRequest(request, "rejected")}>Reject</ConfirmButton>
                <button type="button" className="btn-primary py-2" onClick={() => updateRequest(request, "accepted")}>Accept</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <form onSubmit={createRequest} className="panel h-fit p-6">
        <h4 className="text-xl font-bold">Send Match Request</h4>
        <div className="mt-5 grid gap-4">
          <input className="input" value={form.targetName} onChange={(event) => setForm((current) => ({ ...current, targetName: event.target.value }))} placeholder="Target student name" />
          <input className="input" value={form.roomTitle} onChange={(event) => setForm((current) => ({ ...current, roomTitle: event.target.value }))} placeholder="Room title" />
          <textarea className="input min-h-28 resize-none" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
          <button className="btn-primary" type="submit">Send Request</button>
        </div>
      </form>
    </section>
  );
}

function AlertsTab({ notifications, nudges }) {
  const rows = [...notifications, ...nudges];
  return (
    <section>
      <SectionTitle icon={Bell} title="Notification Center" subtitle="Rent, escrow, visit, poll, move-in, and safety notifications are collected here." />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {(rows.length ? rows : [{ id: "empty-note", title: "No notifications", body: "You are all caught up.", type: "system" }]).map((item) => (
          <article key={item.id || item.title} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="badge bg-primary-50 text-primary-800">{item.type || item.priority || "notice"}</span>
                <h4 className="mt-3 text-lg font-bold">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.body || item.message}</p>
              </div>
              <Bell className="text-primary-800" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LeaderboardTab({ leaderboard }) {
  return (
    <section>
      <SectionTitle icon={Trophy} title="Hostel Leaderboard" subtitle="Automated host score combines reviews, rooms, response discipline, listing quality, and operational health." />
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {leaderboard.map((hostel, index) => (
          <article key={idOf(hostel)} className="panel overflow-hidden">
            {hostel.image && <img src={hostel.image} alt={hostel.name} className="h-44 w-full object-cover" />}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="badge bg-primary-700 text-white">#{index + 1}</span>
                  <h4 className="mt-3 text-xl font-bold">{hostel.name}</h4>
                  <p className="mt-1 text-sm text-slate-700">{hostel.area}, {hostel.city}</p>
                </div>
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-accent-50 text-xl font-extrabold text-accent-700">{hostel.score}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                <span className="rounded-lg bg-canvas p-3"><Star className="mx-auto mb-1 text-primary-800" size={16} />{hostel.rating}</span>
                <span className="rounded-lg bg-canvas p-3"><Package className="mx-auto mb-1 text-primary-800" size={16} />{hostel.roomCount} rooms</span>
                <span className="rounded-lg bg-canvas p-3"><MessageSquare className="mx-auto mb-1 text-primary-800" size={16} />{hostel.reviewCount} reviews</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{hostel.label || "Competitive host score"}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
