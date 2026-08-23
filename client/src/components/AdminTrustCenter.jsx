import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileSearch, Gavel, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { StatTile, StatGrid } from "./ui";
import { currency } from "../utils/formatters";

const fallbackTrust = {
  results: [
    { id: "kyc-1", type: "kyc", title: "The Grand Oak Residency", severity: "medium", status: "pending", reason: "Host verification documents need review." },
    { id: "chat-flag-1", type: "chat", title: "Possible direct payment request", severity: "high", status: "pending", reason: "Chat contained off-platform wording." },
    { id: "off-platform-1", type: "off_platform_report", title: "Student report", severity: "critical", status: "pending", reason: "Host requested direct JazzCash transfer." }
  ]
};

const fallbackIncidents = {
  results: [
    { id: "inc-1", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", category: "access", severity: "medium", status: "investigating", title: "Street access restriction", description: "Temporary access closure near main gate." },
    { id: "inc-2", hostelName: "Gulberg Elite Home", city: "Lahore", category: "maintenance", severity: "low", status: "resolved", title: "Generator outage", description: "Resolved by Host within SLA." }
  ]
};

const fallbackRules = {
  results: [
    { id: "rule-contact", ruleKey: "contact_leak_block", label: "Block contact leaks", description: "Reject phone/email/WhatsApp in listings and chat.", enabled: true, severity: "high" },
    { id: "rule-payout", ruleKey: "payout_hold_dispute", label: "Hold payout on dispute", description: "Block Host payout while dispute is open.", enabled: true, severity: "critical" },
    { id: "rule-late", ruleKey: "late_rent_escalation", label: "Escalate late rent", description: "Create reminder and late-fee review after configured days.", enabled: true, severity: "medium" }
  ]
};

const fallbackScorecard = {
  results: [
    { city: "Islamabad", supplyScore: 86, demandScore: 82, universityCount: 8, averageRent: 21000, verifiedHostCoverage: 72, paidBookings: 160, launchReadiness: 84 },
    { city: "Lahore", supplyScore: 78, demandScore: 77, universityCount: 7, averageRent: 19800, verifiedHostCoverage: 66, paidBookings: 125, launchReadiness: 77 },
    { city: "Karachi", supplyScore: 70, demandScore: 72, universityCount: 6, averageRent: 18600, verifiedHostCoverage: 60, paidBookings: 90, launchReadiness: 70 }
  ]
};

const fallbackAnomaly = {
  anomalies: [
    { id: "anomaly-duplicate", severity: "medium", title: "Possible duplicate payment", amount: 23500, recommendation: "Check webhook idempotency before payout." },
    { id: "anomaly-payout", severity: "high", title: "Payout mismatch", amount: 74000, recommendation: "Hold payout until account title is verified." }
  ],
  confidence: 0.73
};

const fallbackModeration = {
  reasons: [
    { type: "contact_leak", evidence: "Detected phone-like pattern", confidence: 0.92 },
    { type: "payment_leak", evidence: "Contains direct transfer language", confidence: 0.81 }
  ],
  recommendedAction: "Reject or request edit before publishing."
};

const severityClass = (severity) => {
  if (severity === "critical" || severity === "high") return "bg-[#FEE2E2] text-[#991B1B]";
  if (severity === "medium") return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-primary-50 text-primary-800";
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

export function AdminTrustCenter() {
  const [trustQueue, setTrustQueue] = useState(fallbackTrust.results);
  const [incidents, setIncidents] = useState(fallbackIncidents.results);
  const [rules, setRules] = useState(fallbackRules.results);
  const [scorecard, setScorecard] = useState(fallbackScorecard.results);
  const [anomalies, setAnomalies] = useState(fallbackAnomaly.anomalies);
  const [moderation, setModeration] = useState(fallbackModeration);
  const [visitPlan, setVisitPlan] = useState([]);
  const [disputeSummary, setDisputeSummary] = useState(null);
  const [reviewClassification, setReviewClassification] = useState(null);
  const [incidentForm, setIncidentForm] = useState({ title: "Hostel circular investigation", hostelName: "Cozy Boys Hostel F-10", city: "Islamabad", category: "access", severity: "medium", description: "Students reported a temporary access issue near the main gate." });
  const [message, setMessage] = useState("");

  const highRiskCount = useMemo(() => trustQueue.filter((item) => ["critical", "high"].includes(item.severity)).length, [trustQueue]);

  const loadTrust = () => {
    safeRequest(() => api.get("/admin/trust-queue"), fallbackTrust).then((result) => setTrustQueue(result.results || fallbackTrust.results));
    safeRequest(() => api.get("/admin/safety/incidents"), fallbackIncidents).then((result) => setIncidents(result.results || fallbackIncidents.results));
    safeRequest(() => api.get("/admin/policy-rules"), fallbackRules).then((result) => setRules(result.results || fallbackRules.results));
    safeRequest(() => api.get("/admin/city-scorecard"), fallbackScorecard).then((result) => setScorecard(result.results || fallbackScorecard.results));
    safeRequest(() => api.post("/ai/finance/anomaly", { window: "30d" }), fallbackAnomaly).then((result) => setAnomalies(result.anomalies || fallbackAnomaly.anomalies));
  };

  useEffect(() => {
    loadTrust();
  }, []);

  const createIncident = async (event) => {
    event.preventDefault();
    setMessage("Creating safety incident...");
    const result = await safeRequest(() => api.post("/admin/safety/incidents", incidentForm), { incident: { id: `inc-${Date.now()}`, ...incidentForm, status: "open" }, demo: true });
    setIncidents((current) => [result.incident, ...current]);
    setMessage(result.demo ? "Safety incident created in demo mode." : "Safety incident created.");
  };

  const toggleRule = async (rule) => {
    setMessage(`${rule.enabled ? "Disabling" : "Enabling"} ${rule.label}...`);
    const result = await safeRequest(() => api.patch(`/admin/policy-rules/${rule.ruleKey}`, { enabled: !rule.enabled }), { rule: { ...rule, enabled: !rule.enabled }, demo: true });
    setRules((current) => current.map((item) => (item.ruleKey === rule.ruleKey ? result.rule : item)));
    setMessage(result.demo ? "Policy rule updated in demo mode." : "Policy rule updated.");
  };

  const explainModeration = async () => {
    setMessage("Explaining moderation case...");
    const result = await safeRequest(() => api.get("/admin/moderation/chat-flag-1/explain"), fallbackModeration);
    setModeration(result || fallbackModeration);
    setMessage(result.demo ? "Moderation explanation loaded in demo mode." : "Moderation explanation loaded.");
  };

  const planVisits = async () => {
    setMessage("Planning verification visits...");
    const result = await safeRequest(() => api.post("/admin/verification-visits", { hostelIds: ["h1", "h2"], assignedTo: "Field Officer" }), { visits: [], demo: true });
    setVisitPlan(result.visits || []);
    setMessage(result.demo ? "Verification visit plan created in demo mode." : "Verification visit plan created.");
  };

  const summarizeDispute = async () => {
    setMessage("Summarizing dispute...");
    const result = await safeRequest(() => api.post("/ai/disputes/DIS-449/summary"), {
      summary: {
        disputeId: "DIS-449",
        brief: "Student reported possible off-platform payment request. Keep payout blocked until admin review.",
        evidence: ["booking_payment", "chat_flag", "student_report"],
        recommendedDecision: "Request Host response and keep payout on hold."
      },
      demo: true
    });
    setDisputeSummary(result.summary);
    setMessage(result.demo ? "Dispute summary loaded in fallback mode." : "Dispute summary loaded.");
  };

  const classifyReview = async () => {
    setMessage("Classifying review...");
    const result = await safeRequest(() => api.post("/ai/reviews/classify", { reviewId: "review-demo", text: "The hostel matched the photos and the host responded quickly." }), {
      classification: "likely_valid",
      reasons: ["Contains stay-specific details"],
      confidence: 0.81,
      moderationAction: "approve",
      demo: true
    });
    setReviewClassification(result);
    setMessage(result.demo ? "Review classification loaded in fallback mode." : "Review classification loaded.");
  };

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><ShieldCheck size={16} /> Trust and safety center</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Verification, Incidents, Policy Rules, and AI Review</h2>
          <p className="mt-2 max-w-3xl text-slate-700">Admin-grade queue for KYC, contact leaks, off-platform payment reports, safety incidents, moderation explainability, and city launch confidence.</p>
        </div>
        <button type="button" onClick={loadTrust} className="btn-secondary">Refresh Trust Data</button>
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <StatGrid columns={3}>
        <StatTile icon={ShieldCheck} label="Trust Queue" value={trustQueue.length} tone="blue" hint={`${highRiskCount} high-risk items need admin action.`} />
        <StatTile icon={AlertTriangle} label="Safety Incidents" value={incidents.length} tone="amber" hint="Student, host, and admin reported incidents." />
        <StatTile icon={Sparkles} label="AI Anomalies" value={anomalies.length} tone="red" hint="Human approval required before payout action." />
      </StatGrid>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Trust Queue</h3>
              <p className="mt-1 text-sm text-slate-700">Verification, chat, listing, and off-platform payment cases.</p>
            </div>
            <button type="button" onClick={explainModeration} className="btn-secondary"><FileSearch size={16} /> Explain Case</button>
          </div>
          <div className="mt-5 grid gap-4">
            {trustQueue.map((item) => (
              <article key={item.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{item.reason}</p>
                  </div>
                  <span className={`badge ${severityClass(item.severity)}`}>{item.severity}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">{item.type}</span>
                  <span className="chip">{item.status}</span>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={20} /> Moderation Explainability</h3>
          <div className="mt-5 grid gap-3">
            {(moderation.reasons || []).map((reason) => (
              <div key={reason.type} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{reason.type.replace("_", " ")}</p>
                  <span className="badge bg-primary-50 text-primary-800">{Math.round(Number(reason.confidence || 0) * 100)}%</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{reason.evidence}</p>
              </div>
            ))}
            <p className="rounded-lg bg-primary-50 p-4 text-sm font-semibold text-primary-800">{moderation.recommendedAction}</p>
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={createIncident} className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle size={20} /> Incident Timeline</h3>
          <div className="mt-5 grid gap-4">
            <input className="input" value={incidentForm.title} onChange={(event) => setIncidentForm((current) => ({ ...current, title: event.target.value }))} placeholder="Incident title" />
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="input" value={incidentForm.hostelName} onChange={(event) => setIncidentForm((current) => ({ ...current, hostelName: event.target.value }))} placeholder="Hostel name" />
              <select className="input" value={incidentForm.severity} onChange={(event) => setIncidentForm((current) => ({ ...current, severity: event.target.value }))}>
                <option>low</option>
                <option>medium</option>
                <option>high</option>
                <option>critical</option>
              </select>
            </div>
            <textarea className="input min-h-28" value={incidentForm.description} onChange={(event) => setIncidentForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <button type="submit" className="btn-primary mt-5 w-full">Create Incident</button>
        </form>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Active Incidents</h3>
          <div className="mt-5 grid gap-4">
            {incidents.map((incident) => (
              <div key={incident.id || incident._id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{incident.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{incident.hostelName} - {incident.city}</p>
                  </div>
                  <span className={`badge ${severityClass(incident.severity)}`}>{incident.status || incident.severity}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{incident.description}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardCheck size={20} /> Policy Rules</h3>
          <div className="mt-5 grid gap-4">
            {rules.map((rule) => (
              <div key={rule.ruleKey} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{rule.label}</p>
                    <p className="mt-1 text-sm text-slate-700">{rule.description}</p>
                  </div>
                  <button type="button" onClick={() => toggleRule(rule)} className={`badge ${rule.enabled ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned size={20} /> Verification Visit Planner</h3>
              <p className="mt-1 text-sm text-slate-700">Route field visits by priority score and city coverage.</p>
            </div>
            <button type="button" onClick={planVisits} className="btn-secondary">Plan Visits</button>
          </div>
          <div className="mt-5 grid gap-3">
            {(visitPlan.length ? visitPlan : [{ id: "field-demo", hostelName: "No visit plan yet", city: "Click Plan Visits", priorityScore: 0, routeOrder: "-" }]).map((visit) => (
              <div key={visit.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{visit.hostelName}</p>
                  <span className="badge bg-primary-50 text-primary-800">#{visit.routeOrder}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{visit.city} - priority {visit.priorityScore}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="panel p-6">
          <h3 className="flex items-center gap-2 text-xl font-bold"><Gavel size={20} /> AI Admin Assistants</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={summarizeDispute} className="btn-secondary">Summarize Dispute</button>
            <button type="button" onClick={classifyReview} className="btn-secondary">Classify Review</button>
          </div>
          {disputeSummary && (
            <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">Dispute {disputeSummary.disputeId}</p>
              <p className="mt-2 text-sm text-slate-700">{disputeSummary.brief}</p>
              <p className="mt-2 text-sm font-semibold text-primary-800">{disputeSummary.recommendedDecision}</p>
            </div>
          )}
          {reviewClassification && (
            <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
              <p className="font-bold">Review: {reviewClassification.classification}</p>
              <p className="mt-2 text-sm text-slate-700">{(reviewClassification.reasons || []).join(", ")}</p>
              <p className="mt-2 text-sm font-semibold text-primary-800">Action: {reviewClassification.moderationAction}</p>
            </div>
          )}
        </article>

        <article className="panel p-6">
          <h3 className="text-xl font-bold">Finance Anomaly Detector</h3>
          <div className="mt-5 grid gap-4">
            {anomalies.map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-canvas p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{item.recommendation}</p>
                  </div>
                  <span className={`badge ${severityClass(item.severity)}`}>{item.severity}</span>
                </div>
                <p className="mt-3 text-lg font-extrabold text-primary-800">{currency(item.amount)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel p-6">
        <h3 className="text-xl font-bold">City Scorecard</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {scorecard.map((city) => (
            <article key={city.city} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{city.city}</p>
                  <p className="mt-1 text-sm text-slate-700">{city.universityCount} universities</p>
                </div>
                <span className="badge bg-accent-50 text-accent-700"><CheckCircle2 size={14} /> {city.launchReadiness}%</span>
              </div>
              <div className="mt-4 grid gap-3">
                <ScoreBar label="Supply" value={city.supplyScore} />
                <ScoreBar label="Demand" value={city.demandScore} />
                <ScoreBar label="Verified" value={city.verifiedHostCoverage} />
              </div>
              <p className="mt-4 text-sm font-semibold text-primary-800">Avg rent {currency(city.averageRent)} - {city.paidBookings} bookings</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
