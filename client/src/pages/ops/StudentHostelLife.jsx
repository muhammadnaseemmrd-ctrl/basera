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
  const applyCoupon = async (i) => {
    const code = window.prompt("Coupon code:");
    if (!code) return;
    try {
      const { data: out } = await api.post("/hostel-offers/apply", { invoiceId: i.id, code });
      setOk(out.redemption.status === "applied" ? `Coupon applied: −${money(out.redemption.amountOff)}.` : "Coupon sent to the hostel office for approval.");
      reload();
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
                {i.rentDue > 0 ? <button type="button" onClick={() => applyCoupon(i)} className="mt-2 mr-2 text-xs font-semibold text-primary-800 underline">Have a coupon?</button> : null}
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

function Offers() {
  const { data, loading, error } = useLoad("/hostel-offers/my");
  if (loading || error || !data) return null;
  if (!data.results.length && !data.savings.total) return null;
  return (
    <section className="panel p-5">
      <h2 className="mb-1 text-xl font-bold">Offers for you</h2>
      {data.savings.total ? <p className="mb-3 text-sm text-accent-700">You have saved <b>{money(data.savings.total)}</b> with hostel offers.</p> : null}
      <ul className="grid gap-2 text-sm">
        {data.results.map((o) => (
          <li key={o.id} className="rounded-md border border-line p-3">
            <b>{o.name}</b> — {o.type === "percent" ? `${o.value}%` : o.type === "flat" ? money(o.value) : `${o.value} free day(s)`} off
            {o.trigger === "early_payment" ? ` when you pay by day ${o.condition?.payBeforeDay} (applied automatically)` : ""}
            {o.needsCode ? " — enter the code on an invoice below" : ""}
            {o.validTo ? <span className="text-slate-600"> · until {dateShort(o.validTo)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Leave() {
  const policy = useLoad("/leave/policy");
  const mine = useLoad("/leave/my");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const open = (mine.data?.results || []).find((n) => ["submitted", "approved"].includes(n.status));
  const p = policy.data;
  const daysGiven = p && date ? Math.round((new Date(`${date}T00:00:00+05:00`) - new Date(`${p.today}T00:00:00+05:00`)) / 86400000) : null;
  const short = p && daysGiven !== null && daysGiven < p.policyDays;
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/leave", { intendedLeaveDate: date, reason });
      setMsg({ tone: "ok", text: "Notice submitted. The hostel office will confirm it." });
      setDate("");
      setReason("");
      mine.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const withdraw = async () => {
    try {
      await api.post(`/leave/${open.id}/withdraw`);
      mine.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  if (policy.error) return null; // no active stay
  if (!p) return null;
  return (
    <section className="panel p-5">
      <h2 className="mb-1 text-xl font-bold">Leave hostel</h2>
      <p className="mb-3 text-sm text-slate-700">This hostel needs <b>{p.policyDays} days&apos; notice</b>. Earliest leave date without penalty: <b>{p.earliestCompliantDate}</b>.</p>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {open ? (
        <div className="rounded-md border border-line p-3 text-sm">
          <p>Notice for <b>{open.intendedLeaveDay}</b> · <Pill value={open.status === "submitted" ? "pending" : "active"} /> {open.status === "approved" ? "approved" : "waiting for the office"}</p>
          <p className="text-slate-700">{open.noticeDaysGiven} days&apos; notice given{open.shortBy ? ` — ${open.shortBy} day(s) short` : ""}.{open.decisionNote ? ` Note: ${open.decisionNote}` : ""}</p>
          {open.status === "submitted" ? <button type="button" onClick={withdraw} className="btn-secondary mt-2 px-3 py-1 text-xs">Withdraw notice</button> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">Leave date<input className="input" type="date" required min={p.today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="grid gap-1 text-sm font-semibold">Reason (optional)<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="submit" className="btn-primary">Give notice</button>
          {short ? (
            <p role="alert" className="rounded-md bg-[#FEF3C7] p-2 text-sm font-semibold text-[#92400E] sm:col-span-3">
              That is only {daysGiven} days&apos; notice ({p.policyDays - daysGiven} short).{" "}
              {p.shortNoticeAction === "block" ? "The hostel will not accept it — choose a later date." : p.shortNoticeAction === "allow_with_charge" ? `A short-notice charge of PKR ${p.shortNoticeChargeIfShort} will be added.` : "It will be accepted but flagged for the office."}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}

function Visitors() {
  const { data, reload } = useLoad("/visitors/my");
  const [f, setF] = useState({ visitorName: "", cnicLast4: "", relation: "", purpose: "", expectedAt: "" });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data: out } = await api.post("/visitors", { ...f, expectedAt: f.expectedAt || undefined });
      setMsg({ tone: "ok", text: `Sent to your warden. Visiting hours: ${out.visitingHours.start}–${out.visitingHours.end}.` });
      setF({ visitorName: "", cnicLast4: "", relation: "", purpose: "", expectedAt: "" });
      reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const cancel = async (v) => {
    try { await api.post(`/visitors/${v.id}/cancel`); reload(); } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };
  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-xl font-bold">Visitors</h2>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <input className="input" required placeholder="Visitor name" value={f.visitorName} onChange={(e) => setF({ ...f, visitorName: e.target.value })} />
        <input className="input" required maxLength={4} inputMode="numeric" placeholder="CNIC last 4 digits" value={f.cnicLast4} onChange={(e) => setF({ ...f, cnicLast4: e.target.value })} />
        <input className="input" placeholder="Relation" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} />
        <input className="input sm:col-span-2" required placeholder="Purpose" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
        <input className="input" type="datetime-local" aria-label="Expected arrival" value={f.expectedAt} onChange={(e) => setF({ ...f, expectedAt: e.target.value })} />
        <button type="submit" className="btn-primary w-fit">Pre-register visitor</button>
      </form>
      {data?.results?.length ? (
        <ul className="mt-4 grid gap-1 text-sm">
          {data.results.map((v) => <li key={v.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line p-2"><span>{v.visitorName} · {v.purpose} · {dateShort(v.createdAt)}</span><span><Pill value={v.status === "checked_in" ? "active" : v.status} /> {["pending", "approved"].includes(v.status) ? <button type="button" className="ml-1 text-xs underline" onClick={() => cancel(v)}>cancel</button> : null}</span></li>)}
        </ul>
      ) : null}
    </section>
  );
}

function Transfer() {
  const options = useLoad("/transfers/options");
  const mine = useLoad("/transfers/my");
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const open = (mine.data?.results || []).find((t) => t.status === "requested");
  if (!options.data?.results?.length && !open) return null;
  const submit = async (e) => {
    e.preventDefault();
    const [toRoomId, toBedIndex] = pick.split("#");
    try {
      await api.post("/transfers", { toRoomId, toBedIndex: Number(toBedIndex), reason });
      setMsg({ tone: "ok", text: "Transfer request sent." });
      mine.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  return (
    <section className="panel p-5">
      <h2 className="mb-3 text-xl font-bold">Change room</h2>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {open ? <p className="text-sm">Request to move to room {open.toRoom?.roomNumber}, seat {open.toBed + 1} is waiting for the office.</p> : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select className="input" required value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Free seat">
            <option value="">Choose a free seat…</option>
            {options.data.results.map((o) => <option key={`${o.roomId}#${o.bedIndex}`} value={`${o.roomId}#${o.bedIndex}`}>{o.block} · Room {o.roomNumber} · seat {o.bedIndex + 1}</option>)}
          </select>
          <input className="input" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="submit" className="btn-primary">Request move</button>
        </form>
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
        <Offers />
        <Fees />
        <Leave />
        <Visitors />
        <Transfer />
        <Complaints />
      </div>
    </>
  );
}
