import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Lock, Unlock, UserRound, Wrench } from "lucide-react";
import { api, safeRequest } from "../services/api";

const fallbackTickets = [
  { id: "MT-DEMO-1", title: "WiFi speed drops after 9 PM", hostelName: "Cozy Boys Hostel F-10", roomNumber: "204", priority: "medium", status: "in_progress" },
  { id: "MT-DEMO-2", title: "Washroom tap leakage", hostelName: "Cozy Boys Hostel F-10", roomNumber: "101", priority: "low", status: "open" }
];

export function MaintenancePanel({ title = "Maintenance Operations" }) {
  const [tickets, setTickets] = useState(fallbackTickets);
  const [notice, setNotice] = useState("");
  const [blockForm, setBlockForm] = useState({
    roomId: "r3",
    bedIndex: 4,
    from: "2026-06-08",
    to: "2026-06-11",
    reason: "deep_cleaning",
    note: ""
  });
  const [calendar, setCalendar] = useState([]);
  const [activeHolds, setActiveHolds] = useState([]);

  const loadCalendar = async (roomId) => {
    const nextCalendar = await safeRequest(() => api.get(`/rooms/${roomId}/availability-calendar`, { params: { days: 7 } }), { calendar: [] });
    setCalendar(nextCalendar.calendar || []);
  };

  const loadActiveHolds = async (roomId) => {
    const result = await safeRequest(() => api.get(`/rooms/${roomId}/bed-blocks`, { params: { status: "active" } }), { results: [] });
    setActiveHolds(result.results || []);
  };

  useEffect(() => {
    safeRequest(() => api.get("/maintenance/my"), { results: fallbackTickets }).then((result) => setTickets(result.results || fallbackTickets));
    loadCalendar(blockForm.roomId);
    loadActiveHolds(blockForm.roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (ticket, status) => {
    setNotice(`Updating ticket to ${status}...`);
    const result = await safeRequest(() => api.put(`/maintenance/${ticket.id || ticket._id}/status`, { status, note: `Host marked ${status}` }), {
      ticket: { ...ticket, status },
      demo: true
    });
    setTickets((current) => current.map((item) => ((item.id || item._id) === (ticket.id || ticket._id) ? result.ticket : item)));
    setNotice(result.demo ? "Ticket updated in demo mode." : "Ticket updated.");
    setTimeout(() => setNotice(""), 2400);
  };

  const submitBedBlock = async (payload, successMessage) => {
    const result = await safeRequest(() => api.post(`/rooms/${blockForm.roomId}/bed-blocks`, payload), { block: { id: `BB-${Date.now()}`, room: blockForm.roomId, ...payload }, demo: true });
    await loadCalendar(blockForm.roomId);
    await loadActiveHolds(blockForm.roomId);
    setNotice(result.demo ? `${successMessage} (demo mode).` : successMessage);
    setTimeout(() => setNotice(""), 2600);
  };

  const createBedBlock = async (event) => {
    event.preventDefault();
    setNotice("Creating bed hold...");
    await submitBedBlock(
      { bedIndex: Number(blockForm.bedIndex), from: blockForm.from, to: blockForm.to, reason: blockForm.reason, note: blockForm.note },
      "Bed hold created."
    );
  };

  // The manual seat-booked-offline override reuses the exact same bed-block mechanism as a
  // repair/cleaning hold (same model, same availability calendar), just with reason
  // "booked_offline" so it renders with a distinct color and label instead of a generic hold.
  const markSeatBookedOffline = async () => {
    setNotice("Marking seat booked (offline)...");
    await submitBedBlock(
      {
        bedIndex: Number(blockForm.bedIndex),
        from: blockForm.from,
        to: blockForm.to,
        reason: "booked_offline",
        note: blockForm.note || "Booked directly by student/family, cash payment."
      },
      "Seat marked booked (offline)."
    );
  };

  const releaseHold = async (hold) => {
    const holdId = hold.id || hold._id;
    setNotice("Releasing hold...");
    const result = await safeRequest(() => api.put(`/rooms/${blockForm.roomId}/bed-blocks/${holdId}`, { status: "released" }), { block: { ...hold, status: "released" }, demo: true });
    await loadCalendar(blockForm.roomId);
    await loadActiveHolds(blockForm.roomId);
    setNotice(result.demo ? "Hold released (demo mode)." : "Hold released.");
    setTimeout(() => setNotice(""), 2600);
  };

  return (
    <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
      <div className="panel overflow-hidden">
        <div className="p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Wrench size={22} /> {title}</h2>
          <p className="mt-2 text-sm text-slate-700">Resolve tenant tickets, keep SLA notes, and escalate urgent issues.</p>
        </div>
        {notice && <p className="mx-6 mb-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{notice}</p>}
        <div className="grid gap-4 p-5">
          {tickets.map((ticket) => (
            <article key={ticket.id || ticket._id} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`badge ${ticket.priority === "urgent" || ticket.priority === "high" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-primary-50 text-primary-800"}`}>{ticket.priority}</span>
                    <span className="chip">{ticket.status}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{ticket.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{ticket.hostelName} - Room {ticket.roomNumber}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{ticket.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-56 lg:grid-cols-1">
                  <button type="button" className="btn-secondary py-2" onClick={() => updateStatus(ticket, "in_progress")}>In Progress</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => updateStatus(ticket, "resolved")}>Resolved</button>
                  <button type="button" className="btn-primary py-2" onClick={() => updateStatus(ticket, "escalated")}>Escalate</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        <form onSubmit={createBedBlock} className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={22} /> Bed Availability Hold</h2>
          <p className="mt-2 text-sm text-slate-700">Block a specific bed for repairs, cleaning, or owner hold.</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Room ID<input className="input" value={blockForm.roomId} onChange={(event) => setBlockForm((current) => ({ ...current, roomId: event.target.value }))} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Bed index<input className="input" type="number" min="0" value={blockForm.bedIndex} onChange={(event) => setBlockForm((current) => ({ ...current, bedIndex: event.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Reason<select className="input" value={blockForm.reason} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))}><option value="maintenance">maintenance</option><option value="owner_hold">owner_hold</option><option value="deep_cleaning">deep_cleaning</option><option value="reserved">reserved</option><option value="booked_offline">booked_offline</option></select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">From<input className="input" type="date" value={blockForm.from} onChange={(event) => setBlockForm((current) => ({ ...current, from: event.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">To<input className="input" type="date" value={blockForm.to} onChange={(event) => setBlockForm((current) => ({ ...current, to: event.target.value }))} /></label>
            </div>
            <textarea className="input min-h-20 resize-none" value={blockForm.note} onChange={(event) => setBlockForm((current) => ({ ...current, note: event.target.value }))} placeholder="Maintenance note, or offline-booking reason (e.g. booked directly by student's family, cash payment)" />
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-primary" type="submit">Create Hold</button>
              <button
                type="button"
                className="btn-secondary flex items-center justify-center gap-1.5"
                onClick={markSeatBookedOffline}
                title="Mark this bed as booked directly (cash/offline) so it disappears from availability without a platform booking"
              >
                <Lock size={16} /> Mark Seat Booked (Offline)
              </button>
            </div>
          </div>
        </form>

        <section className="panel p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><UserRound size={20} /> Active Holds for Room {blockForm.roomId}</h2>
          <p className="mt-2 text-sm text-slate-700">Manual overrides are reversible - release a seat to make it bookable again.</p>
          <div className="mt-4 grid gap-3">
            {activeHolds.length ? (
              activeHolds.map((hold) => (
                <div key={hold.id || hold._id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
                  <div>
                    <p className="text-sm font-bold">
                      Bed {hold.bedIndex} - <span className={hold.reason === "booked_offline" ? "text-[#92400E]" : "text-primary-800"}>{hold.reason}</span>
                    </p>
                    {hold.note && <p className="text-xs text-slate-700">{hold.note}</p>}
                  </div>
                  <button type="button" className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={() => releaseHold(hold)}>
                    <Unlock size={13} /> Release
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-700">No active holds on this room.</p>
            )}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="text-xl font-bold">7-Day Availability</h2>
          <div className="mt-5 grid gap-3">
            {(calendar.length ? calendar : []).slice(0, 7).map((day) => (
              <div key={day.date} className="rounded-lg border border-line bg-canvas p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold">{day.date}</span>
                  <span className="text-sm text-slate-700">{day.availableBeds}/{day.totalBeds} available</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(day.bedStatuses || []).map((bed) => (
                    <span
                      key={`${day.date}-${bed.bedIndex}`}
                      title={bed.status === "booked_offline" ? `Booked offline${bed.note ? `: ${bed.note}` : ""}` : bed.reason || bed.status}
                      className={`grid h-9 w-9 place-items-center rounded-md border text-sm font-bold ${
                        bed.status === "available"
                          ? "border-accent-700 bg-accent-50 text-accent-700"
                          : bed.status === "booked_offline"
                            ? "border-[#B45309] bg-[#FEF3C7] text-[#92400E]"
                            : bed.status === "blocked"
                              ? "border-[#C81E1E] bg-[#FEE2E2] text-[#991B1B]"
                              : "border-primary-700 bg-primary-50 text-primary-800"
                      }`}
                    >
                      {bed.status === "available" ? <CheckCircle2 size={15} /> : bed.status === "booked_offline" ? <Lock size={13} /> : bed.bedIndex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
