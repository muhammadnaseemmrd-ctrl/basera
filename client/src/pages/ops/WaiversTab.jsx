import { useState } from "react";
import { api } from "../../services/api";
import { Notice, Pill } from "./opsUi";
import { dateShort, errMsg, money, useLoad } from "./opsHelpers";

function Decide({ request, onDone }) {
  const [amount, setAmount] = useState(String(request.requestAll ? request.waivableNow : request.requestedAmount ?? ""));
  const [note, setNote] = useState("");
  const [freeze, setFreeze] = useState(false);
  const [msg, setMsg] = useState("");
  const send = async (decision) => {
    try {
      await api.post(`/fees/waivers/${request.id}/decide`, { decision, amount: decision === "approve" ? Number(amount) : undefined, note, freeze });
      onDone();
    } catch (error) {
      setMsg(errMsg(error));
    }
  };
  return (
    <div className="mt-3 grid gap-2 rounded-md bg-primary-50 p-3 sm:grid-cols-[8rem_1fr_auto]">
      {msg ? <p className="text-sm font-semibold text-[#991B1B] sm:col-span-3">{msg}</p> : null}
      <label className="grid gap-1 text-xs font-semibold">Amount (max {money(request.waivableNow)})<input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="grid gap-1 text-xs font-semibold">Decision note (required, shown to the student)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} /> waive &amp; freeze</label>
        <button type="button" disabled={!note.trim()} onClick={() => send("approve")} className="btn-primary px-3 py-1 text-xs">Approve</button>
        <button type="button" disabled={!note.trim()} onClick={() => send("reject")} className="btn-secondary px-3 py-1 text-xs">Reject</button>
      </div>
    </div>
  );
}

export function WaiversTab({ hostelId, mode }) {
  const isHead = mode === "head_office";
  const [status, setStatus] = useState("pending");
  const list = useLoad(`/fees/waivers?hostelId=${hostelId}${status ? `&status=${status}` : ""}`);
  const report = useLoad(isHead ? `/fees/waivers/report?hostelId=${hostelId}` : null);
  const [open, setOpen] = useState("");
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const recommend = async (r) => {
    const note = window.prompt("Your recommendation for head office:");
    if (!note) return;
    try {
      await api.post(`/fees/waivers/${r.id}/recommend`, { note });
      setMsg({ tone: "ok", text: "Recommendation added." });
      list.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <div className="grid gap-6">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <section className="panel min-w-0 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Fine waiver requests</h3>
          <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="partial">Partial</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="">All</option>
          </select>
        </div>
        {list.loading ? <p>Loading…</p> : list.error ? <Notice tone="error">{list.error}</Notice> : !list.data.results.length ? <p className="text-sm text-slate-700">No requests.</p> : (
          <div className="grid gap-3">
            {list.data.results.map((r) => (
              <article key={r.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{r.student?.name} <span className="font-normal text-slate-600">· {r.invoice?.title} · {r.requestAll ? "all" : money(r.requestedAmount)} asked · {r.ageDays} day(s) old</span></p>
                  <p><Pill value={r.status === "approved" ? "paid" : r.status === "partial" ? "partial" : r.status === "pending" ? "pending" : "unpaid"} /> {r.status}</p>
                </div>
                <p className="mt-1 text-sm">“{r.reason}”{r.onBehalf ? <span className="ml-2 rounded bg-[#FEF3C7] px-1.5 text-xs font-bold text-[#92400E]">filed by warden</span> : null}</p>
                {r.recommendations?.length ? <ul className="mt-1 text-xs text-slate-700">{r.recommendations.map((x, k) => <li key={k}>Warden {x.byName}: “{x.note}” · {dateShort(x.at)}</li>)}</ul> : null}
                {r.decisionNote ? <p className="mt-1 text-xs text-slate-700">Decision: {r.decisionNote}{r.approvedAmount ? ` · ${money(r.approvedAmount)} waived` : ""}</p> : null}
                {r.status === "pending" ? (
                  isHead ? (
                    open === r.id ? <Decide request={r} onDone={() => { setOpen(""); list.reload(); report.reload(); }} /> : <button type="button" onClick={() => setOpen(r.id)} className="btn-secondary mt-2 px-3 py-1 text-xs">Decide</button>
                  ) : (
                    <button type="button" onClick={() => recommend(r)} className="btn-secondary mt-2 px-3 py-1 text-xs">Add recommendation</button>
                  )
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      {isHead && report.data ? (
        <section className="panel min-w-0 p-5">
          <h3 className="mb-3 text-lg font-bold">Fines charged vs waived (by month due)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-600"><tr>{["Month", "Charged", "Waived", "Paid", "Outstanding", "Invoices"].map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}</tr></thead>
              <tbody>
                {report.data.results.map((m) => (
                  <tr key={m.month} className="border-t border-line"><td className="py-1 pr-3 font-semibold">{m.month}</td><td className="pr-3">{money(m.charged)}</td><td className="pr-3">{money(m.waived)}</td><td className="pr-3">{money(m.paid)}</td><td className="pr-3">{money(m.outstanding)}</td><td>{m.invoices}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
