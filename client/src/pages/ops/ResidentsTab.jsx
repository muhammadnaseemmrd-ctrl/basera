import { useState } from "react";
import { api } from "../../services/api";
import { Notice, Pill } from "./opsUi";
import { errMsg, money, uploadProof, useLoad } from "./opsHelpers";

const open = (url) => window.open(url, "_blank", "noopener,noreferrer");
const EMPTY = { name: "", phone: "", cnic: "", email: "", gender: "", dob: "", university: "", homeAddress: "", guardianName: "", guardianRelation: "father", guardianPhone: "", roomId: "", bed: "1", monthlyRent: "", securityDeposit: "0", depositCollected: true, joinDate: "", billingPlan: "monthly", firstPeriod: "", login: false, photoUrl: "", cnicDocUrl: "" };

async function uploadDoc(file) {
  const form = new FormData();
  form.append("document", file);
  const { data } = await api.post("/uploads/document", form);
  if (data.demo || !/^https?:\/\//i.test(data.url || "")) throw new Error("Document storage is not configured on the server; the file was not saved.");
  return data.url;
}

function RegisterForm({ hostelId, rooms, onDone }) {
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const attach = (k, fn) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fn(file);
      setF((s) => ({ ...s, [k]: url }));
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setOut(null);
    try {
      const body = {
        hostelId,
        name: f.name,
        phone: f.phone,
        cnic: f.cnic || undefined,
        email: f.email || undefined,
        gender: f.gender || undefined,
        dob: f.dob || undefined,
        university: f.university || undefined,
        homeAddress: f.homeAddress || undefined,
        guardians: f.guardianPhone ? [{ name: f.guardianName, relation: f.guardianRelation, phone: f.guardianPhone }] : [],
        roomId: f.roomId,
        bedIndex: Number(f.bed) - 1,
        monthlyRent: Number(f.monthlyRent),
        securityDeposit: Number(f.securityDeposit || 0),
        depositCollected: f.depositCollected,
        joinDate: f.joinDate || undefined,
        billingPlan: f.billingPlan,
        login: f.login,
        photoUrl: f.photoUrl || undefined,
        cnicDocUrl: f.cnicDocUrl || undefined,
        firstInvoice: f.firstPeriod ? { period: f.firstPeriod } : undefined
      };
      const { data } = await api.post("/residents", body);
      setOut(data);
      setF(EMPTY);
      setMsg({ tone: "ok", text: `${data.student.name} registered in room ${data.booking.room}, seat ${data.booking.bed}.` });
      onDone();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  };
  const input = (label, k, props = {}) => (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input className="input" value={f[k]} onChange={set(k)} {...props} />
    </label>
  );
  return (
    <form onSubmit={submit} className="panel min-w-0 grid gap-4 p-5">
      <h3 className="text-lg font-bold">Register a student (offline)</h3>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {input("Full name *", "name", { required: true })}
        {input("Phone *", "phone", { required: true, inputMode: "tel" })}
        {input("CNIC", "cnic", { placeholder: "35202-1234567-1" })}
        {input("Email (optional)", "email", { type: "email" })}
        <label className="grid gap-1 text-sm font-semibold">
          Gender
          <select className="input" value={f.gender} onChange={set("gender")}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
        {input("Date of birth", "dob", { type: "date" })}
        {input("University / employer", "university")}
        {input("Home address", "homeAddress")}
        {input("Guardian name", "guardianName")}
        {input("Guardian relation", "guardianRelation")}
        {input("Guardian phone", "guardianPhone", { inputMode: "tel" })}
        <label className="grid gap-1 text-sm font-semibold">
          Room *
          <select className="input" value={f.roomId} onChange={set("roomId")} required>
            <option value="">Choose…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber} ({r.availableBeds}/{r.totalBeds} free online)
              </option>
            ))}
          </select>
        </label>
        {input("Seat / bed no. *", "bed", { type: "number", min: 1, required: true })}
        {input("Monthly rent (PKR) *", "monthlyRent", { inputMode: "numeric", required: true })}
        {input("Security deposit (PKR)", "securityDeposit", { inputMode: "numeric" })}
        {input("Join date", "joinDate", { type: "date" })}
        <label className="grid gap-1 text-sm font-semibold">
          Billing plan
          <select className="input" value={f.billingPlan} onChange={set("billingPlan")}>
            <option value="monthly">Monthly</option>
            <option value="semester">Semester</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {input("Bill first month now (YYYY-MM)", "firstPeriod", { placeholder: "2026-11" })}
        <label className="grid gap-1 text-sm font-semibold">
          Photo
          <input type="file" accept="image/*" onChange={attach("photoUrl", uploadProof)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          CNIC scan (image/PDF)
          <input type="file" accept="image/*,application/pdf" onChange={attach("cnicDocUrl", uploadDoc)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.depositCollected} onChange={set("depositCollected")} /> Deposit collected now (issue receipt)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.login} onChange={set("login")} /> Create a login now (otherwise invite later)</label>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-fit">{busy ? "Saving…" : "Register student"}</button>
      {out ? (
        <div className="rounded-md bg-primary-50 p-3 text-sm">
          {out.tempPassword ? <p>Temporary password (shown once): <b>{out.tempPassword}</b> — login email {out.student.email}</p> : null}
          {out.claimCode ? <p>Login invite code for the student: <b>{out.claimCode}</b> (valid 14 days, at /claim)</p> : null}
          {out.deposit?.receiptNo ? <p>Deposit receipt: <b>{out.deposit.receiptNo}</b></p> : null}
          {out.guardians?.map((g) => <p key={g.inviteCode}>Parent invite for {g.name || g.phone}: <b>{g.inviteCode}</b></p>)}
        </div>
      ) : null}
    </form>
  );
}

