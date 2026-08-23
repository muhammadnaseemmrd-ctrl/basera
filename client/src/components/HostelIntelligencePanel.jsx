import { useMemo, useState } from "react";
import { Activity, BadgeCheck, ChefHat, GraduationCap, Radio, Star } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer
} from "recharts";
import { api, safeRequest } from "../services/api";

const mealLabel = (meal) => `${meal.day} ${meal.type}`;

export function HostelDnaScore({ score }) {
  const dimensions = useMemo(() => score?.dimensions || [], [score?.dimensions]);
  const chartData = useMemo(() => dimensions.map((item) => ({ axis: item.name, score: item.score })), [dimensions]);
  const overall = Number(score?.overallScore || 0);

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><BadgeCheck size={14} /> Basera DNA</p>
          <h2 className="mt-3 text-xl font-bold">Quality fingerprint</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">Safety, value, comfort, location, host quality, and community signals in one transparent score.</p>
        </div>
        <div className="rounded-lg border border-line bg-canvas px-5 py-4 text-center">
          <p className="text-3xl font-extrabold text-primary-800">{overall}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Overall</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid stroke="#d8dfef" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#334155" }} />
              <Radar dataKey="score" stroke="#C93D1E" fill="#FF6B4A" fillOpacity={0.28} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {dimensions.slice(0, 8).map((item) => (
            <div key={item.name} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{item.name}</p>
                <span className="font-extrabold text-primary-800">{item.score}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-700">{item.basis}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HostelPulseWidget({ pulse }) {
  const level = pulse?.pulseLevel || "active";
  const tone = level === "active" ? "bg-accent-50 text-accent-700" : level === "quiet" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-primary-50 text-primary-800";
  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`badge ${tone}`}><Radio size={14} /> Live pulse</p>
          <h2 className="mt-3 text-xl font-bold">Hostel activity</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">Recent views, bookings, updates, and availability signals.</p>
        </div>
        <span className="relative grid h-12 w-12 place-items-center rounded-full bg-primary-700 text-white">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-30" />
          <Activity size={20} />
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["Views 24h", pulse?.viewsLast24h || 128],
          ["Bookings 24h", pulse?.bookingsLast24h || 3],
          ["Open beds", pulse?.availableBeds ?? 5],
          ["Last review", pulse?.lastReviewAge || "2 days ago"]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AlumniNetworkPanel({ alumni }) {
  const summary = alumni || { count: 0, byUniversity: {}, byGraduationYear: {}, networkStrength: 0, sampleReviews: [] };
  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><GraduationCap size={14} /> Alumni network</p>
          <h2 className="mt-3 text-xl font-bold">{summary.count || 0} alumni linked</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">Long-stay tenants can add alumni reviews and referrals without exposing private identities.</p>
        </div>
        <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-center">
          <p className="text-2xl font-extrabold text-primary-800">{summary.networkStrength || 0}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Strength</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">By university</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(summary.byUniversity || {}).map(([key, value]) => <span key={key} className="chip bg-white">{key}: {value}</span>)}
            {!Object.keys(summary.byUniversity || {}).length && <span className="chip bg-white">No public alumni stats yet</span>}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Alumni reviews</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">{summary.sampleReviews?.[0]?.text || "Alumni reviews appear here after long-stay students link their past stay."}</p>
        </div>
      </div>
    </section>
  );
}

export function MessMenuWidget({ menu, onRated }) {
  const [ratingMessage, setRatingMessage] = useState("");
  const meals = menu?.meals?.length ? menu.meals : [
    { mealId: "demo-breakfast", day: "Monday", type: "breakfast", items: ["Paratha", "Omelette", "Tea"], rating: 4.5, ratingCount: 12 },
    { mealId: "demo-lunch", day: "Monday", type: "lunch", items: ["Chicken pulao", "Raita", "Salad"], rating: 4.6, ratingCount: 16 },
    { mealId: "demo-dinner", day: "Monday", type: "dinner", items: ["Daal", "Chapati", "Rice"], rating: 4.2, ratingCount: 10 }
  ];
  const visibleMeals = meals.slice(0, 9);

  const rateMeal = async (meal, rating) => {
    setRatingMessage("Saving meal rating...");
    const result = await safeRequest(() => api.post(`/mess-menu/meals/${meal.mealId}/rate`, { rating }), { demo: true });
    setRatingMessage(result.demo ? "Meal rating saved in demo mode." : "Meal rating saved.");
    onRated?.(meal, rating);
    setTimeout(() => setRatingMessage(""), 2200);
  };

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="badge bg-accent-50 text-accent-700"><ChefHat size={14} /> Mess menu</p>
          <h2 className="mt-3 text-xl font-bold">Meals this week</h2>
          <p className="mt-1 text-sm text-slate-700">Students can rate meals so future search can surface better mess quality.</p>
        </div>
        <span className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm font-bold text-primary-800">Score {Number(menu?.messScore || 4.6).toFixed(1)}</span>
      </div>

      {ratingMessage && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{ratingMessage}</p>}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {visibleMeals.map((meal) => (
          <article key={meal.mealId || mealLabel(meal)} className="rounded-lg border border-line bg-canvas p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold capitalize">{meal.type}</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">{meal.day}</p>
              </div>
              <span className="badge bg-primary-50 text-primary-800"><Star size={13} /> {Number(meal.rating || 4.5).toFixed(1)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{(meal.items || []).join(", ")}</p>
            <div className="mt-4 flex gap-2">
              {[3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => rateMeal(meal, value)} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-bold text-primary-800">
                  {value}*
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
