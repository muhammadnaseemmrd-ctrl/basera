import { dateShort, money, SEAT_LABEL, SEAT_STYLE } from "./opsHelpers";

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${value === key ? "bg-primary-800 text-white" : "bg-primary-50 text-primary-800 hover:bg-primary-100"}`}
        >
          {label}
          {count ? <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs text-primary-800">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = { info: "bg-primary-50 text-primary-800", ok: "bg-[#ECFDF5] text-[#047857]", error: "bg-[#FEE2E2] text-[#991B1B]" };
  if (!children) return null;
  return (
    <p role="status" className={`mb-4 rounded-md px-4 py-3 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </p>
  );
}

export function SeatLegend({ summary }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
      {Object.keys(SEAT_LABEL).map((key) => (
        <span key={key} className={`rounded-md border px-2.5 py-1 ${SEAT_STYLE[key]}`}>
          {SEAT_LABEL[key]}
          {summary ? `: ${summary[key] ?? 0}` : ""}
        </span>
      ))}
      {summary ? <span className="rounded-md border border-line px-2.5 py-1">Total {summary.total} · Occupancy {summary.occupancyPct}%</span> : null}
    </div>
  );
}

export function SeatBlocks({ blocks }) {
  if (!blocks?.length) return <p className="text-slate-700">No blocks or rooms yet.</p>;
  return (
    <div className="grid gap-6">
      {blocks.map((block) => (
        <section key={block.id || "unassigned"} className="rounded-lg border border-line p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">
              {block.name}
              {block.warden ? <span className="ml-2 text-sm font-medium text-slate-600">Warden: {block.warden.name}</span> : block.id ? <span className="ml-2 text-sm font-medium text-[#B45309]">No warden assigned</span> : null}
            </h3>
            <p className="text-sm text-slate-700">
              {block.summary.free} free · {block.summary.reserved} reserved · {block.summary.occupied} occupied · {block.summary.total} total
            </p>
          </div>
          <div className="grid gap-3">
            {block.rooms.map((room) => (
              <div key={room.id} className="flex flex-wrap items-center gap-3">
                <p className="w-24 shrink-0 text-sm font-bold">Room {room.roomNumber}</p>
                <div className="flex flex-wrap gap-2">
                  {room.seats.map((seat) => (
                    <div key={seat.bedIndex} title={seat.student?.name || seat.note || SEAT_LABEL[seat.status]} className={`min-w-[7.5rem] rounded-md border px-2.5 py-1.5 text-xs ${SEAT_STYLE[seat.status]}`}>
                      <p className="font-bold">Seat {seat.bedIndex + 1}</p>
                      <p>{SEAT_LABEL[seat.status]}{seat.status === "leaving" && seat.leavingOn ? ` on ${seat.leavingOn}` : ""}</p>
                      {seat.student?.name ? <p className="truncate font-semibold">{seat.student.name}</p> : null}
                      {seat.conflict ? <p className="font-bold text-[#991B1B]">Double-booked!</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const STATUS_TONE = {
  paid: "bg-[#ECFDF5] text-[#047857]",
  resolved: "bg-[#ECFDF5] text-[#047857]",
  fixed: "bg-[#ECFDF5] text-[#047857]",
  partial: "bg-[#FEF3C7] text-[#92400E]",
  in_progress: "bg-[#FEF3C7] text-[#92400E]",
  under_review: "bg-[#FEF3C7] text-[#92400E]",
  unpaid: "bg-[#FEE2E2] text-[#991B1B]",
  raised: "bg-[#FEE2E2] text-[#991B1B]",
  reopened: "bg-[#FEE2E2] text-[#991B1B]",
  escalated: "bg-[#EDE9FE] text-[#5B21B6]",
  terminated: "bg-[#FEE2E2] text-[#991B1B]",
  suspended: "bg-[#FEF3C7] text-[#92400E]",
  active: "bg-[#ECFDF5] text-[#047857]",
  pending: "bg-[#FEF3C7] text-[#92400E]"
};
export function Pill({ value }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_TONE[value] || "bg-primary-50 text-primary-800"}`}>{String(value).replace(/_/g, " ")}</span>;
}

export function ComplaintTimeline({ items = [] }) {
  return (
    <ol className="mt-2 grid gap-1 border-l-2 border-line pl-3 text-xs text-slate-700">
      {items.map((t, i) => (
        <li key={i}>
          <Pill value={t.status} /> <span className="font-semibold capitalize">{String(t.byRole || "").replace(/_/g, " ")}</span> · {dateShort(t.at)}
          {t.note ? <span className="block text-slate-600">“{t.note}”</span> : null}
        </li>
      ))}
    </ol>
  );
}


/** Rent − discounts + fine − waived − paid = due, exactly as the server computes it. */
export function InvoiceBreakdown({ invoice: i }) {
  if (!i) return null;
  const fineLabel = { accruing: "growing daily", frozen: "frozen", waived: "waived", paid: "paid" }[i.fineStatus];
  return (
    <div className="mt-2 grid gap-0.5 text-xs text-slate-700">
      <p>Rent {money(i.amount)}{i.dueDate ? ` · due ${dateShort(i.dueDate)}` : ""}</p>
      {(i.discounts || []).map((d, k) => <p key={k} className="text-accent-700">{d.name}: −{money(d.amountOff)}</p>)}
      {i.fineAccrued ? (
        <p className="font-semibold text-[#991B1B]">
          Late fine {money(i.fineAccrued)}{fineLabel ? ` (${fineLabel}${i.fineStatus === "accruing" && i.finePerDay ? `, PKR ${i.finePerDay}/day` : ""})` : ""}
          {i.fineWaived ? <span className="text-accent-700"> · waived −{money(i.fineWaived)}</span> : null}
        </p>
      ) : null}
      {i.paidAmount || i.finePaid ? <p>Paid {money((i.paidAmount || 0) + (i.finePaid || 0))}</p> : null}
      {i.status !== "void" && i.totalDue > 0 ? (
        <p className="font-bold text-slate-900">
          To clear today: {money(i.payToday ?? i.totalDue)}{i.payTomorrow > (i.payToday ?? i.totalDue) ? <span className="font-normal text-slate-600"> · tomorrow {money(i.payTomorrow)}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** "Showing 1–100 of 900" with previous/next for server-paged lists. */
export function Pager({ data, page, setPage, label = "items" }) {
  if (!data?.total) return null;
  const from = (page - 1) * data.limit + 1;
  const to = Math.min(data.total, page * data.limit);
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
      <span>Showing {from}–{to} of {data.total} {label}</span>
      {data.pages > 1 ? (
        <span className="flex gap-2">
          <button type="button" className="btn-secondary px-3 py-1 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className="btn-secondary px-3 py-1 text-xs" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      ) : null}
    </div>
  );
}
