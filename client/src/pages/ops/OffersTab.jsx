import { useState } from "react";
import { api } from "../../services/api";
import { Notice, Pill } from "./opsUi";
import { dateShort, errMsg, money, useLoad } from "./opsHelpers";

const TRIGGERS = [
  ["manual", "Manual (office applies)"],
  ["early_payment", "Early payment"],
  ["advance_months", "Pay months in advance"],
  ["long_stay", "Long stay"],
  ["coupon", "Coupon code"],
  ["scholarship", "Scholarship"],
  ["referral", "Referral"],
  ["sibling", "Sibling"]
];
const EMPTY = { name: "", type: "percent", value: "", trigger: "manual", code: "", payBeforeDay: "", minAdvanceMonths: "", minStayMonths: "", scope: "hostel", blocks: [], validFrom: "", validTo: "", maxRedemptions: "", perStudentLimit: "", stackable: false, requiresApproval: false, status: "active" };
const intOrNull = (v) => (v === "" || v === undefined ? null : Number(v));

function describe(o) {
  const v = o.type === "percent" ? `${o.value}%` : o.type === "flat" ? money(o.value) : `${o.value} free day(s)`;
  const when = o.trigger === "early_payment" ? ` if paid by day ${o.condition?.payBeforeDay}` : o.trigger === "advance_months" ? ` when paying ${o.condition?.minAdvanceMonths}+ month(s) ahead` : o.trigger === "long_stay" ? ` after ${o.condition?.minStayMonths}+ months` : o.trigger === "coupon" ? ` with code ${o.code || "•••"}` : "";
  return `${v} off ${Array.isArray(o.appliesTo) ? o.appliesTo.join("/") : o.appliesTo === "all_fees" ? "any fee" : "rent"}${when}`;
}

