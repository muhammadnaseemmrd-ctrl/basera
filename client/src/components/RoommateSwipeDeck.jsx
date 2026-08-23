import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Heart, RefreshCcw, ThumbsDown, Users } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { useToast } from "./ui";
import { useMotionSafe } from "../utils/motion";

// The backend doesn't have a dedicated "other student" roommate profile endpoint --
// /roommates/score (see server/routes/v6AliasRoutes.js) scores compatibility against
// rooms/room-groups, which is the same data source the form-based Roommate Match tool
// (RoommateFormPanel) uses. So each "candidate" card here represents a compatible
// room/roommate group rather than a standalone people profile; that keeps this swipe UI
// grounded in real API data instead of inventing fake student names.
const fallbackCandidates = [
  { roomId: "r1", title: "Premium Single Seater near NUST", compatibilityScore: 92, reasons: ["Budget compatibility", "Study schedule fit", "Food preference fit"], suggestedRoommateRequestId: "rr-r1" },
  { roomId: "r4", title: "NUST Double Sharing", compatibilityScore: 88, reasons: ["Budget compatibility", "Cleanliness preference fit"], suggestedRoommateRequestId: "rr-r4" },
  { roomId: "r5", title: "Executive Triple Sharing", compatibilityScore: 81, reasons: ["Study schedule fit", "Noise tolerance fit"], suggestedRoommateRequestId: "rr-r5" }
];

export function RoommateSwipeDeck() {
  const motionSafe = useMotionSafe();
  const toast = useToast();
  const [candidates, setCandidates] = useState(fallbackCandidates);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadCandidates = () => {
    setLoading(true);
    setIndex(0);
    safeRequest(
      () => api.post("/roommates/score", { studyStyle: "silent", foodPreference: "mess", cleanliness: "regular" }),
      { results: fallbackCandidates, demo: true }
    ).then((result) => {
      setCandidates(result.results?.length ? result.results : fallbackCandidates);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const current = candidates[index];
  const hasMore = Boolean(current);

  const advance = () => setIndex((value) => value + 1);

  const handlePass = () => {
    if (busy) return;
    advance();
  };

  const handleLike = async (candidate) => {
    if (busy || !candidate) return;
    setBusy(true);
    // Reuses the existing "express interest" endpoint (POST /community/roommate-requests,
    // see server/routes/communityRoutes.js) so a Like is actually persisted server-side
    // (or recorded as a demo request when the API/DB is unavailable) rather than being
    // purely a local toast.
    const result = await safeRequest(
      () =>
        api.post("/community/roommate-requests", {
          roomId: candidate.roomId,
          roomTitle: candidate.title,
          compatibilityScore: candidate.compatibilityScore,
          message: `Swiped right on ${candidate.title} -- interested in a roommate match.`
        }),
      { request: { id: candidate.suggestedRoommateRequestId }, demo: true }
    );
    toast.success(result.demo ? `It's a match! Request saved in demo mode for ${candidate.title}.` : `It's a match! Roommate request sent for ${candidate.title}.`);
    setBusy(false);
    advance();
  };

  return (
    <section className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><Users size={14} /> Swipe to match</p>
          <h3 className="mt-3 text-xl font-bold">Roommate Swipe Deck</h3>
          <p className="mt-1 text-sm text-slate-700">Drag a card, or use the buttons, to pass or like a compatible room/roommate group.</p>
        </div>
        <button type="button" onClick={loadCandidates} className="btn-secondary py-2"><RefreshCcw size={16} /> Refresh</button>
      </div>

      <div className="relative mt-6 grid h-[420px] place-items-center">
        {loading ? (
          <p className="text-sm text-slate-600">Loading candidates...</p>
        ) : hasMore ? (
          <AnimatePresence>
            <SwipeCard key={current.roomId} candidate={current} motionSafe={motionSafe} onPass={handlePass} onLike={handleLike} busy={busy} />
          </AnimatePresence>
        ) : (
          <div className="text-center">
            <p className="text-lg font-bold">No more candidates right now.</p>
            <p className="mt-2 text-sm text-slate-700">Check back later or refresh to see the deck again.</p>
            <button type="button" onClick={loadCandidates} className="btn-primary mt-5"><RefreshCcw size={16} /> Reload Deck</button>
          </div>
        )}
      </div>
    </section>
  );
}

function SwipeCard({ candidate, motionSafe, onPass, onLike, busy }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -20], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 120) onLike(candidate);
    else if (info.offset.x < -120) onPass();
  };

  return (
    <motion.article
      className="absolute w-full max-w-sm cursor-grab rounded-2xl border border-line bg-white p-6 shadow-float active:cursor-grabbing"
      style={motionSafe ? { x, rotate } : undefined}
      drag={motionSafe ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={motionSafe ? handleDragEnd : undefined}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {motionSafe && (
        <>
          <motion.span style={{ opacity: likeOpacity }} className="absolute right-6 top-6 rounded-md border-2 border-accent-700 px-3 py-1 text-sm font-extrabold uppercase tracking-widest text-accent-700">
            Like
          </motion.span>
          <motion.span style={{ opacity: passOpacity }} className="absolute left-6 top-6 rounded-md border-2 border-slate-400 px-3 py-1 text-sm font-extrabold uppercase tracking-widest text-slate-500">
            Pass
          </motion.span>
        </>
      )}

      <div className="grid h-28 w-28 place-items-center rounded-full bg-primary-50 text-primary-800">
        <Users size={40} />
      </div>
      <h4 className="mt-5 text-xl font-bold">{candidate.title}</h4>
      <p className="mt-1 text-sm text-slate-600">Suggested roommate match</p>

      <div className="mt-5 rounded-lg bg-accent-50 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-accent-700">Compatibility</p>
        <p className="mt-1 text-4xl font-extrabold text-accent-700">{candidate.compatibilityScore || 0}%</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(candidate.reasons || []).map((reason) => (
          <span key={reason} className="chip">{reason}</span>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onPass} disabled={busy} className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-60">
          <ThumbsDown size={16} /> Pass
        </button>
        <button type="button" onClick={() => onLike(candidate)} disabled={busy} className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60">
          <Heart size={16} /> Like
        </button>
      </div>
    </motion.article>
  );
}
