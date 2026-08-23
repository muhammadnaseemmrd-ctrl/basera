import { useMemo, useState } from "react";
import { BadgePercent, BarChart3, CalendarClock, HandCoins, PiggyBank, Send } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

export function RoomMatchPanel({ match, forecast, room }) {
  const score = Number(match?.score || 82);
  const forecastDate = forecast?.expectedVacancyDate ? new Date(forecast.expectedVacancyDate).toLocaleDateString() : "30 days";
  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><BarChart3 size={14} /> Smart fit</p>
          <h2 className="mt-3 text-xl font-bold">Personal match score</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">Budget, campus fit, preference match, and student trust score combined for this room.</p>
        </div>
        <div className="grid h-20 w-20 place-items-center rounded-full border-[8px] border-primary-100 bg-white">
          <span className="text-2xl font-extrabold text-primary-800">{score}</span>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {Object.entries(match?.breakdown || { budgetFit: 86, campusFit: 82, preferenceFit: 90, trustScore: 84 }).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label.replace(/([A-Z])/g, " $1")}</p>
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-line bg-primary-50 p-4 text-sm leading-6 text-slate-700">
        <CalendarClock className="mb-2 text-primary-800" size={18} />
        Vacancy forecast: {forecast?.confidence || 86}% confidence, expected availability around {forecastDate}. Current rent is {currency(room.pricePerHead)}.
      </div>
    </section>
  );
}

export function RentOfferBox({ room, onCreated }) {
  const [form, setForm] = useState({
    offeredPrice: Math.max(1, Math.round(Number(room.pricePerHead || 0) * 0.92)),
    duration: "Monthly",
    message: "I can move in this month and pay on time."
  });
  const [message, setMessage] = useState("");

  const submitOffer = async (event) => {
    event.preventDefault();
    setMessage("Submitting rent offer...");
    const result = await safeRequest(() => api.post(`/rooms/${room.id}/offers`, form), {
      offer: { id: `offer-${Date.now()}`, roomTitle: room.title, status: "pending", listedPrice: room.pricePerHead, ...form },
      demo: true
    });
    onCreated?.(result.offer);
    setMessage(result.demo ? "Offer submitted in demo mode." : "Offer sent to host.");
  };

  return (
    <section className="panel p-6">
      <p className="badge bg-[#FEF3C7] text-[#92400E]"><HandCoins size={14} /> Live negotiation</p>
      <h2 className="mt-3 text-xl font-bold">Make a rent offer</h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">Host can accept, counter, or decline. Accepted offers can be used during booking.</p>
      <form onSubmit={submitOffer} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Your monthly offer
          <input className="input" type="number" value={form.offeredPrice} onChange={(event) => setForm((current) => ({ ...current, offeredPrice: Number(event.target.value) }))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Duration
          <select className="input" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}>
            <option>Monthly</option>
            <option>Semester</option>
            <option>Annual</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Message
          <textarea className="input min-h-24" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
        </label>
        <button className="btn-primary" type="submit"><Send size={18} /> Submit Offer</button>
        {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
      </form>
    </section>
  );
}

export function StudentBudgetPlanner({ rent = 25000, utilities = 2200 }) {
  const [budget, setBudget] = useState({ income: 55000, food: 14000, transport: 4500, study: 3000, buffer: 6000 });
  const total = useMemo(() => Number(rent || 0) + Number(utilities || 0) + budget.food + budget.transport + budget.study + budget.buffer, [budget, rent, utilities]);
  const remaining = budget.income - total;

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="badge bg-accent-50 text-accent-700"><PiggyBank size={14} /> Budget planner</p>
          <h2 className="mt-3 text-xl font-bold">Monthly living estimate</h2>
          <p className="mt-1 text-sm text-slate-700">Plan total room cost before committing.</p>
        </div>
        <span className={`rounded-lg px-4 py-3 text-sm font-bold ${remaining >= 0 ? "bg-accent-50 text-accent-700" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
          {remaining >= 0 ? "Surplus" : "Short"} {currency(Math.abs(remaining))}
        </span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {Object.entries(budget).map(([key, value]) => (
          <label key={key} className="grid gap-2 text-sm font-semibold capitalize">
            {key}
            <input className="input" type="number" value={value} onChange={(event) => setBudget((current) => ({ ...current, [key]: Number(event.target.value) }))} />
          </label>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
        <div className="flex items-center justify-between text-sm"><span>Rent</span><strong>{currency(rent)}</strong></div>
        <div className="mt-2 flex items-center justify-between text-sm"><span>Estimated utilities</span><strong>{currency(utilities)}</strong></div>
        <div className="mt-3 h-px bg-line" />
        <div className="mt-3 flex items-center justify-between text-lg"><span>Total plan</span><strong className="text-primary-800">{currency(total)}</strong></div>
      </div>
    </section>
  );
}

export function TrustScoreCard({ trustScore }) {
  const score = Number(trustScore?.score || 82);
  return (
    <section className="panel p-6">
      <p className="badge bg-primary-50 text-primary-800"><BadgePercent size={14} /> Student trust</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Trust score {score}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">Improves negotiation approval, faster bookings, and host confidence.</p>
        </div>
        <div className="h-20 w-20 rounded-full border-[8px] border-accent-100 bg-white text-center leading-[64px] text-2xl font-extrabold text-accent-700">{score}</div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Object.entries(trustScore?.breakdown || { payments: 86, disputes: 90, profile: 80, community: 74 }).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
            <p className="mt-2 text-xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
