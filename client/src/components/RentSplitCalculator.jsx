import { useMemo, useState } from "react";
import { Calculator, Receipt, Users, WalletCards } from "lucide-react";
import { currency } from "../utils/formatters";

export function RentSplitCalculator({ totalRent = 0, securityDeposit = 0 }) {
  const [people, setPeople] = useState(2);
  const [utilities, setUtilities] = useState(3500);
  const [mess, setMess] = useState(9000);
  const [serviceFee, setServiceFee] = useState(0);

  const totals = useMemo(() => {
    const rent = Number(totalRent || 0);
    const total = rent + Number(utilities || 0) + Number(mess || 0) + Number(serviceFee || 0);
    const perPerson = Math.ceil(total / Math.max(1, Number(people || 1)));
    const depositPerPerson = Math.ceil(Number(securityDeposit || 0) / Math.max(1, Number(people || 1)));
    return { total, perPerson, depositPerPerson };
  }, [mess, people, securityDeposit, serviceFee, totalRent, utilities]);

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="badge bg-primary-50 text-primary-800"><Calculator size={16} /> Rent split calculator</p>
          <h2 className="mt-4 text-xl font-bold">Estimate shared monthly cost</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Use this before booking with friends or roommates. It does not change the official booking invoice.</p>
        </div>
        <div className="rounded-xl bg-primary-700 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-100">Per person</p>
          <p className="mt-2 text-3xl font-extrabold">{currency(totals.perPerson)}</p>
          <p className="mt-1 text-sm text-primary-100">Deposit share {currency(totals.depositPerPerson)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <NumberField label="People" value={people} min={1} max={8} onChange={setPeople} icon={Users} />
        <NumberField label="Utilities" value={utilities} onChange={setUtilities} icon={WalletCards} />
        <NumberField label="Mess / Food" value={mess} onChange={setMess} icon={Receipt} />
        <NumberField label="Other Fees" value={serviceFee} onChange={setServiceFee} icon={WalletCards} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Summary label="Base rent" value={currency(totalRent)} />
        <Summary label="Monthly total" value={currency(totals.total)} />
        <Summary label="Split members" value={`${people} students`} />
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange, icon: Icon, min = 0, max }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-2"><Icon size={16} className="text-primary-800" /> {label}</span>
      <input className="input" type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-primary-800">{value}</p>
    </div>
  );
}
