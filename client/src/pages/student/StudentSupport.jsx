import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy, ShieldAlert, ShieldCheck, Star, Wrench } from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const fallbackProfile = {
  name: "Ali Ahmed",
  city: "Islamabad",
  university: "NUST",
  emergencyContact: {
    name: "Ahmed Khan",
    relationship: "Father",
    phone: "+923001112222",
    city: "Rawalpindi"
  },
  guardianConsent: { required: false, accepted: true }
};

const fallbackTickets = [
  {
    id: "MT-DEMO-1",
    title: "WiFi speed drops after 9 PM",
    hostelName: "Cozy Boys Hostel F-10",
    roomNumber: "204",
    priority: "medium",
    status: "in_progress",
    slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
];

export function StudentSupport() {
  useDocumentTitle("Safety & Support | Basera");
  const [profile, setProfile] = useState(fallbackProfile);
  const [alerts, setAlerts] = useState([]);
  const [tickets, setTickets] = useState(fallbackTickets);
  const [message, setMessage] = useState("");
  const [refundPreview, setRefundPreview] = useState(null);
  const [ratingForms, setRatingForms] = useState({});
  const [ticketForm, setTicketForm] = useState({
    title: "",
    description: "",
    category: "wifi",
    priority: "medium"
  });

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/student/profile"), { profile: fallbackProfile }).then((result) => {
      const nextProfile = result.profile || fallbackProfile;
      setProfile(nextProfile);
      safeRequest(
        () => api.get("/alerts/active", { params: { audience: "students", city: nextProfile.city, university: nextProfile.university } }),
        { results: [] }
      ).then((alertsResult) => setAlerts(alertsResult.results || []));
    });
    safeRequest(() => api.get("/maintenance/my"), { results: fallbackTickets }).then((result) => setTickets(result.results || fallbackTickets));
    safeRequest(() => api.get("/bookings/b1/cancellation-preview"), { preview: null }).then((result) => setRefundPreview(result.preview));
  }, []);

  const updateEmergency = (field) => (event) => {
    setProfile((current) => ({
      ...current,
      emergencyContact: {
        ...(current.emergencyContact || {}),
        [field]: event.target.value
      }
    }));
  };

  const saveEmergency = async (event) => {
    event.preventDefault();
    setMessage("Saving emergency contact...");
    const result = await safeRequest(() => api.put("/dashboard/student/profile", profile), { profile, saved: true, demo: true });
    setProfile(result.profile || profile);
    setMessage(result.demo ? "Emergency contact saved in demo mode." : "Emergency contact saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  const submitTicket = async (event) => {
    event.preventDefault();
    if (!ticketForm.title.trim() || !ticketForm.description.trim()) {
      setMessage("Ticket title and description are required.");
      return;
    }
    setMessage("Creating maintenance ticket...");
    const result = await safeRequest(() => api.post("/maintenance", ticketForm), {
      ticket: { id: `MT-${Date.now()}`, ...ticketForm, hostelName: "Cozy Boys Hostel F-10", roomNumber: "204", status: "open", slaDueAt: new Date(Date.now() + 86400000).toISOString() },
      demo: true
    });
    setTickets((current) => [result.ticket, ...current]);
    setTicketForm({ title: "", description: "", category: "wifi", priority: "medium" });
    setMessage(result.demo ? "Ticket created in demo mode." : "Ticket created and sent to the Host.");
    setTimeout(() => setMessage(""), 2800);
  };

  const closeTicket = async (ticket) => {
    setMessage("Closing ticket...");
    const result = await safeRequest(() => api.put(`/maintenance/${ticket.id || ticket._id}/status`, { status: "closed", note: "Closed by student" }), {
      ticket: { ...ticket, status: "closed" },
      demo: true
    });
    setTickets((current) => current.map((item) => ((item.id || item._id) === (ticket.id || ticket._id) ? result.ticket : item)));
    setMessage(result.demo ? "Ticket closed in demo mode." : "Ticket closed.");
    setTimeout(() => setMessage(""), 2500);
  };

  const updateRatingForm = (ticketId, patch) => {
    setRatingForms((current) => ({
      ...current,
      [ticketId]: {
        rating: current[ticketId]?.rating || 5,
        comment: current[ticketId]?.comment || "",
        ...patch
      }
    }));
  };

  const rateTicket = async (ticket) => {
    const ticketId = ticket.id || ticket._id;
    const form = ratingForms[ticketId] || { rating: 5, comment: "" };
    setMessage("Saving ticket satisfaction rating...");
    const result = await safeRequest(() => api.post(`/maintenance/${ticketId}/rating`, form), {
      ticket: { ...ticket, satisfaction: { ...form, submittedAt: new Date().toISOString() } },
      demo: true
    });
    setTickets((current) => current.map((item) => ((item.id || item._id) === ticketId ? result.ticket : item)));
    setMessage(result.demo ? "Satisfaction rating saved in demo mode." : "Satisfaction rating saved.");
    setTimeout(() => setMessage(""), 2500);
  };

  const acknowledgeAlert = async (alert) => {
    setMessage("Acknowledging alert...");
    const result = await safeRequest(() => api.post(`/alerts/${alert.id || alert._id}/ack`, { channel: "student_support" }), { acknowledged: true, demo: true });
    setAlerts((current) => current.map((item) => ((item.id || item._id) === (alert.id || alert._id) ? { ...item, acknowledged: true } : item)));
    setMessage(result.demo ? "Alert acknowledged in demo mode." : "Alert acknowledged.");
    setTimeout(() => setMessage(""), 2400);
  };

  return (
    <>
      <Helmet>
        <title>Safety & Support | Basera</title>
      </Helmet>

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Safety & Support</h2>
          <p className="mt-2 text-neutral-700">Maintenance, emergency contacts, alerts, and refund transparency in one place.</p>
        </div>
        <span className="badge bg-accent-50 text-accent-700">
          <ShieldCheck size={16} /> Student protection active
        </span>
      </div>

      {message && <p className="mb-6 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <section className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert size={22} /> Important Alerts</h3>
                <p className="mt-2 text-sm text-slate-700">Targeted by your city, university, hostel, or published globally by admin.</p>
              </div>
              <span className="chip">{alerts.length} active</span>
            </div>
            <div className="mt-5 grid gap-4">
              {(alerts.length ? alerts : [{ id: "empty-alert", title: "No critical alerts", message: "There are no active alerts for your profile right now.", severity: "info", acknowledged: true }]).map((alert) => (
                <article key={alert.id || alert._id} className={`rounded-lg border p-4 ${alert.severity === "critical" ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-line bg-canvas"}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${alert.severity === "critical" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{alert.severity}</span>
                        {alert.city && <span className="chip">{alert.city}</span>}
                        {alert.university && <span className="chip">{alert.university}</span>}
                      </div>
                      <h4 className="mt-3 text-lg font-bold">{alert.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{alert.message}</p>
                    </div>
                    {alert.ackRequired && !alert.acknowledged && (
                      <button type="button" className="btn-primary py-2" onClick={() => acknowledgeAlert(alert)}>
                        <CheckCircle2 size={16} /> Acknowledge
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold"><Wrench size={22} /> Maintenance Tickets</h3>
              <p className="mt-2 text-sm text-slate-700">Track repairs with SLA timing and Host updates.</p>
            </div>
            <div className="grid gap-4 p-5">
              {tickets.map((ticket) => (
                <article key={ticket.id || ticket._id} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${ticket.priority === "urgent" || ticket.priority === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{ticket.priority}</span>
                        <span className="chip">{ticket.status}</span>
                      </div>
                      <h4 className="mt-3 text-lg font-bold">{ticket.title}</h4>
                      <p className="mt-1 text-sm text-slate-700">{ticket.hostelName} - Room {ticket.roomNumber}</p>
                      <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                        <Clock size={14} /> SLA {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : "scheduled"}
                      </p>
                    </div>
                    {ticket.status !== "closed" && (
                      <button type="button" className="btn-secondary py-2" onClick={() => closeTicket(ticket)}>
                        Mark Closed
                      </button>
                    )}
                  </div>
                  {ticket.satisfaction?.rating ? (
                    <div className="mt-4 rounded-lg border border-line bg-white p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-accent-700"><Star size={16} /> Rated {ticket.satisfaction.rating}/5</p>
                      {ticket.satisfaction.comment && <p className="mt-2 text-sm text-slate-700">{ticket.satisfaction.comment}</p>}
                    </div>
                  ) : ["closed", "resolved"].includes(ticket.status) ? (
                    <div className="mt-4 rounded-lg border border-line bg-white p-4">
                      <p className="text-sm font-semibold text-slate-700">Rate complaint resolution</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => updateRatingForm(ticket.id || ticket._id, { rating })}
                            className={`rounded-md border px-3 py-2 text-sm font-semibold ${Number(ratingForms[ticket.id || ticket._id]?.rating || 5) === rating ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-surface text-slate-700"}`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="input mt-3 min-h-20 resize-none"
                        value={ratingForms[ticket.id || ticket._id]?.comment || ""}
                        onChange={(event) => updateRatingForm(ticket.id || ticket._id, { comment: event.target.value })}
                        placeholder="Optional feedback for Basera and the Host"
                      />
                      <button type="button" className="btn-primary mt-3 py-2" onClick={() => rateTicket(ticket)}>
                        Submit Rating
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6">
          <form onSubmit={submitTicket} className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><LifeBuoy size={22} /> Raise Support Ticket</h3>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Issue title
                <input className="input" value={ticketForm.title} onChange={(event) => setTicketForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. AC not cooling" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Category
                  <select className="input" value={ticketForm.category} onChange={(event) => setTicketForm((current) => ({ ...current, category: event.target.value }))}>
                    {["plumbing", "electricity", "wifi", "cleaning", "food", "security", "furniture", "other"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Priority
                  <select className="input" value={ticketForm.priority} onChange={(event) => setTicketForm((current) => ({ ...current, priority: event.target.value }))}>
                    {["low", "medium", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Description
                <textarea className="input min-h-28 resize-none" value={ticketForm.description} onChange={(event) => setTicketForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <button type="submit" className="btn-primary">Create Ticket</button>
            </div>
          </form>

          <form onSubmit={saveEmergency} className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={22} /> Emergency Contact</h3>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Name<input className="input" value={profile.emergencyContact?.name || ""} onChange={updateEmergency("name")} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Relationship<input className="input" value={profile.emergencyContact?.relationship || ""} onChange={updateEmergency("relationship")} /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Phone<input className="input" value={profile.emergencyContact?.phone || ""} onChange={updateEmergency("phone")} /></label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">City<input className="input" value={profile.emergencyContact?.city || ""} onChange={updateEmergency("city")} /></label>
              <button className="btn-secondary" type="submit">Save Emergency Contact</button>
            </div>
          </form>

          <section className="panel p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle size={22} /> Cancellation Preview</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">Students can see refund outcomes before cancelling a booking.</p>
            <div className="mt-5 grid gap-3 rounded-lg border border-line bg-canvas p-4">
              <div className="flex justify-between gap-3"><span>Refund amount</span><strong className="text-primary-800">PKR {Number(refundPreview?.refundAmount || 0).toLocaleString("en-PK")}</strong></div>
              <div className="flex justify-between gap-3"><span>Non-refundable</span><strong>PKR {Number(refundPreview?.nonRefundableAmount || 0).toLocaleString("en-PK")}</strong></div>
              <p className="text-sm text-slate-700">{refundPreview?.policyLabel || "Policy preview will appear after loading."}</p>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
