import { useState } from "react";
import { FileWarning, X } from "lucide-react";
import { api, safeRequest } from "../services/api";

export function DisputeModal({ booking, onClose }) {
  const [form, setForm] = useState({ title: "Listing condition mismatch", description: "", priority: "medium" });
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("Opening dispute...");
    const result = await safeRequest(
      () => api.post(`/bookings/${booking?.id || booking?._id || "b1"}/dispute`, form),
      { demo: true, dispute: { id: `DIS-${Date.now()}`, ...form } }
    );
    setMessage(result.demo ? "Dispute opened in demo mode." : "Dispute opened for admin mediation.");
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <section className="panel w-full max-w-xl p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold"><FileWarning size={24} /> Raise Dispute</h2>
            <p className="mt-1 text-sm text-slate-700">Attach evidence after opening the case from the admin dispute center.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close dispute modal"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="grid gap-5">
          <label className="grid gap-2 font-semibold">
            Title
            <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label className="grid gap-2 font-semibold">
            Priority
            <select className="input" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High priority</option>
            </select>
          </label>
          <label className="grid gap-2 font-semibold">
            Details
            <textarea className="input min-h-32 resize-none" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
          </label>
          {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
          <button className="btn-primary justify-self-end px-8" type="submit">Submit Dispute</button>
        </form>
      </section>
    </div>
  );
}
