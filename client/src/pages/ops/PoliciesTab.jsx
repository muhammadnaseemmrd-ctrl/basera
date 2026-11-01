import { useState } from "react";
import { api } from "../../services/api";
import { Notice } from "./opsUi";
import { errMsg, useLoad } from "./opsHelpers";

const SOURCE_LABEL = { platform: "platform default", hostel: "hostel", block: "block override" };
const BLOCK_FIELDS = [
  ["leaveNoticeDays", "Notice days"],
  ["dueDayOfMonth", "Due day"],
  ["finePerDay", "Fine / day"],
  ["maxFine", "Max fine"]
];

function Source({ value }) {
  return <span className="ml-1 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary-800">{SOURCE_LABEL[value]}</span>;
}

const intOrUndef = (v) => (v === "" || v === undefined || v === null ? undefined : Number(v));

function HostelForm({ data, hostelId, onSaved }) {
  const v = data.hostel.values;
  const [f, setF] = useState({
    days: v.leaveNoticeDays,
    shortNoticeAction: v.shortNoticeAction,
    shortNoticeChargeDays: v.shortNoticeChargeDays,
    wardenCanApprove: v.wardenCanApprove,
    enabled: v.lateFeeEnabled,
    dueDayOfMonth: v.dueDayOfMonth,
    finePerDay: v.finePerDay,
    graceDays: v.graceDays,
    maxFine: v.maxFine ?? "",
    feeAllocation: v.feeAllocation,
    start: v.visitingStart,
    end: v.visitingEnd,
    curfew: v.curfew
  });
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data: out } = await api.put(`/policies/${hostelId}`, {
        leaveNotice: { days: Number(f.days), shortNoticeAction: f.shortNoticeAction, shortNoticeChargeDays: Number(f.shortNoticeChargeDays), wardenCanApprove: f.wardenCanApprove },
        lateFee: { enabled: f.enabled, dueDayOfMonth: Number(f.dueDayOfMonth), finePerDay: Number(f.finePerDay), graceDays: Number(f.graceDays), maxFine: f.maxFine === "" ? null : Number(f.maxFine) },
        feeAllocation: f.feeAllocation,
        visitors: { start: f.start, end: f.end, curfew: f.curfew }
      });
      setMsg({ tone: "ok", text: "Saved. New invoices and notices use these values; issued ones keep theirs." });
      onSaved(out);
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const src = data.hostel.source;
  const field = (label, key, srcKey, props = {}) => (
    <label className="grid gap-1 text-sm font-semibold">
      <span>{label}<Source value={src[srcKey]} /></span>
      <input className="input" value={f[key]} onChange={set(key)} inputMode="numeric" {...props} />
    </label>
  );
  return (
    <form onSubmit={save} className="panel grid gap-4 p-5">
      <h3 className="text-lg font-bold">Hostel defaults</h3>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {field("Leave notice (days)", "days", "leaveNoticeDays")}
        <label className="grid gap-1 text-sm font-semibold">
          <span>Short notice<Source value={src.shortNoticeAction} /></span>
          <select className="input" value={f.shortNoticeAction} onChange={set("shortNoticeAction")}>
            <option value="allow_flag_only">Allow, flag only</option>
            <option value="allow_with_charge">Allow with charge</option>
            <option value="block">Block submission</option>
          </select>
        </label>
        {field("Short-notice charge (days of rent)", "shortNoticeChargeDays", "shortNoticeChargeDays")}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.wardenCanApprove} onChange={set("wardenCanApprove")} /> Wardens may approve leave
        </label>
        {field("Rent due day", "dueDayOfMonth", "dueDayOfMonth")}
        {field("Fine per day (PKR)", "finePerDay", "finePerDay")}
        {field("Grace days", "graceDays", "graceDays")}
        {field("Max fine (PKR, empty = no cap)", "maxFine", "maxFine")}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.enabled} onChange={set("enabled")} /> Late fines enabled
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          <span>Payments clear<Source value={src.feeAllocation} /></span>
          <select className="input" value={f.feeAllocation} onChange={set("feeAllocation")}>
            <option value="rent_first">Rent first</option>
            <option value="fine_first">Fine first</option>
          </select>
        </label>
        {field("Visiting from", "start", "visitingStart", { inputMode: "text", placeholder: "09:00" })}
        {field("Visiting until", "end", "visitingEnd", { inputMode: "text", placeholder: "20:00" })}
      </div>
      <p className="rounded-md bg-primary-50 p-3 text-sm text-primary-900">{data.hostel.preview}</p>
      <button type="submit" className="btn-primary w-fit">Save hostel policy</button>
    </form>
  );
}

