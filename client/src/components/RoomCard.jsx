import { BadgeCheck, Clock, MapPin, ShieldCheck, Sparkles, WalletCards, Zap } from "lucide-react";
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
    <DepthCard className="panel group h-full overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-50">
        <img src={room.image} alt={room.title} className="h-full w-full object-cover transition duration-500 ease-smooth group-hover:scale-[1.04]" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="badge bg-primary-700 text-white">{room.roomType?.replace("_", " ")}</span>
          {room.instantBooking && <span className="badge bg-accent-700 text-white"><Zap size={14} /> Instant</span>}
          {room.budgetFit && <span className={`badge ${room.budgetFit === "within" ? "bg-accent-700 text-white" : room.budgetFit === "near" ? "bg-[#F59E0B] text-white" : "bg-[#991B1B] text-white"}`}>{room.budgetFit === "within" ? "Within budget" : room.budgetFit === "near" ? "Near budget" : "Over budget"}</span>}
        </div>
        {room.recommendationScore ? (
          <span className="badge absolute bottom-4 right-4 bg-white/95 text-primary-800 shadow-card">
            <Sparkles size={14} /> {room.recommendationScore}% match
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold">{room.title}</h3>
            <span className="whitespace-nowrap text-lg font-extrabold text-primary-800">{currency(room.pricePerHead)}</span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <MapPin size={16} /> {room.area}, {room.city}
            {room.distanceToUniversityKm ? <span className="font-semibold text-primary-800">- {room.distanceToUniversityKm} km</span> : null}
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-line bg-canvas p-3 sm:grid-cols-3">
          <span className="text-xs text-slate-700"><ShieldCheck className="mb-1 text-primary-800" size={16} /> Trust <strong className="block text-ink">{trustScore}/100</strong></span>
          <span className="text-xs text-slate-700"><WalletCards className="mb-1 text-primary-800" size={16} /> Monthly total <strong className="block text-ink">{currency(monthlyExposure)}</strong></span>
          <span className="text-xs text-slate-700"><Clock className="mb-1 text-primary-800" size={16} /> Commute <strong className="block text-ink">{room.distanceToUniversity || 15} min</strong></span>
        </div>
        <BedBar total={room.totalBeds} available={room.availableBeds} compact />
        <div className="flex flex-wrap gap-2">
          <GenderBadge value={room.genderPolicy} />
          <MealPlan value={room.mealPlan} cost={room.mealCost} />
          {room.curfewTime && <span className="chip"><Clock size={14} /> Curfew {room.curfewTime}</span>}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-accent-700"><BadgeCheck size={16} /> {room.lister?.verificationTier?.replace("_", " ") || "Verified"}</span>
          <Link to={`/rooms/${room.id}`} className="btn-primary px-4 py-2.5">View Room</Link>
        </div>
      </div>
    </DepthCard>
  );
}
