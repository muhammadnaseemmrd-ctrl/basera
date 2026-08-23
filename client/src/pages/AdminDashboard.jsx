import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BadgePercent, Bell, Building2, CirclePlus, FileSearch, Gavel, Grid2X2, Megaphone, Newspaper, Percent, Search, Settings, ShieldCheck, TrendingUp, Users, WalletCards, Wrench } from "lucide-react";
import { DashboardShell } from "../components/DashboardShell";
import { StatTile, StatGrid, Toolbar, StatusPill, IconButton, ConfirmButton, useToastBridge, DataTable } from "../components/ui";
import { AdminCommunityPanel } from "../components/AdminCommunityPanel";
import { AdminGrowthOpsCenter } from "../components/AdminGrowthOpsCenter";
import { AdminTrustCenter } from "../components/AdminTrustCenter";
import { FinanceCommandRoom } from "../components/FinanceCommandRoom";
import { adminDashboard } from "../data/mockData";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { motion } from "framer-motion";
import { fadeUp, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { downloadBlob } from "../utils/downloadFile";

const navItems = [
  { label: "Platform Stats", icon: Grid2X2 },
  { label: "User Management", icon: Users },
  { label: "Hostel Verification", icon: ShieldCheck },
  { label: "Finance", icon: TrendingUp },
  { label: "Finance Room", icon: WalletCards },
  { label: "Trust Center", icon: FileSearch },
  { label: "Growth Ops", icon: Wrench },
  { label: "Loyalty & Alerts", icon: BadgePercent },
  { label: "Community", icon: Newspaper },
  { label: "Operations", icon: Activity },
  { label: "Risk", icon: AlertTriangle },
  { label: "Discounts", icon: Percent },
  { label: "Payout Queue", icon: WalletCards },
  { label: "Disputes", icon: Gavel }
];

const defaultPlatformSettings = {
  hostManagementMonthlyFee: 1000,
  loyaltyReferralPoints: 1000,
  loyaltyClaimThreshold: 5000,
  loyaltyDiscountMin: 5,
  loyaltyDiscountMax: 10,
  alertDisplayHours: 48,
  studentMonthlyPlatformFeePkr: 200
};

const inferTone = (stat) => {
  if (stat.tone) return stat.tone;
  if (stat.trend?.startsWith("-")) return "red";
  if (stat.label?.toLowerCase().includes("verified")) return "green";
  return "blue";
};

const statIcon = (stat) => {
  const label = stat.label?.toLowerCase() || "";
  if (label.includes("user") || label.includes("student") || label.includes("tenant")) return Users;
  if (label.includes("revenue") || label.includes("finance") || label.includes("payout") || label.includes("earning")) return TrendingUp;
  if (label.includes("verified") || label.includes("trust")) return ShieldCheck;
  if (stat.tone === "red") return AlertTriangle;
  return Building2;
};

const formatAmount = (amount) => {
  if (typeof amount === "number") {
    return `PKR ${amount.toLocaleString("en-PK")}`;
  }
  return amount;
};

const normalizeAdminDashboard = (data = adminDashboard) => ({
  stats: (data.stats || adminDashboard.stats).map((stat) => ({ ...stat, tone: inferTone(stat) })),
  verifications: (data.verifications || data.verificationQueue || adminDashboard.verifications).map((item, index) => ({
    ...item,
    hostelId: item.hostelId || item.hostel || ["h1", "h2"][index] || "h1",
    units: typeof item.units === "number" ? `${item.units} Units` : item.units,
    documentsUploaded: item.documentsUploaded ?? 2,
    documentsRequired: item.documentsRequired ?? 2,
    documents: item.documents || [],
    agreementAccepted: item.agreementAccepted ?? true,
    signedBy: item.signedBy || "Host"
  })),
  payouts: (data.payouts || adminDashboard.payouts).map((item) => ({
    ...item,
    id: item.id || item.hostelId,
    amount: formatAmount(item.amount)
  })),
  disputes: data.disputes || adminDashboard.disputes
});

export function AdminDashboard() {
  const authUser = useAuthStore((state) => state.user);
  const initialAdminTab = new URLSearchParams(window.location.search).get("tab");
  const [activeTab, setActiveTab] = useState(navItems.some((item) => item.label === initialAdminTab) ? initialAdminTab : "Platform Stats");
  const [dashboard, setDashboard] = useState(normalizeAdminDashboard(adminDashboard));
  const [usersList, setUsersList] = useState([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [finance, setFinance] = useState(null);
  const [riskQueue, setRiskQueue] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [loyaltyClaims, setLoyaltyClaims] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [opsHealth, setOpsHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState([]);
  const [documentChecks, setDocumentChecks] = useState([]);
  const [listingQuality, setListingQuality] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [platformSettings, setPlatformSettings] = useState(defaultPlatformSettings);
  const [adminAlertForm, setAdminAlertForm] = useState({
    title: "Important hostel circular",
    message: "",
    category: "hostel",
    severity: "warning",
    audience: "all",
    city: "",
    university: "",
    ackRequired: false
  });
  const [disputeTitle, setDisputeTitle] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const matchesSearch = (...fields) => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) return true;
    return fields.some((field) => String(field ?? "").toLowerCase().includes(query));
  };
  const motionSafe = useMotionSafe();
  useDocumentTitle("Admin Dashboard | Basera");
  useToastBridge(adminMessage);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/admin"), adminDashboard).then((result) => {
      setDashboard(normalizeAdminDashboard(result));
    });
  }, []);

  useEffect(() => {
    if (activeTab === "User Management") {
      safeRequest(() => api.get("/dashboard/admin/users"), { results: [] }).then((result) => {
        setUsersList(result.results || []);
      });
    }
    if (activeTab === "Payout Queue") {
      safeRequest(() => api.get("/dashboard/admin/payouts"), { results: adminDashboard.payouts }).then((result) => {
        setDashboard((current) => normalizeAdminDashboard({ ...current, payouts: result.results || current.payouts }));
      });
    }
    if (activeTab === "Finance") {
      safeRequest(() => api.get("/dashboard/admin/finance"), { summary: {}, byCity: [], overdue: [] }).then(setFinance);
    }
    if (activeTab === "Risk") {
      safeRequest(() => api.get("/dashboard/admin/risk"), { results: [] }).then((result) => setRiskQueue(result.results || []));
    }
    if (activeTab === "Discounts") {
      safeRequest(() => api.get("/dashboard/admin/discounts"), { results: [] }).then((result) => setDiscountRules(result.results || []));
    }
    if (activeTab === "Loyalty & Alerts") {
      safeRequest(() => api.get("/dashboard/admin/loyalty-claims"), { results: [] }).then((result) => setLoyaltyClaims(result.results || []));
      safeRequest(() => api.get("/alerts/admin"), { results: [] }).then((result) => setAdminAlerts(result.results || []));
      safeRequest(() => api.get("/dashboard/admin/platform-settings"), { settings: defaultPlatformSettings }).then((result) => setPlatformSettings(result.settings || defaultPlatformSettings));
    }
    if (activeTab === "Operations") {
      safeRequest(() => api.get("/operations/health"), { checks: [] }).then(setOpsHealth);
      safeRequest(() => api.get("/operations/audit-logs"), { results: [] }).then((result) => setAuditLogs(result.results || []));
      safeRequest(() => api.get("/maintenance/admin"), { results: [] }).then((result) => setMaintenanceTickets(result.results || []));
      safeRequest(() => api.get("/operations/document-checks"), { results: [] }).then((result) => setDocumentChecks(result.results || []));
      safeRequest(() => api.get("/operations/listing-quality"), { results: [] }).then((result) => setListingQuality(result.results || []));
      safeRequest(() => api.get("/reviews/admin/moderation"), { results: [] }).then((result) => setReviewQueue(result.results || []));
    }
    if (activeTab === "Disputes") {
      safeRequest(() => api.get("/dashboard/admin/disputes"), { results: adminDashboard.disputes }).then((result) => {
        setDashboard((current) => normalizeAdminDashboard({ ...current, disputes: result.results || current.disputes }));
      });
    }
  }, [activeTab]);

  const approveVerification = async (item) => {
    setActionMessage(`Approving ${item.name}...`);
    const result = await safeRequest(() => api.post(`/hostels/${item.hostelId}/verify`), { demo: true });
    setDashboard((current) => ({
      ...current,
      verifications: current.verifications.filter((verification) => verification.name !== item.name)
    }));
    setActionMessage(result.demo ? `${item.name} approved in demo mode.` : `${item.name} approved.`);
  };

  const rejectVerification = (item) => {
    setDashboard((current) => ({
      ...current,
      verifications: current.verifications.filter((verification) => verification.name !== item.name)
    }));
    setActionMessage(`${item.name} removed from the verification queue.`);
  };

  const adminNavItems = navItems.map((item) => ({ ...item, onClick: () => setActiveTab(item.label) }));

  const updateUser = async (user, patch) => {
    setAdminMessage(`Updating ${user.name}...`);
    const result = await safeRequest(() => api.put(`/dashboard/admin/users/${user.id || user._id}`, patch), { user: { ...user, ...patch }, demo: true });
    setUsersList((current) => current.map((item) => ((item.id || item._id) === (user.id || user._id) ? { ...item, ...(result.user || patch) } : item)));
    setAdminMessage(result.demo ? "User updated in demo mode." : "User updated.");
  };

  const processBatchPayout = async () => {
    setAdminMessage("Processing payout queue...");
    const result = await safeRequest(() => api.post("/dashboard/admin/payouts/batch", { bookingIds: dashboard.payouts.map((item) => item.bookingId || item.id) }), { processed: true, count: dashboard.payouts.length, demo: true });
    setAdminMessage(result.demo ? `Processed ${result.count} payouts in demo mode.` : `Processed ${result.count} payouts.`);
  };

  const releasePayout = async (item) => {
    setAdminMessage(`Releasing payout to ${item.recipient}...`);
    const result = await safeRequest(
      () => api.post("/dashboard/admin/payouts/batch", { bookingIds: [item.bookingId || item.id] }),
      { processed: true, count: 1, demo: true }
    );
    setDashboard((current) => normalizeAdminDashboard({ ...current, payouts: current.payouts.filter((row) => row !== item) }));
    setAdminMessage(result.demo ? `Payout to ${item.recipient} released in demo mode.` : `Payout to ${item.recipient} released.`);
  };

  const openDispute = async (event) => {
    event.preventDefault();
    const title = disputeTitle.trim();
    if (!title) return;
    setAdminMessage("Opening dispute case...");
    const result = await safeRequest(() => api.post("/dashboard/admin/disputes", { title, priority: "medium", status: "open" }), {
      dispute: { id: `DIS-${Date.now()}`, title, priority: "medium", user: "Admin opened case", status: "open" },
      demo: true
    });
    setDashboard((current) => normalizeAdminDashboard({ ...current, disputes: [result.dispute, ...current.disputes] }));
    setDisputeTitle("");
    setAdminMessage(result.demo ? "Dispute opened in demo mode." : "Dispute opened.");
  };

  const approveLoyaltyClaim = async (claim, discountPercent) => {
    setAdminMessage(`Approving loyalty discount at ${discountPercent}%...`);
    const result = await safeRequest(
      () => api.put(`/dashboard/admin/loyalty-claims/${claim.id || claim._id}/approve`, { discountPercent }),
      { claim: { ...claim, status: "approved", approvedDiscountPercent: discountPercent, couponCode: `LOYALTY${discountPercent}` }, demo: true }
    );
    setLoyaltyClaims((current) => current.map((item) => ((item.id || item._id) === (claim.id || claim._id) ? result.claim : item)));
    setAdminMessage(result.demo ? "Loyalty discount approved in demo mode." : "Loyalty discount approved.");
  };

  const rejectLoyaltyClaim = async (claim) => {
    setAdminMessage("Rejecting loyalty claim...");
    const result = await safeRequest(
      () => api.put(`/dashboard/admin/loyalty-claims/${claim.id || claim._id}/reject`, { adminNote: "Rejected after admin review." }),
      { claim: { ...claim, status: "rejected", adminNote: "Rejected after admin review." }, demo: true }
    );
    setLoyaltyClaims((current) => current.map((item) => ((item.id || item._id) === (claim.id || claim._id) ? result.claim : item)));
    setAdminMessage(result.demo ? "Loyalty claim rejected in demo mode." : "Loyalty claim rejected.");
  };

  const savePlatformSettings = async (event) => {
    event.preventDefault();
    setAdminMessage("Saving platform settings...");
    const result = await safeRequest(() => api.put("/dashboard/admin/platform-settings", platformSettings), { settings: platformSettings, demo: true });
    setPlatformSettings(result.settings || platformSettings);
    setAdminMessage(result.demo ? "Platform settings saved in demo mode." : "Platform settings saved.");
  };

  const publishAdminAlert = async (event) => {
    event.preventDefault();
    if (!adminAlertForm.title.trim() || !adminAlertForm.message.trim()) {
      setAdminMessage("Alert title and message are required.");
      return;
    }
    setAdminMessage("Publishing admin alert...");
    const result = await safeRequest(() => api.post("/alerts/admin", adminAlertForm), {
      alert: { id: `alert-${Date.now()}`, ...adminAlertForm, status: "published", publishedAt: new Date().toISOString() },
      demo: true
    });
    setAdminAlerts((current) => [result.alert, ...current]);
    setAdminAlertForm((current) => ({ ...current, message: "" }));
    setAdminMessage(result.demo ? "Alert published in demo mode." : "Alert published for 48 hours.");
  };

  const approveGlobalAlert = async (alert) => {
    setAdminMessage("Approving global alert...");
    const result = await safeRequest(
      () => api.put(`/alerts/admin/${alert.id || alert._id}/approve`, { displayHours: platformSettings.alertDisplayHours }),
      { alert: { ...alert, status: "published", publishedAt: new Date().toISOString() }, demo: true }
    );
    setAdminAlerts((current) => current.map((item) => ((item.id || item._id) === (alert.id || alert._id) ? result.alert : item)));
    setAdminMessage(result.demo ? "Alert approved in demo mode." : "Alert approved and published.");
  };

  const rejectGlobalAlert = async (alert) => {
    setAdminMessage("Rejecting global alert...");
    const result = await safeRequest(
      () => api.put(`/alerts/admin/${alert.id || alert._id}/reject`, { adminNote: "Rejected after admin review." }),
      { alert: { ...alert, status: "rejected" }, demo: true }
    );
    setAdminAlerts((current) => current.map((item) => ((item.id || item._id) === (alert.id || alert._id) ? result.alert : item)));
    setAdminMessage(result.demo ? "Alert rejected in demo mode." : "Alert rejected.");
  };

  const issueManagementFeeInvoice = async () => {
    setAdminMessage("Issuing management fee invoice...");
    const result = await safeRequest(
      () => api.post("/dashboard/admin/management-fees/invoice", { hostId: "u-owner", period: new Date().toISOString().slice(0, 7), amount: platformSettings.hostManagementMonthlyFee }),
      { invoice: { id: `MGMT-${Date.now()}`, amount: platformSettings.hostManagementMonthlyFee, status: "issued" }, demo: true }
    );
    setAdminMessage(result.demo ? "Management fee invoice issued in demo mode." : "Management fee invoice issued and posted to ledger.");
  };

  const updateMaintenanceTicket = async (ticket, status) => {
    setAdminMessage(`Updating maintenance ticket to ${status}...`);
    const result = await safeRequest(() => api.put(`/maintenance/${ticket.id || ticket._id}/status`, { status, note: `Admin marked ${status}` }), {
      ticket: { ...ticket, status },
      demo: true
    });
    setMaintenanceTickets((current) => current.map((item) => ((item.id || item._id) === (ticket.id || ticket._id) ? result.ticket : item)));
    setAdminMessage(result.demo ? "Maintenance ticket updated in demo mode." : "Maintenance ticket updated.");
  };

  const reviewDocumentCheck = async (document, status) => {
    setAdminMessage(`${status === "approved" ? "Approving" : "Rejecting"} document...`);
    const result = await safeRequest(() => api.post(`/operations/document-checks/${document.id}/review`, { status }), {
      document: { ...document, status },
      demo: true
    });
    setDocumentChecks((current) => current.map((item) => (item.id === document.id ? { ...item, ...(result.document || { status }) } : item)));
    setAdminMessage(result.demo ? "Document review saved in demo mode." : "Document review saved.");
  };

  const moderateReview = async (review, status) => {
    setAdminMessage(`${status === "approved" ? "Approving" : "Hiding"} review...`);
    const result = await safeRequest(() => api.put(`/reviews/${review.id || review._id}/moderate`, { status, reason: "Admin moderation review" }), {
      review: { ...review, moderationStatus: status, isPublished: status === "approved" },
      demo: true
    });
    setReviewQueue((current) => current.map((item) => ((item.id || item._id) === (review.id || review._id) ? result.review : item)));
    setAdminMessage(result.demo ? "Review moderation saved in demo mode." : "Review moderation saved.");
  };

  return (
    <DashboardShell
      title="Platform Overview"
      subtitle="Monitor verification, finance, trust and operations across Basera."
      navLabel="Admin Console"
      navItems={adminNavItems}
      active={activeTab}
      user={{ name: authUser?.name || "Super Admin", role: "Master Access", avatar: authUser?.avatar || "" }}
      footerText="Administrative Operations Dashboard. Secure access protocol active."
    >
      <Toolbar
        search={adminSearch}
        onSearch={setAdminSearch}
        placeholder="Filter this view (name, email, city, status)..."
        searchIcon={Search}
      >
        <IconButton icon={Bell} label="Notifications" />
      </Toolbar>

      {activeTab === "Platform Stats" ? (
      <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="space-y-10">
        <StatGrid columns={dashboard.stats.length >= 4 ? 4 : 3}>
          {dashboard.stats.map((stat) => (
            <StatTile
              key={stat.label}
              icon={statIcon(stat)}
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              tone={stat.tone === "green" ? "green" : stat.tone === "red" ? "red" : "blue"}
            />
          ))}
        </StatGrid>

        <section className="grid gap-8 xl:grid-cols-[1.15fr_0.8fr]">
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Verification Queue</h2>
              <button className="font-semibold text-primary-800">View All</button>
            </div>
            {actionMessage && <p className="mb-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{actionMessage}</p>}
            <div className="grid gap-5">
              {dashboard.verifications.map((item) => (
                <article key={item.name} className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                  <img src={item.image} alt={item.name} className="h-28 w-full rounded-md object-cover sm:w-28" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{item.name}</h3>
                    <p className="text-slate-700">{item.city} - Applied 2h ago</p>
                    <div className="mt-3 flex gap-3">
                      <span className="badge bg-primary-50 text-slate-700">{item.plan}</span>
                      <span className="badge bg-primary-50 text-slate-700">{item.units}</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <span className="rounded-md bg-primary-50 px-3 py-2">
                        Docs: <strong>{item.documentsUploaded}/{item.documentsRequired}</strong>
                      </span>
                      <span className={`rounded-md px-3 py-2 ${item.agreementAccepted ? "bg-accent-50 text-accent-700" : "bg-[#FEE2E2] text-[#9B1C1C]"}`}>
                        Agreement: <strong>{item.agreementAccepted ? "Signed" : "Missing"}</strong>
                      </span>
                    </div>
                    {item.signedBy && <p className="mt-2 text-sm text-slate-600">Signed by {item.signedBy}</p>}
                    {item.documents.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        {item.documents.map((document) => (
                          <a
                            key={`${item.name}-${document.type}`}
                            href={document.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-line bg-white px-3 py-2 font-semibold text-primary-800 hover:bg-primary-50"
                          >
                            {document.type}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3">
                    <button type="button" onClick={() => approveVerification(item)} className="btn-primary py-2">Approve</button>
                    <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => rejectVerification(item)}>Reject</ConfirmButton>
                  </div>
                </article>
              ))}
              {!dashboard.verifications.length && (
                <div className="panel p-6 text-center text-slate-700">No pending verification requests.</div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Payout Queue</h2>
              <span className="badge bg-accent-50 text-accent-700">{dashboard.payouts.length} pending</span>
            </div>
            <div className="panel overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_120px] bg-primary-50 px-5 py-4 text-sm text-slate-700">
                <span>Recipient</span><span>Amount</span><span>Action</span>
              </div>
              {dashboard.payouts.map((item) => (
                <div key={item.recipient} className="grid grid-cols-[1fr_120px_120px] items-center border-t border-line px-5 py-6">
                  <div>
                    <p className="font-bold">{item.recipient}</p>
                    <p className="text-xs uppercase text-slate-600">Hostel ID: {item.id}</p>
                  </div>
                  <strong>{item.amount}</strong>
                  <button className="rounded-md bg-accent-700 px-4 py-2 font-semibold text-white">Release</button>
                </div>
              ))}
              <button type="button" onClick={processBatchPayout} className="w-full bg-primary-50 p-5 font-bold text-primary-800">Process Batch Payout</button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold">Recent Active Disputes</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.disputes.map((item) => (
              <article key={item.id} className="panel p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className={`badge ${item.priority === "High Priority" ? "bg-[#FEE2E2] text-[#9B1C1C]" : "bg-primary-50 text-slate-700"}`}>{item.priority}</span>
                  <span className="text-sm text-slate-700">{item.id}</span>
                </div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-slate-700">User: {item.user}</p>
                <div className="mt-7 flex items-center justify-between">
                  <span>{item.status}</span>
                  <button className="text-primary-800">-&gt;</button>
                </div>
              </article>
            ))}
            <button className="grid min-h-[210px] place-items-center rounded-lg border-2 border-dashed border-line text-center text-slate-800">
              <div>
                <CirclePlus className="mx-auto mb-4" size={34} />
                <p className="font-semibold">Open New Case</p>
              </div>
            </button>
          </div>
        </section>
      </motion.div>
      ) : activeTab === "Finance Room" ? (
        <FinanceCommandRoom />
      ) : activeTab === "Trust Center" ? (
        <AdminTrustCenter />
      ) : activeTab === "Growth Ops" ? (
        <AdminGrowthOpsCenter />
      ) : (
        <AdminOperationsTab
          activeTab={activeTab}
          dashboard={dashboard}
          usersList={usersList}
          actionMessage={actionMessage}
          approveVerification={approveVerification}
          rejectVerification={rejectVerification}
          updateUser={updateUser}
          processBatchPayout={processBatchPayout}
          releasePayout={releasePayout}
          matchesSearch={matchesSearch}
          disputeTitle={disputeTitle}
          setDisputeTitle={setDisputeTitle}
          openDispute={openDispute}
          finance={finance}
          riskQueue={riskQueue}
          discountRules={discountRules}
          loyaltyClaims={loyaltyClaims}
          adminAlerts={adminAlerts}
          opsHealth={opsHealth}
          auditLogs={auditLogs}
          maintenanceTickets={maintenanceTickets}
          documentChecks={documentChecks}
          listingQuality={listingQuality}
          reviewQueue={reviewQueue}
          platformSettings={platformSettings}
          setPlatformSettings={setPlatformSettings}
          adminAlertForm={adminAlertForm}
          setAdminAlertForm={setAdminAlertForm}
          approveLoyaltyClaim={approveLoyaltyClaim}
          rejectLoyaltyClaim={rejectLoyaltyClaim}
          savePlatformSettings={savePlatformSettings}
          publishAdminAlert={publishAdminAlert}
          approveGlobalAlert={approveGlobalAlert}
          rejectGlobalAlert={rejectGlobalAlert}
          issueManagementFeeInvoice={issueManagementFeeInvoice}
          updateMaintenanceTicket={updateMaintenanceTicket}
          reviewDocumentCheck={reviewDocumentCheck}
          moderateReview={moderateReview}
        />
      )}
    </DashboardShell>
  );
}

function AdminOperationsTab({
  activeTab,
  dashboard,
  usersList,
  actionMessage,
  approveVerification,
  rejectVerification,
  updateUser,
  processBatchPayout,
  releasePayout,
  matchesSearch,
  disputeTitle,
  setDisputeTitle,
  openDispute,
  finance,
  riskQueue,
  discountRules,
  loyaltyClaims,
  adminAlerts,
  opsHealth,
  auditLogs,
  maintenanceTickets,
  documentChecks,
  listingQuality,
  reviewQueue,
  platformSettings,
  setPlatformSettings,
  adminAlertForm,
  setAdminAlertForm,
  approveLoyaltyClaim,
  rejectLoyaltyClaim,
  savePlatformSettings,
  publishAdminAlert,
  approveGlobalAlert,
  rejectGlobalAlert,
  issueManagementFeeInvoice,
  updateMaintenanceTicket,
  reviewDocumentCheck,
  moderateReview
}) {
  if (activeTab === "Community") {
    return <AdminCommunityPanel />;
  }

  if (activeTab === "User Management") {
    const rows = (usersList.length ? usersList : [
      { id: "u-student", name: "Ali Ahmed", email: "student@basera.pk", role: "student", isVerified: true, isBanned: false },
      { id: "u-owner", name: "Alex Rivera", email: "owner@basera.pk", role: "host", isVerified: true, isBanned: false },
      { id: "u-admin", name: "Super Admin", email: "admin@basera.pk", role: "admin", isVerified: true, isBanned: false }
    ]).filter((user) => matchesSearch(user.name, user.email, user.role));

    return (
      <section className="panel overflow-hidden">
        <div className="p-7">
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="mt-2 text-sm text-slate-700">Review roles, verification status, and account restrictions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-line bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-7 py-4">User</th>
                <th className="px-7 py-4">Role</th>
                <th className="px-7 py-4">Verified</th>
                <th className="px-7 py-4">Access</th>
                <th className="px-7 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!rows.length && (
                <tr><td colSpan={5} className="px-7 py-12 text-center text-neutral-500">No users match your filter.</td></tr>
              )}
              {rows.map((user) => (
                <tr key={user.id || user._id}>
                  <td className="px-7 py-5">
                    <p className="font-bold">{user.name}</p>
                    <p className="text-sm text-slate-700">{user.email}</p>
                  </td>
                  <td className="px-7 py-5 capitalize">{user.role}</td>
                  <td className="px-7 py-5">
                    <StatusPill status={user.isVerified ? "verified" : "pending"} />
                  </td>
                  <td className="px-7 py-5">
                    <StatusPill status={user.isBanned ? "blocked" : "active"}>{user.isBanned ? "Banned" : "Active"}</StatusPill>
                  </td>
                  <td className="px-7 py-5">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary py-2" onClick={() => updateUser(user, { isVerified: !user.isVerified })}>
                        {user.isVerified ? "Unverify" : "Verify"}
                      </button>
                      {user.isBanned ? (
                        <button type="button" className="btn-secondary py-2" onClick={() => updateUser(user, { isBanned: false })}>
                          Restore access
                        </button>
                      ) : (
                        <ConfirmButton
                          className="btn-secondary py-2 text-danger-700"
                          confirmLabel="Yes, ban"
                          onConfirm={() => updateUser(user, { isBanned: true })}
                        >
                          Ban
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (activeTab === "Hostel Verification") {
    return (
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Hostel Verification Queue</h2>
          <span className="badge bg-primary-50 text-primary-800">{dashboard.verifications.length} pending</span>
        </div>
        {actionMessage && <p className="mb-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{actionMessage}</p>}
        <div className="grid gap-5">
          {dashboard.verifications.map((item) => (
            <article key={item.name} className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <img src={item.image} alt={item.name} className="h-28 w-full rounded-md object-cover sm:w-28" />
              <div className="flex-1">
                <h3 className="text-lg font-bold">{item.name}</h3>
                <p className="text-slate-700">{item.city}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <span className="badge bg-primary-50 text-slate-700">{item.plan}</span>
                  <span className="badge bg-primary-50 text-slate-700">{item.units}</span>
                  <span className={`badge ${item.agreementAccepted ? "bg-accent-50 text-accent-700" : "bg-[#FEE2E2] text-[#9B1C1C]"}`}>{item.agreementAccepted ? "Agreement signed" : "Agreement missing"}</span>
                  <span className="badge bg-primary-50 text-primary-800">Docs {item.documentsUploaded}/{item.documentsRequired}</span>
                </div>
                {item.documents?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {item.documents.map((document) => (
                      <a key={`${item.name}-${document.type}`} href={document.url} target="_blank" rel="noreferrer" className="rounded-md border border-line bg-white px-3 py-2 font-semibold text-primary-800 hover:bg-primary-50">
                        {document.type}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3">
                <button type="button" onClick={() => approveVerification(item)} className="btn-primary py-2">Approve</button>
                <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => rejectVerification(item)}>Reject</ConfirmButton>
              </div>
            </article>
          ))}
          {!dashboard.verifications.length && <div className="panel p-6 text-center text-slate-700">No pending verification requests.</div>}
        </div>
      </section>
    );
  }

  if (activeTab === "Payout Queue") {
    return (
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Payout Queue</h2>
            <p className="mt-2 text-sm text-slate-700">Release escrow payouts to Hosts after payment and dispute checks.</p>
          </div>
          <button type="button" className="btn-primary" onClick={processBatchPayout}>Process Batch Payout</button>
        </div>
        <div className="px-7 pb-7">
          <DataTable
            rows={dashboard.payouts.filter((item) => matchesSearch(item.recipient, item.id, item.hostelId))}
            rowKey={(item) => item.recipient}
            pageSize={8}
            empty="No payouts in the queue."
            columns={[
              { key: "recipient", header: "Recipient", sortable: true, render: (item) => <div><p className="font-bold text-ink">{item.recipient}</p><p className="text-xs uppercase tracking-wider text-neutral-400">Hostel ID: {item.id || item.hostelId}</p></div> },
              { key: "amount", header: "Amount", sortable: true, sortValue: (item) => Number(String(item.amount).replace(/[^0-9.]/g, "")) || 0, render: (item) => <span className="font-bold text-ink">{item.amount}</span> },
              { key: "status", header: "Status", render: () => <StatusPill status="pending" /> },
              { key: "action", header: "Action", render: (item) => <ConfirmButton className="btn-primary py-2" tone="primary" confirmLabel="Release now" onConfirm={() => releasePayout(item)}>Release</ConfirmButton> }
            ]}
          />
        </div>
      </section>
    );
  }

  if (activeTab === "Finance") {
    const summary = finance?.summary || { gmv: 1248000, commissionEarned: 87360, escrowBalance: 214000, payoutQueue: 109740, disputeEscrow: 47000, overdueAmount: 64000 };
    const reconciliation = finance?.reconciliation || {};
    const balances = reconciliation.balances || {};
    const downloadReport = async (report, format) => {
      const response = await api.get(`/admin/reports/${report}?format=${format}`, { responseType: "blob" });
      downloadBlob({
        blob: response.data,
        filename: `basera-${report}-report.${format}`,
        mimeType: format === "csv" ? "text/csv;charset=utf-8" : "application/pdf"
      });
    };
    return (
      <section className="space-y-7">
        <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Finance Exports</h2>
            <p className="mt-1 text-sm text-slate-700">Download commission and overdue reports for accounting review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary py-2" onClick={() => downloadReport("commission", "pdf")}>Commission PDF</button>
            <button type="button" className="btn-secondary py-2" onClick={() => downloadReport("commission", "csv")}>Commission CSV</button>
            <button type="button" className="btn-secondary py-2" onClick={() => downloadReport("overdue", "pdf")}>Overdue PDF</button>
            <button type="button" className="btn-secondary py-2" onClick={() => downloadReport("overdue", "csv")}>Overdue CSV</button>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-7">
          {[
            ["GMV", summary.gmv],
            ["Commission", summary.commissionEarned],
            ["Mgmt Fees", summary.managementFeeRevenue],
            ["Escrow Balance", summary.escrowBalance],
            ["Payout Queue", summary.payoutQueue],
            ["Dispute Escrow", summary.disputeEscrow],
            ["Overdue", summary.overdueAmount]
          ].map(([label, value]) => (
            <article key={label} className="panel p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
              <p className="mt-3 text-2xl font-extrabold text-primary-800">PKR {Number(value || 0).toLocaleString("en-PK")}</p>
            </article>
          ))}
        </div>
        <section className="panel p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Ledger Reconciliation</h2>
              <p className="mt-1 text-sm text-slate-700">Double-entry balances, webhook idempotency, and escrow separation checks.</p>
            </div>
            <span className={`badge ${reconciliation.mismatches?.length ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-accent-50 text-accent-700"}`}>
              {reconciliation.mismatches?.length ? `${reconciliation.mismatches.length} mismatch` : "Balanced"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Object.entries(balances).slice(0, 6).map(([account, value]) => (
              <article key={account} className="rounded-lg border border-line bg-canvas p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{account.replaceAll("_", " ")}</p>
                <p className="mt-2 font-extrabold text-primary-800">PKR {Number(value || 0).toLocaleString("en-PK")}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="text-xl font-bold">City Performance</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {(finance?.byCity || [
              { city: "Islamabad", gmv: 648000, commission: 45360 },
              { city: "Lahore", gmv: 382000, commission: 26740 },
              { city: "Karachi", gmv: 218000, commission: 15260 }
            ]).map((row) => (
              <article key={row.city} className="rounded-lg border border-line p-4">
                <p className="font-bold">{row.city}</p>
                <p className="mt-2 text-sm text-slate-700">GMV PKR {Number(row.gmv).toLocaleString("en-PK")}</p>
                <p className="text-sm text-accent-700">Commission PKR {Number(row.commission).toLocaleString("en-PK")}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    );
  }

  if (activeTab === "Loyalty & Alerts") {
    const pendingClaims = loyaltyClaims.filter((claim) => claim.status === "pending").length;
    const pendingAlerts = adminAlerts.filter((alert) => alert.status === "pending").length;

    const updateSetting = (field) => (event) => {
      setPlatformSettings((current) => ({ ...current, [field]: Number(event.target.value) }));
    };

    const updateAlert = (field) => (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setAdminAlertForm((current) => ({ ...current, [field]: value }));
    };

    return (
      <section className="space-y-7">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="panel p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Pending Loyalty Claims</p>
            <p className="mt-3 text-4xl font-extrabold text-primary-800">{pendingClaims}</p>
          </article>
          <article className="panel p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Pending Alerts</p>
            <p className="mt-3 text-4xl font-extrabold text-primary-800">{pendingAlerts}</p>
          </article>
          <article className="panel p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Management Fee</p>
            <p className="mt-3 text-4xl font-extrabold text-primary-800">PKR {Number(platformSettings.hostManagementMonthlyFee || 0).toLocaleString("en-PK")}</p>
          </article>
          <article className="panel p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Student Monthly Fee</p>
            <p className="mt-3 text-4xl font-extrabold text-primary-800">PKR {Number(platformSettings.studentMonthlyPlatformFeePkr || 0).toLocaleString("en-PK")}</p>
          </article>
        </div>

        <section className="grid gap-7 xl:grid-cols-[420px_1fr]">
          <form onSubmit={savePlatformSettings} className="panel h-fit p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Settings size={22} /> Platform Controls</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Host management monthly fee<input className="input" type="number" min="0" value={platformSettings.hostManagementMonthlyFee} onChange={updateSetting("hostManagementMonthlyFee")} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Student monthly platform fee (PKR)<input className="input" type="number" min="0" value={platformSettings.studentMonthlyPlatformFeePkr} onChange={updateSetting("studentMonthlyPlatformFeePkr")} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Points per referral<input className="input" type="number" min="0" value={platformSettings.loyaltyReferralPoints} onChange={updateSetting("loyaltyReferralPoints")} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Claim threshold<input className="input" type="number" min="0" value={platformSettings.loyaltyClaimThreshold} onChange={updateSetting("loyaltyClaimThreshold")} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Min discount %<input className="input" type="number" min="5" max="10" value={platformSettings.loyaltyDiscountMin} onChange={updateSetting("loyaltyDiscountMin")} /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Max discount %<input className="input" type="number" min="5" max="10" value={platformSettings.loyaltyDiscountMax} onChange={updateSetting("loyaltyDiscountMax")} /></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Alert display hours<input className="input" type="number" min="1" value={platformSettings.alertDisplayHours} onChange={updateSetting("alertDisplayHours")} /></label>
              <button type="submit" className="btn-primary">Save Controls</button>
              <button type="button" onClick={issueManagementFeeInvoice} className="btn-secondary">Issue Monthly Fee Invoice</button>
            </div>
          </form>

          <div className="grid gap-7">
            <section className="panel overflow-hidden">
              <div className="p-6">
                <h2 className="flex items-center gap-2 text-xl font-bold"><BadgePercent size={22} /> Loyalty Discount Claims</h2>
                <p className="mt-2 text-sm text-slate-700">Students can claim after {Number(platformSettings.loyaltyClaimThreshold || 5000).toLocaleString("en-PK")} points. Admin approves a 5-10% next-booking discount.</p>
              </div>
              <div className="px-6 pb-6">
                <DataTable
                  rows={loyaltyClaims.length ? loyaltyClaims : [{ id: "claim-empty", studentName: "No pending claims", requestedPoints: 0, status: "empty" }]}
                  rowKey={(claim) => claim.id || claim._id}
                  pageSize={6}
                  empty="No loyalty claims yet."
                  columns={[
                    { key: "studentName", header: "Student", sortable: true, render: (claim) => <div><p className="font-bold text-ink">{claim.studentName}</p><p className="text-sm text-neutral-500">{claim.studentEmail}</p></div> },
                    { key: "requestedPoints", header: "Points", sortable: true, sortValue: (claim) => claim.requestedPoints || 0, render: (claim) => Number(claim.requestedPoints || 0).toLocaleString("en-PK") },
                    { key: "status", header: "Status", sortable: true, render: (claim) => <StatusPill status={claim.status} /> },
                    { key: "couponCode", header: "Coupon", render: (claim) => <span className="font-semibold text-primary-800">{claim.couponCode || "-"}</span> },
                    { key: "action", header: "Action", render: (claim) => (claim.status === "pending" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="btn-primary py-2" onClick={() => approveLoyaltyClaim(claim, 5)}>Approve 5% off</button>
                        <button type="button" className="btn-secondary py-2" onClick={() => approveLoyaltyClaim(claim, 10)}>Approve 10% off</button>
                        <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject claim" onConfirm={() => rejectLoyaltyClaim(claim)}>Reject</ConfirmButton>
                      </div>
                    ) : <span className="text-sm text-neutral-500">Reviewed</span>) }
                  ]}
                />
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-7 xl:grid-cols-[420px_1fr]">
          <form onSubmit={publishAdminAlert} className="panel h-fit p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Megaphone size={22} /> Publish Admin Alert</h2>
            <p className="mt-2 text-sm text-slate-700">Admin alerts publish immediately and stay visible for {platformSettings.alertDisplayHours || 48} hours.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Title<input className="input" value={adminAlertForm.title} onChange={updateAlert("title")} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Severity<select className="input" value={adminAlertForm.severity} onChange={updateAlert("severity")}><option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option></select></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Audience<select className="input" value={adminAlertForm.audience} onChange={updateAlert("audience")}><option value="all">all</option><option value="students">students</option><option value="hosts">hosts</option></select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Target city<input className="input" value={adminAlertForm.city} onChange={updateAlert("city")} placeholder="Optional" /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Target university<input className="input" value={adminAlertForm.university} onChange={updateAlert("university")} placeholder="Optional" /></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Message<textarea className="input min-h-28 resize-none" value={adminAlertForm.message} onChange={updateAlert("message")} /></label>
              <label className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-4 text-sm font-semibold"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={adminAlertForm.ackRequired} onChange={updateAlert("ackRequired")} /><span>Require acknowledgement</span></label>
              <button type="submit" className="btn-primary">Publish Now</button>
            </div>
          </form>

          <section className="panel overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold">Global Alert Review Queue</h2>
              <p className="mt-2 text-sm text-slate-700">Community-submitted alerts require approval before global display.</p>
            </div>
            <div className="grid gap-4 p-5">
              {(adminAlerts.length ? adminAlerts : [{ id: "alert-empty", title: "No alert submissions", message: "No community alerts are waiting right now.", status: "empty", severity: "info" }]).map((alert) => (
                <article key={alert.id || alert._id} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={alert.status} />
                        <span className="chip">{alert.severity}</span>
                        <span className="chip">{alert.audience || "all"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold">{alert.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{alert.message}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Submitted by {alert.submittedByName || "Community"}</p>
                    </div>
                    {alert.status === "pending" && (
                      <div className="flex gap-2 lg:grid">
                        <button type="button" className="btn-primary py-2" onClick={() => approveGlobalAlert(alert)}>Approve</button>
                        <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => rejectGlobalAlert(alert)}>Reject</ConfirmButton>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>
    );
  }

  if (activeTab === "Operations") {
    const healthChecks = opsHealth?.checks?.length ? opsHealth.checks : [
      { key: "database", label: "MongoDB", status: "demo", detail: "Demo data active until MONGO_URI is configured." },
      { key: "email", label: "Email Provider", status: "missing", detail: "SMTP credentials pending." },
      { key: "maintenance", label: "Maintenance Queue", status: "review", detail: `${maintenanceTickets.length} tickets loaded` }
    ];
    const docs = documentChecks.length ? documentChecks : [
      { id: "doc-empty", ownerName: "No document checks", ownerRole: "system", type: "document", originalName: "Queue is clear", status: "approved", ocrStatus: "scan_passed", confidence: 100 }
    ];
    const qualityRows = listingQuality.length ? listingQuality : [
      { id: "quality-empty", name: "No listings loaded", city: "-", score: 0, label: "pending", missing: [] }
    ];
    const reviewsForModeration = reviewQueue.length ? reviewQueue : [
      { id: "review-empty", studentName: "No pending reviews", comment: "Review queue is clear.", rating: 5, moderationStatus: "approved", isPublished: true }
    ];

    return (
      <section className="space-y-7">
        <div className="grid gap-5 md:grid-cols-3">
          {healthChecks.slice(0, 6).map((check) => (
            <article key={check.key || check.label} className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-700">{check.label}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{check.detail}</p>
                </div>
                <span className={`badge ${check.status === "ok" ? "bg-accent-50 text-accent-700" : check.status === "missing" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{check.status}</span>
              </div>
            </article>
          ))}
        </div>

        <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
          <div className="panel overflow-hidden">
            <div className="p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Wrench size={22} /> Maintenance Command Center</h2>
              <p className="mt-2 text-sm text-slate-700">Open repair tickets, SLA priority, and escalation controls.</p>
            </div>
            <div className="grid gap-4 p-5">
              {(maintenanceTickets.length ? maintenanceTickets : [{ id: "mt-empty", title: "No open tickets", hostelName: "All properties", roomNumber: "-", priority: "low", status: "resolved" }]).map((ticket) => (
                <article key={ticket.id || ticket._id} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${ticket.priority === "urgent" || ticket.priority === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{ticket.priority}</span>
                        <span className="chip">{ticket.status}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold">{ticket.title}</h3>
                      <p className="mt-1 text-sm text-slate-700">{ticket.hostelName} - Room {ticket.roomNumber}</p>
                    </div>
                    {ticket.status !== "resolved" && ticket.status !== "closed" && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary py-2" onClick={() => updateMaintenanceTicket(ticket, "in_progress")}>Progress</button>
                        <button type="button" className="btn-secondary py-2" onClick={() => updateMaintenanceTicket(ticket, "resolved")}>Resolve</button>
                        <button type="button" className="btn-primary py-2" onClick={() => updateMaintenanceTicket(ticket, "escalated")}>Escalate</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <section className="panel overflow-hidden">
            <div className="p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold"><FileSearch size={22} /> KYC / OCR Checks</h2>
              <p className="mt-2 text-sm text-slate-700">Review identity, student, and property proof scans.</p>
            </div>
            <div className="grid gap-4 p-5">
              {docs.slice(0, 5).map((document) => (
                <article key={document.id} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{document.ownerName}</p>
                      <p className="mt-1 text-sm text-slate-700">{document.type} - {document.originalName}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{document.ocrStatus} - {document.confidence}% confidence</p>
                    </div>
                    <span className={`badge ${document.status === "approved" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{document.status}</span>
                  </div>
                  {document.status !== "approved" && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => reviewDocumentCheck(document, "rejected")}>Reject</ConfirmButton>
                      <button type="button" className="btn-primary py-2" onClick={() => reviewDocumentCheck(document, "approved")}>Approve</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
          <div className="panel overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold">Listing Quality Scores</h2>
              <p className="mt-2 text-sm text-slate-700">Scores combine photos, pricing clarity, location, amenities, proofs, rooms, and reviews.</p>
            </div>
            <div className="px-6 pb-6">
              <DataTable
                rows={qualityRows}
                rowKey={(row) => row.id || row.name}
                pageSize={6}
                empty="No listing scores yet."
                columns={[
                  { key: "name", header: "Listing", sortable: true, render: (row) => <span className="font-bold text-ink">{row.name}</span> },
                  { key: "city", header: "City", sortable: true },
                  { key: "score", header: "Score", sortable: true, sortValue: (row) => row.score || 0, render: (row) => <span className={`pill ${row.score >= 70 ? "pill-success" : "pill-warning"}`}>{row.score}/100 {row.label}</span> },
                  { key: "missing", header: "Missing", render: (row) => <span className="text-neutral-600">{(row.missing || []).slice(0, 2).join(", ") || "Complete"}</span> }
                ]}
              />
            </div>
          </div>

          <section className="panel overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold">Review Moderation</h2>
              <p className="mt-2 text-sm text-slate-700">Approve verified feedback and hide unsafe content.</p>
            </div>
            <div className="grid gap-4 p-5">
              {reviewsForModeration.slice(0, 4).map((review) => (
                <article key={review.id || review._id} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{review.studentName || review.student?.name || "Student"}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{review.comment}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{review.rating} stars</p>
                    </div>
                    <StatusPill status={review.moderationStatus} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Hide review" onConfirm={() => moderateReview(review, "rejected")}>
                      Hide
                    </ConfirmButton>
                    <button type="button" className="btn-primary py-2" onClick={() => moderateReview(review, "approved")}>Approve</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Activity size={22} /> Audit Trail</h2>
            <p className="mt-2 text-sm text-slate-700">Latest admin, system, booking, alert, review, and maintenance actions. Click a column to sort.</p>
          </div>
          <div className="px-6 pb-6">
            <DataTable
              rows={auditLogs.length ? auditLogs : [{ id: "audit-empty", createdAt: new Date().toISOString(), actorName: "System", actorRole: "system", action: "No audit events loaded", entityType: "-", status: "success" }]}
              rowKey={(log) => log.id || log._id || `${log.action}-${log.createdAt}`}
              pageSize={6}
              columns={[
                { key: "createdAt", header: "Time", sortable: true, sortValue: (log) => new Date(log.createdAt).getTime(), render: (log) => <span className="whitespace-nowrap text-neutral-600">{new Date(log.createdAt).toLocaleString()}</span> },
                { key: "actorName", header: "Actor", sortable: true, render: (log) => <div><p className="font-semibold text-ink">{log.actorName}</p><p className="text-xs uppercase tracking-wider text-neutral-400">{log.actorRole}</p></div> },
                { key: "action", header: "Action", sortable: true, render: (log) => <span className="font-semibold text-ink">{log.action}</span> },
                { key: "entityType", header: "Entity", render: (log) => `${log.entityType || "-"} ${log.entityId || ""}` },
                { key: "status", header: "Status", sortable: true, render: (log) => <StatusPill status={log.status} /> }
              ]}
            />
          </div>
        </section>
      </section>
    );
  }

  if (activeTab === "Risk") {
    const rows = riskQueue.length ? riskQueue : [
      { hostId: "u-landlord", hostName: "Sara Malik", score: 43, label: "medium", recommendedAction: "Monitor messages and payouts", factors: [{ label: "Off-platform flags", value: 1 }] },
      { hostId: "u-owner", hostName: "Alex Rivera", score: 24, label: "low", recommendedAction: "Normal operations", factors: [{ label: "Verification tier", value: "property_verified" }] }
    ];

    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Host Risk Queue</h2>
          <p className="mt-2 text-sm text-slate-700">Scores combine disputes, cancellations, off-platform reports, and verification tier before payouts are released.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          {rows.map((risk) => (
            <article key={risk.hostId} className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold">{risk.hostName}</p>
                  <p className="mt-1 text-sm text-slate-700">{risk.hostId}</p>
                </div>
                <span className={`badge ${risk.label === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : risk.label === "medium" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-accent-50 text-accent-700"}`}>{risk.score}/100</span>
              </div>
              <p className="mt-5 text-sm font-semibold text-primary-800">{risk.recommendedAction}</p>
              <div className="mt-5 grid gap-2 text-sm text-slate-700">
                {(risk.factors || []).map((factor) => (
                  <div key={factor.label} className="flex justify-between gap-3 rounded-md bg-primary-50 px-3 py-2">
                    <span>{factor.label}</span>
                    <strong>{factor.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (activeTab === "Discounts") {
    const rows = discountRules.length ? discountRules : [
      { id: "disc-semester", name: "Semester Start Special", type: "SEASONAL", value: "10%", status: "ACTIVE", usageCount: 42 },
      { id: "disc-referral", name: "Referral Code HH-2026", type: "COUPON_CODE", value: "PKR 500", status: "ACTIVE", usageCount: 18 }
    ];
    return (
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Discount Rules</h2>
            <p className="mt-2 text-sm text-slate-700">Create and monitor seasonal, city, room type, coupon, and Host-funded discounts.</p>
          </div>
          <button type="button" className="btn-primary"><CirclePlus size={18} /> New Discount</button>
        </div>
        <div className="px-7 pb-7">
          <DataTable
            rows={rows.filter((discount) => matchesSearch(discount.name, discount.type, discount.status))}
            rowKey={(discount) => discount.id || discount._id || discount.name}
            pageSize={8}
            empty="No discount rules match your filter."
            columns={[
              { key: "name", header: "Name", sortable: true, render: (discount) => <span className="font-bold text-ink">{discount.name}</span> },
              { key: "type", header: "Type", sortable: true },
              { key: "value", header: "Value", render: (discount) => (discount.valueType === "PERCENTAGE" ? `${discount.value}%` : discount.value || discount.amountOff) },
              { key: "usageCount", header: "Usage", sortable: true, sortValue: (discount) => discount.usageCount || 0, render: (discount) => discount.usageCount || 0 },
              { key: "status", header: "Status", sortable: true, render: (discount) => <StatusPill status={discount.status} /> }
            ]}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
      <div>
        <h2 className="mb-5 text-2xl font-bold">Dispute Center</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {dashboard.disputes.map((item) => (
            <article key={item.id || item._id || item.title} className="panel p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className={`badge ${String(item.priority).toLowerCase().includes("high") ? "bg-[#FEE2E2] text-[#9B1C1C]" : "bg-primary-50 text-slate-700"}`}>{item.priority}</span>
                <span className="text-sm text-slate-700">{item.id || item._id}</span>
              </div>
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-3 text-slate-700">User: {item.user || item.student?.name || "Platform case"}</p>
              <div className="mt-7 flex items-center justify-between">
                <span>{item.status}</span>
                <button className="text-primary-800">-&gt;</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <form onSubmit={openDispute} className="panel h-fit p-7">
        <CirclePlus size={32} className="text-primary-800" />
        <h2 className="mt-4 text-xl font-bold">Open New Case</h2>
        <p className="mt-2 text-sm text-slate-700">Create a dispute record for refund, overlap, listing, or payment investigation.</p>
        <input className="input mt-5" value={disputeTitle} onChange={(event) => setDisputeTitle(event.target.value)} placeholder="Case title" />
        <button className="btn-primary mt-5 w-full" type="submit">Open Case</button>
      </form>
    </section>
  );
}
