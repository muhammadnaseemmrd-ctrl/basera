import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, MessageSquare, Pencil, Sparkles, Star, TrendingUp, Users, Wrench } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

const fallbackGrowth = {
  score: 84,
  recommendations: [
    { title: "Add 360 tour media", impact: "High", action: "Upload virtualTourUrl or panoramaUrl for top rooms.", metric: "+8% conversion" },
    { title: "Improve listing descriptions", impact: "Medium", action: "Use the AI description generator and remove vague rules.", metric: "+5% trust" },
    { title: "Tighten response time", impact: "High", action: "Use reply templates for visits and payment queries.", metric: "Target under 20 min" }
  ],
  listingHealth: [
    { id: "r1", title: "Premium Single Seater near NUST", photos: 4, score: 88 },
    { id: "r4", title: "NUST Double Sharing", photos: 3, score: 82 }
  ]
};

const fallbackPricing = {
  city: "Islamabad",
  roomType: "DOUBLE",
  suggestedMin: 18000,
  suggestedMax: 26000,
  confidence: 0.78,
  drivers: ["Nearby competition", "Current occupancy", "Seasonal student demand", "Meal plan and security amenities"],
  explanation: "Based on available Basera pricing data for Islamabad. Consider a range of PKR 18,000-26,000."
};

const fallbackCalendar = {
  days: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.now() + index * 86400000).toISOString().slice(0, 10),
    occupied: 32 + (index % 6),
    vacant: 8 - (index % 3),
    held: index % 5 === 0 ? 2 : 1,
    repairBlocked: index % 7 === 0 ? 1 : 0,
    moveOuts: index % 9 === 0 ? 1 : 0
  }))
};

const fallbackReputation = {
  reputation: {
    score: 86,
    responseTime: 22,
    cancellationRate: 2,
    disputeRate: 1,
    reviewScore: 4.7,
    factors: [
      { label: "Response time", value: 88, tone: "green" },
      { label: "Verified documents", value: 92, tone: "green" },
      { label: "Dispute rate", value: 84, tone: "blue" },
      { label: "Review quality", value: 90, tone: "green" }
    ],
    recommendations: [{ title: "Keep response under 20 minutes", impact: "Improves rank", action: "Use reply templates." }]
  }
};

const fallbackTemplates = {
  results: [
    { id: "visit", category: "visit", title: "Visit confirmation", body: "Your visit request is received. Please select a time slot from Basera so we can confirm safely." },
    { id: "rules", category: "rules", title: "House rules", body: "Rules are visible in the listing. Payments and confirmations must stay inside Basera." },
    { id: "checkin", category: "check-in", title: "Check-in instructions", body: "After confirmed payment, Basera will unlock contact and move-in details." }
  ]
};

