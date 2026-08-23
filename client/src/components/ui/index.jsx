// Shared management-panel UI primitives.
// Lightweight, presentational, and dependency-free (Tailwind + lucide only).
// Use these across the Admin, Host, and Student dashboards for a consistent,
// modern, easy-to-scan look.
/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export { ToastProvider, useToast, useToastBridge } from "./toast";

const TONES = {
  blue: { tile: "#F0512E", icon: "bg-primary-50 text-primary-800", pill: "pill-info" },
  green: { tile: "#0E9F6E", icon: "bg-success-50 text-success-700", pill: "pill-success" },
  amber: { tile: "#D9920A", icon: "bg-warning-50 text-warning-700", pill: "pill-warning" },
  red: { tile: "#E02424", icon: "bg-danger-50 text-danger-700", pill: "pill-danger" },
  neutral: { tile: "#64748B", icon: "bg-neutral-100 text-neutral-700", pill: "pill-neutral" }
};

const toneOf = (tone) => TONES[tone] || TONES.blue;

/**
 * KPI tile: icon, label, big value, optional trend + helper text.
 */
export function StatTile({ icon: Icon, label, value, trend, hint, tone = "blue" }) {
  const t = toneOf(tone);
  const trendDown = typeof trend === "string" && trend.trim().startsWith("-");
  return (
    <article className="stat-tile" style={{ "--tile-accent": t.tile }}>
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${t.icon}`}>
            <Icon size={20} />
          </span>
        )}
        {trend != null && trend !== "" && (
          <span className={`text-sm font-bold ${trendDown ? "text-danger-600" : "text-success-700"}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-2 text-sm text-neutral-500">{hint}</p>}
    </article>
  );
}

/**
 * Responsive grid wrapper for StatTiles (defaults to up to 4 columns).
 */
export function StatGrid({ children, columns = 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns] || "sm:grid-cols-2 lg:grid-cols-4";
  return <section className={`grid gap-5 ${cols}`}>{children}</section>;
}

/**
 * Section heading with optional eyebrow, description, and right-aligned action.
 */
