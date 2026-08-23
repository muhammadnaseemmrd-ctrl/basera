import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Clock, FileText, RefreshCw, Search, ShieldCheck, TrendingUp, WalletCards } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { StatTile, StatusPill, ConfirmButton, DataTable } from "./ui";
import { currency } from "../utils/formatters";

const kpiIcon = (label = "") => {
  const key = label.toLowerCase();
  if (key.includes("commission") || key.includes("gmv") || key.includes("revenue")) return TrendingUp;
  if (key.includes("escrow") || key.includes("payout")) return WalletCards;
  if (key.includes("deposit")) return ShieldCheck;
  if (key.includes("dispute")) return AlertTriangle;
  return Banknote;
};

const fallbackCommand = {
  summary: {
    gmv: 520000,
    commission: 36400,
    escrowBalance: 483600,
    depositLiability: 95000,
    payoutPending: 3,
    disputesOpen: 2
  },
  kpis: [
    { label: "GMV", value: 520000, tone: "blue", trend: "+12%" },
    { label: "Commission Earned", value: 36400, tone: "green", trend: "+7%" },
    { label: "Escrow Balance", value: 483600, tone: "blue", trend: "stable" },
    { label: "Deposit Liability", value: 95000, tone: "orange", trend: "+3%" },
    { label: "Payout Queue", value: 3, tone: "orange", trend: "needs review" },
    { label: "Open Disputes", value: 2, tone: "red", trend: "-2" }
  ],
  alerts: [
    { id: "fallback-fin-1", title: "Payout requires review", message: "One payout needs account-title verification.", severity: "warning" }
  ],
  charts: {
    gmvByMonth: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({
      month,
      gmv: 180000 + index * 42000,
      commission: 12600 + index * 3000
    })),
    byCity: [
      { city: "Islamabad", gmv: 420000, occupancy: 86 },
      { city: "Lahore", gmv: 330000, occupancy: 79 },
      { city: "Karachi", gmv: 250000, occupancy: 73 }
    ]
  }
};

const fallbackLedger = {
  results: [
    { entryId: "demo-1", transactionId: "booking-demo", account: "gateway_cash", direction: "debit", amount: 23500, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() },
    { entryId: "demo-2", transactionId: "booking-demo", account: "escrow_rent", direction: "credit", amount: 18000, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() },
    { entryId: "demo-3", transactionId: "booking-demo", account: "escrow_deposit", direction: "credit", amount: 5000, type: "BOOKING_PAYMENT", createdAt: new Date().toISOString() }
  ],
  total: 3
};

const fallbackPayouts = {
  results: [
    { id: "pay-ready-1", hostName: "Sara Malik", hostelName: "Cozy Boys Hostel F-10", amount: 185000, status: "ready", gateway: "bank", city: "Islamabad" },
    { id: "pay-failed-1", hostName: "Ahmed Khan", hostelName: "Pine Crest Boys Hostel", amount: 74000, status: "failed", gateway: "jazzcash", city: "Islamabad", failureReason: "Account title mismatch" },
    { id: "pay-review-1", hostName: "Ayesha Tariq", hostelName: "Gulberg Elite Home", amount: 123000, status: "pending_review", gateway: "bank", city: "Lahore" }
  ]
};

const fallbackDeposits = {
  summary: { totalHeld: 95000, disputed: 1, agingOver7Days: 2 },
  results: [
    { id: "deposit-b1", bookingId: "b1", hostelName: "Cozy Boys Hostel F-10", studentName: "Ali Ahmed", amount: 5000, status: "held", agingDays: 4 },
    { id: "deposit-b2", bookingId: "b2", hostelName: "Pine Crest Boys Hostel", studentName: "Hamza Sheikh", amount: 15000, status: "disputed", agingDays: 12, deductionRequested: 1500 }
  ]
};

const fallbackForecast = {
  results: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((month, index) => ({
    month,
    expectedGmv: 520000 + index * 65000,
    expectedCommission: Math.round((520000 + index * 65000) * 0.07),
    renewalProbability: Math.max(55, 82 - index * 4),
    topCity: ["Islamabad", "Lahore", "Karachi"][index % 3],
    seasonalDemand: index % 2 ? "medium" : "high"
  }))
};

