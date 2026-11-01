import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { HeartHandshake } from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { downloadApiPdf } from "../../utils/downloadFile";
import { ComplaintTimeline, InvoiceBreakdown, Notice, Pill } from "./opsUi";
import { dateShort, errMsg, money, useLoad } from "./opsHelpers";

function ChildView({ studentId }) {
  const { data, loading, error } = useLoad(`/parent-panel/children/${studentId}/overview`);
  const visitors = useLoad("/visitors/my");
  const [msg, setMsg] = useState("");
  const pdf = async (r) => {
    try { await downloadApiPdf({ api, endpoint: `/fees/payments/${r.id}/receipt.pdf`, filename: `${r.receiptNo}.pdf` }); } catch (e) { setMsg(errMsg(e)); }
  };
  if (loading) return <p>Loading…</p>;
  if (error) return <Notice tone="error">{error}</Notice>;
  const { seat, fees, complaints, notices } = data;
  return (
    <div className="grid gap-6">
      <Notice tone="error">{msg}</Notice>
      {notices.some((n) => n.type === "staff_termination") ? (
        <section className="rounded-lg border border-[#C81E1E] bg-[#FEF2F2] p-5">
          <h2 className="text-lg font-bold text-[#991B1B]">Important: staff change — do not pay these people</h2>
          <ul className="mt-2 grid gap-2">{notices.filter((n) => n.type === "staff_termination").map((n) => <li key={n._id || n.id} className="text-sm"><b>{n.title}</b><br />{n.message}</li>)}</ul>
        </section>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h2 className="mb-2 text-xl font-bold">{data.student.name}’s seat</h2>
        {seat ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="font-semibold text-slate-600">Hostel</dt><dd>{seat.hostel}</dd></div>
            <div><dt className="font-semibold text-slate-600">Block / Room / Bed</dt><dd>{seat.block || "-"} / {seat.roomNumber} / {seat.bed ?? "-"}</dd></div>
            <div><dt className="font-semibold text-slate-600">Head office</dt><dd>{seat.headOfficePhone || "-"}</dd></div>
            <div className="sm:col-span-3"><dt className="font-semibold text-slate-600">Address</dt><dd>{seat.address}</dd></div>
          </dl>
        ) : <p className="text-slate-700">No active stay.</p>}
      </section>

      {data.leave ? (
        <section className="rounded-lg border border-[#0E7490] bg-[#ECFEFF] p-5">
          <h2 className="text-lg font-bold text-[#155E75]">Leave notice</h2>
          <p className="mt-1 text-sm">{data.student.name} plans to leave on <b>{dateShort(data.leave.intendedLeaveDate)}</b> ({data.leave.noticeDaysGiven} days&apos; notice; policy {data.leave.policyDays}) — {data.leave.status === "approved" ? "approved by the hostel" : "waiting for the hostel to confirm"}.{data.leave.decisionNote ? ` Note: ${data.leave.decisionNote}` : ""}</p>
        </section>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h2 className="mb-1 text-xl font-bold">Fees</h2>
        <p className="mb-3 text-sm">Billed {money(fees.billed)}{fees.fines ? ` · Fines ${money(fees.fines)}` : ""}{fees.discounts ? ` · Discounts −${money(fees.discounts)}` : ""} · Paid {money(fees.paid)} · <b>Due {money(fees.due)}</b></p>
        <ul className="grid gap-2">
          {fees.invoices.map((i) => (
            <li key={i.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{i.title}{i.period ? ` (${i.period})` : ""}</span><Pill value={i.status} /></div>
              <InvoiceBreakdown invoice={{ ...i, totalDue: i.balance, payToday: i.balance }} />
            </li>
          ))}
        </ul>
        <h3 className="mb-2 mt-5 font-bold">Receipts</h3>
        {!fees.receipts.length ? <p className="text-sm text-slate-700">No receipts yet.</p> : (
          <ul className="grid gap-2">{fees.receipts.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm"><span className="font-mono text-xs">{r.receiptNo}</span><span>{money(r.amount)} · {r.method.replace("_", " ")} · {dateShort(r.paidAt)} · by {r.receivedByName}</span><button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => pdf(r)}>PDF</button></li>)}</ul>
        )}
      </section>

      {(visitors.data?.results || []).some((v) => String(v.student?._id || v.student) === String(studentId)) ? (
        <section className="panel min-w-0 p-5">
          <h2 className="mb-3 text-xl font-bold">Visitors</h2>
          <ul className="grid gap-1 text-sm">
            {visitors.data.results.filter((v) => String(v.student?._id || v.student) === String(studentId)).map((v) => <li key={v.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line p-2"><span>{v.visitorName} ({v.relation || "visitor"}) · {v.purpose}</span><span>{dateShort(v.createdAt)} · {v.status.replace("_", " ")}</span></li>)}
          </ul>
        </section>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h2 className="mb-3 text-xl font-bold">Complaints</h2>
        {!complaints.length ? <p className="text-sm text-slate-700">None.</p> : (
          <div className="grid gap-3">{complaints.map((c) => <article key={c.id} className="rounded-lg border border-line p-3"><div className="flex flex-wrap justify-between gap-2"><b>{c.title}</b><Pill value={c.status} /></div><ComplaintTimeline items={c.timeline} /></article>)}</div>
        )}
      </section>

      <section className="panel min-w-0 p-5">
        <h2 className="mb-3 text-xl font-bold">Hostel notices</h2>
        {!notices.length ? <p className="text-sm text-slate-700">No notices.</p> : <ul className="grid gap-3">{notices.map((n) => <li key={n._id || n.id} className="rounded-lg border border-line p-3"><b>{n.title}</b><p className="text-sm">{n.message}</p><p className="text-xs text-slate-500">{dateShort(n.createdAt)}</p></li>)}</ul>}
      </section>
    </div>
  );
}

export function ParentPanelPage() {
  const user = useAuthStore((s) => s.user);
  const children = useLoad("/parent-panel/children");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [picked, setSelected] = useState("");
  // default to the first linked child until the parent picks one
  const selected = picked || children.data?.results?.[0]?.id || "";

  const claim = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/parent-panel/claim", { code });
      setCode("");
      setSelected(data.studentId);
      setMsg({ tone: "ok", text: "Linked! You can now follow your child’s hostel life." });
      children.reload();
    } catch (error) { setMsg({ tone: "error", text: errMsg(error) }); }
  };

  return (
    <>
      <Helmet><title>Parent Panel | Basera</title></Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-800"><HeartHandshake size={22} /></span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Parent Panel</h1>
            <p className="text-slate-700">Welcome{user?.name ? `, ${user.name}` : ""}. Seat, fees, receipts, complaints and notices for your child.</p>
          </div>
        </div>

        <section className="panel min-w-0 mb-8 p-5">
          <h2 className="mb-1 text-lg font-bold">Link a child</h2>
          <p className="mb-3 text-sm text-slate-700">Enter the invite code the hostel office or your child sent you (or the share code starting with HHP-). Have a read-only link instead? <Link className="font-semibold text-primary-800 underline" to="/">Open it from the message.</Link></p>
          <Notice tone={msg.tone}>{msg.text}</Notice>
          <form onSubmit={claim} className="flex flex-wrap gap-3">
            <input className="input max-w-xs font-mono uppercase" required minLength={6} placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn-primary">Link</button>
          </form>
        </section>

        {children.loading ? <p>Loading…</p> : children.error ? <Notice tone="error">{children.error}</Notice> : !children.data.results.length ? (
          <p className="text-slate-700">No child linked yet.</p>
        ) : (
          <>
            {children.data.results.length > 1 ? (
              <select className="input mb-6 max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Child">
                {children.data.results.map((c) => <option key={c.id} value={c.id}>{c.name}{c.hostel ? ` — ${c.hostel}` : ""}</option>)}
              </select>
            ) : null}
            {selected ? <ChildView key={selected} studentId={selected} /> : null}
          </>
        )}
      </main>
    </>
  );
}
