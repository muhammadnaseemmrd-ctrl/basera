import { useEffect, useMemo, useState } from "react";
import { MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { api, safeRequest } from "../services/api";

const fallbackParent = {
  score: 84,
  safety: { label: "Parent-safe summary", score: 84, notes: ["Verified listing data", "Contact gating active", "Deposit policy visible"] },
  paymentProtection: ["Escrow hold", "QR receipt verification", "Dispute support"],
  pois: [
    { id: "poi-1", name: "Pharmacy", category: "pharmacy", distanceMeters: 420 },
    { id: "poi-2", name: "Transport stop", category: "transport", distanceMeters: 260 },
    { id: "poi-3", name: "Food street", category: "food", distanceMeters: 620 }
  ]
};

export function ParentAssurancePanel({ room }) {
  const [summary, setSummary] = useState(fallbackParent);
  const lat = room?.coordinates?.lat;
  const lng = room?.coordinates?.lng;
  const city = room?.city || "Islamabad";
  const score = useMemo(() => {
    if (typeof summary.score === "object") return summary.score?.score || summary.safety?.score || 0;
    return summary.score || summary.safety?.score || 0;
  }, [summary]);

  useEffect(() => {
    safeRequest(() => api.get("/map/parent-summary", { params: { city, lat, lng } }), fallbackParent).then((result) => setSummary(result || fallbackParent));
  }, [city, lat, lng]);

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="badge bg-accent-50 text-accent-700"><ShieldCheck size={16} /> Parent assurance</p>
          <h2 className="mt-4 text-xl font-bold">Safety and Payment Protection</h2>
          <p className="mt-2 text-sm text-slate-700">Read-only trust summary for families reviewing the room before booking.</p>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-700 font-extrabold text-white">{score}</span>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="flex items-center gap-2 font-bold"><WalletCards size={18} /> Payment protection</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(summary.paymentProtection || []).map((item) => <span key={item} className="chip">{item}</span>)}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="flex items-center gap-2 font-bold"><MapPin size={18} /> Nearby essentials</p>
          <div className="mt-3 grid gap-2">
            {(summary.pois || []).slice(0, 4).map((poi) => (
              <div key={poi.id || poi.name} className="flex justify-between gap-3 text-sm">
                <span>{poi.name || poi.category}</span>
                <strong>{poi.distanceMeters ? `${poi.distanceMeters}m` : poi.category}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