function BlockOverrides({ data, hostelId, onSaved }) {
  const [rows, setRows] = useState(() =>
    Object.fromEntries(data.blocks.map((b) => [b.id, Object.fromEntries(BLOCK_FIELDS.map(([k]) => [k, b.override?.[k] ?? ""]))]))
  );
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const setCell = (id, k) => (e) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: e.target.value } }));
  const save = async () => {
    const blockOverrides = Object.entries(rows)
      .map(([block, vals]) => ({ block, ...Object.fromEntries(BLOCK_FIELDS.map(([k]) => [k, intOrUndef(vals[k])])) }))
      .filter((o) => BLOCK_FIELDS.some(([k]) => o[k] !== undefined));
    try {
      const { data: out } = await api.put(`/policies/${hostelId}`, { blockOverrides });
      setMsg({ tone: "ok", text: "Block overrides saved." });
      onSaved(out);
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  if (!data.blocks.length) return null;
  return (
    <section className="panel p-5">
      <h3 className="mb-1 text-lg font-bold">Per-block overrides</h3>
      <p className="mb-3 text-sm text-slate-700">Leave a cell empty to inherit the hostel value.</p>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="grid gap-4">
        {data.blocks.map((b) => (
          <div key={b.id} className="rounded-lg border border-line p-3">
            <p className="font-bold">{b.name}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BLOCK_FIELDS.map(([k, label]) => (
                <label key={k} className="grid gap-1 text-xs font-semibold">
                  <span>{label} — now {String(b.values[k] ?? "no cap")}<Source value={b.source[k]} /></span>
                  <input className="input" inputMode="numeric" placeholder="inherit" value={rows[b.id]?.[k] ?? ""} onChange={setCell(b.id, k)} aria-label={`${b.name} ${label}`} />
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-700">{b.preview}</p>
          </div>
        ))}
      </div>
      <button type="button" onClick={save} className="btn-primary mt-4">Save block overrides</button>
    </section>
  );
}

export function PoliciesTab({ hostelId }) {
  const { data, loading, error } = useLoad(`/policies/${hostelId}`);
  const [saved, setSaved] = useState(null);
  const view = saved || data;
  if (loading && !view) return <p>Loading policy…</p>;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!view) return null;
  if (!view.editable) {
    return (
      <div className="grid gap-4">
        <Notice>Policies are set by the head office. These are the rules in force for your block(s).</Notice>
        {view.blocks.map((b) => (
          <section key={b.id} className="panel p-5">
            <h3 className="text-lg font-bold">{b.name}</h3>
            <p className="mt-1 text-sm">{b.preview}</p>
            <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <li>Notice: {b.values.leaveNoticeDays} days<Source value={b.source.leaveNoticeDays} /></li>
              <li>Rent due: day {b.values.dueDayOfMonth}<Source value={b.source.dueDayOfMonth} /></li>
              <li>Fine: PKR {b.values.finePerDay}/day<Source value={b.source.finePerDay} /></li>
              <li>Max fine: {b.values.maxFine ?? "no cap"}<Source value={b.source.maxFine} /></li>
            </ul>
          </section>
        ))}
      </div>
    );
  }
  // re-mount the forms after a save so they reflect the stored values
  const key = view.policy?.updatedAt || "new";
  return (
    <div className="grid gap-6">
      <HostelForm key={`h-${key}`} data={view} hostelId={hostelId} onSaved={setSaved} />
      <BlockOverrides key={`b-${key}`} data={view} hostelId={hostelId} onSaved={setSaved} />
    </div>
  );
}
