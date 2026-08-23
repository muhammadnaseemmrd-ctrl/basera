import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Megaphone, X } from "lucide-react";
import { api, safeRequest } from "../services/api";

export function GlobalAlertBanner({ compact = false }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("basera_dismissed_alerts") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    safeRequest(() => api.get("/alerts/active"), { results: [] }).then((result) => {
      setAlerts(result.results || []);
    });
  }, []);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissed.includes(alert.id || alert._id)),
    [alerts, dismissed]
  );

  if (!visibleAlerts.length) return null;

  const alert = visibleAlerts[0];
  const isCritical = alert.severity === "critical";
  const isWarning = alert.severity === "warning";

  const dismiss = () => {
    const id = alert.id || alert._id;
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem("basera_dismissed_alerts", JSON.stringify(next));
  };

  const acknowledge = async () => {
    await safeRequest(() => api.post(`/alerts/${alert.id || alert._id}/ack`, { channel: "banner" }), { acknowledged: true, demo: true });
    dismiss();
  };

  return (
    <section className={`${compact ? "mx-5 mt-5 sm:mx-10" : "container-page pt-4"}`}>
      <div className={`rounded-xl border p-4 shadow-soft ${
        isCritical
          ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#7F1D1D]"
          : isWarning
            ? "border-[#FDE68A] bg-[#FFFBEB] text-[#78350F]"
            : "border-primary-200 bg-primary-50 text-primary-900"
      }`}>
        <div className="flex items-start gap-4">
          <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/70">
            {isCritical || isWarning ? <AlertTriangle size={20} /> : <Megaphone size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-extrabold uppercase tracking-widest">Important Alert</p>
              {visibleAlerts.length > 1 && <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold">+{visibleAlerts.length - 1} more</span>}
            </div>
            <h2 className="mt-1 break-words text-base font-extrabold">{alert.title}</h2>
            <p className="mt-1 break-words text-sm leading-6">{alert.message}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {alert.ackRequired && localStorage.getItem("basera_token") && (
              <button type="button" onClick={acknowledge} className="grid h-9 w-9 place-items-center rounded-lg bg-white/70" aria-label="Acknowledge alert">
                <CheckCircle2 size={18} />
              </button>
            )}
            <button type="button" onClick={dismiss} className="grid h-9 w-9 place-items-center rounded-lg bg-white/70" aria-label="Dismiss alert">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
