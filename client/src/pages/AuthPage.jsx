import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { dashboardPathForRole, useAuthStore } from "../store/useAuthStore";

const demoAccounts = [
  { label: "Student", email: "student@basera.pk" },
  { label: "Host", email: "landlord@basera.pk" },
  { label: "Hostel Host", email: "owner@basera.pk" },
  { label: "Admin", email: "admin@basera.pk" }
];

export function AuthPage() {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({
    name: "Ali Ahmed",
    email: "student@basera.pk",
    phone: "+923001234567",
    password: "password123"
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loading, error } = useAuthStore();
  useDocumentTitle(`${mode === "login" ? "Login" : "Sign Up"} | Basera`);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const goAfterAuth = (user) => {
    const requestedPath = location.state?.from;
    const fallbackPath = dashboardPathForRole(user.role);
    navigate(requestedPath || fallbackPath, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const user =
        mode === "login"
          ? await login({ email: form.email, password: form.password })
          : await register({ ...form, role });
      goAfterAuth(user);
    } catch {
      // Auth errors are held in the auth store and rendered in the form.
    }
  };

  const loginDemo = async (email) => {
    try {
      setForm((current) => ({ ...current, email, password: "password123" }));
      const user = await login({ email, password: "password123" });
      goAfterAuth(user);
    } catch {
      // Auth errors are held in the auth store and rendered in the form.
    }
  };

  return (
    <>
      <Helmet>
        <title>{mode === "login" ? "Login" : "Sign Up"} | Basera</title>
      </Helmet>
      <main className="container-page grid min-h-[680px] items-center py-12 lg:grid-cols-[1fr_520px] lg:gap-12">
        <section className="hidden lg:block">
          <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={14} /> Verified marketplace</span>
          <h1 className="mt-7 max-w-xl text-5xl font-extrabold leading-tight">One account for students, Hosts, and admins.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">
            Use demo credentials while MongoDB is not configured: student@basera.pk, landlord@basera.pk, owner@basera.pk, or admin@basera.pk with password password123.
          </p>
        </section>
        <section className="panel p-7 sm:p-9">
          <div className="mb-7 grid grid-cols-2 rounded-lg bg-primary-50 p-1">
            {["login", "signup"].map((value) => (
              <button key={value} onClick={() => setMode(value)} className={`rounded-md px-4 py-3 font-semibold capitalize ${mode === value ? "bg-white text-primary-800 shadow-card" : "text-slate-700"}`}>
                {value === "signup" ? "Sign Up" : "Login"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <div className="mb-6 grid grid-cols-3 gap-2">
              {["student", "host", "admin"].map((value) => (
                <button key={value} onClick={() => setRole(value)} className={`rounded-md border px-3 py-3 text-sm font-semibold capitalize ${role === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line"}`}>
                  {value === "host" ? "Host" : value}
                </button>
              ))}
            </div>
          )}

          <form className="grid gap-5" onSubmit={submit}>
            {mode === "signup" && (
              <label className="grid gap-2 font-medium">
                Full Name
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input className="input pl-11" placeholder="Ali Ahmed" value={form.name} onChange={update("name")} required />
                </div>
              </label>
            )}
            <label className="grid gap-2 font-medium">
              Email
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input className="input pl-11" placeholder="student@basera.pk" type="email" value={form.email} onChange={update("email")} required />
              </div>
            </label>
            {mode === "signup" && (
              <label className="grid gap-2 font-medium">
                Phone
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input className="input pl-11" placeholder="+92 300 1234567" value={form.phone} onChange={update("phone")} required />
                </div>
              </label>
            )}
            <label className="grid gap-2 font-medium">
              Password
              <input className="input" placeholder="password123" type="password" value={form.password} onChange={update("password")} required />
            </label>
            {error && <p className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#991B1B]">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? "Working..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>
          {mode === "login" && (
            <div className="mt-6">
              <p className="mb-3 text-center text-sm font-semibold text-slate-700">Quick demo login</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => loginDemo(account.email)}
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-6 text-center text-sm text-slate-700">
            Continue to <Link className="font-semibold text-primary-800" to="/hostels">browse hostels</Link>
          </p>
        </section>
      </main>
    </>
  );
}
