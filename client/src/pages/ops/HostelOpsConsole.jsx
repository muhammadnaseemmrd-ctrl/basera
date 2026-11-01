import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Building2, ShieldAlert } from "lucide-react";
import { api } from "../../services/api";
import { downloadApiPdf } from "../../utils/downloadFile";
import { ComplaintTimeline, InvoiceBreakdown, Notice, Pager, Pill, SeatBlocks, SeatLegend, Tabs } from "./opsUi";
import { dateShort, errMsg, money, uploadProof, useLoad } from "./opsHelpers";
import { PoliciesTab } from "./PoliciesTab";
import { ResidentsTab } from "./ResidentsTab";
import { WaiversTab } from "./WaiversTab";
import { LeaveTab } from "./LeaveTab";
import { OffersTab } from "./OffersTab";
import { ExpensesTab, ReportsTab, SetupWizard, TransfersTab, VisitorsTab } from "./OperationsExtras";

const open = (url) => window.open(url, "_blank", "noopener,noreferrer");

/* ------------------------------------------------------------------ Overview */
function AllHostels() {
  const { data, loading, error } = useLoad("/head-office/overview");
  if (loading || error || !data) return null;
  const { totals } = data;
  return (
    <section className="panel min-w-0 mb-6 p-5">
      <h3 className="mb-3 text-lg font-bold">All hostels ({data.hostels.length})</h3>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><b>{totals.residents}</b> residents</p>
        <p><b>{totals.seats.free || 0}</b> of {totals.seats.total || 0} seats free · {totals.seats.occupancyPct}% occupied</p>
        <p><b>{money(totals.fees.collected)}</b> collected · {money(totals.fees.outstanding)} pending</p>
        <p><b>{totals.complaints.openOverThreeDays}</b> complaints open over 3 days</p>
      </div>
      {data.truncated ? <p className="mt-2 text-xs text-slate-600">Showing the first 50 hostels.</p> : null}
    </section>
  );
}

