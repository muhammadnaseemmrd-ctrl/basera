import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeDollarSign, BedDouble, CalendarDays, Grid2X2, HandCoins, MessageSquare, Newspaper, Plus, ReceiptText, Send, ShieldCheck, TrendingUp, Users, WalletCards, Wrench } from "lucide-react";
import { DashboardShell } from "../components/DashboardShell";
import { StatTile, StatGrid, ConfirmButton, useToastBridge } from "../components/ui";
import { AlertSubmitCard } from "../components/AlertSubmitCard";
import { ChatPanel } from "../components/ChatPanel";
import { HostCommunityPanel } from "../components/HostCommunityPanel";
import { HostGrowthCenter } from "../components/HostGrowthCenter";
import { HostSubscriptionCenter } from "../components/HostSubscriptionCenter";
import { HostFinanceIntelligence, HostMessMenuManager, HostOffersPanel } from "../components/HostV6Operations";
import { MaintenancePanel } from "../components/MaintenancePanel";
import { RoomCard } from "../components/RoomCard";
import { TenantLedger } from "../components/TenantLedger";
import { api, safeRequest } from "../services/api";
import { roomListings } from "../data/mockData";
import { normalizeRooms } from "../utils/normalize";
import { useAuthStore } from "../store/useAuthStore";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { downloadApiPdf } from "../utils/downloadFile";

const tabs = [
  { label: "Overview", icon: Grid2X2 },
  { label: "My Rooms", icon: BedDouble },
  { label: "Requests", icon: CalendarDays },
  { label: "Tenants", icon: Users },
  { label: "Finance", icon: WalletCards },
  { label: "Smart Finance", icon: BadgeDollarSign },
  { label: "Offers", icon: HandCoins },
  { label: "Ledger", icon: ReceiptText },
  { label: "Mess Menu", icon: Newspaper },
  { label: "Growth", icon: TrendingUp },
  { label: "Subscription", icon: BadgeDollarSign },
  { label: "Maintenance", icon: Wrench },
  { label: "Community", icon: Newspaper },
  { label: "Chat", icon: MessageSquare }
];

const fallbackLandlordData = {
  stats: {},
  rooms: roomListings.filter((room) => room.lister?.name === "Sara Malik"),
  requests: [],
  earnings: []
};