function CsvImport({ hostelId, onDone }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const [busy, setBusy] = useState(false);
  const template = async () => {
    try {
      const { data } = await api.get("/residents/import/template.csv", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "basera-residents-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
    setMsg({ tone: "info", text: `${file.name} loaded. Check it before importing.` });
    // clear the input so choosing the same (edited) file again still fires a change
    e.target.value = "";
  };
  const check = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/residents/import/preview", { hostelId, csv });
      setPreview(data);
      setMsg({ tone: data.summary.error ? "error" : "ok", text: data.summary.error ? `${data.summary.error} row(s) need fixing — nothing will be imported until the file is clean.` : `${data.summary.ok} row(s) ready, ${data.summary.duplicate} duplicate(s) will be skipped.` });
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!window.confirm(`Import ${preview.summary.ok} student(s)?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/residents/import/commit", { hostelId, csv });
      setMsg({ tone: "ok", text: `Imported ${data.imported}; skipped ${data.duplicatesSkipped} duplicate(s).` });
      setPreview(null);
      setCsv("");
      onDone();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel min-w-0 grid gap-3 p-5">
      <h3 className="text-lg font-bold">Bulk import (CSV)</h3>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={template} className="btn-secondary">Download template</button>
        <label className="text-sm font-semibold">
          <span className="sr-only">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={pick} />
        </label>
        <button type="button" onClick={check} disabled={!csv || busy} className="btn-secondary">Check file</button>
        <button type="button" onClick={commit} disabled={!preview || preview.summary.error > 0 || !preview.summary.ok || busy} className="btn-primary">Import</button>
      </div>
      {preview ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-600"><tr><th className="py-1 pr-3">Line</th><th className="pr-3">Name</th><th className="pr-3">Room/bed</th><th className="pr-3">Status</th><th>Problems</th></tr></thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.line} className="border-t border-line align-top">
                  <td className="py-1 pr-3">{r.line}</td>
                  <td className="pr-3">{r.name}</td>
                  <td className="pr-3">{r.room} / {r.bed}</td>
                  <td className="pr-3"><Pill value={r.status === "ok" ? "active" : r.status === "duplicate" ? "pending" : "unpaid"} /> {r.status}</td>
                  <td className="text-xs">{r.errors.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ResidentList({ hostelId, blockId, students, reload }) {
  const [msg, setMsg] = useState({ tone: "info", text: "" });
  const invite = async (s) => {
    try {
      const { data } = await api.post(`/residents/${s.studentId}/invite`);
      setMsg({ tone: "ok", text: `Invite code for ${s.name}: ${data.code}` });
      if (data.whatsapp) open(data.whatsapp.link);
      reload();
    } catch (error) {
      setMsg({ tone: "error", text: errMsg(error) });
    }
  };
  const rows = (students || []).filter((s) => !blockId || s.blockId === blockId);
  return (
    <section className="panel min-w-0 p-5">
      <h3 className="mb-3 text-lg font-bold">Residents ({rows.length})</h3>
      <Notice tone={msg.tone}>{msg.text}</Notice>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-600"><tr><th className="py-1 pr-3">Name</th><th className="pr-3">Room</th><th className="pr-3">Source</th><th className="pr-3">Login</th><th className="pr-3">Due</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.studentId} className="border-t border-line">
                <td className="py-1.5 pr-3 font-semibold">{s.name}</td>
                <td className="pr-3">{s.roomNumber} · seat {(s.bedIndex ?? 0) + 1}</td>
                <td className="pr-3">{s.source}</td>
                <td className="pr-3">{s.loginEnabled ? "yes" : "not yet"}</td>
                <td className="pr-3">{money(s.balanceDue)}</td>
                <td>{!s.loginEnabled ? <button type="button" onClick={() => invite(s)} className="btn-secondary px-3 py-1 text-xs">Invite to log in</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-sm text-slate-700">No residents yet{hostelId ? "" : "."}</p> : null}
    </section>
  );
}

export function ResidentsTab({ hostelId, blockId, mode }) {
  const isHead = mode === "head_office";
  const students = useLoad(`/fees/students?hostelId=${hostelId}${blockId ? `&blockId=${blockId}` : ""}`);
  const rooms = useLoad(isHead ? `/head-office/hostels/${hostelId}/rooms` : null);
  const wardenRooms = useLoad(!isHead ? `/blocks?hostelId=${hostelId}` : null);
  const [roomsForWarden, setRoomsForWarden] = useState(null);
  const loadWardenRooms = async () => {
    const blocks = wardenRooms.data?.results || [];
    const lists = await Promise.all(blocks.map((b) => api.get(`/blocks/${b.id || b._id}/rooms`).then((r) => r.data.results || r.data.rooms || []).catch(() => [])));
    setRoomsForWarden(lists.flat().map((r) => ({ id: r.id || r._id, roomNumber: r.roomNumber, totalBeds: r.totalBeds, availableBeds: r.availableBeds })));
  };
  const roomList = isHead ? rooms.data?.results || [] : roomsForWarden || [];
  return (
    <div className="grid gap-6">
      {!isHead && !roomsForWarden && wardenRooms.data ? (
        <button type="button" onClick={loadWardenRooms} className="btn-secondary w-fit">Load my block's rooms to register a student</button>
      ) : null}
      <RegisterForm hostelId={hostelId} rooms={roomList} onDone={() => { students.reload(); rooms.reload(); }} />
      <CsvImport hostelId={hostelId} onDone={students.reload} />
      {students.error ? <Notice tone="error">{students.error}</Notice> : <ResidentList hostelId={hostelId} blockId={blockId} students={students.data?.results} reload={students.reload} />}
    </div>
  );
}