export function SectionHeader({ eyebrow, title, description, action, className = "" }) {
  return (
    <div className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="section-title text-xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Card container with optional header (title/description/action) and body padding.
 */
export function SectionCard({ title, description, action, icon: Icon, children, className = "", bodyClassName = "p-6" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="flex flex-col gap-3 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary-800">
                <Icon size={18} />
              </span>
            )}
            <div>
              {title && <h3 className="section-title">{title}</h3>}
              {description && <p className="mt-0.5 text-sm text-neutral-600">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * Status pill. Pass a tone, or let it infer from a status string.
 */
const STATUS_TONE = {
  approved: "green", published: "green", paid: "green", active: "green", signed: "green",
  completed: "green", verified: "green", resolved: "green", success: "green", ok: "green",
  confirmed: "green", current: "green", live: "green", open: "green",
  pending: "amber", review: "amber", processing: "amber", "in-progress": "amber", hold: "amber",
  warning: "amber", issued: "amber", upcoming: "amber", scheduled: "amber", draft: "amber",
  rejected: "red", failed: "red", overdue: "red", blocked: "red", dispute: "red",
  missing: "red", error: "red", critical: "red", cancelled: "red", canceled: "red", banned: "red"
};

export function StatusPill({ status, tone, children }) {
  const label = children ?? status ?? "";
  const resolvedTone = tone || STATUS_TONE[String(status || "").toLowerCase()] || "neutral";
  return <span className={`pill ${toneOf(resolvedTone).pill}`}>{label}</span>;
}

/**
 * Animated placeholder bar for loading states.
 */
export function Skeleton({ className = "" }) {
  return <span className={`block animate-pulse rounded bg-neutral-200 ${className}`} />;
}

/**
 * Declarative table with optional sorting, pagination, and loading state.
 * columns: [{ key, header, render?(row), className?, sortable?, sortValue?(row) }]
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = (_, i) => i,
  empty = "No records yet.",
  emptyIcon,
  pageSize,
  loading = false
}) {
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const value = (row) => (col.sortValue ? col.sortValue(row) : row[col.key]);
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true }) * sort.dir;
    });
  }, [rows, sort, columns]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visible = pageSize ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const toggleSort = (key) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir * -1 } : { key, dir: 1 }));

  if (!loading && !rows.length) return <EmptyState icon={emptyIcon} title={empty} />;

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider transition hover:text-ink"
                    >
                      {col.header}
                      {sort.key === col.key ? (
                        sort.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                      ) : (
                        <ChevronsUpDown size={13} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: pageSize || 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              : visible.map((row, i) => (
                  <tr key={rowKey(row, i)}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(row, i) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {pageSize && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-neutral-50 px-4 py-3 text-sm">
          <span className="text-neutral-500">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost py-1.5" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>Prev</button>
            <span className="text-neutral-500">{safePage + 1}/{totalPages}</span>
            <button type="button" className="btn-ghost py-1.5" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Friendly empty state for lists/tables.
 */
export function EmptyState({ icon: Icon, title = "Nothing here yet", description, action }) {
  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line bg-neutral-50 px-6 py-12 text-center">
      {Icon && (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-500">
          <Icon size={22} />
        </span>
      )}
      <p className="font-semibold text-neutral-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
      {action}
    </div>
  );
}

/**
 * Toolbar with a search input and optional trailing actions.
 */
export function Toolbar({ search, onSearch, placeholder = "Search...", searchIcon: SearchIcon, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        {SearchIcon && <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />}
        <input
          value={search ?? ""}
          onChange={(e) => onSearch?.(e.target.value)}
          className="toolbar-search"
          placeholder={placeholder}
        />
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Hover/focus tooltip wrapper. Instant (no native title delay), touch-aware via focus.
 */
export function Tooltip({ label, children, side = "bottom" }) {
  const pos = side === "top"
    ? "bottom-full mb-2"
    : side === "left"
      ? "right-full top-1/2 mr-2 -translate-y-1/2"
      : side === "right"
        ? "left-full top-1/2 ml-2 -translate-y-1/2"
        : "top-full mt-2";
  const centerX = side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : "";
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 ${pos} ${centerX} whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-card transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}

/**
 * Icon-only action button with an always-available label (tooltip + aria-label),
 * so the control is never ambiguous.
 */
export function IconButton({ icon: Icon, label, onClick, size = 18, tone = "secondary", side = "bottom", type = "button" }) {
  const cls = tone === "ghost" ? "btn-ghost" : tone === "primary" ? "btn-primary" : "btn-secondary";
  return (
    <Tooltip label={label} side={side}>
      <button type={type} onClick={onClick} aria-label={label} className={`${cls} rounded-full px-2.5 py-2.5`}>
        <Icon size={size} />
      </button>
    </Tooltip>
  );
}

/**
 * A button that requires a second click to confirm before firing its action.
 * Prevents accidental destructive/financial actions (ban, release payout, hide, etc.).
 */
export function ConfirmButton({
  onConfirm,
  children,
  className = "btn-secondary py-2",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  title
}) {
  const [armed, setArmed] = useState(false);
  const confirmClass = tone === "primary" ? "btn-primary py-2" : "btn-danger py-2";
  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="button" className={confirmClass} onClick={() => { setArmed(false); onConfirm(); }}>
          {confirmLabel}
        </button>
        <button type="button" className="btn-ghost py-2" onClick={() => setArmed(false)}>{cancelLabel}</button>
      </span>
    );
  }
  return (
    <button type="button" className={className} title={title} onClick={() => setArmed(true)}>
      {children}
    </button>
  );
}

/**
 * Inline status/feedback banner.
 */
export function Banner({ tone = "blue", children }) {
  const map = {
    blue: "bg-primary-50 text-primary-800",
    green: "bg-success-50 text-success-700",
    amber: "bg-warning-50 text-warning-700",
    red: "bg-danger-50 text-danger-700"
  };
  return <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${map[tone] || map.blue}`}>{children}</p>;
}
