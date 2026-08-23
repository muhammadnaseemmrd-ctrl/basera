import { useEffect, useMemo, useState } from "react";
import { Banknote, ChefHat, FileDown, HandCoins, ReceiptText, Send, SplitSquareHorizontal, TrendingUp } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { ConfirmButton } from "./ui";
import { currency } from "../utils/formatters";
import { downloadApiPdf } from "../utils/downloadFile";

export function HostFinanceIntelligence() {
  const [pl, setPl] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [message, setMessage] = useState("");
  const [bill, setBill] = useState({ electricity: 12000, gas: 4000, water: 1500, hostelId: "h1" });
  const [split, setSplit] = useState(null);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/host/pl-statement"), { statement: null }).then((result) => setPl(result.statement));
    safeRequest(() => api.get("/dashboard/host/cashflow-forecast"), { forecast: null }).then((result) => setForecast(result.forecast));
    safeRequest(() => api.get("/dashboard/host/portfolio-finance"), { portfolio: null }).then((result) => setPortfolio(result.portfolio));
  }, []);

  const lines = pl?.lines || { grossRentCollected: 118000, platformCommissionPaid: 8260, saasSubscriptionFee: 1000, netOperatingIncome: 100740, occupancyRate: 86 };
  const projection = forecast?.projection || [
    { month: "Jun", guaranteed: 118000, projected: 136000, vacancyProbability: 18 },
    { month: "Jul", guaranteed: 113000, projected: 132000, vacancyProbability: 23 },
    { month: "Aug", guaranteed: 108000, projected: 130000, vacancyProbability: 28 }
  ];

  const createUtilityBill = async (event) => {
    event.preventDefault();
    setMessage("Posting utility split...");
    const result = await safeRequest(() => api.post("/utility-bills", bill), { bill: { id: "ub-demo", totalAmount: Number(bill.electricity) + Number(bill.gas) + Number(bill.water) }, demo: true });
    const splitResult = await safeRequest(() => api.get("/utility-bills/split/b1"), { totalUtilityShare: 2400, split: { share: 2400 }, demo: true });
    setSplit(splitResult);
    setMessage(result.demo ? "Utility bill posted in demo mode." : "Utility bill posted and tenant splits calculated.");
  };

  const downloadPl = async () => {
    setMessage("Preparing P&L PDF...");
    try {
      await downloadApiPdf({ api, endpoint: "/documents/hosts/u-landlord/pl-statement", filename: "basera-pl-statement.pdf" });
      setMessage("P&L PDF downloaded.");
    } catch {
      setMessage("P&L PDF requires API server and Host/Admin login.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-5 md:grid-cols-4">
        {[
          ["Gross rent", lines.grossRentCollected],
          ["Commission", lines.platformCommissionPaid],
          ["SaaS fee", lines.saasSubscriptionFee],
          ["Net operating income", lines.netOperatingIncome]
        ].map(([label, value]) => (
          <article key={label} className="panel p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
            <p className="mt-3 text-2xl font-extrabold text-primary-800">{currency(value)}</p>
          </article>
        ))}
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="text-primary-800" /> 3-month cashflow forecast</h2>
              <p className="mt-1 text-sm text-slate-700">Guaranteed booked income versus expected income after vacancy and demand signals.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={downloadPl}><FileDown size={18} /> P&L PDF</button>
          </div>
          <div className="mt-8 flex h-64 items-end gap-4">
            {projection.map((month) => (
              <div key={month.month} className="grid flex-1 gap-3 text-center">
                <div className="mx-auto flex h-52 w-full max-w-28 items-end gap-2">
                  <div className="w-1/2 rounded-t-lg bg-primary-200" style={{ height: `${Math.max(38, month.guaranteed / 1600)}px` }} />
                  <div className="w-1/2 rounded-t-lg bg-primary-700" style={{ height: `${Math.max(48, month.projected / 1600)}px` }} />
                </div>
                <div>
                  <p className="font-bold">{month.month}</p>
                  <p className="text-xs text-slate-700">{month.vacancyProbability}% vacancy risk</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><SplitSquareHorizontal className="text-primary-800" /> Utility bill splitter</h2>
          <form onSubmit={createUtilityBill} className="mt-5 grid gap-4">
            {["electricity", "gas", "water"].map((field) => (
              <label key={field} className="grid gap-2 text-sm font-semibold capitalize">
                {field}
                <input className="input" type="number" value={bill[field]} onChange={(event) => setBill((current) => ({ ...current, [field]: Number(event.target.value) }))} />
              </label>
            ))}
            <button className="btn-primary" type="submit"><Send size={18} /> Calculate Splits</button>
          </form>
          <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Example tenant split</p>
            <p className="mt-2 text-3xl font-extrabold text-primary-800">{currency(split?.totalUtilityShare || split?.split?.share || 2400)}</p>
            <p className="mt-2 text-sm text-slate-700">Weighted by beds and occupancy days.</p>
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Banknote className="text-primary-800" /> Portfolio finance</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(portfolio?.properties || []).length ? portfolio.properties.map((item) => (
            <article key={item.hostelId} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-bold">{item.name}</p><p className="text-sm text-slate-700">{item.city}</p></div>
                <span className="badge bg-accent-50 text-accent-700">{item.occupancyRate}%</span>
              </div>
              <p className="mt-4 text-xl font-extrabold text-primary-800">{currency(item.monthlyIncome)}</p>
              <p className="mt-1 text-xs text-slate-700">{item.contributionPercent}% portfolio contribution</p>
            </article>
          )) : ["Cozy Boys Hostel", "Executive Living Hostel", "Metro Student House"].map((name, index) => (
            <article key={name} className="rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">{name}</p>
              <p className="mt-4 text-xl font-extrabold text-primary-800">{currency([72000, 48000, 36000][index])}</p>
              <p className="mt-1 text-xs text-slate-700">{[92, 81, 76][index]}% occupancy</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export function HostOffersPanel() {
  const [offers, setOffers] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => safeRequest(() => api.get("/offers/my"), { results: [] }).then((result) => setOffers(result.results || []));
    refresh();
  }, []);

  const updateOffer = async (offer, action, payload = {}) => {
    setMessage(`${action} offer...`);
    const id = offer.id || offer._id;
    const result = await safeRequest(() => api.put(`/offers/${id}/${action}`, payload), { offer: { ...offer, status: action === "accept" ? "accepted" : action === "decline" ? "declined" : "countered", ...payload }, demo: true });
    setOffers((current) => current.map((item) => ((item.id || item._id) === id ? result.offer : item)));
    setMessage(result.demo ? `Offer ${action} saved in demo mode.` : `Offer ${action} saved.`);
  };

  const rows = offers.length ? offers : [
    { id: "offer-demo-1", roomTitle: "Executive Triple Sharing", studentName: "Ali Ahmed", listedPrice: 18000, offeredPrice: 16000, status: "pending", trustScore: 87 }
  ];

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><HandCoins className="text-primary-800" /> Rent negotiation offers</h2>
      <p className="mt-1 text-sm text-slate-700">Accept, counter, or decline live offers from students.</p>
      {message && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
      <div className="mt-5 grid gap-4">
        {rows.map((offer) => (
          <article key={offer.id || offer._id} className="rounded-lg border border-line bg-canvas p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <p className="font-bold">{offer.roomTitle || offer.room?.title}</p>
                <p className="mt-1 text-sm text-slate-700">{offer.studentName || offer.student?.name || "Student"} - trust {offer.trustScore || 82}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">Listed {currency(offer.listedPrice)}</span>
                  <span className="chip">Offered {currency(offer.offeredPrice)}</span>
                  <span className="chip">{offer.status}</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                <button className="btn-primary py-2" onClick={() => updateOffer(offer, "accept")}>Accept</button>
                <button className="btn-secondary py-2" onClick={() => updateOffer(offer, "counter", { price: Math.round(Number(offer.listedPrice || offer.offeredPrice) * 0.96) })}>Counter</button>
                <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Decline offer" onConfirm={() => updateOffer(offer, "decline", { reason: "Rate not possible this month." })}>Decline</ConfirmButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HostMessMenuManager() {
  const [menu, setMenu] = useState(null);
  const [message, setMessage] = useState("");
  const [hostelId, setHostelId] = useState("h1");

  useEffect(() => {
    const refresh = () => safeRequest(() => api.get(`/hostels/${hostelId}/mess-menu`), { menu: null }).then((result) => setMenu(result.menu));
    refresh();
  }, [hostelId]);

  const grouped = useMemo(() => {
    const meals = menu?.meals || [];
    return meals.reduce((acc, meal) => {
      acc[meal.day] = [...(acc[meal.day] || []), meal];
      return acc;
    }, {});
  }, [menu]);

  const saveMenu = async () => {
    setMessage("Publishing mess menu...");
    const meals = menu?.meals?.length ? menu.meals : ["Monday", "Tuesday", "Wednesday"].flatMap((day, index) => [
      { mealId: `${hostelId}-${index}-breakfast`, day, type: "breakfast", items: ["Paratha", "Tea"], rating: 4.5, ratingCount: 8 },
      { mealId: `${hostelId}-${index}-lunch`, day, type: "lunch", items: ["Rice", "Chicken"], rating: 4.4, ratingCount: 10 },
      { mealId: `${hostelId}-${index}-dinner`, day, type: "dinner", items: ["Daal", "Roti"], rating: 4.3, ratingCount: 9 }
    ]);
    const result = await safeRequest(() => api.post(`/hostels/${hostelId}/mess-menu`, { meals, messScore: 4.6 }), { menu: { hostelRef: hostelId, meals, messScore: 4.6 }, demo: true });
    setMenu(result.menu);
    setMessage(result.demo ? "Mess menu published in demo mode." : "Mess menu published.");
  };

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><ChefHat className="text-primary-800" /> Mess menu manager</h2>
          <p className="mt-1 text-sm text-slate-700">Publish weekly menu and monitor ratings.</p>
        </div>
        <div className="flex gap-2">
          <input className="input w-28" value={hostelId} onChange={(event) => setHostelId(event.target.value)} />
          <button className="btn-primary" type="button" onClick={saveMenu}><ReceiptText size={18} /> Publish</button>
        </div>
      </div>
      {message && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {Object.entries(grouped).slice(0, 6).map(([day, meals]) => (
          <article key={day} className="rounded-lg border border-line bg-canvas p-4">
            <p className="font-bold">{day}</p>
            <div className="mt-3 grid gap-2 text-sm">
              {meals.map((meal) => (
                <div key={meal.mealId} className="rounded-md bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="capitalize">{meal.type}</span>
                    <strong className="text-primary-800">{Number(meal.rating || 4.5).toFixed(1)}</strong>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">{(meal.items || []).join(", ")}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