const fallbackTenant = {
  profile: {
    bookingId: "b1",
    tenant: { name: "Ali Ahmed", email: "student@basera.pk" },
    room: { title: "Premium Single Seater near NUST" },
    rentStatus: "current",
    reminders: [{ title: "Next rent due", dueAt: new Date(Date.now() + 7 * 86400000).toISOString() }],
    documents: [{ label: "Booking receipt", status: "available" }, { label: "Move-in checklist", status: "available" }]
  }
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

export function HostGrowthCenter() {
  const [growth, setGrowth] = useState(fallbackGrowth);
  const [pricing, setPricing] = useState(fallbackPricing);
  const [calendar, setCalendar] = useState(fallbackCalendar.days);
  const [reputation, setReputation] = useState(fallbackReputation.reputation);
  const [templates, setTemplates] = useState(fallbackTemplates.results);
  const [tenant, setTenant] = useState(fallbackTenant.profile);
  const [bulkForm, setBulkForm] = useState({ roomIds: "r1,r4", pricePerHead: 22000, availableBeds: 2, mealPlan: "FULL_BOARD" });
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  const calendarMax = useMemo(() => Math.max(...calendar.map((day) => Number(day.occupied || 0) + Number(day.vacant || 0)), 1), [calendar]);

  const loadHostTools = () => {
    safeRequest(() => api.get("/host/growth-coach"), fallbackGrowth).then((result) => setGrowth(result || fallbackGrowth));
    safeRequest(() => api.get("/host/pricing/suggestions", { params: { city: "Islamabad", roomType: "DOUBLE" } }), fallbackPricing).then((result) => setPricing(result || fallbackPricing));
    safeRequest(() => api.get("/host/availability-calendar"), fallbackCalendar).then((result) => setCalendar(result.days || fallbackCalendar.days));
    safeRequest(() => api.get("/host/reputation"), fallbackReputation).then((result) => setReputation(result.reputation || fallbackReputation.reputation));
    safeRequest(() => api.get("/host/reply-templates"), fallbackTemplates).then((result) => setTemplates(result.results || fallbackTemplates.results));
    safeRequest(() => api.get("/host/tenants/b1/profile"), fallbackTenant).then((result) => setTenant(result.profile || fallbackTenant.profile));
  };

  useEffect(() => {
    loadHostTools();
  }, []);

  const saveBulkUpdate = async (event) => {
    event.preventDefault();
    setMessage("Applying bulk room update...");
    const payload = {
      ...bulkForm,
      roomIds: bulkForm.roomIds.split(",").map((item) => item.trim()).filter(Boolean),
      pricePerHead: Number(bulkForm.pricePerHead),
      availableBeds: Number(bulkForm.availableBeds)
    };
    const result = await safeRequest(() => api.patch("/host/rooms/bulk", payload), { updated: payload.roomIds.length, patch: payload, demo: true });
    setMessage(result.demo ? `Updated ${result.updated} rooms in demo mode.` : `Updated ${result.updated} rooms.`);
  };

  const generateDescription = async () => {
    setMessage("Generating listing description...");
    const result = await safeRequest(
      () => api.post("/ai/listing-description", { title: "Verified NUST shared room", area: "H-13", amenities: ["WiFi", "CCTV", "Mess", "Study desk"], roomId: "r4" }),
      { english: "This verified room is designed for practical student living with WiFi, CCTV, mess, and study desk. Pricing and booking protection are handled through Basera.", demo: true }
    );
    setDescription(result.english || "");
    setMessage(result.demo ? "AI description generated in fallback mode." : "AI description generated.");
  };

  return (
    <section className="space-y-7">
      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="badge bg-primary-50 text-primary-800"><TrendingUp size={16} /> Host growth coach</p>
              <h2 className="mt-4 text-3xl font-extrabold">{growth.score}/100</h2>
              <p className="mt-2 text-sm text-slate-700">Operational score from photos, listing quality, response time, price fit, and verified trust signals.</p>
            </div>
            <button type="button" onClick={loadHostTools} className="btn-secondary py-2">Refresh</button>
          </div>
          <div className="mt-6 grid gap-3">
            {(growth.recommendations || []).map((item) => (
              <div key={item.title} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{item.title}</p>
                  <span className={`badge ${item.impact === "High" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{item.impact}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.action}</p>
                <p className="mt-2 text-sm font-semibold text-primary-800">{item.metric}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Occupancy Heat Calendar</h3>
              <p className="mt-1 text-sm text-slate-700">Daily occupancy, vacancies, held beds, repair blocks, and move-outs.</p>
            </div>
            <span className="badge bg-accent-50 text-accent-700"><CalendarDays size={14} /> 30-day view</span>
          </div>
          <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {calendar.slice(0, 30).map((day) => {
              const total = Number(day.occupied || 0) + Number(day.vacant || 0);
              const intensity = Math.round((total / calendarMax) * 100);
              const occupiedPct = Math.round((Number(day.occupied || 0) / Math.max(1, total)) * 100);
              return (
                <div key={day.date} className="rounded-lg border border-line bg-canvas p-2 text-center" title={`${day.date}: ${occupiedPct}% occupied`}>
                  <div className="mx-auto h-12 w-full rounded-md bg-primary-50">
                    <div className="h-full rounded-md bg-primary-700" style={{ opacity: Math.max(0.25, intensity / 100) }} />
                  </div>
                  <p className="mt-2 text-xs font-bold">{new Date(day.date).getDate()}</p>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><BarChart3 size={20} /> Smart Pricing</h3>
          <p className="mt-2 text-sm text-slate-700">{pricing.city} {pricing.roomType?.replace("_", " ")} recommended band.</p>
          <p className="mt-5 text-3xl font-extrabold text-primary-800">{currency(pricing.suggestedMin)} - {currency(pricing.suggestedMax)}</p>
          <p className="mt-2 text-sm font-semibold">Confidence {Math.round(Number(pricing.confidence || 0) * 100)}%</p>
          {pricing.explanation && <p className="mt-3 text-sm text-slate-700">{pricing.explanation}</p>}
          <div className="mt-5 flex flex-wrap gap-2">{(pricing.drivers || []).map((driver) => <span key={driver} className="chip">{driver}</span>)}</div>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Star size={20} /> Reputation Score</h3>
          <p className="mt-5 text-4xl font-extrabold text-primary-800">{reputation.score}</p>
          <p className="mt-1 text-sm text-slate-700">Review {reputation.reviewScore} - response {reputation.responseTime} min - disputes {reputation.disputeRate}%</p>
          <div className="mt-5 grid gap-3">
            {(reputation.factors || []).map((factor) => <ScoreBar key={factor.label} label={factor.label} value={factor.value} />)}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Users size={20} /> Tenant CRM Snapshot</h3>
          <p className="mt-5 text-lg font-bold">{tenant.tenant?.name || "Tenant"}</p>
          <p className="mt-1 text-sm text-slate-700">{tenant.room?.title || "Room"} - rent {tenant.rentStatus}</p>
          <div className="mt-5 grid gap-2">
            {(tenant.documents || []).map((document) => (
              <div key={document.label} className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3 text-sm">
                <span>{document.label}</span>
                <span className="badge bg-accent-50 text-accent-700">{document.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={saveBulkUpdate} className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Pencil size={20} /> Bulk Room Editor</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Room IDs
              <input className="input" value={bulkForm.roomIds} onChange={(event) => setBulkForm((current) => ({ ...current, roomIds: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Price per head
              <input className="input" type="number" value={bulkForm.pricePerHead} onChange={(event) => setBulkForm((current) => ({ ...current, pricePerHead: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Available beds
              <input className="input" type="number" value={bulkForm.availableBeds} onChange={(event) => setBulkForm((current) => ({ ...current, availableBeds: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Meal plan
              <select className="input" value={bulkForm.mealPlan} onChange={(event) => setBulkForm((current) => ({ ...current, mealPlan: event.target.value }))}>
                <option>FULL_BOARD</option>
                <option>TWO_MEALS</option>
                <option>BREAKFAST</option>
                <option>NONE</option>
              </select>
            </label>
          </div>
          <button type="submit" className="btn-primary mt-5 w-full">Apply Bulk Update</button>
        </form>

        <article className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={20} /> AI Listing Description</h3>
              <p className="mt-1 text-sm text-slate-700">Generate contact-safe, trust-focused copy for room listings.</p>
            </div>
            <button type="button" onClick={generateDescription} className="btn-secondary">Generate</button>
          </div>
          <div className="mt-5 min-h-32 rounded-lg border border-line bg-canvas p-4 text-sm text-slate-700">
            {description || "Generated description will appear here."}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><MessageSquare size={20} /> Auto Reply Templates</h3>
          <div className="mt-5 grid gap-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{template.title}</p>
                  <span className="chip">{template.category}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{template.body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Wrench size={20} /> Maintenance SLA Board</h3>
          <div className="mt-5 grid gap-3">
            {[
              ["Open tickets", 4, "2 under SLA"],
              ["Urgent", 1, "Generator backup check"],
              ["Resolved this week", 9, "Average 18 hours"]
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-extrabold text-primary-800">{value}</p>
                <p className="mt-1 text-sm text-slate-700">{note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
