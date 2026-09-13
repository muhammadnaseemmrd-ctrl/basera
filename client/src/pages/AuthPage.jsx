import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Phone, ShieldCheck, UserRound, BadgeCheck, Lock, Users } from "lucide-react";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { dashboardPathForRole, useAuthStore } from "../store/useAuthStore";
import { Logo } from "../components/Logo";

const demoAccounts = [
  { label: "Student", email: "student@basera.pk" },
  { label: "Host", email: "landlord@basera.pk" },
  { label: "Hostel Host", email: "owner@basera.pk" },
  { label: "Admin", email: "admin@basera.pk" }
];

// Quick demo login buttons are a development convenience only. They must never be
// visible to real users in production, so they're gated behind an explicit env flag
// (set VITE_SHOW_DEMO_BUTTONS=true in client/.env for local/demo environments).
const showDemoButtons = import.meta.env.VITE_SHOW_DEMO_BUTTONS === "true";

export function AuthPage() {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("student");
  // Form fields start empty for real users. The old defaults (a real-looking demo
  // email/password pre-filled into the visible login form) defeated the point of
  // removing the on-page demo-credentials text and gating the quick-login buttons
  // behind VITE_SHOW_DEMO_BUTTONS -- a production visitor would still see working
  // credentials sitting in the fields. Dev/demo convenience is now opt-in only,
  // matching the same env flag used for the quick-login buttons below.
  const [form, setForm] = useState(
    showDemoButtons
      ? { name: "Ali Ahmed", email: "student@basera.pk", phone: "+923001234567", password: "password123", confirmPassword: "password123" }
      : { name: "", email: "", phone: "", password: "", confirmPassword: "" }
  );
  const [formError, setFormError] = useState("");
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
    setFormError("");
    if (mode === "signup" && form.password !== form.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    try {
      const { confirmPassword, ...signupPayload } = form;
      const user =
        mode === "login"
          ? await login({ email: form.email, password: form.password })
          : await register({ ...signupPayload, role });
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
        {/* The visible <h1> lives in the hero section below, which is hidden below the lg
            breakpoint. This sr-only heading keeps exactly one <h1> present on every
            viewport size so mobile screen-reader users still get a page-level heading. */}
        <h1 className="sr-only lg:hidden">{mode === "login" ? "Login to Basera" : "Create your Basera account"}</h1>
        <section className="hidden lg:block">
          <Link to="/" className="inline-flex">
            <Logo wordmarkClassName="text-xl" />
          </Link>
          <span className="badge bg-accent-50 text-accent-700 mt-8"><ShieldCheck size={14} /> Verified marketplace</span>
          <h1 className="mt-5 max-w-xl font-display text-5xl font-bold leading-tight text-ink">Find your Basera — Safe, Verified Student Housing.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">
            One account for students, Hosts, and admins — booking, payments, and support all in one place.
          </p>
          <div className="mt-10 grid max-w-md gap-5">
            {[
              [BadgeCheck, "Verified Hostels Only"],
              [Lock, "Escrow Payment Protection"],
              [Users, "10,000+ Students Placed"]
            ].map(([Icon, label]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
                  <Icon size={20} />
                </span>
                <span className="font-semibold text-slate-800">{label}</span>
              </div>
            ))}
          </div>
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
            {mode === "signup" && (
              <label className="grid gap-2 font-medium">
                Confirm Password
                <input className="input" placeholder="Re-enter password" type="password" value={form.confirmPassword} onChange={update("confirmPassword")} required />
              </label>
            )}
            {(formError || error) && <p className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#991B1B]">{formError || error}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? "Working..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>
          {mode === "login" && showDemoButtons && (
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
