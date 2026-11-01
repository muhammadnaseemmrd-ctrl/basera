import { useState } from "react";
import { api } from "../../services/api";
import { Notice, Pill } from "./opsUi";
import { dateShort, errMsg, money, useLoad } from "./opsHelpers";

// Phase 2 extras for the head office / warden console: visitors, reports, expenses, transfers.

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ Visitors */
export function VisitorsTab({ hostelId, blockId }) {
  const [status, setStatus] = useState("");
  const list = useLoad(`/visitors?hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}${status ? `&status=${status}` : ""}`);
  const students = useLoad(`/fees/students?hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}`);
  const [f, setF] = useState({ studentId: "", visitorName: "", cnicLast4: "", purpose: "", relation: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const act = async (v, path, body = {}) => {
    try {
      await api.post(`/visitors/${v.id}/${path}`, body);
      list.reload();
    } catch (error) {
      const message = errMsg(error);
      if (path === "check-in" && /override/.test(message)) {
        const overrideNote = window.prompt(`${message}\n\nReason for letting them in:`);
        if (overrideNote) return act(v, path, { overrideNote });
      }
      setMsg({ tone: "error", text: message });
    }
    return undefined;
  };
  const log = async (e) => {
    e.preventDefault();
    try {
      await api.post("/visitors", f);
      setF({ studentId: "", visitorName: "", cnicLast4: "", purpose: "", relation: "" });
      setMsg({ tone: "ok", text: "Visitor logged and approved." });
      list.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <div className="grid gap-6">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <form onSubmit={log} className="panel min-w-0 grid gap-3 p-5 sm:grid-cols-3">
        <h3 className="text-lg font-bold sm:col-span-3">Log a walk-in visitor</h3>
        <select className="input" required value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} aria-label="Resident visited">
          <option value="">Visiting which resident…</option>
          {(students.data?.results || []).map((s) => <option key={s.studentId} value={s.studentId}>{s.name} · Room {s.roomNumber}</option>)}
        </select>
        <input className="input" required placeholder="Visitor name" value={f.visitorName} onChange={(e) => setF({ ...f, visitorName: e.target.value })} />
        <input className="input" required placeholder="CNIC last 4 digits" maxLength={4} inputMode="numeric" value={f.cnicLast4} onChange={(e) => setF({ ...f, cnicLast4: e.target.value })} />
        <input className="input" placeholder="Relation" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} />
        <input className="input sm:col-span-2" required placeholder="Purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
        <button type="submit" className="btn-primary w-fit">Log visitor</button>
      </form>
      <section className="panel min-w-0 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Visitor log</h3>
          <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="checked_in">Inside now</option>
            <option value="checked_out">Left</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        {list.loading ? <p>Loading…</p> : list.error ? <Notice tone="error">{list.error}</Notice> : !list.data.results.length ? <p className="text-sm text-slate-700">No visitors.</p> : (
          <ul className="grid gap-2 text-sm">
            {list.data.results.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
                <span><b>{v.visitorName}</b> (CNIC …{v.cnicLast4}) for {v.student?.name} · {v.purpose}{v.outsideHours ? <b className="ml-1 text-[#991B1B]">outside hours</b> : null}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Pill value={v.status === "checked_in" ? "active" : v.status} />
                  {v.status === "pending" ? <><button type="button" onClick={() => act(v, "decide", { decision: "approve" })} className="btn-primary px-2 py-1 text-xs">Approve</button><button type="button" onClick={() => act(v, "decide", { decision: "deny" })} className="btn-secondary px-2 py-1 text-xs">Deny</button></> : null}
                  {v.status === "approved" ? <button type="button" onClick={() => act(v, "check-in")} className="btn-secondary px-2 py-1 text-xs">Check in</button> : null}
                  {v.status === "checked_in" ? <button type="button" onClick={() => act(v, "check-out")} className="btn-secondary px-2 py-1 text-xs">Check out</button> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- Reports */
const REPORTS = [
  ["collections", "Collections (day / method)"],
  ["outstanding", "Outstanding & ageing"],
  ["fines", "Fines charged vs waived"],
  ["occupancy", "Occupancy by block"],
  ["movements", "Move-in / move-out"],
  ["complaints", "Complaint turnaround"],
  ["offers", "Offer usage"],
  ["profit", "Profit (head office)"]
];

export function ReportsTab({ hostelId, blockId, mode }) {
  const [report, setReport] = useState("collections");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = `hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  const data = useLoad(`/ops-reports/${report}?${q}`);
  const [msg, setMsg] = useState("");
  const download = async (format) => {
    try {
      const { data: blob } = await api.get(`/ops-reports/${report}?${q}&format=${format}`, { responseType: "blob" });
      saveBlob(blob, `${report}.${format}`);
    } catch (error) {
      setMsg(errMsg(error));
    }
  };
  const rows = data.data?.rows || [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return (
    <section className="panel min-w-0 p-5">
      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-semibold">Report
          <select className="input" value={report} onChange={(e) => setReport(e.target.value)}>
            {REPORTS.filter(([k]) => k !== "profit" || mode === "head_office").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">From<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold">To<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <span className="flex gap-2">
          <button type="button" onClick={() => download("csv")} className="btn-secondary px-3 py-2 text-xs">CSV</button>
          <button type="button" onClick={() => download("pdf")} className="btn-secondary px-3 py-2 text-xs">PDF</button>
        </span>
      </div>
      <Notice tone="error">{msg}</Notice>
      {data.loading ? <p>Loading…</p> : data.error ? <Notice tone="error">{data.error}</Notice> : (
        <>
          <p className="mb-2 text-xs text-slate-600">{data.data.range.from} to {data.data.range.to}{mode !== "head_office" ? " · your block(s) only" : ""}</p>
          {data.data.summary ? <pre className="mb-3 overflow-x-auto rounded-md bg-primary-50 p-3 text-xs">{JSON.stringify(data.data.summary, null, 2)}</pre> : null}
          {!rows.length ? <p className="text-sm text-slate-700">No rows for this range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-slate-600"><tr>{cols.map((c) => <th key={c} className="py-1 pr-3">{c}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{cols.map((c) => <td key={c} className="py-1 pr-3">{typeof r[c] === "number" && /total|due|amount|charged|waived|paid|collections|expenses|profit/i.test(c) ? money(r[c]) : String(r[c] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Expenses */
const CATEGORIES = ["salaries", "utilities", "maintenance", "food", "supplies", "rent", "taxes", "marketing", "other"];

export function ExpensesTab({ hostelId }) {
  const list = useLoad(`/expenses?hostelId=${hostelId}`);
  const profit = useLoad(`/ops-reports/profit?hostelId=${hostelId}`);
  const [f, setF] = useState({ category: "utilities", amount: "", note: "", spentOn: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/expenses", { hostelId, category: f.category, amount: Number(f.amount), note: f.note, spentOn: f.spentOn || undefined });
      setF({ category: f.category, amount: "", note: "", spentOn: "" });
      setMsg({ tone: "ok", text: "Expense recorded." });
      list.reload();
      profit.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const voidIt = async (x) => {
    const reason = window.prompt("Reason for voiding:");
    if (!reason) return;
    try {
      await api.post(`/expenses/${x.id}/void`, { reason });
      list.reload();
      profit.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <div className="grid gap-6">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {profit.data ? (
        <section className="panel min-w-0 grid gap-3 p-5 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase text-slate-600">Collections (this month)</p><p className="text-2xl font-extrabold">{money(profit.data.summary.collections)}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-600">Expenses</p><p className="text-2xl font-extrabold">{money(profit.data.summary.expenses)}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-600">Profit</p><p className={`text-2xl font-extrabold ${profit.data.summary.profit < 0 ? "text-[#991B1B]" : "text-accent-700"}`}>{money(profit.data.summary.profit)}</p></div>
          <p className="text-xs text-slate-600 sm:col-span-3">Collections exclude refundable security deposits. Use Reports → Profit for other months.</p>
        </section>
      ) : null}
      <form onSubmit={add} className="panel min-w-0 grid gap-3 p-5 sm:grid-cols-4">
        <h3 className="text-lg font-bold sm:col-span-4">Record an expense</h3>
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input className="input" required inputMode="numeric" placeholder="Amount (PKR)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input className="input" type="date" value={f.spentOn} onChange={(e) => setF({ ...f, spentOn: e.target.value })} aria-label="Date" />
        <input className="input" required placeholder="Description" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button type="submit" className="btn-primary w-fit">Save</button>
      </form>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-2 text-lg font-bold">This month · total {money(list.data?.total)}</h3>
        {list.loading ? <p>Loading…</p> : list.error ? <Notice tone="error">{list.error}</Notice> : (
          <ul className="grid gap-1 text-sm">
            {list.data.results.map((x) => (
              <li key={x.id} className={`flex flex-wrap justify-between gap-2 rounded-md border border-line p-2 ${x.status === "void" ? "opacity-50 line-through" : ""}`}>
                <span>{dateShort(x.spentOn)} · <b>{x.category}</b> · {x.note}</span>
                <span>{money(x.amount)} {x.status === "active" ? <button type="button" onClick={() => voidIt(x)} className="ml-2 text-xs font-semibold text-[#991B1B] underline">Void</button> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- Transfers */
export function TransfersTab({ hostelId }) {
  const [status, setStatus] = useState("requested");
  const list = useLoad(`/transfers?hostelId=${hostelId}${status ? `&status=${status}` : ""}`);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const decide = async (t, decision) => {
    const note = decision === "reject" ? window.prompt("Reason:") : "";
    if (decision === "reject" && !note) return;
    try {
      await api.post(`/transfers/${t.id}/decide`, { decision, note });
      setMsg({ tone: "ok", text: decision === "approve" ? "Moved." : "Rejected." });
      list.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <section className="panel min-w-0 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Room / seat transfers</h3>
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="requested">Open</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {list.loading ? <p>Loading…</p> : list.error ? <Notice tone="error">{list.error}</Notice> : !list.data.results.length ? <p className="text-sm text-slate-700">No transfers.</p> : (
        <ul className="grid gap-2 text-sm">
          {list.data.results.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
              <span><b>{t.student?.name}</b>: room {t.fromRoom?.roomNumber} seat {t.fromBed + 1} → room {t.toRoom?.roomNumber} seat {t.toBed + 1}{t.newMonthlyRent ? ` · new rent ${money(t.newMonthlyRent)}` : ""}{t.reason ? ` · “${t.reason}”` : ""}</span>
              {t.status === "requested" ? (
                <span className="flex gap-2"><button type="button" onClick={() => decide(t, "approve")} className="btn-primary px-2 py-1 text-xs">Approve & move</button><button type="button" onClick={() => decide(t, "reject")} className="btn-secondary px-2 py-1 text-xs">Reject</button></span>
              ) : <Pill value={t.status === "approved" ? "active" : t.status} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------- Setup wizard, branding, export */
export function SetupWizard({ hostelId, goTo }) {
  const ob = useLoad(`/head-office/hostels/${hostelId}/onboarding`);
  const [brand, setBrand] = useState({ logoUrl: "", receiptFooter: "", contactEmail: "", contactPhone: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const TAB_FOR = { blocks: "setup", rooms: "setup", policies: "policies", staff: "staff", students: "residents" };
  const saveBrand = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(brand).filter(([, v]) => v !== ""));
    try {
      await api.put(`/head-office/hostels/${hostelId}/branding`, body);
      setMsg({ tone: "ok", text: "Branding saved — it appears on new receipts." });
      ob.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const exportAll = async () => {
    try {
      const { data } = await api.get(`/head-office/hostels/${hostelId}/export`, { responseType: "blob" });
      saveBlob(data, `basera-hostel-export-${hostelId}.json`);
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <div className="grid gap-6">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-1 text-lg font-bold">Hostel setup checklist</h3>
        {ob.data ? <p className="mb-3 text-sm text-slate-700">Plan {ob.data.plan.tier}: {ob.data.plan.seats} seat(s){ob.data.plan.limit ? ` of ${ob.data.plan.limit}` : " (unlimited)"}.</p> : null}
        {ob.loading ? <p>Loading…</p> : ob.error ? <Notice tone="error">{ob.error}</Notice> : (
          <ol className="grid gap-2">
            {ob.data.steps.map((s, i) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm">
                <span><b>{i + 1}.</b> {s.label}{s.count !== undefined ? ` (${s.count})` : ""}</span>
                <span className="flex items-center gap-2">
                  <Pill value={s.done ? "paid" : "pending"} /> {s.done ? "done" : "to do"}
                  {!s.done && TAB_FOR[s.key] ? <button type="button" onClick={() => goTo(TAB_FOR[s.key])} className="btn-secondary px-2 py-1 text-xs">Open</button> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <form onSubmit={saveBrand} className="panel min-w-0 grid gap-3 p-5 sm:grid-cols-2">
        <h3 className="text-lg font-bold sm:col-span-2">Receipt branding</h3>
        <input className="input" placeholder="Logo URL (https://…, PNG/JPG)" value={brand.logoUrl} onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })} />
        <input className="input" placeholder="Office phone" value={brand.contactPhone} onChange={(e) => setBrand({ ...brand, contactPhone: e.target.value })} />
        <input className="input" placeholder="Office email" value={brand.contactEmail} onChange={(e) => setBrand({ ...brand, contactEmail: e.target.value })} />
        <input className="input" placeholder="Receipt footer text" value={brand.receiptFooter} onChange={(e) => setBrand({ ...brand, receiptFooter: e.target.value })} />
        <button type="submit" className="btn-primary w-fit">Save branding</button>
      </form>
      <section className="panel min-w-0 p-5">
        <h3 className="mb-1 text-lg font-bold">Your data</h3>
        <p className="mb-3 text-sm text-slate-700">Download everything for this hostel (residents, invoices, receipts, complaints, notices, leave, offers, visitors, expenses) as one JSON file.</p>
        <button type="button" onClick={exportAll} className="btn-secondary">Download everything</button>
      </section>
    </div>
  );
}
