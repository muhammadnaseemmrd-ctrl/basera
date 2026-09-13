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
    <DepthCard className="group h-full overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
        <motion.img
          src={hostel.image}
          alt={hostel.name}
          className="h-full w-full object-cover"
          whileHover={motionSafe ? { scale: 1.04 } : undefined}
          transition={motionSafe ? transitions.base : undefined}
        />
        {/* Gold Standard signature Verification Badge: shield/check icon + uppercase "Verified" label */}
        {hostel.verified && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded bg-surface px-2 py-1 text-primary-600 shadow-sm">
            <ShieldCheck size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wide">Verified</span>
          </div>
        )}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[11px] font-bold text-on-surface shadow-sm backdrop-blur">
          <Star size={13} className="fill-current text-primary-600" /> {rating(hostel.rating)}
        </div>
        {hostel.left <= 2 && <span className="badge absolute bottom-3 left-3 bg-accent-600 text-white">Only {hostel.left} left</span>}
        <button
          type="button"
          aria-label={isSaved ? "Remove saved hostel" : "Save hostel"}
          onClick={() => toggleSaved(hostel.id)}
          className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-primary-600 shadow-card transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float"
        >
          <motion.span
            animate={motionSafe && isSaved ? { scale: [1, 1.12, 1] } : undefined}
            transition={motionSafe ? { duration: 0.25 } : undefined}
          >
            <Heart size={20} fill={isSaved ? "#C0392B" : "none"} className={isSaved ? "text-accent-600" : ""} />
          </motion.span>
        </button>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-on-surface">{hostel.name}</h3>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
          <MapPin size={16} /> {hostel.area}, {hostel.city}
        </p>
        {hostel.groupName && (
          <Link
            to={`/hostel-groups/${hostel.groupSlug || ""}`}
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
          >
            <Building2 size={13} /> Part of {hostel.groupName}
          </Link>
        )}
        {!compact && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hostel.tags.map((tag) => (
              <span key={tag} className="rounded border border-line bg-surface-container-low px-2 py-1 text-xs font-semibold text-on-surface-variant">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
          <p>
            <span className="font-display text-xl font-bold text-primary-600">{currency(hostel.price)}</span>
            <span className="text-sm text-on-surface-variant"> /mo</span>
          </p>
          <Link to={`/hostels/${hostel.slug}`} className="rounded bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition duration-250 ease-smooth hover:bg-primary-700">
            {compact ? <ArrowRight size={18} /> : "Details"}
          </Link>
        </div>
      </div>
    </DepthCard>
  );
}
