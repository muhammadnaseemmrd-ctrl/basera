import { Clock, MapPin, ShieldCheck, Sparkles, WalletCards, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { currency } from "../utils/formatters";
import { BedBar } from "./BedBar";
import { GenderBadge } from "./GenderBadge";
import { MealPlan } from "./MealPlan";
import { DepthCard } from "./DepthCard";

export function RoomCard({ room }) {
  const monthlyExposure = Number(room.totalMonthlyCost || 0) || Number(room.pricePerHead || 0) + Number(room.mealCost || 0);
  const trustScore = Math.min(98, 74 + (room.lister?.verificationTier ? 10 : 0) + (room.instantBooking ? 4 : 0) + Math.min(10, (room.amenities || []).length));

  return (
    <DepthCard className="group h-full overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
        <img src={room.image} alt={room.title} className="h-full w-full object-cover transition duration-500 ease-smooth group-hover:scale-[1.04]" />
        {/* Gold Standard signature Verification Badge: shield/check icon + uppercase "Verified" label */}
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded bg-surface px-2 py-1 text-primary-600 shadow-sm">
          <ShieldCheck size={14} />
          <span className="text-[11px] font-bold uppercase tracking-wide">{room.lister?.verificationTier?.replace("_", " ") || "Verified"}</span>
        </div>
        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
          {room.instantBooking && <span className="badge bg-accent-600 text-white"><Zap size={14} /> Instant</span>}
          {room.budgetFit && <span className={`badge ${room.budgetFit === "within" ? "bg-accent-600 text-white" : room.budgetFit === "near" ? "bg-[#F59E0B] text-white" : "bg-[#991B1B] text-white"}`}>{room.budgetFit === "within" ? "Within budget" : room.budgetFit === "near" ? "Near budget" : "Over budget"}</span>}
        </div>
        <span className="absolute bottom-3 left-3 rounded bg-primary-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">{room.roomType?.replace("_", " ")}</span>
        {room.recommendationScore ? (
          <span className="badge absolute bottom-3 right-3 bg-surface/95 text-primary-700 shadow-card">
            <Sparkles size={14} /> {room.recommendationScore}% match
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-on-surface">{room.title}</h3>
            <span className="whitespace-nowrap font-display text-lg font-bold text-primary-600">{currency(room.pricePerHead)}</span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
            <MapPin size={16} /> {room.area}, {room.city}
            {room.distanceToUniversityKm ? <span className="font-semibold text-primary-700">- {room.distanceToUniversityKm} km</span> : null}
          </p>
        </div>
        <div className="grid gap-3 rounded border border-line bg-surface-container-low p-3 sm:grid-cols-3">
          <span className="text-xs text-on-surface-variant"><ShieldCheck className="mb-1 text-primary-600" size={16} /> Trust <strong className="block text-on-surface">{trustScore}/100</strong></span>
          <span className="text-xs text-on-surface-variant"><WalletCards className="mb-1 text-primary-600" size={16} /> Monthly total <strong className="block text-on-surface">{currency(monthlyExposure)}</strong></span>
          <span className="text-xs text-on-surface-variant"><Clock className="mb-1 text-primary-600" size={16} /> Commute <strong className="block text-on-surface">{room.distanceToUniversity || 15} min</strong></span>
        </div>
        <BedBar total={room.totalBeds} available={room.availableBeds} compact />
        <div className="flex flex-wrap gap-2">
          <GenderBadge value={room.genderPolicy} />
          <MealPlan value={room.mealPlan} cost={room.mealCost} />
          {room.curfewTime && <span className="chip"><Clock size={14} /> Curfew {room.curfewTime}</span>}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <Link to={`/rooms/${room.id}`} className="ml-auto rounded bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">View Room</Link>
        </div>
      </div>
    </DepthCard>
  );
}
