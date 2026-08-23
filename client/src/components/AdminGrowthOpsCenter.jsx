import { useEffect, useState } from "react";
import { Activity, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, FileSearch, KeyRound, MapPin, PackageCheck, ReceiptText, ShieldCheck, Star, Users } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { ConfirmButton, StatusPill, DataTable, useToastBridge } from "./ui";

const currency = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

export function AdminGrowthOpsCenter() {
  const [manualPayments, setManualPayments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [ambassadors, setAmbassadors] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [apiPartners, setApiPartners] = useState([]);
  const [jobLogs, setJobLogs] = useState([]);
  const [visitForm, setVisitForm] = useState({ hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", scheduledFor: new Date().toISOString().slice(0, 10), priority: "high" });
  const [academicForm, setAcademicForm] = useState({ university: "NUST", city: "Islamabad", eventType: "semester_start", title: "Semester start demand boost", startDate: "2026-08-01", endDate: "2026-08-31" });
  const [partnerForm, setPartnerForm] = useState({ name: "Campus Deals API", email: "partner@campus.pk", tier: "DEVELOPER", dailyLimit: 500 });
  const [message, setMessage] = useState("");
  useToastBridge(message);

  const refresh = () => {
    safeRequest(() => api.get("/manual-payments/admin"), { results: [] }).then((result) => setManualPayments(result.results || []));
    safeRequest(() => api.get("/field-verification/visits"), { results: [] }).then((result) => setVisits(result.results || []));
    safeRequest(() => api.get("/subscriptions/admin"), { invoices: [] }).then((result) => setSubscriptions(result.invoices || []));
    safeRequest(() => api.get("/vendors/admin/orders"), { orders: [] }).then((result) => setVendorOrders(result.orders || []));
    safeRequest(() => api.get("/trust-ops/disputes/DIS-449/timeline"), { timeline: [] }).then((result) => setTimeline(result.timeline || result.events || []));
    safeRequest(() => api.get("/trust-ops/reviews/sentiment"), { sentiment: null }).then((result) => {
      setSentiment(result.sentiment || {
        positiveShare: result.score,
        averageTrust: result.score ? (result.score / 20).toFixed(1) : undefined,
        flaggedCount: result.flaggedReviews?.length,
        topics: result.topics || []
      });
    });
    safeRequest(() => api.get("/ambassadors/admin"), { results: [] }).then((result) => setAmbassadors(result.results || []));
    safeRequest(() => api.get("/academic-calendar"), { results: [] }).then((result) => setAcademicEvents(result.results || []));
    safeRequest(() => api.get("/api-marketplace/admin/partners"), { results: [] }).then((result) => setApiPartners(result.results || []));
    safeRequest(() => api.get("/operations/job-logs"), { results: [] }).then((result) => setJobLogs(result.results || []));
  };

  useEffect(() => {
    refresh();
  }, []);

  const reviewPayment = async (payment, status) => {
    const id = payment.id || payment._id || payment.reference;
    setMessage(`${status === "approved" ? "Approving" : "Rejecting"} ${payment.reference || id}...`);
    const result = await safeRequest(() => api.post(`/manual-payments/${id}/review`, { status, adminNote: "Reviewed from admin growth ops." }), {
      payment: { ...payment, status },
      demo: true
    });
    setManualPayments((current) => current.map((item) => ((item.id || item._id || item.reference) === id ? result.payment : item)));
    setMessage(result.demo ? "Manual payment reviewed in demo mode." : "Manual payment reviewed and ledger updated where applicable.");
  };

  const createVisit = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/field-verification/visits", visitForm), {
      visit: { id: `fv-${Date.now()}`, ...visitForm, status: "scheduled", checklist: [] },
      demo: true
    });
    setVisits((current) => [result.visit, ...current]);
    setMessage(result.demo ? "Field visit scheduled in demo mode." : "Field verification visit scheduled.");
  };

  const submitVisit = async (visit) => {
    const id = visit.id || visit._id;
    const result = await safeRequest(() => api.post(`/field-verification/visits/${id}/submit`, { decision: "approved", notes: "Photos, property proof, and occupancy checked." }), {
      visit: { ...visit, status: "approved" },
      demo: true
    });
    setVisits((current) => current.map((item) => ((item.id || item._id) === id ? result.visit : item)));
    setMessage(result.demo ? "Field visit submitted in demo mode." : "Field visit submitted.");
  };

  const reviewAmbassador = async (ambassador, status) => {
    const id = ambassador.id || ambassador._id;
    const result = await safeRequest(() => api.patch(`/ambassadors/admin/${id}`, { status, trustScore: status === "approved" ? 90 : ambassador.trustScore }), {
      ambassador: { ...ambassador, status },
      demo: true
    });
    setAmbassadors((current) => current.map((item) => ((item.id || item._id) === id ? result.ambassador : item)));
    setMessage(result.demo ? "Ambassador review saved in demo mode." : "Ambassador review saved.");
  };

  const saveAcademicEvent = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.put("/admin/academic-calendar", { ...academicForm, autoActions: ["Boost nearby listings", "Notify waitlisted students"] }), {
      event: { id: `acad-${Date.now()}`, ...academicForm, autoActions: ["Boost nearby listings", "Notify waitlisted students"] },
      demo: true
    });
    setAcademicEvents((current) => [result.event, ...current]);
    setMessage(result.demo ? "Academic event saved in demo mode." : "Academic event saved.");
  };

  const createApiPartner = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/api-marketplace/admin/partners", partnerForm), {
      partner: { id: `api-${Date.now()}`, ...partnerForm, status: "active" },
      demo: true
    });
    setApiPartners((current) => [result.partner, ...current]);
    setMessage(result.demo ? "API partner created in demo mode." : "API partner created.");
  };

  return (
    <section className="space-y-7">
      <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Banknote} label="Manual Review" value={manualPayments.length || 2} />
        <Metric icon={MapPin} label="Field Visits" value={visits.length || 1} />
        <Metric icon={ReceiptText} label="Host Invoices" value={subscriptions.length || 2} />
        <Metric icon={PackageCheck} label="Vendor Orders" value={vendorOrders.length || 1} />
        <Metric icon={Star} label="Sentiment" value={`${sentiment?.positiveShare || 84}%`} />
        <Metric icon={Users} label="Ambassadors" value={ambassadors.length || 2} />
      </div>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <div className="panel overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Banknote className="text-primary-800" /> Manual Payment Review</h2>
            <p className="mt-1 text-sm text-slate-700">Approve verified bank/JazzCash/Easypaisa payments and reject suspicious proof.</p>
          </div>
          <div className="px-6 pb-6">
            <DataTable
              rows={manualPayments.length ? manualPayments : [{ id: "mp-demo-1", reference: "HH-MAN-DEMO1", studentName: "Ali Ahmed", amount: 23500, status: "proof_submitted" }]}
              rowKey={(payment) => payment.id || payment._id || payment.reference}
              pageSize={6}
              empty="No manual payments to review."
              columns={[
                { key: "reference", header: "Reference", sortable: true, render: (payment) => <span className="font-bold text-ink">{payment.reference || payment.id || payment._id}</span> },
                { key: "studentName", header: "Student", sortable: true, render: (payment) => payment.studentName || payment.student?.name || "Student" },
                { key: "amount", header: "Amount", sortable: true, sortValue: (payment) => payment.amount || 0, render: (payment) => currency(payment.amount) },
                { key: "status", header: "Status", sortable: true, render: (payment) => <StatusPill status={payment.status} /> },
                { key: "actions", header: "Actions", render: (payment) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => reviewPayment(payment, "rejected")}>Reject</ConfirmButton>
                    <ConfirmButton className="btn-primary py-2" tone="primary" confirmLabel="Confirm payment" onConfirm={() => reviewPayment(payment, "approved")}>Approve</ConfirmButton>
                  </div>
                ) }
              ]}
            />
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><MapPin className="text-primary-800" /> Field Verification</h2>
          <form onSubmit={createVisit} className="mt-5 grid gap-4">
            <input className="input" value={visitForm.hostelName} onChange={(event) => setVisitForm((current) => ({ ...current, hostelName: event.target.value }))} placeholder="Hostel name" />
            <div className="grid gap-4 sm:grid-cols-3">
              <input className="input" value={visitForm.city} onChange={(event) => setVisitForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
              <input className="input" type="date" value={visitForm.scheduledFor} onChange={(event) => setVisitForm((current) => ({ ...current, scheduledFor: event.target.value }))} />
              <select className="input" value={visitForm.priority} onChange={(event) => setVisitForm((current) => ({ ...current, priority: event.target.value }))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
            </div>
            <button type="submit" className="btn-primary"><ClipboardCheck size={18} /> Schedule Visit</button>
          </form>
          <div className="mt-5 grid gap-3">
            {(visits.length ? visits : [{ id: "fv-demo", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", status: "scheduled", priority: "high" }]).slice(0, 4).map((visit) => (
              <article key={visit.id || visit._id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-bold">{visit.hostelName}</p><p className="text-sm text-slate-700">{visit.city} - {visit.priority}</p></div>
                  <span className="badge bg-primary-50 text-primary-800">{visit.status}</span>
                </div>
                <button type="button" className="btn-secondary mt-4 w-full py-2" onClick={() => submitVisit(visit)}><BadgeCheck size={16} /> Submit Approved Visit</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-3">
        <PanelList
          icon={ReceiptText}
          title="Host Management Fees"
          rows={(subscriptions.length ? subscriptions : [{ id: "sub-demo-1", hostName: "Sara Malik", period: "2026-06", plan: "STARTER", amount: 1000, status: "issued" }]).slice(0, 4).map((invoice) => ({
            id: invoice.id || invoice._id,
            title: invoice.hostName || invoice.host?.name || "Host",
            meta: `${invoice.period} - ${invoice.plan}`,
            value: currency(invoice.amount),
            status: invoice.status
          }))}
        />
        <PanelList
          icon={PackageCheck}
          title="Vendor Orders"
          rows={(vendorOrders.length ? vendorOrders : [{ id: "vo-demo", vendorName: "Campus Laundry Express", service: "Wash & fold", amount: 900, status: "requested" }]).slice(0, 4).map((order) => ({
            id: order.id || order._id,
            title: order.vendorName,
            meta: order.service,
            value: currency(order.amount),
            status: order.status
          }))}
        />
        <PanelList
          icon={FileSearch}
          title="Dispute Timeline"
          rows={(timeline.length ? timeline : [{ id: "tl-1", title: "Case opened", actor: "Student", status: "logged" }, { id: "tl-2", title: "Host response requested", actor: "Admin", status: "pending" }]).map((item) => ({
            id: item.id || item._id || item.title,
            title: item.title,
            meta: item.actor || "System",
            value: String(item.createdAt || item.at || "").slice(0, 10),
            status: item.status || item.type
          }))}
        />
      </section>

      <section className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="text-primary-800" /> Review Sentiment</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric icon={Star} label="Positive" value={`${sentiment?.positiveShare || 84}%`} />
            <Metric icon={FileSearch} label="Needs Review" value={sentiment?.flaggedCount || 3} />
            <Metric icon={BadgeCheck} label="Avg Trust" value={sentiment?.averageTrust || 4.6} />
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-700">Use sentiment and flag counts to prioritize hostel audits, review moderation, and owner coaching.</p>
        </div>

        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Users className="text-primary-800" /> Campus Ambassadors</h2>
          <div className="mt-5 grid gap-3">
            {(ambassadors.length ? ambassadors : [{ id: "amb-demo", name: "Ayesha Khan", university: "NUST", city: "Islamabad", status: "applied", trustScore: 70 }]).slice(0, 5).map((ambassador) => (
              <article key={ambassador.id || ambassador._id || ambassador.email} className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-bold">{ambassador.name}</p>
                  <p className="text-sm text-slate-700">{ambassador.university} - {ambassador.city} - score {ambassador.trustScore || 70}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Reject" onConfirm={() => reviewAmbassador(ambassador, "rejected")}>Reject</ConfirmButton>
                  <button type="button" className="btn-primary py-2" onClick={() => reviewAmbassador(ambassador, "approved")}>Approve</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays className="text-primary-800" /> Academic calendar intelligence</h2>
          <form onSubmit={saveAcademicEvent} className="mt-5 grid gap-4 md:grid-cols-3">
            <input className="input" value={academicForm.university} onChange={(event) => setAcademicForm((current) => ({ ...current, university: event.target.value }))} placeholder="University" />
            <input className="input" value={academicForm.city} onChange={(event) => setAcademicForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
            <select className="input" value={academicForm.eventType} onChange={(event) => setAcademicForm((current) => ({ ...current, eventType: event.target.value }))}><option value="semester_start">Semester start</option><option value="exam_season">Exam season</option><option value="eid_break">Eid break</option><option value="custom">Custom</option></select>
            <input className="input md:col-span-3" value={academicForm.title} onChange={(event) => setAcademicForm((current) => ({ ...current, title: event.target.value }))} placeholder="Event title" />
            <input className="input" type="date" value={academicForm.startDate} onChange={(event) => setAcademicForm((current) => ({ ...current, startDate: event.target.value }))} />
            <input className="input" type="date" value={academicForm.endDate} onChange={(event) => setAcademicForm((current) => ({ ...current, endDate: event.target.value }))} />
            <button className="btn-primary" type="submit"><CalendarDays size={18} /> Save Event</button>
          </form>
          <div className="mt-5 grid gap-3">
            {(academicEvents.length ? academicEvents : [{ id: "acad-demo", university: "NUST", city: "Islamabad", title: "Semester Start Campaign", eventType: "semester_start" }]).slice(0, 4).map((item) => (
              <article key={item.id || item._id || item.title} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{item.title}</p><p className="text-sm text-slate-700">{item.university} - {item.city}</p></div><span className="badge bg-primary-50 text-primary-800">{item.eventType}</span></div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><KeyRound className="text-primary-800" /> API marketplace</h2>
          <form onSubmit={createApiPartner} className="mt-5 grid gap-4">
            <input className="input" value={partnerForm.name} onChange={(event) => setPartnerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Partner name" />
            <input className="input" value={partnerForm.email} onChange={(event) => setPartnerForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
            <div className="grid gap-4 sm:grid-cols-2">
              <select className="input" value={partnerForm.tier} onChange={(event) => setPartnerForm((current) => ({ ...current, tier: event.target.value }))}><option value="FREE">Free</option><option value="DEVELOPER">Developer</option><option value="ENTERPRISE">Enterprise</option></select>
              <input className="input" type="number" value={partnerForm.dailyLimit} onChange={(event) => setPartnerForm((current) => ({ ...current, dailyLimit: Number(event.target.value) }))} />
            </div>
            <button className="btn-primary" type="submit"><KeyRound size={18} /> Create API Partner</button>
          </form>
          <div className="mt-5 grid gap-3">
            {(apiPartners.length ? apiPartners : [{ id: "api-demo", name: "Campus Deals API", email: "partner@campus.pk", tier: "DEVELOPER", status: "active" }]).slice(0, 3).map((partner) => (
              <article key={partner.id || partner._id || partner.email} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{partner.name}</p><p className="text-sm text-slate-700">{partner.email}</p></div><span className="badge bg-accent-50 text-accent-700">{partner.tier}</span></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Activity className="text-primary-800" /> Batch job logs</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(jobLogs.length ? jobLogs : [{ id: "job-demo-1", name: "rent-reminders", status: "success", processed: 42 }, { id: "job-demo-2", name: "escrow-release", status: "success", processed: 6 }]).slice(0, 6).map((job) => (
            <article key={job.id || job._id || job.name} className="rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-bold">{job.name}</p><span className="badge bg-primary-50 text-primary-800">{job.status}</span></div>
              <p className="mt-3 text-sm text-slate-700">Processed {job.processed || 0}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <Icon className="text-primary-800" size={20} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </article>
  );
}

function PanelList({ icon: Icon, title, rows }) {
  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Icon className="text-primary-800" /> {title}</h2>
      <div className="mt-5 grid gap-3">
        {rows.map((row) => (
          <article key={row.id || row.title} className="rounded-lg border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{row.title}</p>
                <p className="text-sm text-slate-700">{row.meta}</p>
              </div>
              <span className="badge bg-primary-50 text-primary-800">{row.status}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-primary-800">{row.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
