export function BedBar({ total = 1, available = 0, compact = false }) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeAvailable = Math.max(0, Math.min(safeTotal, Number(available || 0)));
  const occupied = safeTotal - safeAvailable;
  const width = `${(safeAvailable / safeTotal) * 100}%`;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{safeAvailable} of {safeTotal} beds available</span>
        {!compact && <span>{occupied} occupied</span>}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100">
        <div className={`h-full rounded-full ${safeAvailable ? "bg-accent-700" : "bg-[#C81E1E]"}`} style={{ width }} />
      </div>
    </div>
  );
}
