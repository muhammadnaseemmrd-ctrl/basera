import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, CalendarDays, CreditCard, Home, Info, Languages, ShieldCheck } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { useLocaleStore } from "../store/useLocaleStore";

const currency = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

const fallbackPortal = {
  access: {
    token: "HHP-DEMO",
    parentName: "Parent",
    studentName: "Ali Ahmed",
    status: "active",
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString()
  },
  booking: {
    id: "b1",
    status: "confirmed",
    paymentStatus: "paid",
    moveInDate: new Date().toISOString(),
    totalAmount: 23500,
    deposit: 5000
  },
  rooms: [
    {
      id: "r1",
      title: "Premium Single Room",
      hostelName: "Cozy Boys Hostel F-10",
      city: "Islamabad",
      area: "F-10",
      pricePerHead: 25000,
      image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=900&q=80",
      parentSafety: ["Verified Host", "Escrow payment", "Contact gated until paid confirmation"]
    }
  ],
  safety: {
    score: 86,
    notes: ["Basera escrow protection", "QR-verifiable receipts", "Admin dispute support", "Emergency contact saved"]
  },
  payments: [
    { label: "Rent + fees", amount: 23500, status: "paid" },
    { label: "Security deposit", amount: 5000, status: "held separately" }
  ]
};

export function ParentPortalPage() {
  const { token } = useParams();
  const [portal, setPortal] = useState(fallbackPortal);
  const [familyStatus, setFamilyStatus] = useState(null);
  const [message, setMessage] = useState("");
  const locale = useLocaleStore((state) => state.locale);
  const toggleLocale = useLocaleStore((state) => state.toggleLocale);
  const t = useLocaleStore((state) => state.t);
  const urdu = locale === "ur";
  useDocumentTitle("Parent Portal | Basera");

  useEffect(() => {
    safeRequest(() => api.get(`/parent/portal/${token}`), { portal: fallbackPortal }).then((result) => setPortal(result.portal || fallbackPortal));
    safeRequest(() => api.get("/family/student-status", { params: { token } }), { status: null }).then((result) => setFamilyStatus(result.status || null));
  }, [token]);

  const acknowledge = async () => {
    const result = await safeRequest(() => api.post(`/parent/portal/${token}/consent`, { acknowledged: true }), { acknowledged: true, demo: true });
    setMessage(result.demo ? t("parentPortalAcknowledgedDemo") : t("parentPortalAcknowledgedLive"));
  };

  const requestCheckIn = async () => {
    const result = await safeRequest(() => api.post("/family/check-in-request", { token }), { requested: true, demo: true });
    setMessage(result.demo ? t("parentPortalCheckInDemo") : t("parentPortalCheckInLive"));
  };

  const copy = {
    title: t("parentPortalTitleFor", { name: familyStatus?.studentName || portal.access.studentName }),
    subtitle: t("parentPortalSubtitle")
  };

  return (
    <main className="container-page py-10">
      <section className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7">
          <div className="panel p-7">
            <span className="badge bg-accent-50 text-accent-700"><ShieldCheck size={14} /> {t("parentPortalGuardianView")}</span>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold sm:text-4xl">{copy.title}</h1>
                <p className="mt-3 max-w-3xl text-slate-700">{copy.subtitle}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={toggleLocale}>
                <Languages size={16} /> {urdu ? "English" : "اردو"}
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric icon={Home} label={t("parentPortalBooking")} value={familyStatus?.booking?.status || portal.booking.status} />
              <Metric icon={CreditCard} label={t("parentPortalPayment")} value={familyStatus?.booking?.paymentStatus || portal.booking.paymentStatus} />
              <Metric icon={CalendarDays} label={t("parentPortalMoveIn")} value={String(portal.booking.moveInDate || "").slice(0, 10)} />
            </div>
          </div>

          {familyStatus && (
            <section className="panel p-6">
              <h2 className="text-xl font-bold">{t("parentPortalTodayStatus")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Metric icon={Home} label={t("parentPortalLocation")} value={familyStatus.today.location} />
                <Metric icon={ShieldCheck} label={t("parentPortalSafety")} value={familyStatus.today.status} />
                <Metric icon={CreditCard} label={t("parentPortalRent")} value={familyStatus.today.rentPaid ? t("parentPortalPaid") : t("parentPortalDue")} />
              </div>
              <button type="button" onClick={requestCheckIn} className="btn-primary mt-5"><ShieldCheck size={18} /> {t("parentPortalRequestCheckIn")}</button>
            </section>
          )}

          <section className="grid gap-5 md:grid-cols-2">
            {portal.rooms.map((room) => (
              <article key={room.id} className="panel overflow-hidden">
                <img src={room.image} alt={room.title} className="h-56 w-full object-cover" />
                <div className="p-5">
                  <h2 className="text-xl font-bold">{room.title}</h2>
                  <p className="mt-1 text-sm text-slate-700">{room.hostelName} - {room.area}, {room.city}</p>
                  <p className="mt-4 text-2xl font-extrabold text-primary-800">{currency(room.pricePerHead)}<span className="text-sm font-semibold text-slate-700">/month</span></p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(room.parentSafety || []).map((item) => <span key={item} className="chip"><BadgeCheck size={14} /> {item}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>

        <aside className="space-y-7">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="text-primary-800" /> {t("parentPortalSafetySummary")}</h2>
            <div className="mt-5 rounded-lg border border-line bg-primary-50 p-5">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-700">{t("parentPortalSafetyScore")}</p>
              <p className="mt-2 text-5xl font-extrabold text-primary-800">{portal.safety.score}%</p>
            </div>
            <div className="mt-4 grid gap-3">
              {portal.safety.notes.map((note) => (
                <p key={note} className="flex gap-3 rounded-lg border border-line p-3 text-sm text-slate-700"><BadgeCheck className="mt-0.5 text-accent-700" size={16} /> {note}</p>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><CreditCard className="text-primary-800" /> {t("parentPortalPaymentSnapshot")}</h2>
            <div className="mt-5 grid gap-3">
              {portal.payments.map((payment) => (
                <article key={payment.label} className="flex items-center justify-between rounded-lg border border-line p-4">
                  <div>
                    <p className="font-bold">{payment.label}</p>
                    <p className="text-sm text-slate-700">{payment.status}</p>
                  </div>
                  <strong>{currency(payment.amount)}</strong>
                </article>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-primary-50 p-4 text-sm leading-6 text-slate-700">
              <Info className="mb-2 text-primary-800" size={18} />
              {t("parentPortalDepositNote")}
            </div>
            <button type="button" onClick={acknowledge} className="btn-primary mt-5 w-full"><BadgeCheck size={18} /> {t("parentPortalAcknowledge")}</button>
            {message && <p className="mt-4 rounded-md bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700">{message}</p>}
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-line bg-canvas p-4">
      <Icon className="text-primary-800" size={20} />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
      <p className="mt-2 font-extrabold capitalize">{value}</p>
    </article>
  );
}
