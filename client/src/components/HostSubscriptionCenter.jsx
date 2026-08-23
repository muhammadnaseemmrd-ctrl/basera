import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CalendarClock, FileUp, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { api, safeRequest } from "../services/api";

const currency = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
const fallbackInvoices = [{ id: "sub-demo-1", period: "2026-06", plan: "STARTER", amount: 1000, status: "issued", dueAt: "2026-06-15" }];

export function HostSubscriptionCenter() {
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ plan: "STARTER", period: new Date().toISOString().slice(0, 7), amount: 1000 });
  const [proofForm, setProofForm] = useState({ invoiceId: "", manualPaymentRef: "BANK-REF-2026", proofUrl: "https://basera.pk/demo-host-proof.jpg" });
  const [message, setMessage] = useState("");

  const activeInvoice = useMemo(() => invoices.find((invoice) => (invoice.id || invoice._id) === proofForm.invoiceId) || invoices[0], [invoices, proofForm.invoiceId]);

  const refresh = () => {
    safeRequest(() => api.get("/subscriptions/plans"), { results: [] }).then((result) => setPlans(result.results || []));
    safeRequest(() => api.get("/subscriptions/host"), { plan: null, invoices: [] }).then((result) => {
      setPlan(result.plan || null);
      setInvoices(result.invoices || []);
      const firstInvoice = result.invoices?.[0];
      if (firstInvoice) setProofForm((current) => ({ ...current, invoiceId: firstInvoice.id || firstInvoice._id }));
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const issueInvoice = async (event) => {
    event.preventDefault();
    setMessage("Issuing management fee invoice...");
    const result = await safeRequest(() => api.post("/subscriptions/host/invoices", form), {
      invoice: { id: `sub-${Date.now()}`, ...form, status: "issued", dueAt: new Date(Date.now() + 7 * 86400000).toISOString() },
      demo: true
    });
    setInvoices((current) => [result.invoice, ...current]);
    setProofForm((current) => ({ ...current, invoiceId: result.invoice.id || result.invoice._id }));
    setMessage(result.demo ? "Management fee invoice issued in demo mode." : "Management fee invoice issued and posted to ledger.");
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    const invoiceId = proofForm.invoiceId || activeInvoice?.id || activeInvoice?._id;
    if (!invoiceId) return setMessage("Select an invoice before uploading proof.");
    setMessage("Uploading subscription proof...");
    const result = await safeRequest(() => api.post(`/subscriptions/host/invoices/${invoiceId}/pay-manual`, proofForm), {
      invoice: { ...activeInvoice, ...proofForm, status: "proof_submitted" },
      demo: true
    });
    setInvoices((current) => current.map((invoice) => ((invoice.id || invoice._id) === invoiceId ? result.invoice : invoice)));
    setMessage(result.demo ? "Subscription proof saved in demo mode." : "Subscription proof sent for admin finance review.");
  };

  const selectedPlan = plans.find((item) => item.tier === form.plan) || plan || plans[0] || { tier: "STARTER", monthlyFee: 1000, commissionRate: 7, features: ["Management dashboard", "Basic listing", "Monthly statement"] };

  return (
    <section className="space-y-7">
      <div className="grid gap-5 md:grid-cols-3">
        <Metric icon={BadgeDollarSign} label="Current Plan" value={selectedPlan.tier} />
        <Metric icon={ReceiptText} label="Monthly Fee" value={currency(selectedPlan.monthlyFee || form.amount)} />
        <Metric icon={ShieldCheck} label="Commission" value={`${selectedPlan.commissionRate || 7}%`} />
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <div className="grid gap-7 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary-800"><Sparkles size={20} /></span>
            <div>
              <h2 className="text-xl font-bold">Management Subscription</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">Basera charges a monthly management fee for dashboard, finance, verification, and support tooling.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {(plans.length ? plans : [
              { tier: "STARTER", monthlyFee: 1000, commissionRate: 7, features: ["Management dashboard", "Basic listing", "Monthly statement"] },
              { tier: "PRO", monthlyFee: 2500, commissionRate: 5, features: ["Priority listing", "Growth coach", "Smart pricing"] },
              { tier: "PREMIUM", monthlyFee: 5000, commissionRate: 3, features: ["Dedicated support", "Featured ranking", "Advanced analytics"] }
            ]).map((item) => (
              <button
                key={item.tier}
                type="button"
                onClick={() => setForm((current) => ({ ...current, plan: item.tier, amount: item.monthlyFee }))}
                className={`rounded-lg border p-4 text-left transition ${form.plan === item.tier ? "border-primary-700 bg-primary-50" : "border-line bg-canvas hover:border-primary-700"}`}
              >
                <p className="font-bold">{item.tier}</p>
                <p className="mt-2 text-2xl font-extrabold text-primary-800">{currency(item.monthlyFee)}</p>
                <p className="mt-1 text-sm text-slate-700">{item.commissionRate}% commission</p>
                <div className="mt-3 flex flex-wrap gap-2">{item.features.map((feature) => <span key={feature} className="chip bg-white">{feature}</span>)}</div>
              </button>
            ))}
          </div>

          <form onSubmit={issueInvoice} className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">Plan<select className="input" value={form.plan} onChange={(event) => {
              const next = plans.find((item) => item.tier === event.target.value);
              setForm((current) => ({ ...current, plan: event.target.value, amount: next?.monthlyFee || current.amount }));
            }}><option value="STARTER">Starter</option><option value="PRO">Pro</option><option value="PREMIUM">Premium</option></select></label>
            <label className="grid gap-2 text-sm font-semibold">Period<input className="input" type="month" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Amount<input className="input" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></label>
            <button type="submit" className="btn-primary md:col-span-3"><CalendarClock size={18} /> Issue Monthly Invoice</button>
          </form>
        </section>

        <section className="panel p-6">
          <h2 className="text-xl font-bold">Subscription Invoices</h2>
          <p className="mt-1 text-sm text-slate-700">Hosts can upload bank/JazzCash/Easypaisa proof for admin finance approval.</p>
          <form onSubmit={uploadProof} className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">Invoice<select className="input" value={proofForm.invoiceId} onChange={(event) => setProofForm((current) => ({ ...current, invoiceId: event.target.value }))}>{invoices.map((invoice) => <option key={invoice.id || invoice._id} value={invoice.id || invoice._id}>{invoice.period} - {currency(invoice.amount)}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Payment Ref<input className="input" value={proofForm.manualPaymentRef} onChange={(event) => setProofForm((current) => ({ ...current, manualPaymentRef: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Proof URL<input className="input" value={proofForm.proofUrl} onChange={(event) => setProofForm((current) => ({ ...current, proofUrl: event.target.value }))} /></label>
            <button type="submit" className="btn-secondary md:col-span-3"><FileUp size={18} /> Upload Manual Proof</button>
          </form>

          <div className="mt-6 grid gap-3">
            {(invoices.length ? invoices : fallbackInvoices).map((invoice) => (
              <article key={invoice.id || invoice._id} className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-bold">{invoice.period} - {invoice.plan}</p>
                  <p className="text-sm text-slate-700">Due {String(invoice.dueAt || "").slice(0, 10)}</p>
                </div>
                <strong>{currency(invoice.amount)}</strong>
                <span className={`badge ${invoice.status === "paid" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>{invoice.status}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="panel p-5">
      <Icon className="text-primary-800" size={22} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </article>
  );
}