export function OffersTab({ hostelId, blocks, mode }) {
  const isHead = mode === "head_office";
  const offers = useLoad(`/hostel-offers?hostelId=${hostelId}`);
  const pending = useLoad(`/hostel-offers/redemptions?hostelId=${hostelId}&status=pending_approval`);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/hostel-offers", {
        hostelId,
        name: f.name,
        type: f.type,
        value: Number(f.value),
        trigger: f.trigger,
        code: f.trigger === "coupon" ? f.code : undefined,
        condition: { payBeforeDay: intOrNull(f.payBeforeDay) ?? undefined, minAdvanceMonths: intOrNull(f.minAdvanceMonths) ?? undefined, minStayMonths: intOrNull(f.minStayMonths) ?? undefined },
        scope: f.scope,
        blocks: f.scope === "block" ? f.blocks : [],
        validFrom: f.validFrom || undefined,
        validTo: f.validTo || undefined,
        maxRedemptions: intOrNull(f.maxRedemptions),
        perStudentLimit: intOrNull(f.perStudentLimit),
        stackable: f.stackable,
        requiresApproval: f.requiresApproval,
        status: f.status
      });
      setF(EMPTY);
      setMsg({ tone: "ok", text: "Offer created." });
      offers.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const move = async (o, status) => {
    try {
      await api.post(`/hostel-offers/${o.id}/status`, { status });
      offers.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const decide = async (r, approve) => {
    try {
      if (approve) await api.post(`/hostel-offers/redemptions/${r.id}/approve`);
      else {
        const reason = window.prompt("Reason for rejecting:");
        if (!reason) return;
        await api.post(`/hostel-offers/redemptions/${r.id}/reject`, { reason });
      }
      pending.reload();
      offers.reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const toggleBlock = (id) => setF((s) => ({ ...s, blocks: s.blocks.includes(id) ? s.blocks.filter((b) => b !== id) : [...s.blocks, id] }));
  const input = (label, k, props = {}) => (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input className="input" value={f[k]} onChange={set(k)} {...props} />
    </label>
  );
  return (
    <div className="grid gap-6">
      <Notice tone={msg.tone}>{msg.text}</Notice>
      {isHead ? (
        <form onSubmit={create} className="panel min-w-0 grid gap-3 p-5">
          <h3 className="text-lg font-bold">New offer</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {input("Name *", "name", { required: true })}
            <label className="grid gap-1 text-sm font-semibold">
              Type
              <select className="input" value={f.type} onChange={set("type")}>
                <option value="percent">Percent</option>
                <option value="flat">Flat PKR</option>
                <option value="free_days">Free days</option>
              </select>
            </label>
            {input("Value *", "value", { required: true, inputMode: "numeric" })}
            <label className="grid gap-1 text-sm font-semibold">
              Trigger
              <select className="input" value={f.trigger} onChange={set("trigger")}>
                {TRIGGERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            {f.trigger === "coupon" ? input("Coupon code", "code") : null}
            {f.trigger === "early_payment" ? input("Pay by day of month", "payBeforeDay", { inputMode: "numeric" }) : null}
            {f.trigger === "advance_months" ? input("Min months in advance", "minAdvanceMonths", { inputMode: "numeric" }) : null}
            {f.trigger === "long_stay" ? input("Min stay (months)", "minStayMonths", { inputMode: "numeric" }) : null}
            {input("Valid from", "validFrom", { type: "date" })}
            {input("Valid to (inclusive)", "validTo", { type: "date" })}
            {input("Max redemptions", "maxRedemptions", { inputMode: "numeric", placeholder: "unlimited" })}
            {input("Per-student limit", "perStudentLimit", { inputMode: "numeric", placeholder: "unlimited" })}
            <label className="grid gap-1 text-sm font-semibold">
              Scope
              <select className="input" value={f.scope} onChange={set("scope")}>
                <option value="hostel">Whole hostel</option>
                <option value="block">Selected blocks</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Start as
              <select className="input" value={f.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          {f.scope === "block" ? (
            <div className="flex flex-wrap gap-3 text-sm">{blocks.map((b) => { const id = b.id || b._id; return <label key={id} className="flex items-center gap-1"><input type="checkbox" checked={f.blocks.includes(id)} onChange={() => toggleBlock(id)} /> {b.name}</label>; })}</div>
          ) : null}
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.stackable} onChange={set("stackable")} /> Can combine with other stackable offers</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.requiresApproval} onChange={set("requiresApproval")} /> Needs head-office approval per use</label>
          </div>
          <button type="submit" className="btn-primary w-fit">Create offer</button>
        </form>
      ) : null}

      {isHead && pending.data?.results?.length ? (
        <section className="panel min-w-0 p-5">
          <h3 className="mb-2 text-lg font-bold">Waiting for approval</h3>
          <ul className="grid gap-2 text-sm">
            {pending.data.results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
                <span>{r.offer?.name} for <b>{r.student?.name}</b> on {r.invoice?.title} — {money(r.amountOff)}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => decide(r, true)} className="btn-primary px-3 py-1 text-xs">Approve</button>
                  <button type="button" onClick={() => decide(r, false)} className="btn-secondary px-3 py-1 text-xs">Reject</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel min-w-0 p-5">
        <h3 className="mb-3 text-lg font-bold">Offers</h3>
        {offers.loading ? <p>Loading…</p> : offers.error ? <Notice tone="error">{offers.error}</Notice> : !offers.data.results.length ? <p className="text-sm text-slate-700">No offers yet.</p> : (
          <div className="grid gap-3">
            {offers.data.results.map((o) => (
              <article key={o.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{o.name} <span className="font-normal text-slate-600">· {describe(o)}{o.scope === "block" ? " · selected blocks" : ""}</span></p>
                  <Pill value={o.status === "active" ? "active" : o.status === "paused" ? "pending" : o.status === "expired" ? "terminated" : o.status} />
                </div>
                <p className="mt-1 text-xs text-slate-700">
                  Used {o.usage.applied}× ({money(o.usage.amount)} given){o.maxRedemptions ? ` of ${o.maxRedemptions}` : ""}{o.usage.pending ? ` · ${o.usage.pending} pending` : ""}{o.usage.reversed ? ` · ${o.usage.reversed} reversed` : ""}
                  {o.validTo ? ` · ends ${dateShort(o.validTo)}` : ""}{o.stackable ? " · stackable" : ""}{o.requiresApproval ? " · needs approval" : ""}
                </p>
                {isHead ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === "draft" || o.status === "paused" ? <button type="button" onClick={() => move(o, "active")} className="btn-secondary px-3 py-1 text-xs">Activate</button> : null}
                    {o.status === "active" ? <button type="button" onClick={() => move(o, "paused")} className="btn-secondary px-3 py-1 text-xs">Pause</button> : null}
                    {o.status === "active" || o.status === "paused" ? <button type="button" onClick={() => move(o, "expired")} className="text-xs font-semibold text-[#991B1B] underline">End now</button> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