export function LandlordDashboard() {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const [active, setActive] = useState(() => {
    const tab = searchParams.get("tab");
    return tabs.some((item) => item.label === tab) ? tab : "Overview";
  });
  const [data, setData] = useState(fallbackLandlordData);
  const [ledger, setLedger] = useState([]);
  const [notice, setNotice] = useState("");
  const [finance, setFinance] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [plan, setPlan] = useState(null);
  const [risk, setRisk] = useState(null);
  useDocumentTitle("Host Dashboard | Basera");
  useToastBridge(notice);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/host"), fallbackLandlordData).then((result) => {
      setData({
        stats: result.stats || {},
        rooms: normalizeRooms(result.rooms || fallbackLandlordData.rooms),
        requests: result.requests || [],
        earnings: result.earnings || [],
        verificationTier: result.verificationTier
      });
    });
    safeRequest(() => api.get("/dashboard/host/plan"), { plan: null }).then((result) => setPlan(result.plan || null));
    safeRequest(() => api.get("/dashboard/host/risk"), { risk: null }).then((result) => setRisk(result.risk || null));
  }, []);

  useEffect(() => {
    if (active === "Ledger") {
      safeRequest(() => api.get("/dashboard/landlord/ledger"), { results: [] }).then((result) => setLedger(result.results || []));
    }
    if (active === "Finance") {
      safeRequest(() => api.get("/dashboard/host/finance"), { summary: {}, payouts: [] }).then(setFinance);
    }
    if (active === "Tenants") {
      safeRequest(() => api.get("/dashboard/host/tenants"), { results: [] }).then((result) => setTenants(result.results || []));
    }
  }, [active]);

  const navItems = tabs.map((tab) => ({ ...tab, onClick: () => setActive(tab.label) }));

  const updateRequest = async (request, status) => {
    setNotice(`${status === "accepted" ? "Accepting" : "Declining"} ${request.tenant}...`);
    const endpoint = status === "accepted" ? "accept" : "decline";
    const result = await safeRequest(() => api.put(`/bookings/${request.id}/${endpoint}`, { reason: "Unavailable" }), { demo: true });
    setData((current) => ({
      ...current,
      requests: current.requests.map((item) => (item.id === request.id ? { ...item, status } : item))
    }));
    setNotice(result.demo ? `Request ${status} in demo mode.` : `Request ${status}.`);
  };

  const updatePlan = async (tier) => {
    setNotice(`Updating plan to ${tier}...`);
    const result = await safeRequest(() => api.put("/dashboard/host/plan", { tier }), { plan: { tier, label: tier }, demo: true });
    setPlan(result.plan);
    setNotice(result.demo ? "Plan updated in demo mode." : "Plan updated.");
  };

  return (
    <DashboardShell
      title="Host Dashboard"
      subtitle="Occupancy, rent reminders, escrow payouts, commission and tenant messages — in one place."
      navLabel="Host Workspace"
      navItems={navItems}
      active={active}
      user={{
        name: user?.name || "Sara Malik",
        role: data.verificationTier || "Verified Host",
        avatar: user?.avatar
      }}
      footerText="Room marketplace tools for Hosts, PG operators, and property teams."
    >
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={14} /> {data.verificationTier || "Identity Verified"}</span>
        <Link to="/landlord/onboarding" className="btn-primary"><Plus size={18} /> List Another Room</Link>
      </div>


      {active === "Overview" && (
        <section className="space-y-7">
          <StatGrid columns={4}>
            <StatTile icon={BedDouble} label="Rooms" value={data.stats.rooms || data.rooms.length} tone="blue" />
            <StatTile icon={ShieldCheck} label="Active Rooms" value={data.stats.activeRooms || data.rooms.length} tone="green" />
            <StatTile icon={CalendarDays} label="Pending Requests" value={data.stats.pendingRequests || data.requests.length} tone="amber" />
            <StatTile icon={TrendingUp} label="Monthly Earnings" value={`PKR ${Number(data.stats.monthlyEarnings || 118000).toLocaleString("en-PK")}`} tone="green" />
          </StatGrid>
          <div className="grid gap-7 xl:grid-cols-[1fr_380px]">
            <section className="grid gap-6 md:grid-cols-2">
              {data.rooms.slice(0, 2).map((room) => <RoomCard key={room.id} room={room} />)}
            </section>
            <div className="grid gap-6">
              <HostControlPanel plan={plan} risk={risk} onPlanChange={updatePlan} />
              <RequestPanel requests={data.requests} onUpdate={updateRequest} />
              <AlertSubmitCard audience="all" title="Submit Hostel Alert" />
            </div>
          </div>
        </section>
      )}

      {active === "My Rooms" && <section className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">{data.rooms.map((room) => <RoomCard key={room.id} room={room} />)}</section>}
      {active === "Requests" && <RequestPanel requests={data.requests} onUpdate={updateRequest} />}
      {active === "Tenants" && <TenantPanel
        tenants={tenants}
        onReminder={async (tenant) => {
          setNotice(`Sending rent reminder to ${tenant.tenant}...`);
          const result = await safeRequest(() => api.post(`/reminders/host/${tenant.id}`), { demo: true });
          setNotice(result.demo ? "Reminder sent in demo mode." : "Rent reminder sent.");
        }}
        onLifecycleDecision={async (tenant, decision) => {
          setNotice(`${decision === "approve" ? "Approving" : "Declining"} ${tenant.tenant}'s request...`);
          const result = await safeRequest(() => api.post(`/bookings/${tenant.id}/lifecycle/${decision}`), { demo: true });
          setNotice(result.demo ? `Request ${decision}d in demo mode.` : `Request ${decision}d.`);
          const refreshed = await safeRequest(() => api.get("/dashboard/host/tenants"), { results: [] });
          setTenants(refreshed.results || []);
        }}
      />}
      {active === "Finance" && <FinancePanel finance={finance} />}
      {active === "Smart Finance" && <HostFinanceIntelligence />}
      {active === "Offers" && <HostOffersPanel />}
      {active === "Ledger" && <TenantLedger rows={ledger} />}
      {active === "Mess Menu" && <HostMessMenuManager />}
      {active === "Growth" && <HostGrowthCenter />}
      {active === "Subscription" && <HostSubscriptionCenter />}
      {active === "Maintenance" && <MaintenancePanel title="Host Maintenance Queue" />}
      {active === "Community" && <HostCommunityPanel title="Host Community Operations" hostName={user?.name || "Sara Malik"} />}
      {active === "Earnings" && (
        <section className="panel p-7">
          <h2 className="text-xl font-bold">Earnings Trend</h2>
          <div className="mt-8 flex h-72 items-end gap-5">
            {(data.earnings.length ? data.earnings : [{ month: "April", amount: 86000 }, { month: "May", amount: 118000 }, { month: "June", amount: 124000 }]).map((item) => (
              <div key={item.month} className="grid flex-1 gap-3 text-center">
                <div className="rounded-t-lg bg-primary-700" style={{ height: `${Math.max(80, item.amount / 800)}px` }} />
                <span className="text-sm font-semibold">{item.month}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {active === "Chat" && <ChatPanel title="Host Messages" />}
    </DashboardShell>
  );
}

function HostControlPanel({ plan, risk, onPlanChange }) {
  const currentPlan = plan || {
    tier: "STARTER",
    label: "Starter",
    monthlyFee: 0,
    commissionRate: 7,
    features: ["Verified listing", "Escrow collection", "Basic support"]
  };
  const riskTone = risk?.label === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : risk?.label === "medium" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-accent-50 text-accent-700";

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Host Controls</h2>
          <p className="mt-1 text-sm text-slate-700">Plan, commission, and compliance risk.</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary-800">
          <ShieldCheck size={20} />
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">{currentPlan.label} plan</p>
            <p className="text-sm text-slate-700">Commission {currentPlan.commissionRate}% - PKR {Number(currentPlan.monthlyFee || 0).toLocaleString("en-PK")}/mo plan</p>
            <p className="mt-1 text-xs font-semibold text-primary-800">Management system fee: PKR {Number(currentPlan.managementFeeMonthly || 1000).toLocaleString("en-PK")}/mo</p>
          </div>
          <span className="badge bg-primary-50 text-primary-800">{currentPlan.tier}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["STARTER", "PRO", "PREMIUM"].map((tier) => (
            <button key={tier} type="button" className={`chip ${currentPlan.tier === tier ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`} onClick={() => onPlanChange(tier)}>
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-canvas p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">Risk score</p>
          <span className={`badge ${riskTone}`}>{risk?.score ?? 28}/100</span>
        </div>
        <p className="mt-2 text-sm text-slate-700">{risk?.recommendedAction || "Normal operations"}</p>
      </div>
    </section>
  );
}

const LIFECYCLE_LABELS = {
  switch_requested: "Switch requested",
  leave_requested: "Leave requested"
};

function TenantPanel({ tenants = [], onReminder, onLifecycleDecision }) {
  const rows = tenants.length ? tenants : [
    { id: "b-landlord-1", tenant: "Noor Fatima", room: "PG-1", rentStatus: "PAID", dueDate: "2026-07-01", amount: "PKR 32,000", lifecycleStatus: "none" },
    { id: "b-landlord-2", tenant: "Danish Raza", room: "ST-2", rentStatus: "OVERDUE", dueDate: "2026-06-01", amount: "PKR 42,000", lifecycleStatus: "leave_requested", lifecycleReason: "Relocating closer to campus" }
  ];

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between p-6">
        <h2 className="text-xl font-bold">My Tenants</h2>
        <span className="chip">Rent must be paid through Basera</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-primary-50 text-sm uppercase tracking-widest text-slate-700">
            <tr>
              <th className="px-6 py-4">Tenant</th>
              <th className="px-6 py-4">Room</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Reminder</th>
              <th className="px-6 py-4">Lifecycle Request</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-6 py-5 font-semibold">{tenant.tenant}</td>
                <td className="px-6 py-5">{tenant.room}</td>
                <td className="px-6 py-5">{String(tenant.dueDate || "").slice(0, 10)}</td>
                <td className="px-6 py-5">{tenant.amount}</td>
                <td className="px-6 py-5"><span className={`badge ${tenant.rentStatus === "PAID" ? "bg-accent-50 text-accent-700" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{tenant.rentStatus}</span></td>
                <td className="px-6 py-5"><button type="button" className="btn-secondary py-2" onClick={() => onReminder(tenant)}><Send size={16} /> Send</button></td>
                <td className="px-6 py-5">
                  {["switch_requested", "leave_requested"].includes(tenant.lifecycleStatus) ? (
                    <div className="grid gap-2">
                      <span className="badge bg-[#FEF3C7] text-[#92400E]">{LIFECYCLE_LABELS[tenant.lifecycleStatus]}</span>
                      {tenant.lifecycleReason && <p className="text-xs text-slate-600">{tenant.lifecycleReason}</p>}
                      <div className="flex gap-2">
                        <button type="button" className="btn-primary py-1.5" onClick={() => onLifecycleDecision(tenant, "approve")}>Approve</button>
                        <button type="button" className="btn-secondary py-1.5" onClick={() => onLifecycleDecision(tenant, "decline")}>Decline</button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">No pending request</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinancePanel({ finance }) {
  const summary = finance?.summary || { grossRent: 118000, commissionDeducted: 8260, netEarnings: 109740, escrowHeld: 47000, payoutPending: 109740 };
  const payouts = finance?.payouts || [];
  const [downloadMessage, setDownloadMessage] = useState("");

  const downloadMonthlySummary = async () => {
    setDownloadMessage("Preparing monthly PDF...");
    try {
      await downloadApiPdf({
        api,
        endpoint: "/documents/hosts/monthly-summary",
        filename: "basera-host-monthly-summary.pdf"
      });
      setDownloadMessage("Monthly PDF downloaded.");
    } catch {
      setDownloadMessage("Monthly PDF requires the API server and a valid Host login.");
    }
    setTimeout(() => setDownloadMessage(""), 2500);
  };

  const downloadPayoutStatement = async (payout) => {
    const payoutId = payout.bookingId || payout.id || payout._id || "demo-payout";
    setDownloadMessage("Preparing payout statement...");
    try {
      await downloadApiPdf({
        api,
        endpoint: `/documents/payout/${payoutId}/download`,
        filename: `basera-payout-${payoutId}.pdf`
      });
      setDownloadMessage("Payout statement downloaded.");
    } catch {
      setDownloadMessage("Payout statement requires the API server and a valid Host login.");
    }
    setTimeout(() => setDownloadMessage(""), 2500);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-5 md:grid-cols-5">
        {[
          ["Gross Rent", summary.grossRent],
          ["Commission", summary.commissionDeducted],
          ["Net Earnings", summary.netEarnings],
          ["Escrow Held", summary.escrowHeld],
          ["Payout Pending", summary.payoutPending]
        ].map(([label, value]) => (
          <article key={label} className="panel p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
            <p className="mt-3 text-2xl font-extrabold text-primary-800">PKR {Number(value || 0).toLocaleString("en-PK")}</p>
          </article>
        ))}
      </div>
      <section className="panel p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Payout History</h2>
            <p className="mt-1 text-sm text-slate-700">Every rupee is collected in escrow first; Basera commission is deducted automatically.</p>
          </div>
          <button type="button" onClick={downloadMonthlySummary} className="btn-secondary">Download Monthly PDF</button>
        </div>
        {downloadMessage && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{downloadMessage}</p>}
        <div className="mt-5 grid gap-3">
          {(payouts.length ? payouts : [
            { id: "p1", tenant: "Noor Fatima", rentCollected: "PKR 32,000", commission: "PKR 2,240", netPayout: "PKR 29,760", status: "Released" },
            { id: "p2", tenant: "Danish Raza", rentCollected: "PKR 42,000", commission: "PKR 3,360", netPayout: "PKR 38,640", status: "Held in escrow" }
          ]).map((payout) => (
            <article key={payout.id || payout._id} className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-6 md:items-center">
              <span>{payout.tenant || payout.bookingId || "Tenant"}</span>
              <span>{payout.rentCollected || `PKR ${Number(payout.totalAmount || 0).toLocaleString("en-PK")}`}</span>
              <span>{payout.commission || `PKR ${Number(payout.commissionAmount || 0).toLocaleString("en-PK")}`}</span>
              <span>{payout.netPayout || `PKR ${Number(payout.hostPayoutAmount || 0).toLocaleString("en-PK")}`}</span>
              <span className="badge bg-primary-50 text-primary-800">{payout.status}</span>
              <button type="button" className="btn-secondary py-2" onClick={() => downloadPayoutStatement(payout)}>Statement</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function RequestPanel({ requests = [], onUpdate }) {
  const rows = requests.length ? requests : [
    { id: "b-landlord-1", tenant: "Noor Fatima", room: "Family PG Room with Breakfast", dates: "Jul 01 - Dec 31", status: "pending" },
    { id: "b-landlord-2", tenant: "Danish Raza", room: "Self-Contained Studio for Professional", dates: "Jun 15 - Sep 15", status: "pending" }
  ];

  return (
    <section className="panel p-6">
      <h2 className="text-xl font-bold">Booking Requests</h2>
      <div className="mt-5 grid gap-4">
        {rows.map((request) => (
          <article key={request.id} className="rounded-lg border border-line bg-canvas p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold">{request.tenant}</p>
                <p className="mt-1 text-sm text-slate-700">{request.room}</p>
                <p className="mt-2 text-sm text-slate-700">{request.dates}</p>
              </div>
              <span className="badge bg-primary-50 text-primary-800">{request.status}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Decline" onConfirm={() => onUpdate(request, "declined")}>Decline</ConfirmButton>
              <button type="button" className="btn-primary py-2" onClick={() => onUpdate(request, "accepted")}>Accept</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
