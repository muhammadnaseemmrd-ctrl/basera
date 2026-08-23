import { useEffect, useMemo, useState } from "react";
import { Bell, Brain, Calculator, CalendarDays, CheckCircle2, CreditCard, MessageSquare, Share2, Sparkles, Users, WalletCards } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

const fallbackMatches = {
  results: [
    {
      id: "r1",
      title: "Premium Single Seater near NUST",
      hostelName: "Cozy Boys Hostel F-10",
      city: "Islamabad",
      area: "F-10",
      pricePerHead: 25000,
      totalMoveInCost: 59000,
      commuteMinutes: 15,
      availableBeds: 1,
      scores: { match: 92, value: 78, commute: 86, safety: 90, amenities: 84 },
      rankingReasons: ["Near NUST", "Fits budget", "Strong safety signals"]
    },
    {
      id: "r4",
      title: "NUST Double Sharing",
      hostelName: "Pine Crest Boys Hostel",
      city: "Islamabad",
      area: "H-13",
      pricePerHead: 12500,
      totalMoveInCost: 25000,
      commuteMinutes: 8,
      availableBeds: 1,
      scores: { match: 89, value: 94, commute: 76, safety: 88, amenities: 70 },
      rankingReasons: ["Budget friendly", "Close commute", "Verified property"]
    }
  ],
  explanation: "Ranked by budget, commute, safety, gender preference, meals, and availability."
};

const fallbackCompare = {
  results: fallbackMatches.results.map((room) => ({
    ...room,
    securityDeposit: room.id === "r1" ? 25000 : 12500,
    mealPlan: "FULL_BOARD",
    genderPolicy: "BOYS_ONLY"
  }))
};

const fallbackWallet = {
  wallet: {
    balance: 3500,
    loyaltyPoints: 4200,
    credits: [
      { id: "credit-ref", source: "Referral", points: 1000, amount: 0, note: "Hamza joined Basera." },
      { id: "credit-refund", source: "Deposit refund", points: 0, amount: 3000, note: "Available for next booking." }
    ]
  }
};

const fallbackGroups = {
  results: [
    { id: "cg-nust", name: "NUST Housing Circle", university: "NUST", city: "Islamabad", members: 1240, verified: true, topics: ["roommates", "alerts", "rides"] },
    { id: "cg-lums", name: "LUMS Basera Group", university: "LUMS", city: "Lahore", members: 860, verified: true, topics: ["PG rooms", "visits", "marketplace"] }
  ]
};

const fallbackChecklist = {
  checklist: {
    bookingId: "b1",
    items: [
      { key: "pay-balance", label: "Pay any remaining balance", completed: false },
      { key: "upload-id", label: "Upload CNIC/student ID", completed: false },
      { key: "route", label: "Save move-in route and Host check-in window", completed: false },
      { key: "receipt", label: "Download QR receipt", completed: false }
    ]
  }
};

const fallbackCost = {
  estimate: {
    rent: 18000,
    meals: 9000,
    laundry: 1500,
    commute: 1848,
    utilities: 3000,
    serviceFee: 400,
    depositAmortized: 833,
    monthlyTotal: 33581,
    moveInCost: 23400
  }
};

const fallbackRoommates = {
  results: [
    { roomId: "r1", title: "Premium Single Seater near NUST", compatibilityScore: 92, reasons: ["Study schedule fit", "Food preference fit"] },
    { roomId: "r4", title: "NUST Double Sharing", compatibilityScore: 88, reasons: ["Budget compatibility", "Cleanliness preference fit"] }
  ]
};

const fallbackRefund = {
  preview: {
    refundAmount: 30000,
    nonRefundableAmount: 0,
    depositRefund: 5000,
    policyVersion: "v6-demo",
    policyLabel: "Standard refundable window.",
    etaDays: 3
  }
};

const fallbackConcierge = {
  answer: "Compare rent, deposit, commute, meals, safety and parent summary before booking.",
  recommendations: fallbackMatches.results.slice(0, 2),
  nextActions: ["Open map search", "Compare rooms", "Share shortlist"],
  confidence: 0.78
};

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