function Overview({ hostelId }) {
  const { data, loading, error } = useLoad(`/head-office/hostels/${hostelId}/overview`);
  if (loading) return <p>Loading overview…</p>;
  if (error) return <Notice tone="error">{error}</Notice>;
  const { seats, fees, complaints, staff } = data;
  const tile = (label, value, hint) => (
    <div className="panel min-w-0 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
  const c = complaints.byStatus || {};
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Residents", data.residents)}
        {tile("Seats free", seats.free, `of ${seats.total} · ${seats.occupancyPct}% occupied`)}
        {tile("Reserved", seats.reserved, "awaiting payment / owner hold")}
        {tile("Maintenance / offline", `${seats.maintenance} / ${seats.booked_offline}`)}
        {tile("Collected (this month)", money(fees.collectedThisMonthTotal))}
        {tile("Outstanding", money(fees.outstanding), `${fees.invoices.unpaid} unpaid · ${fees.invoices.partial} partial`)}
        {tile("Open complaints", (c.raised || 0) + (c.under_review || 0) + (c.in_progress || 0) + (c.reopened || 0) + (c.escalated || 0), `${complaints.openOverThreeDays} older than 3 days`)}
        {tile("Staff active", staff.active || 0, `${staff.suspended || 0} suspended · ${staff.terminated || 0} terminated`)}
      </div>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Occupancy by block</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-600">
              <tr>{["Block", "Warden", "Free", "Reserved", "Occupied", "Offline", "Maint.", "Total"].map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr>
            </thead>
            <tbody>
              {seats.blocks.map((b) => (
                <tr key={b.id || "u"} className="border-t border-line">
                  <td className="py-2 pr-4 font-semibold">{b.name}</td>
                  <td className="pr-4">{b.warden?.name || <span className="text-[#B45309]">None</span>}</td>
                  <td className="pr-4">{b.free}</td><td className="pr-4">{b.reserved}</td><td className="pr-4">{b.occupied}</td>
                  <td className="pr-4">{b.booked_offline}</td><td className="pr-4">{b.maintenance}</td><td className="font-bold">{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {data.notices?.length ? (
        <section className="panel min-w-0 p-5">
          <h3 className="mb-2 text-lg font-bold">Latest notices</h3>
          <ul className="grid gap-1 text-sm">{data.notices.map((n) => <li key={n._id}><Pill value={n.type} /> {n.title} · {dateShort(n.createdAt)}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------- Seats */
function Seats({ hostelId, mode, blocks }) {
  const path = mode === "head_office" ? `/head-office/hostels/${hostelId}/seats` : null;
  const head = useLoad(path);
  const [wardenMaps, setWardenMaps] = useState({ blocks: [], summary: null, loading: mode === "warden", error: "" });
  const [sel, setSel] = useState("");

  // `blocks` is a fresh array every render; key the effect on the ids so it doesn't loop.
  const blockKey = blocks.map((b) => b.id || b._id).join(",");
  useEffect(() => {
    if (mode !== "warden") return;
    let ignore = false;
    (async () => {
      try {
        const all = await Promise.all(blockKey.split(",").filter(Boolean).map((id) => api.get(`/blocks/${id}/seats`).then((r) => r.data)));
        if (ignore) return;
        const merged = all.flatMap((m) => m.blocks);
        const summary = merged.reduce((acc, b) => {
          Object.keys(b.summary).forEach((k) => { if (k !== "occupancyPct") acc[k] = (acc[k] || 0) + b.summary[k]; });
          return acc;
        }, {});
        summary.occupancyPct = summary.total ? Math.round(((summary.occupied + summary.booked_offline) / summary.total) * 100) : 0;
        setWardenMaps({ blocks: merged, summary, loading: false, error: "" });
      } catch (error) {
        if (!ignore) setWardenMaps({ blocks: [], summary: null, loading: false, error: errMsg(error) });
      }
    })();
    return () => { ignore = true; };
  }, [mode, blockKey]);

  const loading = mode === "head_office" ? head.loading : wardenMaps.loading;
  const error = mode === "head_office" ? head.error : wardenMaps.error;
  const map = mode === "head_office" ? head.data : wardenMaps;
  if (loading) return <p>Loading seat map…</p>;
  if (error) return <Notice tone="error">{error}</Notice>;
  const shown = (map?.blocks || []).filter((b) => !sel || (b.id || "u") === sel);
  return (
    <div>
      <SeatLegend summary={map?.summary} />
      {(map?.blocks || []).length > 1 ? (
        <select className="input mb-4 max-w-xs" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Filter by block">
          <option value="">All blocks</option>
          {map.blocks.map((b) => <option key={b.id || "u"} value={b.id || "u"}>{b.name}</option>)}
        </select>
      ) : null}
      <SeatBlocks blocks={shown} />
      <p className="mt-4 text-xs text-slate-600">Hold a seat, mark it booked offline or release it from the Warden Dashboard → Seats screen.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- Fees */
function CollectForm({ invoice, onDone }) {
  const [f, setF] = useState({ amount: invoice.balance, method: "cash", transactionId: "", bankName: "", screenshotUrl: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const needsProof = f.method !== "cash";

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadProof(file);
      setF((s) => ({ ...s, screenshotUrl: url }));
      setMsg({ tone: "ok", text: "Screenshot attached." });
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ tone: "info", text: "" });
    try {
      const { data } = await api.post(`/fees/invoices/${invoice.id}/payments`, { ...f, amount: Number(f.amount) });
      onDone(data);
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-lg border border-line bg-canvas p-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold">Amount (PKR)
        <input className="input" type="number" min="1" max={invoice.balance} step="1" required value={f.amount} onChange={set("amount")} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Method
        <select className="input" value={f.method} onChange={set("method")}>
          <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
          <option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option><option value="cheque">Cheque</option>
        </select>
      </label>
      {needsProof ? (
        <>
          <label className="grid gap-1 text-sm font-semibold">Transaction ID
            <input className="input" value={f.transactionId} onChange={set("transactionId")} placeholder="e.g. TID 8839201" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Bank / wallet
            <input className="input" value={f.bankName} onChange={set("bankName")} placeholder="HBL, Meezan…" />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">…or payment screenshot
            <input className="input" type="file" accept="image/*" onChange={onFile} />
            {f.screenshotUrl ? <span className="text-xs text-accent-700">Attached ✓</span> : <span className="text-xs text-slate-600">Transaction ID or screenshot is required.</span>}
          </label>
        </>
      ) : null}
      <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Note (optional)
        <input className="input" value={f.note} onChange={set("note")} />
      </label>
      <div className="sm:col-span-2">
        <Notice tone={msg.tone}>{msg.text}</Notice>
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Record payment & issue receipt"}</button>
      </div>
    </form>
  );
}

function ReceiptActions({ paymentId, receiptNo }) {
  const [msg, setMsg] = useState("");
  const pdf = async () => {
    try { await downloadApiPdf({ api, endpoint: `/fees/payments/${paymentId}/receipt.pdf`, filename: `${receiptNo}.pdf` }); } catch (e) { setMsg(errMsg(e)); }
  };
  const share = async () => {
    try { const { data } = await api.get(`/fees/payments/${paymentId}/whatsapp`); open(data.link); } catch (e) { setMsg(errMsg(e)); }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={pdf} className="btn-secondary px-3 py-1 text-xs">Receipt PDF</button>
      <button type="button" onClick={share} className="rounded-md bg-[#25D366] px-3 py-1 text-xs font-bold text-white">Share on WhatsApp</button>
      {msg ? <span className="text-xs text-[#991B1B]">{msg}</span> : null}
    </span>
  );
}

function Fees({ hostelId, blockId, mode }) {
  const q = `hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}`;
  const [status, setStatus] = useState("");
  // lists are paged on the server; a big hostel has far more invoices than one screen
  const [invPage, setInvPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const inv = useLoad(`/fees/invoices?${q}${status ? `&status=${status}` : ""}&page=${invPage}`);
  const pays = useLoad(`/fees/payments?${q}&page=${payPage}`);
  const studs = useLoad(`/fees/students?${q}`);
  const [collecting, setCollecting] = useState("");
  const [last, setLast] = useState(null);
  const [form, setForm] = useState({ studentId: "", title: "Monthly rent", amount: "", period: new Date().toISOString().slice(0, 7), dueDate: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });

  const reloadAll = () => { inv.reload(); pays.reload(); studs.reload(); };
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fees/invoices", { hostelId, ...form, amount: Number(form.amount), kind: "rent" });
      setMsg({ tone: "ok", text: "Invoice created." });
      reloadAll();
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };
  const bulk = async () => {
    if (!form.amount || !window.confirm(`Bill every resident ${money(form.amount)} for ${form.period}? Existing invoices for the period are skipped.`)) return;
    try {
      const { data } = await api.post("/fees/invoices/bulk", { hostelId, blockId: blockId || undefined, ...form, amount: Number(form.amount), kind: "rent" });
      setMsg({ tone: "ok", text: `${data.created} invoices created, ${data.skipped} skipped (already billed).` });
      reloadAll();
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };
  const waive = async (i) => {
    const amount = window.prompt(`Waive how much of the PKR ${i.fineDue} fine? (number or "all")`, "all");
    if (!amount) return;
    const reason = window.prompt("Reason (required, shown to the student):");
    if (!reason) return;
    try {
      await api.post(`/fees/invoices/${i.id}/waive`, { amount: amount === "all" ? "all" : Number(amount), reason });
      setMsg({ tone: "ok", text: "Fine waived." });
      reloadAll();
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };
  const applyOffer = async (i) => {
    try {
      const { data } = await api.get(`/hostel-offers?hostelId=${hostelId}`);
      const usable = data.results.filter((o) => o.status === "active" && o.trigger !== "early_payment");
      if (!usable.length) return setMsg({ tone: "info", text: "No active offers that can be applied by hand. Create one in Offers." });
      const pick = window.prompt(`Apply which offer to ${i.title}?\n${usable.map((o, k) => `${k + 1}. ${o.name}`).join("\n")}`, "1");
      const offer = usable[Number(pick) - 1];
      if (!offer) return undefined;
      const { data: out } = await api.post("/hostel-offers/apply", { invoiceId: i.id, offerId: offer.id });
      setMsg({ tone: "ok", text: out.redemption.status === "applied" ? `${offer.name}: −${money(out.redemption.amountOff)} applied.` : "Sent to head office for approval." });
      reloadAll();
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
    return undefined;
  };
  const requestOnBehalf = async (i) => {
    const reason = window.prompt(`Why should the PKR ${i.fineDue} fine be waived? (sent to head office, flagged as filed by you)`);
    if (!reason) return;
    try {
      await api.post("/fees/waivers", { invoiceId: i.id, amount: "all", reason });
      setMsg({ tone: "ok", text: "Waiver request sent to head office." });
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };
  const voidPayment = async (p) => {
    const reason = window.prompt(`Void receipt ${p.receiptNo}? Enter the reason:`);
    if (!reason) return;
    try { await api.post(`/fees/payments/${p.id}/void`, { reason }); reloadAll(); } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };

  const rows = inv.data?.results || [];
  return (
    <div className="grid gap-8">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {last ? (
        <div className="rounded-lg border border-accent-700 bg-accent-50 p-4">
          <p className="font-bold text-accent-800">Receipt {last.receiptNo} issued — balance {money(last.balance)}</p>
          <div className="mt-2"><ReceiptActions paymentId={last.payment.id} receiptNo={last.receiptNo} /></div>
        </div>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Create invoice</h3>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-5">
          <select className="input sm:col-span-2" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} aria-label="Student">
            <option value="">Select student…</option>
            {(studs.data?.results || []).map((s) => <option key={s.studentId} value={s.studentId}>{s.name} · Room {s.roomNumber}{s.balanceDue ? ` · owes ${money(s.balanceDue)}` : ""}</option>)}
          </select>
          <input className="input" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" required type="number" min="1" step="1" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="input" required placeholder="Period 2026-11" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
          <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} aria-label="Due date" />
          <div className="flex gap-2 sm:col-span-4">
            <button className="btn-primary">Create invoice</button>
            {mode === "head_office" ? <button type="button" onClick={bulk} className="btn-secondary">Bill all residents</button> : null}
          </div>
        </form>
      </section>

      <section className="panel min-w-0 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Invoices</h3>
          <select className="input max-w-[10rem]" value={status} onChange={(e) => { setStatus(e.target.value); setInvPage(1); }} aria-label="Status filter">
            <option value="">All</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option>
          </select>
        </div>
        <Pager data={inv.data} page={invPage} setPage={setInvPage} label="invoices" />
        {inv.loading ? <p>Loading…</p> : inv.error ? <Notice tone="error">{inv.error}</Notice> : !rows.length ? <p className="text-slate-700">No invoices.</p> : (
          <div className="grid gap-3">
            {rows.map((i) => (
              <article key={i.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{i.student?.name} <span className="font-normal text-slate-600">· {i.title}{i.period ? ` (${i.period})` : ""}</span></p>
                  <p className="text-sm"><Pill value={i.status} /> {i.fineAccrued ? <span className="ml-1 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-bold text-[#991B1B]">fine {i.fineStatus}</span> : null}{i.balance > 0 ? <b className="ml-2">Due {money(i.balance)}</b> : null}</p>
                </div>
                <InvoiceBreakdown invoice={i} />
                {mode === "head_office" && i.fineDue > 0 ? <button type="button" onClick={() => waive(i)} className="mt-2 mr-2 text-xs font-semibold text-primary-800 underline">Waive fine</button> : null}
                {i.rentDue > 0 && i.status !== "void" ? <button type="button" onClick={() => applyOffer(i)} className="mt-2 mr-2 text-xs font-semibold text-primary-800 underline">Apply offer</button> : null}
                {mode === "warden" && i.fineDue > 0 ? <button type="button" onClick={() => requestOnBehalf(i)} className="mt-2 mr-2 text-xs font-semibold text-primary-800 underline">Request waiver for student</button> : null}
                {i.balance > 0 && i.status !== "void" ? (
                  collecting === i.id
                    ? <CollectForm invoice={i} onDone={(d) => { setCollecting(""); setLast(d); reloadAll(); }} />
                    : <button type="button" onClick={() => setCollecting(i.id)} className="btn-secondary mt-2 px-3 py-1 text-xs">Collect payment</button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Receipts</h3>
        <Pager data={pays.data} page={payPage} setPage={setPayPage} label="receipts" />
        {pays.loading ? <p>Loading…</p> : !(pays.data?.results || []).length ? <p className="text-slate-700">No payments yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-600"><tr>{["Receipt", "Student", "Amount", "Method", "Ref", "By", "Date", ""].map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr></thead>
            <tbody>
              {pays.data.results.map((p) => (
                <tr key={p.id} className={`border-t border-line ${p.status === "void" ? "opacity-50 line-through" : ""}`}>
                  <td className="py-2 pr-3 font-mono text-xs">{p.receiptNo}</td><td className="pr-3">{p.student?.name}</td><td className="pr-3">{money(p.amount)}</td>
                  <td className="pr-3 capitalize">{p.method.replace("_", " ")}</td><td className="pr-3">{p.transactionId || (p.screenshotUrl ? "screenshot" : "cash")}</td>
                  <td className="pr-3">{p.receivedByName}</td><td className="pr-3">{dateShort(p.paidAt)}</td>
                  <td className="py-2">
                    {p.status === "confirmed" ? <ReceiptActions paymentId={p.id} receiptNo={p.receiptNo} /> : <Pill value="void" />}
                    {mode === "head_office" && p.status === "confirmed" ? <button type="button" onClick={() => voidPayment(p)} className="ml-2 text-xs font-semibold text-[#991B1B] underline">Void</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Complaints */
const NEXT = {
  raised: [["under_review", "Start review", "warden"]],
  under_review: [["in_progress", "Mark in progress", "warden"], ["fixed", "Mark fixed", "warden"]],
  in_progress: [["fixed", "Mark fixed", "warden"]],
  reopened: [["under_review", "Re-review", "warden"], ["in_progress", "Mark in progress", "warden"]],
  escalated: [["in_progress", "Mark in progress", "head"], ["fixed", "Mark fixed", "head"]]
};

function Complaints({ hostelId, blockId, mode }) {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useLoad(`/complaints?hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}${status ? `&status=${status}` : ""}`);
  const [msg, setMsg] = useState("");
  const [now] = useState(() => Date.now());
  const act = async (c, to) => {
    const needsNote = ["fixed", "escalated"].includes(to);
    const note = needsNote ? window.prompt(to === "fixed" ? "What was done to fix it?" : "Why escalate to head office?") : window.prompt("Add a note (optional)") || "";
    if (needsNote && !note) return;
    try { await api.post(`/complaints/${c.id}/status`, { status: to, note }); reload(); } catch (e) { setMsg(errMsg(e)); }
  };
  return (
    <div>
      <Notice tone="error">{msg}</Notice>
      <select className="input mb-4 max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
        <option value="">All statuses</option>
        {["raised", "under_review", "in_progress", "fixed", "resolved", "reopened", "escalated"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      {loading ? <p>Loading…</p> : error ? <Notice tone="error">{error}</Notice> : !data.results.length ? <p className="text-slate-700">No complaints.</p> : (
        <div className="grid gap-3">
          {data.results.map((c) => {
            const old = !["resolved", "fixed"].includes(c.status) && now - new Date(c.createdAt) > 3 * 86400000;
            return (
              <article key={c.id} className="panel min-w-0 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{c.title} <span className="font-normal text-slate-600">· {c.category.replace("_", " ")} · Room {c.room?.roomNumber || "-"} · {c.student?.name}</span></p>
                  <p><Pill value={c.status} /> {old ? <span className="ml-1 text-xs font-bold text-[#991B1B]">overdue</span> : null}</p>
                </div>
                <p className="mt-1 text-sm text-slate-700">{c.description}</p>
                <ComplaintTimeline items={c.timeline} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(NEXT[c.status] || []).filter(([, , who]) => who === "warden" || mode === "head_office").map(([to, label]) => <button key={to} type="button" onClick={() => act(c, to)} className="btn-primary px-3 py-1 text-xs">{label}</button>)}
                  {mode === "head_office" && ["raised", "under_review", "in_progress", "reopened"].includes(c.status) ? <button type="button" onClick={() => act(c, "escalated")} className="btn-secondary px-3 py-1 text-xs">Escalate to head office</button> : null}
                  {c.status === "fixed" ? <span className="text-xs text-slate-600">Waiting for the student to confirm.</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Staff */
function Staff({ hostelId, blocks }) {
  const { data, loading, error, reload } = useLoad(`/staff?hostelId=${hostelId}`);
  const [f, setF] = useState({ name: "", phone: "", role: "warden", blockId: "", email: "", password: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [result, setResult] = useState(null);
  const canLogin = ["warden", "assistant_warden"].includes(f.role);

  const add = async (e) => {
    e.preventDefault();
    try {
      const body = { hostelId, name: f.name, phone: f.phone, role: f.role, blockIds: f.blockId ? [f.blockId] : [] };
      if (canLogin && f.email) body.login = { email: f.email, password: f.password };
      await api.post("/staff", body);
      setMsg({ tone: "ok", text: "Staff member added." });
      setF({ name: "", phone: "", role: "warden", blockId: "", email: "", password: "" });
      reload();
    } catch (error2) { setMsg({ tone: "error", text: errMsg(error2) }); }
  };
  const suspend = async (s) => {
    const reason = window.prompt(`Suspend ${s.name}? Reason:`);
    if (!reason) return;
    try { await api.post(`/staff/${s.id}/suspend`, { reason }); reload(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  const reinstate = async (s) => { try { await api.post(`/staff/${s.id}/reinstate`); reload(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } };
  const terminate = async (s) => {
    const reason = window.prompt(`TERMINATE ${s.name}?\n\nEvery student and parent in ${s.blocks?.length ? "their block" : "the hostel"} will be told not to pay this person.\n\nEnter the reason:`);
    if (!reason) return;
    try {
      const { data: d } = await api.post(`/staff/${s.id}/terminate`, { reason });
      setResult(d);
      reload();
    } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };

  return (
    <div className="grid gap-8">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {result ? (
        <section className="rounded-lg border border-[#C81E1E] bg-[#FEF2F2] p-5">
          <h3 className="text-lg font-bold text-[#991B1B]">{result.staff.name} terminated — notice sent</h3>
          <p className="mt-1 text-sm">{result.recipients.students} students and {result.recipients.parents} guardians covered · {result.recipients.inAppNotified} in-app notifications delivered. Login disabled.</p>
          <p className="mt-3 text-sm font-semibold">Also send it on WhatsApp (one tap each):</p>
          <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {result.whatsapp.map((w, i) => <button key={i} type="button" onClick={() => open(w.link)} className="rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white">{w.audience === "parent" ? "Parent" : "Student"}: {w.name}</button>)}
          </div>
          <button type="button" onClick={() => setResult(null)} className="btn-secondary mt-3 px-3 py-1 text-xs">Dismiss</button>
        </section>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Add staff member</h3>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
          <input className="input" required placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" required placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Role">
            {["warden", "assistant_warden", "manager", "accountant", "cook", "guard", "cleaner", "maintenance", "other"].map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
          <select className="input" value={f.blockId} onChange={(e) => setF({ ...f, blockId: e.target.value })} aria-label="Block">
            <option value="">No block (hostel-wide)</option>
            {blocks.map((b) => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}
          </select>
          {canLogin ? <><input className="input" type="email" placeholder="Login email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><input className="input" type="password" minLength={8} placeholder="Temporary password (8+)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required={Boolean(f.email)} /></> : null}
          <div className="sm:col-span-3"><button className="btn-primary">Add</button></div>
        </form>
      </section>

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Staff</h3>
        {loading ? <p>Loading…</p> : error ? <Notice tone="error">{error}</Notice> : !data.results.length ? <p className="text-slate-700">No staff yet.</p> : (
          <div className="grid gap-3">
            {data.results.map((s) => (
              <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                <div>
                  <p className="font-semibold">{s.name} <span className="font-normal capitalize text-slate-600">· {s.role.replace("_", " ")} · {s.phone}</span></p>
                  <p className="text-xs text-slate-600">{s.blocks?.length ? s.blocks.map((b) => b.name).join(", ") : "Hostel-wide"}{s.user?.email ? ` · login ${s.user.email}` : ""}</p>
                  {s.status === "terminated" ? <p className="text-xs text-[#991B1B]">Terminated {dateShort(s.terminatedAt)} — {s.terminationReason}</p> : null}
                  {s.status === "suspended" ? <p className="text-xs text-[#92400E]">Suspended — {s.suspensionReason}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Pill value={s.status} />
                  {s.status === "active" ? <button type="button" onClick={() => suspend(s)} className="btn-secondary px-3 py-1 text-xs">Suspend</button> : null}
                  {s.status === "suspended" ? <button type="button" onClick={() => reinstate(s)} className="btn-secondary px-3 py-1 text-xs">Reinstate</button> : null}
                  {s.status !== "terminated" ? <button type="button" onClick={() => terminate(s)} className="rounded-md bg-[#C81E1E] px-3 py-1 text-xs font-bold text-white">Terminate…</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Parents */
function Parents({ hostelId, blockId }) {
  const studs = useLoad(`/fees/students?hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}`);
  const links = useLoad(`/parent-panel/links?hostelId=${hostelId}`);
  const [f, setF] = useState({ studentId: "", parentName: "", parentPhone: "", relation: "father" });
  const [out, setOut] = useState(null);
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await api.post("/parent-panel/links", { hostelId, ...f });
      setOut(data);
      links.reload();
    } catch (error) { setMsg(errMsg(error)); }
  };
  return (
    <div className="grid gap-8">
      <section className="panel min-w-0 p-5">
        <h3 className="mb-1 text-lg font-bold">Invite a parent / guardian</h3>
        <p className="mb-3 text-sm text-slate-700">The parent signs up as “Parent” and enters the one-time code. A phone number alone never gives access.</p>
        <Notice tone="error">{msg}</Notice>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <select className="input" required value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} aria-label="Student">
            <option value="">Student…</option>
            {(studs.data?.results || []).map((s) => <option key={s.studentId} value={s.studentId}>{s.name} · Room {s.roomNumber}</option>)}
          </select>
          <input className="input" placeholder="Parent name" value={f.parentName} onChange={(e) => setF({ ...f, parentName: e.target.value })} />
          <input className="input" required placeholder="Parent WhatsApp number" value={f.parentPhone} onChange={(e) => setF({ ...f, parentPhone: e.target.value })} />
          <button className="btn-primary">Create invite</button>
        </form>
        {out ? (
          <div className="mt-4 rounded-lg border border-accent-700 bg-accent-50 p-4">
            <p className="font-bold text-accent-800">Invite code: <span className="font-mono text-lg">{out.inviteCode}</span> (valid 14 days)</p>
            {out.whatsapp ? <button type="button" onClick={() => open(out.whatsapp.link)} className="mt-2 rounded-md bg-[#25D366] px-3 py-1.5 text-sm font-bold text-white">Send on WhatsApp</button> : null}
          </div>
        ) : null}
      </section>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Linked guardians</h3>
        {links.loading ? <p>Loading…</p> : !(links.data?.results || []).length ? <p className="text-slate-700">None yet.</p> : (
          <ul className="grid gap-2 text-sm">{links.data.results.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2"><Pill value={l.status} /> <b>{l.parentName || "Parent"}</b> ({l.parentPhone}) → {l.student?.name}</li>)}</ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ Notices */
function Notices({ hostelId, blocks, mode }) {
  const { data, loading, error, reload } = useLoad(mode === "head_office" ? `/notices/my?hostelId=${hostelId}` : "/notices/my");
  const [f, setF] = useState({ title: "", message: "", blockId: mode === "warden" ? blocks[0]?.id || blocks[0]?._id || "" : "", type: "general" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const post = async (e) => {
    e.preventDefault();
    try {
      await api.post("/notices", { hostelId, ...f, blockId: f.blockId || undefined });
      setF({ ...f, title: "", message: "" });
      setMsg({ tone: "ok", text: "Notice posted — students and parents will see it in their panels." });
      reload();
    } catch (err) { setMsg({ tone: "error", text: errMsg(err) }); }
  };
  return (
    <div className="grid gap-8">
      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Post a notice</h3>
        <Notice tone={msg.tone}>{msg.text}</Notice>
        <form onSubmit={post} className="grid gap-3 sm:grid-cols-2">
          <input className="input" required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className="input" value={f.blockId} onChange={(e) => setF({ ...f, blockId: e.target.value })} aria-label="Audience">
            {mode === "head_office" ? <option value="">Whole hostel</option> : null}
            {blocks.map((b) => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}
          </select>
          <textarea className="input sm:col-span-2" required rows={3} placeholder="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Type"><option value="general">General</option><option value="fee_reminder">Fee reminder</option><option value="safety">Safety</option></select>
          <div><button className="btn-primary">Post notice</button></div>
        </form>
      </section>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Notices</h3>
        {loading ? <p>Loading…</p> : error ? <Notice tone="error">{error}</Notice> : !data.results.length ? <p className="text-slate-700">No notices.</p> : (
          <ul className="grid gap-3">{data.results.map((n) => <li key={n.id} className="rounded-lg border border-line p-3"><p className="font-semibold"><Pill value={n.type} /> {n.title}</p><p className="text-sm text-slate-700">{n.message}</p><p className="mt-1 text-xs text-slate-500">{dateShort(n.createdAt)}{n.studentRecipients ? ` · ${n.studentRecipients} students` : ""}</p></li>)}</ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------- Setup */
function Setup({ hostelId, blocks, reloadBlocks }) {
  const rooms = useLoad(`/head-office/hostels/${hostelId}/rooms`);
  const students = useLoad(`/head-office/hostels/${hostelId}/students`);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [blockForm, setBlockForm] = useState({ name: "", floorCount: 1 });
  const [bulk, setBulk] = useState({ blockId: "", prefix: "", from: "", to: "", beds: 2, pricePerBed: "", floor: "" });
  const [assign, setAssign] = useState({ blockId: "", roomIds: [] });
  const [admit, setAdmit] = useState({ name: "", phone: "", email: "", roomId: "", bedIndex: 0, monthlyRent: "", guardianName: "", guardianPhone: "" });
  const [admitted, setAdmitted] = useState(null);
  const ok = (text) => setMsg({ tone: "ok", text });
  const bad = (e) => setMsg({ tone: "error", text: errMsg(e) });
  const roomList = rooms.data?.results || [];
  const selectedRoom = roomList.find((r) => r.id === admit.roomId);

  const addBlock = async (e) => {
    e.preventDefault();
    try { await api.post("/blocks", { hostelId, ...blockForm, floorCount: Number(blockForm.floorCount) }); setBlockForm({ name: "", floorCount: 1 }); ok("Block created."); reloadBlocks(); } catch (err) { bad(err); }
  };
  const addRooms = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/head-office/hostels/${hostelId}/rooms/bulk`, { ...bulk, from: Number(bulk.from), to: Number(bulk.to), beds: Number(bulk.beds), pricePerBed: Number(bulk.pricePerBed), floor: bulk.floor === "" ? undefined : Number(bulk.floor), blockId: bulk.blockId || undefined });
      ok(`${data.created} rooms created.`); rooms.reload();
    } catch (err) { bad(err); }
  };
  const doAssign = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post(`/head-office/hostels/${hostelId}/blocks/${assign.blockId || "none"}/assign-rooms`, { roomIds: assign.roomIds }); ok(`${data.updated} rooms moved.`); setAssign({ ...assign, roomIds: [] }); rooms.reload(); } catch (err) { bad(err); }
  };
  const doAdmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/head-office/hostels/${hostelId}/residents`, { ...admit, bedIndex: Number(admit.bedIndex), monthlyRent: Number(admit.monthlyRent) });
      setAdmitted(data); ok(`${data.student.name} admitted to room ${data.booking.room}, seat ${data.booking.bed}.`);
      setAdmit({ ...admit, name: "", phone: "", email: "", guardianName: "", guardianPhone: "" }); rooms.reload(); students.reload();
    } catch (err) { bad(err); }
  };
  const checkout = async (s, early = false) => {
    if (!early && !window.confirm(`Check out ${s.name}? Their seat becomes free.`)) return undefined;
    const raw = early ? s.damagesRaw : window.prompt('Damage deductions from the deposit, e.g. "Broken chair: 1500; Lost key: 500" (leave empty for none):', "");
    if (raw === null) return undefined;
    const damages = String(raw || "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
      const [label, amount] = x.split(":");
      return { label: (label || "Damage").trim(), amount: Number(String(amount || "").trim()) };
    });
    try {
      const { data } = await api.post(`/head-office/hostels/${hostelId}/residents/${s.bookingId}/checkout`, { damages, early });
      const st = data.settlement;
      ok(`Checked out. Deposit ${money(st.deposit)} − dues ${money(st.duesTotal)} − damages ${money(st.damagesTotal)} = ${st.refund ? `refund ${money(st.refund)}` : st.payable ? `still payable ${money(st.payable)}` : "nothing to settle"}.`);
      students.reload();
      rooms.reload();
    } catch (err) {
      const message = err?.response?.data?.message || "";
      if (!early && /leave date/.test(message) && window.confirm(`${message}\n\nCheck out early anyway?`)) return checkout({ ...s, damagesRaw: raw }, true);
      bad(err);
    }
    return undefined;
  };
  const blockName = (id) => blocks.find((b) => (b.id || b._id) === String(id))?.name || "—";

  return (
    <div className="grid gap-8">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="panel min-w-0 p-5">
          <h3 className="mb-3 text-lg font-bold">1. Create a block</h3>
          <form onSubmit={addBlock} className="flex flex-wrap gap-3">
            <input className="input max-w-[12rem]" required placeholder="Block A" value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} />
            <input className="input max-w-[7rem]" type="number" min="1" value={blockForm.floorCount} onChange={(e) => setBlockForm({ ...blockForm, floorCount: e.target.value })} aria-label="Floors" />
            <button className="btn-primary">Add block</button>
          </form>
          <p className="mt-3 text-sm text-slate-700">Blocks: {blocks.length ? blocks.map((b) => b.name).join(", ") : "none yet"}</p>
        </section>

        <section className="panel min-w-0 p-5">
          <h3 className="mb-3 text-lg font-bold">2. Add rooms in bulk</h3>
          <form onSubmit={addRooms} className="grid grid-cols-2 gap-3">
            <select className="input col-span-2" value={bulk.blockId} onChange={(e) => setBulk({ ...bulk, blockId: e.target.value })} aria-label="Block"><option value="">No block yet</option>{blocks.map((b) => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}</select>
            <input className="input" placeholder="Prefix (optional)" maxLength={6} value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} />
            <input className="input" type="number" placeholder="Floor" value={bulk.floor} onChange={(e) => setBulk({ ...bulk, floor: e.target.value })} />
            <input className="input" required type="number" placeholder="From no. (101)" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} />
            <input className="input" required type="number" placeholder="To no. (120)" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} />
            <input className="input" required type="number" min="1" max="12" placeholder="Seats per room" value={bulk.beds} onChange={(e) => setBulk({ ...bulk, beds: e.target.value })} />
            <input className="input" required type="number" min="0" placeholder="Rent per seat (PKR)" value={bulk.pricePerBed} onChange={(e) => setBulk({ ...bulk, pricePerBed: e.target.value })} />
            <div className="col-span-2"><button className="btn-primary">Create rooms</button></div>
          </form>
        </section>
      </div>

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">3. Rooms ({roomList.length}) — move into a block</h3>
        {rooms.loading ? <p>Loading…</p> : !roomList.length ? <p className="text-slate-700">No rooms yet.</p> : (
          <form onSubmit={doAssign}>
            <div className="mb-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {roomList.map((r) => (
                <label key={r.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs ${assign.roomIds.includes(r.id) ? "border-primary-700 bg-primary-50 font-bold" : "border-line"}`}>
                  <input type="checkbox" className="sr-only" checked={assign.roomIds.includes(r.id)} onChange={(e) => setAssign((a) => ({ ...a, roomIds: e.target.checked ? [...a.roomIds, r.id] : a.roomIds.filter((x) => x !== r.id) }))} />
                  {r.roomNumber} · {r.totalBeds} seats · {blockName(r.blockId)}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="input max-w-xs" value={assign.blockId} onChange={(e) => setAssign({ ...assign, blockId: e.target.value })} aria-label="Target block"><option value="">Remove from block</option>{blocks.map((b) => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}</select>
              <button className="btn-secondary" disabled={!assign.roomIds.length}>Move {assign.roomIds.length || ""} selected</button>
            </div>
          </form>
        )}
      </section>

      <section className="panel min-w-0 p-5">
        <h3 className="mb-1 text-lg font-bold">4. Admit a current resident to a seat</h3>
        <p className="mb-3 text-sm text-slate-700">For students already living in the hostel (or who paid you directly). Creates their login and takes the seat off the marketplace.</p>
        <form onSubmit={doAdmit} className="grid gap-3 sm:grid-cols-4">
          <input className="input" required placeholder="Student name" value={admit.name} onChange={(e) => setAdmit({ ...admit, name: e.target.value })} />
          <input className="input" required placeholder="Student phone" value={admit.phone} onChange={(e) => setAdmit({ ...admit, phone: e.target.value })} />
          <input className="input" type="email" placeholder="Email (optional)" value={admit.email} onChange={(e) => setAdmit({ ...admit, email: e.target.value })} />
          <input className="input" required type="number" min="0" placeholder="Monthly rent" value={admit.monthlyRent} onChange={(e) => setAdmit({ ...admit, monthlyRent: e.target.value })} />
          <select className="input sm:col-span-2" required value={admit.roomId} onChange={(e) => setAdmit({ ...admit, roomId: e.target.value, bedIndex: 0 })} aria-label="Room"><option value="">Room…</option>{roomList.map((r) => <option key={r.id} value={r.id}>{r.roomNumber} · {blockName(r.blockId)} · {r.availableBeds}/{r.totalBeds} free</option>)}</select>
          <select className="input" value={admit.bedIndex} onChange={(e) => setAdmit({ ...admit, bedIndex: e.target.value })} aria-label="Seat">{Array.from({ length: selectedRoom?.totalBeds || 1 }, (_, i) => <option key={i} value={i}>Seat {i + 1}</option>)}</select>
          <span />
          <input className="input" placeholder="Guardian name" value={admit.guardianName} onChange={(e) => setAdmit({ ...admit, guardianName: e.target.value })} />
          <input className="input" placeholder="Guardian WhatsApp" value={admit.guardianPhone} onChange={(e) => setAdmit({ ...admit, guardianPhone: e.target.value })} />
          <div className="sm:col-span-2"><button className="btn-primary">Admit resident</button></div>
        </form>
        {admitted ? (
          <div className="mt-4 rounded-lg border border-accent-700 bg-accent-50 p-4 text-sm">
            <p className="font-bold text-accent-800">Share these with the student (shown once):</p>
            <p>Login: <b>{admitted.student.email || admitted.student.phone}</b>{admitted.tempPassword ? <> · Temporary password: <b className="font-mono">{admitted.tempPassword}</b></> : " (existing account)"}</p>
            {admitted.guardian ? <p>Guardian invite code: <b className="font-mono">{admitted.guardian.inviteCode}</b> (use Parents tab to send it on WhatsApp)</p> : null}
          </div>
        ) : null}
      </section>

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Residents</h3>
        {students.loading ? <p>Loading…</p> : !(students.data?.results || []).length ? <p className="text-slate-700">No residents yet.</p> : (
          <ul className="grid gap-2 text-sm">{students.data.results.map((s) => <li key={s.bookingId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2"><span><b>{s.name}</b> · Room {s.roomNumber}, seat {Number.isInteger(s.bedIndex) ? s.bedIndex + 1 : "?"} · {blockName(s.blockId)}{s.balanceDue ? ` · owes ${money(s.balanceDue)}` : ""}</span><button type="button" onClick={() => checkout(s)} className="btn-secondary px-3 py-1 text-xs">Check out</button></li>)}</ul>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------------- Shell */
export function HostelOpsConsole({ mode }) {
  const isHead = mode === "head_office";
  const hostels = useLoad(isHead ? "/head-office/hostels" : null);
  const myBlocks = useLoad(isHead ? null : "/blocks");
  const [pickedHostel, setHostelId] = useState("");
  const [tab, setTab] = useState(isHead ? "overview" : "seats");
  const [blockFilter, setBlockFilter] = useState("");

  const wardenHostels = useMemo(() => {
    const map = new Map();
    (myBlocks.data?.results || []).forEach((b) => map.set(String(b.hostelId), true));
    return [...map.keys()];
  }, [myBlocks.data]);

  // default to the first hostel until the user picks one
  const hostelId = pickedHostel || (isHead ? hostels.data?.results?.[0]?.id : wardenHostels[0]) || "";
  const blockList = useLoad(hostelId && isHead ? `/blocks?hostelId=${hostelId}` : null);

  const blocks = isHead ? blockList.data?.results || [] : (myBlocks.data?.results || []).filter((b) => String(b.hostelId) === String(hostelId));
  const loading = isHead ? hostels.loading : myBlocks.loading;
  const loadError = isHead ? hostels.error : myBlocks.error;

  const tabs = isHead
    ? [["overview", "Overview"], ["setup", "Setup"], ["residents", "Residents"], ["seats", "Seats"], ["fees", "Fees & receipts"], ["complaints", "Complaints"], ["staff", "Staff"], ["parents", "Parents"], ["notices", "Notices"], ["waivers", "Waivers"], ["leave", "Leave requests"], ["offers", "Offers"], ["visitors", "Visitors"], ["transfers", "Transfers"], ["reports", "Reports"], ["expenses", "Expenses"], ["policies", "Policies"], ["wizard", "Setup wizard"]]
    : [["seats", "Seats"], ["residents", "Register students"], ["fees", "Collect fees"], ["complaints", "Complaints"], ["parents", "Parents"], ["notices", "Notices"], ["waivers", "Waivers"], ["leave", "Leave requests"], ["offers", "Offers"], ["visitors", "Visitors"], ["transfers", "Transfers"], ["reports", "Reports"], ["policies", "Policy"]];
  const scopeBlock = isHead ? blockFilter : "";

  return (
    <>
      <Helmet><title>{isHead ? "Head Office" : "Warden Operations"} | Basera</title></Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-800"><Building2 size={22} /></span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{isHead ? "Head Office" : "Warden Operations"}</h1>
              <p className="text-slate-700">{isHead ? "Seats, fees, staff, complaints and parents — every block in one place." : "Your block: seats, fee collection and complaints."}</p>
            </div>
          </div>
          {isHead && hostels.data?.results?.length ? (
            <select className="input max-w-xs" value={hostelId} onChange={(e) => { setHostelId(e.target.value); setBlockFilter(""); }} aria-label="Hostel">
              {hostels.data.results.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.city}</option>)}
            </select>
          ) : null}
        </div>

        {loading ? <p>Loading…</p> : loadError ? <Notice tone="error">{loadError}</Notice> : !hostelId ? (
          <div className="panel min-w-0 p-8 text-center">
            <ShieldAlert className="mx-auto mb-2 text-primary-800" />
            <p className="text-lg font-bold">{isHead ? "No hostels yet" : "No block assigned yet"}</p>
            <p className="mt-2 text-slate-700">{isHead ? "Create a hostel, add blocks and rooms from the host dashboard first." : "Ask the head office to assign you to a block."}</p>
          </div>
        ) : (
          <>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
            {isHead && ["fees", "complaints", "parents", "residents", "leave", "visitors", "reports"].includes(tab) && blocks.length > 1 ? (
              <select className="input mb-4 max-w-xs" value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)} aria-label="Block filter">
                <option value="">All blocks</option>
                {blocks.map((b) => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}
              </select>
            ) : null}
            {tab === "overview" && isHead ? (
              <>
                {(hostels.data?.results?.length || 0) > 1 ? <AllHostels /> : null}
                <Overview hostelId={hostelId} />
              </>
            ) : null}
            {tab === "setup" && isHead ? <Setup hostelId={hostelId} blocks={blocks} reloadBlocks={blockList.reload} /> : null}
            {tab === "seats" ? <Seats hostelId={hostelId} mode={mode} blocks={blocks} /> : null}
            {tab === "fees" ? <Fees hostelId={hostelId} blockId={scopeBlock} mode={mode} /> : null}
            {tab === "complaints" ? <Complaints hostelId={hostelId} blockId={scopeBlock} mode={mode} /> : null}
            {tab === "staff" && isHead ? <Staff hostelId={hostelId} blocks={blocks} /> : null}
            {tab === "parents" ? <Parents hostelId={hostelId} blockId={scopeBlock} /> : null}
            {tab === "notices" ? <Notices hostelId={hostelId} blocks={blocks} mode={mode} /> : null}
            {tab === "policies" ? <PoliciesTab hostelId={hostelId} /> : null}
            {tab === "waivers" ? <WaiversTab hostelId={hostelId} mode={mode} /> : null}
            {tab === "leave" ? <LeaveTab hostelId={hostelId} blockId={scopeBlock} mode={mode} /> : null}
            {tab === "offers" ? <OffersTab hostelId={hostelId} blocks={blocks} mode={mode} /> : null}
            {tab === "visitors" ? <VisitorsTab hostelId={hostelId} blockId={scopeBlock} /> : null}
            {tab === "transfers" ? <TransfersTab hostelId={hostelId} /> : null}
            {tab === "reports" ? <ReportsTab hostelId={hostelId} blockId={scopeBlock} mode={mode} /> : null}
            {tab === "expenses" && isHead ? <ExpensesTab hostelId={hostelId} /> : null}
            {tab === "wizard" && isHead ? <SetupWizard hostelId={hostelId} goTo={setTab} /> : null}
            {tab === "residents" ? <ResidentsTab hostelId={hostelId} blockId={scopeBlock} mode={mode} /> : null}
          </>
        )}
      </main>
    </>
  );
}

export const HeadOfficePage = () => <HostelOpsConsole mode="head_office" />;
export const WardenOperationsPage = () => <HostelOpsConsole mode="warden" />;
