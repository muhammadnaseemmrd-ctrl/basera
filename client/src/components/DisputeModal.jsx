import { useState } from "react";
import { Gavel, UploadCloud, X } from "lucide-react";
import { api, safeRequest } from "../services/api";

const ISSUE_TYPES = [
  { value: "ROOM_CONDITION", label: "Property not as described" },
  { value: "OTHER", label: "Missing amenities" },
  { value: "REFUND", label: "Refund dispute" },
  { value: "BEHAVIOUR", label: "Safety or security concern" },
  { value: "PAYMENT", label: "Payment issue" }
];

export function DisputeModal({ booking, onClose }) {
  const [form, setForm] = useState({ title: "Listing condition mismatch", category: "ROOM_CONDITION", description: "", priority: "medium", evidence: [] });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const uploadEvidence = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("document", file);
    try {
      const { data } = await api.post("/uploads/document", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((current) => ({
        ...current,
        evidence: [...current.evidence, { type: "document", url: data.url, originalName: data.originalName || file.name }]
      }));
    } catch {
      // Evidence upload is optional -- ignore failures and let the student submit without it.
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage("Opening dispute...");
    const result = await safeRequest(
      () => api.post(`/bookings/${booking?.id || booking?._id || "b1"}/dispute`, form),
      { demo: true, dispute: { id: `DIS-${Date.now()}`, ...form, status: "open" } }
    );
    setMessage(result.demo ? "Dispute opened in demo mode." : "Dispute opened for admin mediation.");
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <section className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface-container-lowest p-7 shadow-card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-on-surface"><Gavel size={22} className="text-danger-600" /> File a New Dispute</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Provide details and evidence to expedite the resolution process.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close dispute modal"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="grid gap-5">
          <label className="grid gap-2 text-sm font-medium text-on-surface">
            Title
            <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-on-surface">
              Issue Type
              <select className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {ISSUE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-on-surface">
              Priority
              <select className="input" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High priority</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium text-on-surface">
            Detailed Description
            <textarea
              className="input min-h-32 resize-none"
              placeholder="Provide a detailed account of the issue. Be as specific as possible to expedite the resolution process."
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium text-on-surface">Upload Evidence</span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center transition-colors hover:bg-surface-container">
              <UploadCloud size={28} className="text-outline" />
              <span className="text-sm font-medium text-on-surface">{uploading ? "Uploading..." : "Drag & drop files or click to browse"}</span>
              <span className="text-xs text-on-surface-variant">Supported formats: JPG, PNG, PDF (Max 5MB)</span>
              <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={(event) => uploadEvidence(event.target.files?.[0])} />
            </label>
            {form.evidence.length > 0 && (
              <ul className="grid gap-1 text-xs text-on-surface-variant">
                {form.evidence.map((item) => <li key={item.url || item.originalName}>{item.originalName}</li>)}
              </ul>
            )}
          </div>
          {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
          <button className="btn-primary justify-self-end px-8" type="submit">Submit Dispute</button>
        </form>
      </section>
    </div>
  );
}