const fallbackWaterfall = {
  waterfall: {
    bookingId: "b1",
    hostelName: "Cozy Boys Hostel F-10",
    status: "confirmed",
    totals: { rent: 18000, deposit: 5000, serviceFee: 500, commission: 1260, hostPayout: 16740, paid: 23500 },
    steps: [
      { key: "student_paid", label: "Student Paid", account: "Gateway Cash", amount: 23500, status: "complete" },
      { key: "escrow_held", label: "Escrow Held", account: "Escrow Rent + Deposit", amount: 23000, status: "complete" },
      { key: "commission_split", label: "Commission Split", account: "Platform Commission", amount: 1260, status: "ready" },
      { key: "host_payout", label: "Host Payout", account: "Host Payable", amount: 16740, status: "pending" }
    ]
  }
};

const fallbackStatement = {
  statement: {
    month: "2026-06",
    rows: [
      { bookingId: "b1", hostelName: "Cozy Boys Hostel F-10", rent: 18000, commission: 1260, payout: 16740 },
      { bookingId: "b2", hostelName: "Pine Crest Boys Hostel", rent: 25000, commission: 1750, payout: 23250 }
    ],
    totals: { rent: 43000, commission: 3010, payout: 39990 }
  }
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-PK", { month: "short", day: "numeric" }) : "Pending");

export function FinanceCommandRoom() {
  const [command, setCommand] = useState(fallbackCommand);
  const [ledger, setLedger] = useState(fallbackLedger);
  const [payouts, setPayouts] = useState(fallbackPayouts.results);
  const [deposits, setDeposits] = useState(fallbackDeposits);
  const [forecast, setForecast] = useState(fallbackForecast);
  const [waterfall, setWaterfall] = useState(fallbackWaterfall.waterfall);
  const [statement, setStatement] = useState(fallbackStatement.statement);
  const [filters, setFilters] = useState({ account: "", direction: "" });
  const [message, setMessage] = useState("");

  const maxGmv = useMemo(() => Math.max(...(command.charts?.gmvByMonth || []).map((item) => Number(item.gmv || 0)), 1), [command]);
  const depositSummary = deposits.summary || fallbackDeposits.summary;

  const loadFinance = () => {
    safeRequest(() => api.get("/finance/command-room"), fallbackCommand).then((result) => setCommand(result || fallbackCommand));
    safeRequest(() => api.get("/finance/payouts"), fallbackPayouts).then((result) => setPayouts(result.results || fallbackPayouts.results));
    safeRequest(() => api.get("/finance/deposits/liability-register"), fallbackDeposits).then((result) => setDeposits(result || fallbackDeposits));
    safeRequest(() => api.get("/finance/forecast", { params: { days: 90 } }), fallbackForecast).then((result) => setForecast(result || fallbackForecast));
    safeRequest(() => api.get("/finance/bookings/b1/waterfall"), fallbackWaterfall).then((result) => setWaterfall(result.waterfall || fallbackWaterfall.waterfall));
    safeRequest(() => api.get("/finance/statements/host/u-owner"), fallbackStatement).then((result) => setStatement(result.statement || fallbackStatement.statement));
  };

  useEffect(() => {
    loadFinance();
  }, []);

  useEffect(() => {
    safeRequest(
      () => api.get("/finance/ledger/search", { params: { account: filters.account || undefined, direction: filters.direction || undefined, limit: 25 } }),
      fallbackLedger
    ).then((result) => setLedger(result || fallbackLedger));
  }, [filters]);

  const approvePayout = async (payout) => {
    setMessage(`Approving ${payout.hostName || payout.hostelName} payout...`);
    const result = await safeRequest(
      () => api.post(`/finance/payouts/${payout.id}/approve`, { amount: payout.amount, idempotencyKey: `manual-${payout.id}` }),
      { payout: { ...payout, status: "paid" }, demo: true }
    );
    setPayouts((current) => current.map((item) => (item.id === payout.id ? result.payout : item)));
    setMessage(result.demo ? "Payout approved in demo mode." : "Payout approved and ledger-safe.");
  };

  const retryPayout = async (payout) => {
    setMessage(`Retrying ${payout.hostName || payout.hostelName} payout...`);
    const result = await safeRequest(() => api.post(`/finance/payouts/${payout.id}/retry`), { payout: { ...payout, status: "ready", retryCount: 1 }, demo: true });
    setPayouts((current) => current.map((item) => (item.id === payout.id ? result.payout : item)));
    setMessage(result.demo ? "Payout retry queued in demo mode." : "Payout retry queued.");
  };

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><Banknote size={16} /> Finance command room</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Escrow, Ledger, Payouts, and Forecast</h2>
          <p className="mt-2 max-w-3xl text-slate-700">Operational finance visibility across student payments, escrow liability, host payouts, refunds, deposits, and platform revenue.</p>
        </div>
        <button type="button" onClick={loadFinance} className="btn-secondary w-full sm:w-auto"><RefreshCw size={17} /> Refresh Finance Data</button>
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(command.kpis || fallbackCommand.kpis).map((kpi) => (
          <StatTile
            key={kpi.label}
            icon={kpiIcon(kpi.label)}
            label={kpi.label}
            value={Number(kpi.value) > 1000 || /gmv|commission|escrow|deposit/i.test(kpi.label) ? currency(kpi.value) : kpi.value}
            trend={kpi.trend && /^[+-]/.test(kpi.trend) ? kpi.trend : undefined}
            hint={kpi.trend && !/^[+-]/.test(kpi.trend) ? kpi.trend : undefined}
            tone={kpi.tone === "green" ? "green" : kpi.tone === "orange" ? "amber" : kpi.tone === "red" ? "red" : "blue"}
          />
        ))}
      </section>

      <section className="grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Revenue Growth</h3>
              <p className="mt-1 text-sm text-slate-700">GMV and commission trend by month.</p>
            </div>
            <span className="badge bg-accent-50 text-accent-700"><TrendingUp size={14} /> forecast-ready</span>
          </div>
          <div className="mt-7 grid h-72 grid-cols-6 items-end gap-3">
            {(command.charts?.gmvByMonth || fallbackCommand.charts.gmvByMonth).map((item) => (
              <div key={item.month} className="grid gap-3 text-center">
                <div className="flex h-56 items-end justify-center rounded-lg bg-primary-50 px-2">
                  <div
                    className="w-full rounded-t-lg bg-primary-700 shadow-card"
                    style={{ height: `${Math.max(18, (Number(item.gmv || 0) / maxGmv) * 100)}%` }}
                    title={`${item.month}: ${currency(item.gmv)}`}
                  />
                </div>
                <span className="text-sm font-bold">{item.month}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Finance Alerts</h3>
          <div className="mt-5 grid gap-3">
            {(command.alerts || []).map((alert) => (
              <div key={alert.id} className="rounded-lg border border-line bg-canvas p-4">
                <p className="flex items-center gap-2 font-bold"><AlertTriangle size={18} className="text-[#B45309]" /> {alert.title}</p>
                <p className="mt-2 text-sm text-slate-700">{alert.message}</p>
              </div>
            ))}
            <div className="rounded-lg border border-line bg-accent-50 p-4 text-sm text-accent-700">
              <ShieldCheck className="mb-2" size={20} />
              Payout approval keeps escrow, commission, deposit liability, and refund exposure separated.
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-line p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold">Ledger Explorer</h3>
              <p className="mt-1 text-sm text-slate-700">Search double-entry rows by account, direction, type, and transaction.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input className="input pl-10" value={filters.account} onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))} placeholder="Account" />
              </label>
              <select className="input" value={filters.direction} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value }))}>
                <option value="">All directions</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>
          <div className="p-6 pt-4">
            <DataTable
              rows={ledger.results || []}
              rowKey={(entry) => entry.entryId || entry._id}
              pageSize={8}
              empty="No ledger entries match your filters."
              columns={[
                { key: "account", header: "Account", sortable: true, render: (entry) => <span className="font-semibold text-ink">{entry.account}</span> },
                { key: "type", header: "Type", sortable: true },
                { key: "direction", header: "Direction", sortable: true, render: (entry) => <span className={`pill ${entry.direction === "credit" ? "pill-success" : "pill-info"}`}>{entry.direction}</span> },
                { key: "amount", header: "Amount", sortable: true, sortValue: (entry) => entry.amount || 0, render: (entry) => <span className="font-bold text-ink">{currency(entry.amount)}</span> },
                { key: "transactionId", header: "Transaction", render: (entry) => <span className="text-neutral-600">{entry.transactionId || entry.booking?._id || "system"}</span> }
              ]}
            />
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Escrow Waterfall</h3>
          <p className="mt-1 text-sm text-slate-700">{waterfall.hostelName} - booking {waterfall.bookingId}</p>
          <div className="mt-5 grid gap-3">
            {(waterfall.steps || []).map((step, index) => (
              <div key={step.key} className="grid grid-cols-[42px_1fr_auto] items-start gap-3 rounded-lg border border-line bg-canvas p-4">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${step.status === "complete" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>
                  {step.status === "complete" ? <CheckCircle2 size={18} /> : index + 1}
                </span>
                <div>
                  <p className="font-bold">{step.label}</p>
                  <p className="text-sm text-slate-700">{step.account}</p>
                </div>
                <strong className="whitespace-nowrap">{step.amount ? currency(step.amount) : "-"}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Payout Approval Room</h3>
              <p className="mt-1 text-sm text-slate-700">Manual approvals with idempotent retries.</p>
            </div>
            <WalletCards className="text-primary-800" />
          </div>
          <div className="mt-5 grid gap-4">
            {payouts.map((payout) => (
              <article key={payout.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{payout.hostName}</p>
                    <p className="text-sm text-slate-700">{payout.hostelName} - {payout.city}</p>
                  </div>
                  <StatusPill status={payout.status} />
                </div>
                <p className="mt-4 text-2xl font-extrabold text-primary-800">{currency(payout.amount)}</p>
                {payout.failureReason && <p className="mt-2 text-sm font-semibold text-danger-700">{payout.failureReason}</p>}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" className="btn-secondary py-2" onClick={() => retryPayout(payout)}><RefreshCw size={16} /> Retry</button>
                  <ConfirmButton className="btn-primary py-2" tone="primary" confirmLabel="Approve payout" onConfirm={() => approvePayout(payout)}>Approve</ConfirmButton>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold">Deposit Liability Register</h3>
              <p className="mt-1 text-sm text-slate-700">Total held {currency(depositSummary.totalHeld)} - {depositSummary.disputed || 0} disputed - {depositSummary.agingOver7Days || 0} aging over 7 days.</p>
            </div>
            <span className="badge bg-[#FEF3C7] text-[#92400E]"><Clock size={14} /> aging watched</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-line bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Hostel</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Aging</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(deposits.results || []).map((row) => (
                  <tr key={row.id || row.bookingId}>
                    <td className="px-6 py-4 font-semibold">{row.studentName}</td>
                    <td className="px-6 py-4">{row.hostelName}</td>
                    <td className="px-6 py-4 font-bold">{currency(row.amount)}</td>
                    <td className="px-6 py-4">{row.agingDays || 0} days</td>
                    <td className="px-6 py-4"><span className={`badge ${row.status === "disputed" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-accent-50 text-accent-700"}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel p-6">
          <h3 className="text-xl font-bold">Revenue Forecast</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(forecast.results || []).map((item) => (
              <div key={item.month} className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-600">{item.month}</p>
                <p className="mt-2 text-xl font-extrabold text-primary-800">{currency(item.expectedGmv)}</p>
                <p className="mt-1 text-sm text-slate-700">Commission {currency(item.expectedCommission)}</p>
                <p className="mt-2 text-sm font-semibold">Renewal {item.renewalProbability}% - {item.seasonalDemand}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><FileText size={20} /> Host Statement</h3>
          <p className="mt-1 text-sm text-slate-700">Month {statement.month}. Printable PDF endpoints are still available from host payout history.</p>
          <div className="mt-5 grid gap-3">
            {(statement.rows || []).map((row) => (
              <div key={row.bookingId} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{row.hostelName}</p>
                  <span className="text-sm text-slate-700">{formatDate(row.paidAt)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <span>Rent <strong className="block">{currency(row.rent)}</strong></span>
                  <span>Commission <strong className="block">{currency(row.commission)}</strong></span>
                  <span>Payout <strong className="block">{currency(row.payout)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