export function StudentDecisionLab() {
  const [quiz, setQuiz] = useState({ city: "Islamabad", university: "NUST", maxBudget: 25000, gender: "boys", meals: true, safetyPriority: true });
  const [matches, setMatches] = useState(fallbackMatches.results);
  const [comparison, setComparison] = useState(fallbackCompare.results);
  const [cost, setCost] = useState(fallbackCost.estimate);
  const [roommates, setRoommates] = useState(fallbackRoommates.results);
  const [wallet, setWallet] = useState(fallbackWallet.wallet);
  const [groups, setGroups] = useState(fallbackGroups.results);
  const [checklist, setChecklist] = useState(fallbackChecklist.checklist);
  const [refund, setRefund] = useState(fallbackRefund.preview);
  const [concierge, setConcierge] = useState(fallbackConcierge);
  const [shortlist, setShortlist] = useState(null);
  const [visit, setVisit] = useState(null);
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("Which NUST room is safest under 25k?");
  const [visitForm, setVisitForm] = useState({ hostelId: "h1", visitType: "physical", preferredDate: "2026-06-15", preferredTime: "18:30" });

  const bestMatch = useMemo(() => matches[0] || fallbackMatches.results[0], [matches]);
  const walletCredits = useMemo(() => wallet.credits || [], [wallet]);

  useEffect(() => {
    safeRequest(() => api.get("/wallet/credits"), fallbackWallet).then((result) => setWallet(result.wallet || fallbackWallet.wallet));
    safeRequest(() => api.get("/campus-groups"), fallbackGroups).then((result) => setGroups(result.results || fallbackGroups.results));
    safeRequest(() => api.get("/move-in/checklist", { params: { bookingId: "b1" } }), fallbackChecklist).then((result) => setChecklist(result.checklist || fallbackChecklist.checklist));
  }, []);

  const runQuiz = async (event) => {
    event.preventDefault();
    setMessage("Running AI room match quiz...");
    const result = await safeRequest(() => api.post("/recommendations/match-quiz", quiz), fallbackMatches);
    setMatches(result.results || fallbackMatches.results);
    setMessage(result.demo ? "Room match calculated in demo mode." : "Room match calculated from API data.");
  };

  const compareRooms = async () => {
    setMessage("Building comparison board...");
    const result = await safeRequest(() => api.post("/rooms/compare", { roomIds: matches.slice(0, 3).map((room) => room.id) }), fallbackCompare);
    setComparison(result.results || fallbackCompare.results);
    setMessage(result.demo ? "Comparison board loaded in demo mode." : "Comparison board loaded.");
  };

  const calculateCost = async () => {
    setMessage("Estimating monthly cost...");
    const result = await safeRequest(
      () => api.post("/tools/cost-estimator", { rent: bestMatch.pricePerHead, mealCost: 9000, commuteKm: 3, securityDeposit: 5000 }),
      fallbackCost
    );
    setCost(result.estimate || fallbackCost.estimate);
    setMessage(result.demo ? "Cost estimate loaded in demo mode." : "Cost estimate loaded.");
  };

  const scoreRoommates = async () => {
    setMessage("Scoring roommate compatibility...");
    const result = await safeRequest(() => api.post("/roommates/score", { studyStyle: "silent", foodPreference: "mess", cleanliness: "regular" }), fallbackRoommates);
    setRoommates(result.results || fallbackRoommates.results);
    setMessage(result.demo ? "Roommate score loaded in demo mode." : "Roommate score loaded.");
  };

  const createSearchAlert = async () => {
    setMessage("Creating saved search alert...");
    const result = await safeRequest(
      () => api.post("/search-alerts", { title: `${quiz.university} under ${quiz.maxBudget}`, filters: quiz, trigger: "under_budget_or_near_university" }),
      { search: { id: `sa-${Date.now()}`, title: `${quiz.university} under ${quiz.maxBudget}` }, matches: fallbackMatches.results, demo: true }
    );
    setMessage(result.demo ? "Search alert saved in demo mode." : `Search alert saved: ${result.search?.title}`);
  };

  const shareParentShortlist = async () => {
    setMessage("Creating parent share link...");
    const roomIds = matches.slice(0, 3).map((room) => room.id);
    const result = await safeRequest(
      () => api.post("/shortlists/share", { title: "Parent shortlist", roomIds, parentEmail: "parent@example.com", note: "Top rooms after AI matching." }),
      { shortlist: { id: `short-${Date.now()}`, shareToken: "HHSL-DEMO" }, shareUrl: "/shortlists/HHSL-DEMO", demo: true }
    );
    setShortlist({ ...result.shortlist, shareUrl: result.shareUrl });
    setMessage(result.demo ? "Parent share link created in demo mode." : "Parent share link created.");
  };

  const scheduleVisit = async (event) => {
    event.preventDefault();
    setMessage("Scheduling visit...");
    const result = await safeRequest(() => api.post("/visits", visitForm), { visit: { id: `visit-${Date.now()}`, hostelName: "Cozy Boys Hostel F-10", status: "pending_host_approval", ...visitForm }, demo: true });
    setVisit(result.visit);
    setMessage(result.demo ? "Visit scheduled in demo mode." : "Visit request sent to Host.");
  };

  const previewRefund = async () => {
    setMessage("Previewing refund policy...");
    const result = await safeRequest(() => api.post("/refunds/preview", { rentPaid: bestMatch.pricePerHead, securityDeposit: 5000, daysUntilMoveIn: 7 }), fallbackRefund);
    setRefund(result.preview || fallbackRefund.preview);
    setMessage(result.demo ? "Refund preview loaded in demo mode." : "Refund preview loaded.");
  };

  const askConcierge = async (event) => {
    event.preventDefault();
    setMessage("Asking student concierge...");
    const result = await safeRequest(() => api.post("/ai/student-concierge", { question, city: quiz.city }), fallbackConcierge);
    setConcierge(result || fallbackConcierge);
    setMessage(result.demo ? "Concierge answered in template fallback mode." : "Concierge answered.");
  };

  return (
    <section className="space-y-7">
      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="badge bg-primary-50 text-primary-800"><Brain size={16} /> AI room match quiz</p>
              <h3 className="mt-4 text-2xl font-extrabold">Find the best fit before you pay</h3>
              <p className="mt-2 text-sm text-slate-700">Rank rooms by affordability, commute, safety, meals, availability, and parent confidence.</p>
            </div>
            <Sparkles className="text-primary-800" />
          </div>
          <form onSubmit={runQuiz} className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">
              City
              <select className="input" value={quiz.city} onChange={(event) => setQuiz((current) => ({ ...current, city: event.target.value }))}>
                <option>Islamabad</option>
                <option>Lahore</option>
                <option>Karachi</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              University
              <select className="input" value={quiz.university} onChange={(event) => setQuiz((current) => ({ ...current, university: event.target.value }))}>
                <option>NUST</option>
                <option>LUMS</option>
                <option>FAST</option>
                <option>IBA</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Max Budget
              <input className="input" type="number" value={quiz.maxBudget} onChange={(event) => setQuiz((current) => ({ ...current, maxBudget: Number(event.target.value) }))} />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-4 text-sm font-semibold">
              <input type="checkbox" checked={quiz.meals} onChange={(event) => setQuiz((current) => ({ ...current, meals: event.target.checked }))} className="h-4 w-4 accent-primary-700" />
              Meals important
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-line bg-canvas p-4 text-sm font-semibold">
              <input type="checkbox" checked={quiz.safetyPriority} onChange={(event) => setQuiz((current) => ({ ...current, safetyPriority: event.target.checked }))} className="h-4 w-4 accent-primary-700" />
              Safety priority
            </label>
            <button type="submit" className="btn-primary">Run Match</button>
          </form>
        </article>

        <article className="panel p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Best match</p>
          <h3 className="mt-3 text-2xl font-extrabold">{bestMatch.title}</h3>
          <p className="mt-2 text-sm text-slate-700">{bestMatch.hostelName} - {bestMatch.area}, {bestMatch.city}</p>
          <div className="mt-5 grid gap-3">
            <ScoreBar label="Match" value={bestMatch.scores?.match || 90} />
            <ScoreBar label="Safety" value={bestMatch.scores?.safety || 84} />
            <ScoreBar label="Value" value={bestMatch.scores?.value || 78} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(bestMatch.rankingReasons || []).map((reason) => <span key={reason} className="chip">{reason}</span>)}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="panel p-6 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Room Comparison Board</h3>
              <p className="mt-1 text-sm text-slate-700">Side-by-side rent, deposit, commute, safety, and move-in exposure.</p>
            </div>
            <button type="button" onClick={compareRooms} className="btn-secondary"><CheckCircle2 size={16} /> Refresh Compare</button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {comparison.map((room) => (
              <div key={room.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{room.title}</p>
                    <p className="text-sm text-slate-700">{room.hostelName}</p>
                  </div>
                  <span className="badge bg-primary-50 text-primary-800">{room.availableBeds || 0} beds</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <span>Rent <strong className="block text-primary-800">{currency(room.pricePerHead)}</strong></span>
                  <span>Move-in <strong className="block">{currency(room.totalMoveInCost || Number(room.pricePerHead || 0) + Number(room.securityDeposit || 0))}</strong></span>
                  <span>Commute <strong className="block">{room.commuteMinutes || room.distanceToUniversity || 15} min</strong></span>
                  <span>Safety <strong className="block">{room.scores?.safety || 82}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">Student Wallet</h3>
            <WalletCards className="text-primary-800" />
          </div>
          <p className="mt-4 text-3xl font-extrabold text-primary-800">{currency(wallet.balance)}</p>
          <p className="mt-1 text-sm text-slate-700">{Number(wallet.loyaltyPoints || 0).toLocaleString("en-PK")} loyalty points</p>
          <div className="mt-5 grid gap-3">
            {walletCredits.slice(0, 3).map((credit) => (
              <div key={credit.id || credit.source} className="rounded-lg border border-line bg-canvas p-3 text-sm">
                <p className="font-bold">{credit.source}</p>
                <p className="text-slate-700">{credit.note}</p>
                <p className="mt-1 text-primary-800">{credit.amount ? currency(credit.amount) : `${credit.points || 0} points`}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Calculator size={20} /> Cost Estimator</h3>
          <p className="mt-1 text-sm text-slate-700">Monthly real cost including meals, commute, utilities, service fee, and amortized deposit.</p>
          <div className="mt-5 grid gap-2 text-sm">
            {Object.entries(cost).filter(([key]) => !["monthlyTotal", "moveInCost"].includes(key)).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b border-line py-2">
                <span className="capitalize text-slate-700">{key.replace(/([A-Z])/g, " $1")}</span>
                <strong>{currency(value)}</strong>
              </div>
            ))}
          </div>
          <p className="mt-5 text-2xl font-extrabold text-primary-800">{currency(cost.monthlyTotal)} /mo</p>
          <button type="button" onClick={calculateCost} className="btn-secondary mt-5 w-full">Recalculate</button>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Users size={20} /> Roommate Compatibility</h3>
          <div className="mt-5 grid gap-3">
            {roommates.map((item) => (
              <div key={item.roomId} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{item.title}</p>
                  <span className="badge bg-accent-50 text-accent-700">{item.compatibilityScore}%</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{(item.reasons || []).join(", ")}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={scoreRoommates} className="btn-secondary mt-5 w-full">Score Again</button>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><CreditCard size={20} /> Refund Preview</h3>
          <p className="mt-4 text-3xl font-extrabold text-primary-800">{currency(refund.refundAmount)}</p>
          <p className="mt-2 text-sm text-slate-700">{refund.policyLabel}</p>
          <div className="mt-5 grid gap-2 text-sm">
            <div className="flex justify-between"><span>Deposit refund</span><strong>{currency(refund.depositRefund)}</strong></div>
            <div className="flex justify-between"><span>Non-refundable</span><strong>{currency(refund.nonRefundableAmount)}</strong></div>
            <div className="flex justify-between"><span>ETA</span><strong>{refund.etaDays} days</strong></div>
          </div>
          <button type="button" onClick={previewRefund} className="btn-secondary mt-5 w-full">Preview Policy</button>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Parent Share, Visit Scheduler, and Search Alerts</h3>
              <p className="mt-1 text-sm text-slate-700">Create trusted parent links, schedule visits, and get alert triggers when better rooms appear.</p>
            </div>
            <button type="button" onClick={createSearchAlert} className="btn-secondary"><Bell size={16} /> Save Alert</button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">Parent shortlist</p>
              <p className="mt-2 text-sm text-slate-700">Share the top rooms with parent-safe pricing, safety and payment protection notes.</p>
              <button type="button" onClick={shareParentShortlist} className="btn-primary mt-4 w-full"><Share2 size={16} /> Create Parent Link</button>
              {shortlist && <p className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-800">{shortlist.shareUrl}</p>}
            </div>
            <form onSubmit={scheduleVisit} className="rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">Schedule a visit</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input className="input" type="date" value={visitForm.preferredDate} onChange={(event) => setVisitForm((current) => ({ ...current, preferredDate: event.target.value }))} />
                <input className="input" type="time" value={visitForm.preferredTime} onChange={(event) => setVisitForm((current) => ({ ...current, preferredTime: event.target.value }))} />
              </div>
              <button type="submit" className="btn-primary mt-4 w-full"><CalendarDays size={16} /> Request Visit</button>
              {visit && <p className="mt-3 text-sm font-semibold text-primary-800">{visit.hostelName} - {visit.status}</p>}
            </form>
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Move-in Checklist</h3>
          <div className="mt-5 grid gap-3">
            {(checklist.items || []).map((item) => (
              <div key={item.key} className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-3">
                <CheckCircle2 size={18} className={item.completed ? "text-accent-700" : "text-slate-500"} />
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><MessageSquare size={20} /> Student Concierge</h3>
          <form onSubmit={askConcierge} className="mt-4 grid gap-3">
            <textarea className="input min-h-28" value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button type="submit" className="btn-primary">Ask Concierge</button>
          </form>
          <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
            <p className="text-sm text-slate-700">{concierge.answer}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary-800">Confidence {Math.round(Number(concierge.confidence || 0.78) * 100)}%</p>
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Campus Groups</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <div key={group.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{group.name}</p>
                    <p className="mt-1 text-sm text-slate-700">{group.university} - {group.city}</p>
                  </div>
                  {group.verified && <span className="badge bg-accent-50 text-accent-700">Verified</span>}
                </div>
                <p className="mt-3 text-sm">{Number(group.members || 0).toLocaleString("en-PK")} members</p>
                <div className="mt-3 flex flex-wrap gap-2">{(group.topics || []).map((topic) => <span key={topic} className="chip">{topic}</span>)}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
