import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";

// A student registered by the hostel office activates their login with the office's code.
export function ClaimAccountPage() {
  const navigate = useNavigate();
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const [f, setF] = useState({ code: "", phone: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/residents/claim", { code: f.code, phone: f.phone, password: f.password, email: f.email || undefined });
      adoptSession(data);
      navigate("/dashboard/student/hostel");
    } catch (err) {
      setError(err.response?.data?.message || "Could not activate the account.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Helmet><title>Activate your account | Basera</title></Helmet>
      <main className="container-page grid min-h-[70vh] place-items-center py-10">
        <form onSubmit={submit} className="panel grid w-full max-w-md gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-50 text-primary-800"><KeyRound size={20} /></span>
            <div>
              <h1 className="text-2xl font-extrabold">Activate your account</h1>
              <p className="text-sm text-slate-700">Use the code your hostel office gave you.</p>
            </div>
          </div>
          {error ? <p role="alert" className="rounded-md bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#991B1B]">{error}</p> : null}
          <label className="grid gap-1 text-sm font-semibold">Invite code<input className="input uppercase" value={f.code} onChange={set("code")} required maxLength={8} autoComplete="one-time-code" /></label>
          <label className="grid gap-1 text-sm font-semibold">Phone number (as given to the hostel)<input className="input" value={f.phone} onChange={set("phone")} required inputMode="tel" /></label>
          <label className="grid gap-1 text-sm font-semibold">Email (optional — for logging in)<input className="input" type="email" value={f.email} onChange={set("email")} /></label>
          <label className="grid gap-1 text-sm font-semibold">New password (min 8)<input className="input" type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" /></label>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? "Activating…" : "Activate"}</button>
        </form>
      </main>
    </>
  );
}
