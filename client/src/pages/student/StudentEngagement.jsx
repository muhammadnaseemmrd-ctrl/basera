import { useEffect, useMemo, useState } from "react";
import { Award, BadgePercent, Bell, BookOpen, CalendarDays, CheckCircle2, Compass, CreditCard, Gift, MapPin, Medal, Megaphone, Search, Share2, SlidersHorizontal, Trophy, Users, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { AlertSubmitCard } from "../../components/AlertSubmitCard";
import { RoutePlannerPanel } from "../../components/RoutePlannerPanel";
import { StudentDecisionLab } from "../../components/StudentDecisionLab";
import { RoommateSwipeDeck } from "../../components/RoommateSwipeDeck";
import { api, safeRequest } from "../../services/api";
import { currency } from "../../utils/formatters";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const tabs = ["Compare", "Decision Lab", "Roommate Match", "Search Alerts", "Activities", "Route Planner", "Study Sessions", "Loyalty", "Leaderboard", "Rewards", "Alerts"];

const fallbackCompare = {
  results: [
    { id: "r1", title: "Premium Single Seater near NUST", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", area: "F-10", roomType: "SINGLE", pricePerHead: 25000, totalMoveInCost: 59000, availableBeds: 1, distanceToUniversity: 15, mealPlan: "FULL_BOARD", genderPolicy: "BOYS_ONLY", curfewTime: "10:30 PM", amenities: ["WiFi", "AC", "Study Table"], scores: { value: 78, commute: 55, amenities: 72, safety: 90 }, highlights: ["Verified property", "Private room"] },
    { id: "r4", title: "NUST Double Sharing", hostelName: "Pine Crest Boys Hostel", city: "Islamabad", area: "H-13", roomType: "DOUBLE", pricePerHead: 12500, totalMoveInCost: 25000, availableBeds: 1, distanceToUniversity: 8, mealPlan: "FULL_BOARD", genderPolicy: "BOYS_ONLY", curfewTime: "10:00 PM", amenities: ["WiFi", "Mess", "CCTV"], scores: { value: 94, commute: 76, amenities: 70, safety: 88 }, highlights: ["Budget friendly", "Close commute"] }
  ]
};

const fallbackActivities = {
  results: [
    { id: "act-murree", title: "Saturday Murree Day Trip", type: "trip", location: "Murree", activityDate: "2026-06-13T08:00:00.000Z", description: "Shared transport, lunch stop, and return by evening.", capacity: 10, contributionTarget: 25000, contributionPerPerson: 2500, participantCount: 2, collectedAmount: 2500, remainingAmount: 22500, collectionProgress: 10, status: "open" },
    { id: "act-cricket", title: "F-10 Evening Cricket", type: "sports", location: "F-10 Park Ground", activityDate: "2026-06-08T17:30:00.000Z", description: "Friendly tape-ball match with shared ground and refreshments cost.", capacity: 14, contributionTarget: 5600, contributionPerPerson: 400, participantCount: 1, collectedAmount: 0, remainingAmount: 5600, collectionProgress: 0, status: "open" }
  ]
};

const fallbackProfile = {
  profile: { city: "Islamabad", university: "NUST", budget: 20000, sleepSchedule: "balanced", studyStyle: "silent", cleanliness: "regular", noiseTolerance: "low", foodPreference: "mess" },
  matches: fallbackCompare.results.map((room, index) => ({ ...room, matchScore: index ? 89 : 82 }))
};

const fallbackSearches = {
  results: [{ id: "ss-demo", title: "NUST rooms under 20k", filters: { city: "Islamabad", university: "NUST", maxBudget: 20000, roomType: "DOUBLE" }, frequency: "daily", isActive: true }],
  alerts: [{ search: { title: "NUST rooms under 20k" }, matches: fallbackCompare.results }]
};

const fallbackLoyalty = {
  account: {
    id: "loyalty-demo",
    referralCode: "HH-ALI-2026",
    pointsBalance: 4000,
    lifetimePoints: 4000,
    pointsRedeemed: 0,
    referralCount: 4,
    referrals: [
      { id: "ref-1", referredName: "Hamza Sheikh", referredEmail: "hamza@example.com", status: "completed", pointsAwarded: 1000 },
      { id: "ref-2", referredName: "Noor Fatima", referredEmail: "noor@example.com", status: "completed", pointsAwarded: 1000 }
    ]
  },
  claims: [{ id: "claim-approved", status: "approved", approvedDiscountPercent: 7, couponCode: "LOYALTY7", adminNote: "Approved for next room booking." }],
  config: { referralPoints: 1000, claimThreshold: 5000, discountRange: [5, 10] }
};

const fallbackLeaderboard = {
  results: [
    { rank: 1, name: "Hamza S.", points: 6200, isCurrentStudent: false },
    { rank: 2, name: "Noor F.", points: 5400, isCurrentStudent: false },
    { rank: 3, name: "Ali A.", points: 4000, isCurrentStudent: true },
    { rank: 4, name: "Bilal K.", points: 3800, isCurrentStudent: false },
    { rank: 5, name: "Sarah M.", points: 3200, isCurrentStudent: false }
  ]
};

const fallbackRewards = {
  results: [
    { id: "reward-mobile-topup-200", name: "PKR 200 Mobile Top-up", partner: "Jazz / Zong / Telenor (illustrative)", description: "Instant balance top-up for any major Pakistani network.", pointsCost: 1000 },
    { id: "reward-food-delivery-voucher", name: "PKR 500 Food Delivery Voucher", partner: "Foodpanda (illustrative)", description: "Voucher code for a discount on your next food delivery order.", pointsCost: 2200 },
    { id: "reward-bookstore-discount", name: "15% Off Campus Bookstore", partner: "Liberty Books (illustrative)", description: "Discount code for textbooks and stationery at partner bookstores.", pointsCost: 1500 }
  ]
};

const fallbackGlobalAlerts = {
  results: [
    { id: "alert-student-demo", title: "F-10 hostel safety advisory", message: "Route access may be restricted for the next few hours. Confirm travel before leaving campus.", severity: "warning", status: "published", expiresAt: "2026-06-05T18:00:00.000Z" }
  ]
};

const fallbackStudySessions = {
  results: [
    { id: "study-demo-1", subject: "Calculus revision", hostelName: "Cozy Boys Hostel F-10", university: "NUST", city: "Islamabad", location: "Common Room", scheduledAt: "2026-06-12T19:30:00.000Z", maxParticipants: 8, attendeeCount: 3, status: "open", notes: "Bring past papers." },
    { id: "study-demo-2", subject: "Programming lab prep", hostelName: "Pine Crest Boys Hostel", university: "FAST", city: "Islamabad", location: "Study lounge", scheduledAt: "2026-06-13T20:00:00.000Z", maxParticipants: 6, attendeeCount: 2, status: "open", notes: "Pair debugging session." }
  ]
};

export function StudentEngagement() {
  useDocumentTitle("Explore & Activities | Basera");
  const [active, setActive] = useState("Compare");
  const [compare, setCompare] = useState(fallbackCompare.results);
  const [profile, setProfile] = useState(fallbackProfile.profile);
  const [matches, setMatches] = useState(fallbackProfile.matches);
  const [savedSearches, setSavedSearches] = useState(fallbackSearches.results);
  const [alerts, setAlerts] = useState(fallbackSearches.alerts);
  const [globalAlerts, setGlobalAlerts] = useState(fallbackGlobalAlerts.results);
  const [activities, setActivities] = useState(fallbackActivities.results);
  const [studySessions, setStudySessions] = useState(fallbackStudySessions.results);
  const [loyalty, setLoyalty] = useState(fallbackLoyalty);
  const [leaderboard, setLeaderboard] = useState(fallbackLeaderboard.results);
  const [rewards, setRewards] = useState(fallbackRewards.results);
  const [redeemingId, setRedeemingId] = useState(null);
  const [message, setMessage] = useState("");
  const [searchForm, setSearchForm] = useState({ title: "Rooms near my campus", city: "Islamabad", university: "NUST", maxBudget: 20000, roomType: "DOUBLE", frequency: "daily" });
  const [referralForm, setReferralForm] = useState({ referredName: "", referredEmail: "" });
  const [activityForm, setActivityForm] = useState({
    title: "Weekend Food Street Plan",
    type: "dining",
    location: "Saddar Food Street",
    activityDate: "2026-06-14T19:00",
    description: "Dinner plan with shared ride and simple contribution tracking.",
    capacity: 8,
    contributionTarget: 12000,
    contributionPerPerson: 1500
  });
  const [studyForm, setStudyForm] = useState({
    subject: "Physics group revision",
    university: "NUST",
    city: "Islamabad",
    hostelName: "Cozy Boys Hostel F-10",
    location: "Study lounge",
    scheduledAt: "2026-06-15T20:00",
    maxParticipants: 6,
    notes: "Bring lecture notes and calculator."
  });
  const [contributions, setContributions] = useState({});

  useEffect(() => {
    safeRequest(() => api.get("/engagement/compare"), fallbackCompare).then((result) => setCompare(result.results || fallbackCompare.results));
    safeRequest(() => api.get("/engagement/roommate-profile"), fallbackProfile).then((result) => {
      setProfile((current) => ({ ...current, ...(result.profile || {}) }));
      setMatches(result.matches || fallbackProfile.matches);
    });
    safeRequest(() => api.get("/engagement/saved-searches"), fallbackSearches).then((result) => setSavedSearches(result.results || fallbackSearches.results));
    safeRequest(() => api.get("/engagement/saved-searches/alerts"), fallbackSearches).then((result) => setAlerts(result.alerts || fallbackSearches.alerts));
    safeRequest(() => api.get("/engagement/activities"), fallbackActivities).then((result) => setActivities(result.results || fallbackActivities.results));
    safeRequest(() => api.get("/study-sessions"), fallbackStudySessions).then((result) => setStudySessions(result.results || fallbackStudySessions.results));
    safeRequest(() => api.get("/engagement/loyalty"), fallbackLoyalty).then((result) => setLoyalty(result.account ? result : fallbackLoyalty));
    safeRequest(() => api.get("/engagement/loyalty/leaderboard"), fallbackLeaderboard).then((result) => setLeaderboard(result.results || fallbackLeaderboard.results));
    safeRequest(() => api.get("/engagement/loyalty/rewards"), fallbackRewards).then((result) => setRewards(result.results || fallbackRewards.results));
    safeRequest(() => api.get("/alerts/active"), fallbackGlobalAlerts).then((result) => setGlobalAlerts(result.results || fallbackGlobalAlerts.results));
  }, []);

  const activityStats = useMemo(() => ({
    open: activities.filter((item) => item.status === "open").length,
    totalCollected: activities.reduce((sum, item) => sum + Number(item.collectedAmount || 0), 0),
    people: activities.reduce((sum, item) => sum + Number(item.participantCount || 0), 0)
  }), [activities]);

  const approvedClaim = useMemo(
    () => (loyalty.claims || []).find((claim) => claim.status === "approved" && claim.couponCode),
    [loyalty.claims]
  );

  const submitProfile = async (event) => {
    event.preventDefault();
    setMessage("Finding compatible rooms...");
    const result = await safeRequest(() => api.post("/engagement/roommate-profile", profile), { ...fallbackProfile, demo: true });
    setMatches(result.matches || []);
    setMessage(result.demo ? "Compatibility calculated in demo mode." : "Compatibility profile saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  const createSearch = async (event) => {
    event.preventDefault();
    setMessage("Saving search alert...");
    const result = await safeRequest(() => api.post("/engagement/saved-searches", searchForm), { search: { id: `ss-${Date.now()}`, filters: searchForm, ...searchForm }, matches: fallbackCompare.results, demo: true });
    setSavedSearches((current) => [result.search, ...current]);
    setAlerts((current) => [{ search: result.search, matches: result.matches || [] }, ...current]);
    setMessage(result.demo ? "Search alert saved in demo mode." : "Search alert saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  const createActivity = async (event) => {
    event.preventDefault();
    setMessage("Creating activity...");
    const result = await safeRequest(() => api.post("/engagement/activities", activityForm), { activity: { id: `act-${Date.now()}`, ...activityForm, participantCount: 1, collectedAmount: 0, remainingAmount: activityForm.contributionTarget, collectionProgress: 0, status: "open" }, demo: true });
    setActivities((current) => [result.activity, ...current]);
    setMessage(result.demo ? "Activity created in demo mode." : "Activity created.");
    setTimeout(() => setMessage(""), 2500);
  };

  const joinActivity = async (activity) => {
    setMessage("Joining activity...");
    const result = await safeRequest(() => api.post(`/engagement/activities/${activity.id || activity._id}/join`, { status: "joined" }), { activity: { ...activity, participantCount: Number(activity.participantCount || 0) + 1 }, demo: true });
    setActivities((current) => current.map((item) => ((item.id || item._id) === (activity.id || activity._id) ? result.activity : item)));
    setMessage(result.demo ? "Joined in demo mode." : "Joined activity.");
    setTimeout(() => setMessage(""), 2500);
  };

  const contribute = async (activity) => {
    const id = activity.id || activity._id;
    const amount = Number(contributions[id] || activity.contributionPerPerson || 0);
    if (!amount) {
      setMessage("Enter a contribution amount first.");
      return;
    }
    setMessage("Recording contribution...");
    const result = await safeRequest(() => api.post(`/engagement/activities/${id}/contribute`, { amount, paymentMethod: "jazzcash" }), {
      activity: {
        ...activity,
        collectedAmount: Number(activity.collectedAmount || 0) + amount,
        remainingAmount: Math.max(0, Number(activity.remainingAmount || activity.contributionTarget || 0) - amount),
        collectionProgress: Math.min(100, Math.round(((Number(activity.collectedAmount || 0) + amount) / Number(activity.contributionTarget || 1)) * 100))
      },
      demo: true
    });
    setActivities((current) => current.map((item) => ((item.id || item._id) === id ? result.activity : item)));
    setMessage(result.demo ? "Contribution recorded in demo mode." : "Contribution recorded.");
    setTimeout(() => setMessage(""), 2500);
  };

  const createStudySession = async (event) => {
    event.preventDefault();
    setMessage("Creating study session...");
    const result = await safeRequest(() => api.post("/study-sessions", studyForm), {
      session: { id: `study-${Date.now()}`, ...studyForm, scheduledAt: new Date(studyForm.scheduledAt).toISOString(), attendeeCount: 1, status: "open" },
      demo: true
    });
    setStudySessions((current) => [result.session, ...current]);
    setMessage(result.demo ? "Study session created in demo mode." : "Study session created.");
    setTimeout(() => setMessage(""), 2500);
  };

  const joinStudySession = async (session) => {
    const id = session.id || session._id;
    setMessage("Joining study session...");
    const result = await safeRequest(() => api.post(`/study-sessions/${id}/join`), {
      session: { ...session, attendeeCount: Number(session.attendeeCount || 0) + 1 },
      demo: true
    });
    setStudySessions((current) => current.map((item) => ((item.id || item._id) === id ? result.session : item)));
    setMessage(result.demo ? "Joined in demo mode." : "Joined study session.");
    setTimeout(() => setMessage(""), 2500);
  };

  const completeStudySession = async (session) => {
    const id = session.id || session._id;
    setMessage("Completing study session...");
    const result = await safeRequest(() => api.put(`/study-sessions/${id}/complete`, { sharedNotesUrl: session.sharedNotesUrl || "" }), {
      session: { ...session, status: "completed", loyaltyAwarded: true },
      pointsAwarded: 50,
      demo: true
    });
    setStudySessions((current) => current.map((item) => ((item.id || item._id) === id ? result.session : item)));
    setMessage(result.pointsAwarded ? `Study completed. ${result.pointsAwarded} bonus points flagged.` : "Study session completed.");
    setTimeout(() => setMessage(""), 2500);
  };

  const addReferral = async (event) => {
    event.preventDefault();
    if (!referralForm.referredEmail.trim()) {
      setMessage("Enter the referred student's email first.");
      return;
    }
    setMessage("Adding referral...");
    const result = await safeRequest(() => api.post("/engagement/loyalty/referrals", referralForm), {
      ...fallbackLoyalty,
      account: {
        ...loyalty.account,
        pointsBalance: Number(loyalty.account?.pointsBalance || 0) + Number(loyalty.config?.referralPoints || 1000),
        lifetimePoints: Number(loyalty.account?.lifetimePoints || 0) + Number(loyalty.config?.referralPoints || 1000),
        referralCount: Number(loyalty.account?.referralCount || 0) + 1,
        referrals: [{ id: `ref-${Date.now()}`, ...referralForm, pointsAwarded: loyalty.config?.referralPoints || 1000, status: "completed" }, ...(loyalty.account?.referrals || [])]
      },
      claims: loyalty.claims || [],
      demo: true
    });
    setLoyalty({ account: result.account, claims: result.claims || loyalty.claims || [], config: result.config || loyalty.config });
    setReferralForm({ referredName: "", referredEmail: "" });
    setMessage(result.demo ? "Referral points added in demo mode." : "Referral points added.");
    setTimeout(() => setMessage(""), 2500);
  };

  const claimLoyaltyDiscount = async () => {
    setMessage("Submitting loyalty discount claim...");
    try {
      const { data } = await api.post("/engagement/loyalty/claims", { preferredDiscountPercent: loyalty.config?.discountRange?.[0] || 5 });
      setLoyalty({ account: data.account, claims: data.claims || [data.claim], config: data.config || loyalty.config });
      setMessage(data.demo ? "Claim submitted in demo mode. Admin approval is pending." : "Claim submitted. Admin will approve a 5-10% booking discount.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Loyalty claim could not be submitted.");
    }
    setTimeout(() => setMessage(""), 3500);
  };

  const redeemReward = async (reward) => {
    setRedeemingId(reward.id);
    setMessage(`Redeeming ${reward.name}...`);
    try {
      const { data } = await api.post(`/engagement/loyalty/rewards/${reward.id}/redeem`, {});
      setLoyalty({ account: data.account, claims: data.claims || loyalty.claims || [], config: data.config || loyalty.config });
      setMessage(data.demo ? `Redeemed "${reward.name}" in demo mode.` : `Redeemed "${reward.name}". Check your rewards inbox for the code.`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not redeem this reward right now.");
    }
    setRedeemingId(null);
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><Compass size={16} /> Student tools</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Explore & Activities</h2>
          <p className="mt-2 max-w-3xl text-slate-700">Compare rooms, find better-fit housing, save search alerts, and plan outdoor activities with contribution tracking.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Open Activities" value={activityStats.open} />
          <Stat label="Students Joined" value={activityStats.people} />
          <Stat label="Loyalty Points" value={Number(loyalty.account?.pointsBalance || 0).toLocaleString("en-PK")} />
        </div>
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-line bg-surface p-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`min-w-fit rounded-lg px-4 py-3 text-sm font-bold transition ${active === tab ? "bg-primary-700 text-white shadow-card" : "text-slate-700 hover:bg-primary-50"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "Compare" && <ComparePanel rows={compare} />}
      {active === "Decision Lab" && <StudentDecisionLab />}
      {active === "Roommate Match" && <RoommatePanel profile={profile} setProfile={setProfile} matches={matches} onSubmit={submitProfile} />}
      {active === "Search Alerts" && <SearchAlertsPanel form={searchForm} setForm={setSearchForm} searches={savedSearches} alerts={alerts} onSubmit={createSearch} />}
      {active === "Activities" && <ActivitiesPanel form={activityForm} setForm={setActivityForm} activities={activities} contributions={contributions} setContributions={setContributions} onSubmit={createActivity} onJoin={joinActivity} onContribute={contribute} />}
      {active === "Route Planner" && <RoutePlannerPanel />}
      {active === "Study Sessions" && <StudySessionsPanel form={studyForm} setForm={setStudyForm} sessions={studySessions} onSubmit={createStudySession} onJoin={joinStudySession} onComplete={completeStudySession} />}
      {active === "Loyalty" && <LoyaltyPanel loyalty={loyalty} approvedClaim={approvedClaim} referralForm={referralForm} setReferralForm={setReferralForm} onReferral={addReferral} onClaim={claimLoyaltyDiscount} />}
      {active === "Leaderboard" && <LeaderboardPanel entries={leaderboard} />}
      {active === "Rewards" && <RewardsPanel rewards={rewards} pointsBalance={Number(loyalty.account?.pointsBalance || 0)} redeemingId={redeemingId} onRedeem={redeemReward} />}
      {active === "Alerts" && <GlobalAlertsPanel alerts={globalAlerts} />}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <article className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-primary-800">{value}</p>
    </article>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-primary-50">
        <div className="h-2 rounded-full bg-primary-700" style={{ width: `${Math.min(100, Number(value || 0))}%` }} />
      </div>
    </div>
  );
}

function ComparePanel({ rows }) {
  return (
    <section className="space-y-5">
      <div className="panel p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><SlidersHorizontal size={22} /> Smart Hostel Comparison</h3>
        <p className="mt-2 text-sm text-slate-700">Side-by-side decision support for rent, deposit, commute, safety, amenities, and move-in cost.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {rows.map((room) => (
          <article key={room.id} className="panel overflow-hidden">
            {room.image && <img src={room.image} alt={room.title} className="h-48 w-full object-cover" />}
            <div className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold">{room.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{room.hostelName} - {room.area}, {room.city}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-800">{room.roomType}</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat label="Monthly Rent" value={currency(room.pricePerHead)} />
                <Stat label="Move-in Cost" value={currency(room.totalMoveInCost)} />
                <Stat label="Distance" value={`${room.distanceToUniversity || "-"} min`} />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ScoreBar label="Value" value={room.scores?.value || 0} />
                <ScoreBar label="Commute" value={room.scores?.commute || 0} />
                <ScoreBar label="Amenities" value={room.scores?.amenities || 0} />
                <ScoreBar label="Safety" value={room.scores?.safety || 0} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(room.highlights || []).map((item) => <span key={item} className="chip">{item}</span>)}
              </div>
              <Link to={`/rooms/${room.id}`} className="btn-primary mt-5 w-full">View Room</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoommatePanel({ profile, setProfile, matches, onSubmit }) {
  const [view, setView] = useState("form");
  return (
    <section className="space-y-5">
      <div className="flex gap-2 rounded-xl border border-line bg-surface p-2">
        {[["form", "Form View"], ["swipe", "Swipe View"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === value ? "bg-primary-700 text-white shadow-card" : "text-slate-700 hover:bg-primary-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "swipe" ? <RoommateSwipeDeck /> : <RoommateFormPanel profile={profile} setProfile={setProfile} matches={matches} onSubmit={onSubmit} />}
    </section>
  );
}

function RoommateFormPanel({ profile, setProfile, matches, onSubmit }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Users size={22} /> Roommate Compatibility Quiz</h3>
        <div className="mt-5 grid gap-4">
          <Input label="City" value={profile.city || ""} onChange={(value) => setProfile((current) => ({ ...current, city: value }))} />
          <Input label="University" value={profile.university || ""} onChange={(value) => setProfile((current) => ({ ...current, university: value }))} />
          <Input label="Budget" type="number" value={profile.budget || ""} onChange={(value) => setProfile((current) => ({ ...current, budget: Number(value) }))} />
          <Select label="Sleep Schedule" value={profile.sleepSchedule || "balanced"} options={["early", "balanced", "late"]} onChange={(value) => setProfile((current) => ({ ...current, sleepSchedule: value }))} />
          <Select label="Study Style" value={profile.studyStyle || "normal"} options={["silent", "normal", "group"]} onChange={(value) => setProfile((current) => ({ ...current, studyStyle: value }))} />
          <Select label="Cleanliness" value={profile.cleanliness || "regular"} options={["relaxed", "regular", "strict"]} onChange={(value) => setProfile((current) => ({ ...current, cleanliness: value }))} />
          <Select label="Noise Tolerance" value={profile.noiseTolerance || "medium"} options={["low", "medium", "high"]} onChange={(value) => setProfile((current) => ({ ...current, noiseTolerance: value }))} />
          <Select label="Food Preference" value={profile.foodPreference || "any"} options={["mess", "self_cook", "outside", "any"]} onChange={(value) => setProfile((current) => ({ ...current, foodPreference: value }))} />
          <button className="btn-primary" type="submit">Find Matches</button>
        </div>
      </form>
      <div className="grid gap-4">
        {matches.map((room) => (
          <article key={room.id} className="panel grid gap-4 p-5 md:grid-cols-[96px_1fr_120px] md:items-center">
            {room.image ? <img src={room.image} alt={room.title} className="h-24 w-24 rounded-lg object-cover" /> : <span className="grid h-24 w-24 place-items-center rounded-lg bg-primary-50 text-primary-800"><Users /></span>}
            <div>
              <h3 className="font-bold">{room.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{room.hostelName} - {room.city}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">{currency(room.pricePerHead)}</span>
                <span className="chip">{room.mealPlan}</span>
                <span className="chip">{room.genderPolicy}</span>
              </div>
            </div>
            <div className="rounded-lg bg-accent-50 p-4 text-center text-accent-700">
              <p className="text-xs font-bold uppercase tracking-widest">Match</p>
              <p className="mt-1 text-3xl font-extrabold">{room.matchScore || 0}%</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchAlertsPanel({ form, setForm, searches, alerts, onSubmit }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Bell size={22} /> Saved Search Alerts</h3>
        <div className="mt-5 grid gap-4">
          <Input label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <Input label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
          <Input label="University" value={form.university} onChange={(value) => setForm((current) => ({ ...current, university: value }))} />
          <Input label="Max Budget" type="number" value={form.maxBudget} onChange={(value) => setForm((current) => ({ ...current, maxBudget: Number(value) }))} />
          <Select label="Room Type" value={form.roomType} options={["SINGLE", "DOUBLE", "TRIPLE", "PG", "STUDIO"]} onChange={(value) => setForm((current) => ({ ...current, roomType: value }))} />
          <Select label="Frequency" value={form.frequency} options={["instant", "daily", "weekly"]} onChange={(value) => setForm((current) => ({ ...current, frequency: value }))} />
          <button className="btn-primary" type="submit">Save Alert</button>
        </div>
      </form>
      <div className="space-y-5">
        <section className="panel p-6">
          <h3 className="text-xl font-bold">Active Alerts</h3>
          <div className="mt-4 grid gap-3">
            {searches.map((search) => (
              <article key={search.id || search._id || search.title} className="rounded-lg border border-line bg-canvas p-4">
                <p className="font-bold">{search.title}</p>
                <p className="mt-1 text-sm text-slate-700">{search.filters?.city || search.city || "Any city"} - under {currency(search.filters?.maxBudget || search.maxBudget)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Search size={22} /> Latest Matches</h3>
          <div className="mt-4 grid gap-4">
            {alerts.flatMap((alert) => (alert.matches || []).map((room) => ({ ...room, searchTitle: alert.search?.title }))).slice(0, 6).map((room) => (
              <article key={`${room.searchTitle}-${room.id}`} className="flex flex-col gap-3 rounded-lg border border-line bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-800">{room.searchTitle}</p>
                  <p className="mt-1 font-bold">{room.title}</p>
                  <p className="text-sm text-slate-700">{currency(room.pricePerHead)} - {room.city}</p>
                </div>
                <Link to={`/rooms/${room.id}`} className="btn-secondary py-2">Open</Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function ActivitiesPanel({ form, setForm, activities, contributions, setContributions, onSubmit, onJoin, onContribute }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={22} /> Plan Outdoor Activity</h3>
        <div className="mt-5 grid gap-4">
          <Input label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <Select label="Type" value={form.type} options={["trip", "sports", "dining", "study", "shopping", "other"]} onChange={(value) => setForm((current) => ({ ...current, type: value }))} />
          <Input label="Location" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
          <Input label="Date & Time" type="datetime-local" value={form.activityDate} onChange={(value) => setForm((current) => ({ ...current, activityDate: value }))} />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(value) => setForm((current) => ({ ...current, capacity: Number(value) }))} />
          <Input label="Target Collection" type="number" value={form.contributionTarget} onChange={(value) => setForm((current) => ({ ...current, contributionTarget: Number(value) }))} />
          <Input label="Per Person" type="number" value={form.contributionPerPerson} onChange={(value) => setForm((current) => ({ ...current, contributionPerPerson: Number(value) }))} />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Description
            <textarea className="input min-h-24" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <button className="btn-primary" type="submit">Create Activity</button>
        </div>
      </form>

      <div className="grid gap-5">
        {activities.map((activity) => {
          const id = activity.id || activity._id;
          return (
            <article key={id} className="panel p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span className="badge bg-primary-50 text-primary-800">{activity.type}</span>
                  <h3 className="mt-3 text-xl font-bold">{activity.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-700"><MapPin size={16} /> {activity.location}</p>
                  <p className="mt-1 text-sm text-slate-700">{new Date(activity.activityDate).toLocaleString()}</p>
                  <p className="mt-3 text-slate-700">{activity.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-80 lg:grid-cols-1">
                  <Stat label="People" value={`${activity.participantCount || 0}/${activity.capacity || "-"}`} />
                  <Stat label="Collected" value={currency(activity.collectedAmount || 0)} />
                  <Stat label="Remaining" value={currency(activity.remainingAmount || 0)} />
                </div>
              </div>
              <div className="mt-5">
                <ScoreBar label="Collection Progress" value={activity.collectionProgress || 0} />
              </div>
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
                <button type="button" className="btn-secondary" onClick={() => onJoin(activity)}><CheckCircle2 size={18} /> Join</button>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input className="input" type="number" min="1" value={contributions[id] ?? activity.contributionPerPerson ?? ""} onChange={(event) => setContributions((current) => ({ ...current, [id]: event.target.value }))} placeholder="Amount" />
                  <button type="button" className="btn-primary" onClick={() => onContribute(activity)}><CreditCard size={18} /> Contribute</button>
                </div>
                <span className="chip"><WalletCards size={16} /> tracked collection</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StudySessionsPanel({ form, setForm, sessions, onSubmit, onJoin, onComplete }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><BookOpen size={22} /> Create Study Session</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">Organize hostel or campus study circles. Sessions with enough attendance can be flagged for engagement points.</p>
        <div className="mt-5 grid gap-4">
          <Input label="Subject" value={form.subject} onChange={(value) => setForm((current) => ({ ...current, subject: value }))} />
          <Input label="University" value={form.university} onChange={(value) => setForm((current) => ({ ...current, university: value }))} />
          <Input label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
          <Input label="Hostel Name" value={form.hostelName} onChange={(value) => setForm((current) => ({ ...current, hostelName: value }))} />
          <Input label="Location" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
          <Input label="Date & Time" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm((current) => ({ ...current, scheduledAt: value }))} />
          <Input label="Max Participants" type="number" value={form.maxParticipants} onChange={(value) => setForm((current) => ({ ...current, maxParticipants: Number(value) }))} />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Notes
            <textarea className="input min-h-24" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <button className="btn-primary" type="submit"><BookOpen size={18} /> Create Session</button>
        </div>
      </form>

      <div className="grid gap-5">
        {(sessions.length ? sessions : fallbackStudySessions.results).map((session) => {
          const id = session.id || session._id;
          const attendeeCount = Number(session.attendeeCount ?? session.attendees?.length ?? 0);
          const max = Number(session.maxParticipants || 6);
          const progress = Math.min(100, Math.round((attendeeCount / Math.max(1, max)) * 100));
          return (
            <article key={id} className="panel p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span className={`badge ${session.status === "completed" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{session.status || "open"}</span>
                  <h3 className="mt-3 text-xl font-bold">{session.subject}</h3>
                  <p className="mt-2 text-sm text-slate-700">{session.hostelName} - {session.location}</p>
                  <p className="mt-1 text-sm text-slate-700">{new Date(session.scheduledAt).toLocaleString()} - {session.university}, {session.city}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{session.notes}</p>
                </div>
                <div className="rounded-xl border border-line bg-canvas p-4 text-center lg:w-40">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Attendees</p>
                  <p className="mt-2 text-3xl font-extrabold text-primary-800">{attendeeCount}/{max}</p>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-primary-50">
                <div className="h-2 rounded-full bg-primary-700" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => onJoin(session)} className="btn-secondary"><Users size={18} /> Join</button>
                <button type="button" onClick={() => onComplete(session)} className="btn-primary"><CheckCircle2 size={18} /> Complete</button>
                {session.sharedNotesUrl && <a href={session.sharedNotesUrl} className="btn-secondary" target="_blank" rel="noreferrer">Open Notes</a>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LoyaltyPanel({ loyalty, approvedClaim, referralForm, setReferralForm, onReferral, onClaim }) {
  const account = loyalty.account || fallbackLoyalty.account;
  const config = loyalty.config || fallbackLoyalty.config;
  const progress = Math.min(100, Math.round((Number(account.pointsBalance || 0) / Number(config.claimThreshold || 5000)) * 100));

  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onReferral} className="panel h-fit p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Gift size={22} /> Referral Loyalty</h3>
        <p className="mt-2 text-sm text-slate-700">Each successful referral adds {Number(config.referralPoints || 1000).toLocaleString("en-PK")} loyalty points.</p>
        <div className="mt-5 rounded-lg border border-line bg-primary-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Your referral code</p>
          <p className="mt-2 break-all text-2xl font-extrabold text-primary-800">{account.referralCode}</p>
        </div>
        <div className="mt-5 grid gap-4">
          <Input label="Friend Name" value={referralForm.referredName} onChange={(value) => setReferralForm((current) => ({ ...current, referredName: value }))} />
          <Input label="Friend Email" value={referralForm.referredEmail} onChange={(value) => setReferralForm((current) => ({ ...current, referredEmail: value }))} />
          <button className="btn-primary" type="submit"><Share2 size={18} /> Add Referral</button>
        </div>
      </form>

      <div className="space-y-6">
        <section className="panel p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="badge bg-accent-50 text-accent-700"><Trophy size={16} /> Loyalty wallet</p>
              <h3 className="mt-4 text-3xl font-extrabold">{Number(account.pointsBalance || 0).toLocaleString("en-PK")} points</h3>
              <p className="mt-2 text-sm text-slate-700">Claim threshold: {Number(config.claimThreshold || 5000).toLocaleString("en-PK")} points. Admin approves a {config.discountRange?.[0] || 5}-{config.discountRange?.[1] || 10}% discount for your next room booking.</p>
            </div>
            <button type="button" onClick={onClaim} disabled={Number(account.pointsBalance || 0) < Number(config.claimThreshold || 5000)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              <BadgePercent size={18} /> Claim Discount
            </button>
          </div>
          <div className="mt-6">
            <ScoreBar label="Points Progress" value={progress} />
          </div>
          {approvedClaim && (
            <div className="mt-5 rounded-lg border border-accent-700 bg-accent-50 p-4 text-accent-700">
              <p className="text-sm font-bold uppercase tracking-widest">Approved discount</p>
              <p className="mt-2 text-xl font-extrabold">{approvedClaim.couponCode} - {approvedClaim.approvedDiscountPercent}% off next booking</p>
              <p className="mt-1 text-sm">Use this code on the booking payment screen.</p>
            </div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="p-6">
            <h3 className="text-xl font-bold">Referral History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-primary-50 text-xs uppercase tracking-widest text-slate-700">
                <tr><th className="px-6 py-4">Student</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Points</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(account.referrals || []).map((referral) => (
                  <tr key={referral.id || referral._id || referral.referredEmail}>
                    <td className="px-6 py-4 font-semibold">{referral.referredName || "Student"}</td>
                    <td className="px-6 py-4">{referral.referredEmail}</td>
                    <td className="px-6 py-4"><span className="badge bg-accent-50 text-accent-700">{referral.status}</span></td>
                    <td className="px-6 py-4 font-bold text-primary-800">+{Number(referral.pointsAwarded || 0).toLocaleString("en-PK")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function LeaderboardPanel({ entries }) {
  const medalColor = (rank) => (rank === 1 ? "text-[#B45309]" : rank === 2 ? "text-slate-500" : rank === 3 ? "text-[#92400E]" : "text-primary-800");
  return (
    <section className="grid gap-6">
      <section className="panel p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Trophy size={22} /> Referral Points Leaderboard</h3>
        <p className="mt-2 text-sm text-slate-700">Top students ranked by referral loyalty points. Names are partially masked for privacy.</p>
      </section>
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead className="bg-primary-50 text-xs uppercase tracking-widest text-slate-700">
              <tr><th className="px-6 py-4">Rank</th><th className="px-6 py-4">Student</th><th className="px-6 py-4">Points</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((entry) => (
                <tr key={entry.rank} className={entry.isCurrentStudent ? "bg-accent-50" : ""}>
                  <td className="px-6 py-4 font-bold">
                    <span className={`inline-flex items-center gap-2 ${medalColor(entry.rank)}`}>
                      <Medal size={16} /> #{entry.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold">{entry.name} {entry.isCurrentStudent && <span className="chip ml-2">You</span>}</td>
                  <td className="px-6 py-4 font-bold text-primary-800">{Number(entry.points || 0).toLocaleString("en-PK")}</td>
                </tr>
              ))}
              {!entries.length && (
                <tr><td colSpan={3} className="px-6 py-6 text-center text-sm text-slate-600">No leaderboard data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function RewardsPanel({ rewards, pointsBalance, redeemingId, onRedeem }) {
  return (
    <section className="grid gap-6">
      <section className="panel p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Award size={22} /> Rewards Marketplace</h3>
        <p className="mt-2 text-sm text-slate-700">Redeem loyalty points for partner rewards. You have {pointsBalance.toLocaleString("en-PK")} points available.</p>
        <p className="mt-1 text-xs text-slate-500">Partner names are illustrative placeholders for this demo build.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rewards.map((reward) => {
          const disabled = pointsBalance < Number(reward.pointsCost || 0) || redeemingId === reward.id;
          return (
            <article key={reward.id} className="panel flex flex-col p-5">
              <span className="badge bg-primary-50 text-primary-800 self-start">{Number(reward.pointsCost || 0).toLocaleString("en-PK")} pts</span>
              <h4 className="mt-3 text-lg font-bold">{reward.name}</h4>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{reward.partner}</p>
              <p className="mt-3 flex-1 text-sm text-slate-700">{reward.description}</p>
              <button
                type="button"
                className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                onClick={() => onRedeem(reward)}
              >
                <Gift size={16} /> {redeemingId === reward.id ? "Redeeming..." : "Redeem"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GlobalAlertsPanel({ alerts }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <AlertSubmitCard audience="all" title="Submit Hostel Alert" />
      <section className="panel p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold"><Megaphone size={22} /> Active Important Alerts</h3>
        <p className="mt-2 text-sm text-slate-700">Published alerts remain visible globally for 48 hours, then expire automatically.</p>
        <div className="mt-5 grid gap-4">
          {alerts.map((alert) => (
            <article key={alert.id || alert._id} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className={`badge ${alert.severity === "critical" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{alert.severity}</span>
                  <h4 className="mt-3 text-lg font-bold">{alert.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{alert.message}</p>
                </div>
                <span className="chip">{alert.category || "general"}</span>
              </div>
            </article>
          ))}
          {!alerts.length && <p className="rounded-lg bg-primary-50 p-4 text-sm font-semibold text-primary-800">No active global alerts right now.</p>}
        </div>
      </section>
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}
