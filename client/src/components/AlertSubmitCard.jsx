import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { api, safeRequest } from "../services/api";

export function AlertSubmitCard({ audience = "all", title = "Submit Important Alert" }) {
  const [form, setForm] = useState({
    title: "Hostel evacuation or safety notice",
    category: "hostel",
    severity: "warning",
    audience,
    city: "",
    university: "",
    ackRequired: false,
    message: ""
  });
  const [notice, setNotice] = useState("");

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      setNotice("Title and message are required.");
      return;
    }
    setNotice("Submitting alert for admin review...");
    const result = await safeRequest(() => api.post("/alerts", form), {
      alert: { id: `alert-${Date.now()}`, ...form, status: "pending" },
      requiresApproval: true,
      demo: true
    });
    setNotice(result.requiresApproval ? "Alert submitted. Admin approval is required before global publishing." : "Alert published globally for 48 hours.");
    setForm((current) => ({ ...current, message: "" }));
    setTimeout(() => setNotice(""), 3500);
  };

  return (
    <form onSubmit={submit} className="panel h-fit p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold"><Megaphone size={22} /> {title}</h3>
          <p className="mt-2 text-sm text-slate-700">Student and Host alerts are reviewed by admin before they appear globally.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Alert title
          <input className="input" value={form.title} onChange={update("title")} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Category
            <select className="input" value={form.category} onChange={update("category")}>
              {["safety", "policy", "weather", "transport", "hostel", "health", "general"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Severity
            <select className="input" value={form.severity} onChange={update("severity")}>
              {["info", "warning", "critical"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Audience
            <select className="input" value={form.audience} onChange={update("audience")}>
              <option value="all">All users</option>
              <option value="students">Students</option>
              <option value="hosts">Hosts</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Target city
            <input className="input" value={form.city} onChange={update("city")} placeholder="Optional" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Target university
            <input className="input" value={form.university} onChange={update("university")} placeholder="Optional" />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Alert details
          <textarea className="input min-h-28 resize-none" value={form.message} onChange={update("message")} placeholder="Write the verified notice, location, and what students should do..." />
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-4 text-sm font-semibold">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={form.ackRequired} onChange={update("ackRequired")} />
          <span>Require users to acknowledge this alert.</span>
        </label>
        {notice && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{notice}</p>}
        <button className="btn-primary" type="submit"><Send size={18} /> Submit Alert</button>
      </div>
    </form>
  );
}
