import { useState } from "react";
import { api } from "../../services/api";
import { Notice, Pill } from "./opsUi";
import { dateShort, errMsg, useLoad } from "./opsHelpers";

// Leave requests queue for head office (all blocks) and wardens (own blocks; they can decide
// only when the hostel policy allows it — the server enforces that).
export function LeaveTab({ hostelId, blockId }) {
  const [status, setStatus] = useState("submitted");
  const list = useLoad(`/leave?hostelId=${hostelId}${status ? `&status=${status}` : ""}${blockId ? `&blockId=${blockId}` : ""}`);
  const [deciding, setDeciding] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const decide = async (n, decision) => {
    try {
      await api.post(`/leave/${n.id}/decide`, { decision, note });
      setMsg({ tone: "ok", text: `Notice ${decision === "approve" ? "approved" : "rejected"}.` });
      setDeciding("");
      setNote("");
      list.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Leave requests</h3>
        <select className="input max-w-[11rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="submitted">Waiting for decision</option>
          <option value="approved">Approved (leaving)</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="completed">Completed</option>
          <option value="">All</option>
        </select>
      </div>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {list.loading ? <p>Loading…</p> : list.error ? <Notice tone="error">{list.error}</Notice> : !list.data.results.length ? <p className="text-sm text-slate-700">Nothing here.</p> : (
        <div className="grid gap-3">
          {list.data.results.map((n) => (
            <article key={n.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{n.student?.name} <span className="font-normal text-slate-600">· Room {n.room?.roomNumber} · leaving {dateShort(n.intendedLeaveDate)} ({n.daysLeft} day(s))</span></p>
                <Pill value={n.status === "submitted" ? "pending" : n.status === "approved" ? "active" : n.status} />
              </div>
              <p className="mt-1 text-sm">
                Gave {n.noticeDaysGiven} days&apos; notice (policy {n.policyDays}).
                {n.shortBy ? <b className="ml-1 text-[#991B1B]">Short by {n.shortBy} day(s){n.shortNoticeCharge?.amount ? ` — charge PKR ${n.shortNoticeCharge.amount}` : ""}.</b> : null}
                {n.reason ? <span className="block text-slate-600">“{n.reason}”</span> : null}
              </p>
              {n.decisionNote ? <p className="text-xs text-slate-600">Decision note: {n.decisionNote}</p> : null}
              {n.depositSettlement?.settledAt ? <p className="text-xs text-slate-600">Settled: refund PKR {n.depositSettlement.refund}, payable PKR {n.depositSettlement.payable}.</p> : null}
              {n.status === "submitted" ? (
                deciding === n.id ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="grid flex-1 gap-1 text-xs font-semibold">Note (required to reject)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
                    <button type="button" onClick={() => decide(n, "approve")} className="btn-primary px-3 py-1 text-xs">Approve</button>
                    <button type="button" disabled={!note.trim()} onClick={() => decide(n, "reject")} className="btn-secondary px-3 py-1 text-xs">Reject</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDeciding(n.id)} className="btn-secondary mt-2 px-3 py-1 text-xs">Decide</button>
                )
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
