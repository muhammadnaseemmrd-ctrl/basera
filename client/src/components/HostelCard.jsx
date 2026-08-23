import { Heart, MapPin, Star, ShieldCheck, ArrowRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { currency, rating } from "../utils/formatters";
import { useAppStore } from "../store/useAppStore";
import { motion } from "framer-motion";
import { transitions, useMotionSafe } from "../utils/motion";
import { DepthCard } from "./DepthCard";

export function HostelCard({ hostel, compact = false }) {
  const { saved, toggleSaved } = useAppStore();
  const isSaved = saved.includes(hostel.id);
  const motionSafe = useMotionSafe();

  return (
    <DepthCard className="panel group h-full overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-50">
        <motion.img
          src={hostel.image}
          alt={hostel.name}
          className="h-full w-full object-cover"
          whileHover={motionSafe ? { scale: 1.04 } : undefined}
          transition={motionSafe ? transitions.base : undefined}
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {hostel.verified && (
            <span className="badge bg-accent-700 text-white">
              <ShieldCheck size={14} /> Verified
            </span>
          )}
          {hostel.left <= 2 && <span className="badge bg-[#FF5A1F] text-white">Only {hostel.left} left</span>}
        </div>
        <button
          type="button"
          aria-label={isSaved ? "Remove saved hostel" : "Save hostel"}
          onClick={() => toggleSaved(hostel.id)}
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-primary-800 shadow-card transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float"
        >
          <motion.span
            animate={motionSafe && isSaved ? { scale: [1, 1.12, 1] } : undefined}
            transition={motionSafe ? { duration: 0.25 } : undefined}
          >
            <Heart size={22} fill={isSaved ? "#FF6B4A" : "none"} />
          </motion.span>
        </button>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{hostel.name}</h3>
          <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-[#9B1C1C]">
            <Star size={16} /> {rating(hostel.rating)}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <MapPin size={16} /> {hostel.area}, {hostel.city}
        </p>
        {hostel.groupName && (
          <Link
            to={`/hostel-groups/${hostel.groupSlug || ""}`}
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-800 hover:underline"
          >
            <Building2 size={13} /> Part of {hostel.groupName}
          </Link>
        )}
        {!compact && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hostel.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
          <p>
            <span className="text-xl font-extrabold text-primary-800">{currency(hostel.price)}</span>
            <span className="text-sm text-slate-600"> /mo</span>
          </p>
          <Link to={`/hostels/${hostel.slug}`} className="btn-primary px-4 py-2.5">
            {compact ? <ArrowRight size={18} /> : "Details"}
          </Link>
        </div>
      </div>
    </DepthCard>
  );
}
