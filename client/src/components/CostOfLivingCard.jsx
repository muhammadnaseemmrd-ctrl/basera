import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { currency } from "../utils/formatters";

const fallbackEstimate = {
  rent: 18000,
  meals: 9000,
  laundry: 1500,
  commute: 1848,
  utilities: 3000,
  serviceFee: 400,
  depositAmortized: 833,
  monthlyTotal: 33581,
  moveInCost: 23400
};

export function CostOfLivingCard({ room }) {
  const [estimate, setEstimate] = useState(null);
  const rent = Number(room?.pricePerHead || room?.pricePerBed || room?.pricePerRoom || 0);
  const deposit = Number(room?.securityDeposit || 5000);
  const mealCost = Number(room?.mealCost || 9000);
  const commuteKm = Number(room?.distanceToUniversityKm || room?.distanceToUniversity || 3);
  const hasToken = Boolean(localStorage.getItem("basera_token"));
  const localEstimate = useMemo(() => ({
    ...fallbackEstimate,
    rent: rent || fallbackEstimate.rent,
    meals: mealCost,
    commute: Math.round(commuteKm * 28 * 22),
    depositAmortized: Math.round(deposit / 6),
    monthlyTotal: (rent || fallbackEstimate.rent) + mealCost + Math.round(commuteKm * 28 * 22) + fallbackEstimate.laundry + fallbackEstimate.utilities + fallbackEstimate.serviceFee + Math.round(deposit / 6),
    moveInCost: (rent || fallbackEstimate.rent) + deposit + fallbackEstimate.serviceFee
  }), [commuteKm, deposit, mealCost, rent]);
  const displayEstimate = estimate || localEstimate;

  useEffect(() => {
    if (!hasToken) return;
    safeRequest(
      () => api.post("/tools/cost-estimator", { rent, mealCost, securityDeposit: deposit, commuteKm }),
      { estimate: localEstimate }
    ).then((result) => setEstimate(result.estimate || fallbackEstimate));
  }, [commuteKm, deposit, hasToken, localEstimate, mealCost, rent]);

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Calculator size={20} /> True Monthly Cost</h2>
      <p className="mt-2 text-sm text-slate-700">Rent plus meals, commute, utilities, service fee, and amortized deposit.</p>
      <div className="mt-5 grid gap-2 text-sm">
        {Object.entries(displayEstimate).filter(([key]) => !["monthlyTotal", "moveInCost"].includes(key)).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 border-b border-line py-2">
            <span className="capitalize text-slate-700">{key.replace(/([A-Z])/g, " $1")}</span>
            <strong>{currency(value)}</strong>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-primary-50 p-4">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-600">Estimated monthly total</p>
        <p className="mt-2 text-2xl font-extrabold text-primary-800">{currency(displayEstimate.monthlyTotal)}</p>
        <p className="mt-1 text-sm text-slate-700">Move-in exposure: {currency(displayEstimate.moveInCost)}</p>
      </div>
    </section>
  );
}
