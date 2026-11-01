import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { api } from "../../services/api";
import { downloadApiPdf } from "../../utils/downloadFile";
import { ComplaintTimeline, InvoiceBreakdown, Notice, Pill } from "./opsUi";
import { dateShort, errMsg, money, uploadProof, useLoad } from "./opsHelpers";

const CATEGORIES = ["plumbing", "electricity", "cleaning", "food", "wifi", "security", "furniture", "staff_conduct", "payment", "other"];

function Fees() {
  const { data, loading, error, reload } = useLoad("/fees/my");
  const waivers = useLoad("/fees/waivers/my");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const requestWaiver = async (i) => {
    const reason = window.prompt(`Why should the PKR ${i.fineDue} late fine be waived? Head office decides.`);
    if (!reason) return;
    try {
      await api.post("/fees/waivers", { invoiceId: i.id, amount: "all", reason });
      setOk("Waiver request sent. You'll be notified of the decision.");
      waivers.reload();
    } catch (e) { setMsg(errMsg(e)); }
  };
  const cancelWaiver = async (w) => {
    try { await api.post(`/fees/waivers/${w.id}/cancel`); waivers.reload(); reload(); } catch (e) { setMsg(errMsg(e)); }
  };
  const pdf = async (p) => {
    try { await downloadApiPdf({ api, endpoint: `/fees/payments/${p.id}/receipt.pdf`, filename: `${p.receiptNo}.pdf` }); } catch (e) { setMsg(errMsg(e)); }
  };
  if (loading) return <p>Loading fees…</p>;
  if (error) return <Notice tone="error">{error}</Notice>;
  return (
    <section className="panel p-5">
      <h2 className="mb-1 text-xl font-bold">Hostel fees</h2>
      <p className="mb-4 text-sm text-slate-700">Billed {money(data.totals.billed)}{data.totals.fines ? ` · Fines ${money(data.totals.fines)}` : ""}{data.totals.discounts ? ` · You saved ${money(data.totals.discounts)}` : ""} · Paid {money(data.totals.paid)} · <b>Due {money(data.totals.due)}</b></p>
      <Notice tone="error">{msg}</Notice>
      <Notice tone="ok">{ok}</Notice>
      {!data.invoices.length ? <p className="text-slate-700">No hostel invoices yet.</p> : (
        <ul className="grid gap-2">
          {data.invoices.map((i) => {
            const pending = (waivers.data?.results || []).find((w) => String(w.invoice?._id || w.invoice) === i.id && w.status === "pending");
            return (
              <li key={i.id} className="rounded-md border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{i.title}{i.period ? ` (${i.period})` : ""}</span><Pill value={i.status} /></div>
                <InvoiceBreakdown invoice={i} />
                {i.fineDue > 0 && !pending ? <button type="button" onClick={() => requestWaiver(i)} className="btn-secondary mt-2 px-3 py-1 text-xs">Request fine waiver</button> : null}
                {pending ? <p className="mt-2 text-xs">Waiver request pending · <button type="button" className="font-semibold underline" onClick={() => cancelWaiver(pending)}>cancel</button></p> : null}
              </li>
            );
          })}
        </ul>
      )}
      {(waivers.data?.results || []).some((w) => w.status !== "pending") ? (
        <ul className="mt-3 grid gap-1 text-xs text-slate-700">
          {waivers.data.results.filter((w) => w.status !== "pending").map((w) => <li key={w.id}>Waiver for {w.invoice?.title}: <b>{w.status}</b>{w.approvedAmount ? ` (${money(w.approvedAmount)})` : ""}{w.decisionNote ? ` — ${w.decisionNote}` : ""}</li>)}
        </ul>
      ) : null}
      <h3 className="mb-2 mt-6 text-lg font-bold">My receipts</h3>
      {!data.payments.length ? <p className="text-slate-700">No receipts yet.</p> : (
        <ul className="grid gap-2">{data.payments.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm"><span className="font-mono text-xs">{p.receiptNo}</span><span>{money(p.amount)} · {p.method.replace("_", " ")} · {dateShort(p.paidAt)}</span><button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => pdf(p)}>Download PDF</button></li>)}</ul>
      )}
      <p className="mt-4 text-xs text-slate-600">Only pay at the hostel office and always ask for the system receipt (it has a receipt number and QR code). If a warden is removed, you will get a notice here.</p>
    </section>
  );
}

function Complaints() {
  const { data, loading, error, reload } = useLoad("/complaints/my");
  const [f, setF] = useState({ title: "", description: "", category: "plumbing", priority: "medium", evidence: [] });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [busy, setBusy] = useState(false);

  const attach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadProof(file);
      setF((s) => ({ ...s, evidence: [...s.evidence, url] }));
    } catch (err) { setMsg({ tone: "error", text: errMsg(err) }); }
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/complaints", f);
      setF({ title: "", description: "", category: "plumbing", priority: "medium", evidence: [] });
      setMsg({ tone: "ok", text: "Complaint sent to your block warden." });
      reload();
    } catch (err) { setMsg({ tone: "error", text: errMsg(err) }); } finally { setBusy(false); }
  };
  const respond = async (c, status) => {
    let rating;
    let note;
    if (status === "resolved") {
      const r = window.prompt("Is it really fixed? Rate the fix 1–5 (optional):", "5");
      rating = Number(r) || undefined;
      note = "Confirmed fixed by student.";
    } else {
      note = window.prompt("What is still wrong?");
      if (!note) return;
    }
    try { await api.post(`/complaints/${c.id}/status`, { status, note, rating }); reload(); } catch (err) { setMsg({ tone: "error", text: errMsg(err) }); }
  };

  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-xl font-bold">Complaints</h2>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <form onSubmit={submit} className="mb-6 grid gap-3 sm:grid-cols-2">
        <input className="input sm:col-span-2" required maxLength={140} placeholder="What is the problem?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select>
        <select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} aria-label="Priority">{["low", "medium", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</select>
        <textarea className="input sm:col-span-2" required rows={3} maxLength={2000} placeholder="Describe it" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">Photo (optional)<input className="input" type="file" accept="image/*" onChange={attach} />{f.evidence.length ? <span className="text-xs text-accent-700">{f.evidence.length} photo attached</span> : null}</label>
        <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Raise complaint"}</button></div>
      </form>

      {loading ? <p>Loading…</p> : error ? <Notice tone="error">{error}</Notice> : !data.results.length ? <p className="text-slate-700">You haven’t raised any complaints.</p> : (
        <div className="grid gap-3">
          {data.results.map((c) => (
            <article key={c.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{c.title}</p><Pill value={c.status} /></div>
              <p className="text-sm text-slate-700">{c.description}</p>
              <ComplaintTimeline items={c.timeline} />
              {c.status === "fixed" ? (
                <div className="mt-3 rounded-md bg-accent-50 p-3">
                  <p className="text-sm font-semibold text-accent-800">The warden says this is fixed. Is it?</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => respond(c, "resolved")}>Yes — mark resolved</button>
                    <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => respond(c, "reopened")}>No — reopen</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Notices() {
  const { data, loading, error, reload } = useLoad("/notices/my");
  const read = async (n) => { if (!n.read) { await api.post(`/notices/${n.id}/read`).catch(() => {}); reload(); } };
  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-xl font-bold">Hostel notices {data?.unread ? <span className="ml-2 rounded-full bg-[#C81E1E] px-2 py-0.5 text-xs text-white">{data.unread} new</span> : null}</h2>
      {loading ? <p>Loading…</p> : error ? <Notice tone="error">{error}</Notice> : !data.results.length ? <p className="text-slate-700">No notices.</p> : (
        <ul className="grid gap-3">
          {data.results.map((n) => (
            <li key={n.id} onMouseEnter={() => read(n)} className={`rounded-lg border p-4 ${n.type === "staff_termination" ? "border-[#C81E1E] bg-[#FEF2F2]" : "border-line"}`}>
              <p className="font-bold">{n.type === "staff_termination" ? "⚠ " : ""}{n.title}</p>
              <p className="mt-1 text-sm text-slate-800">{n.message}</p>
              <p className="mt-1 text-xs text-slate-500">{dateShort(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudentHostelLife() {
  return (
    <>
      <Helmet><title>My Hostel | Basera</title></Helmet>
      <div className="grid gap-6">
        <Notices />
        <Fees />
        <Complaints />
      </div>
    </>
  );
}
