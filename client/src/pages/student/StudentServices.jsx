import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  ClipboardCheck,
  CreditCard,
  FileUp,
  HandCoins,
  Link2,
  PackageCheck,
  Play,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { downloadApiPdf } from "../../utils/downloadFile";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const currency = (value) => `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
const today = () => new Date().toISOString().slice(0, 10);

const fallbackMoveIn = {
  pass: {
    id: "MIP-DEMO",
    studentName: "Ali Ahmed",
    hostelName: "Cozy Boys Hostel F-10",
    roomTitle: "Premium Single Room",
    moveInDate: today(),
    qrPayload: "HH-MOVEIN-DEMO",
    checklist: ["CNIC verified", "Receipt verified", "Host notified", "Security deposit logged"]
  }
};

export function StudentServices() {
  useDocumentTitle("Student Services | Basera");
  const [manualPayments, setManualPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [waitlistRules, setWaitlistRules] = useState([]);
  const [ambassadors, setAmbassadors] = useState([]);
  const [moveInPass, setMoveInPass] = useState(fallbackMoveIn.pass);
  const [message, setMessage] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [manualForm, setManualForm] = useState({ bookingId: "b1", amount: 23500, method: "bank_transfer" });
  const [proofForm, setProofForm] = useState({ paymentId: "HH-MAN-DEMO1", proofReference: "TRX-10293", proofUrl: "https://basera.pk/demo-receipt.jpg" });
  const [parentForm, setParentForm] = useState({ parentName: "Mr Ahmed", parentEmail: "parent@example.com", parentPhone: "+92 300 1234567" });
  const [vendorForm, setVendorForm] = useState({ vendorId: "vendor-laundry", service: "Wash & fold", address: "F-10 Markaz, Islamabad", scheduledFor: today() });
  const [waitlistForm, setWaitlistForm] = useState({ title: "NUST shared room under 18k", city: "Islamabad", university: "NUST", maxBudget: 18000, roomType: "double", gender: "male" });
  const [ambassadorForm, setAmbassadorForm] = useState({ name: "Ali Ahmed", email: "student@basera.pk", university: "NUST", city: "Islamabad" });
  const [familyForm, setFamilyForm] = useState({ guardianName: "Mr Ahmed", guardianPhone: "+92 300 1234567", relation: "father" });
  const [familyPortalUrl, setFamilyPortalUrl] = useState("");
  const [groupForm, setGroupForm] = useState({ invites: "friend1@example.com, friend2@example.com", roomIds: "r1,r4,r5" });
  const [groupBooking, setGroupBooking] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [signForm, setSignForm] = useState({ name: "Ali Ahmed", cnic: "35202-1234567-1" });
  const [checkInForm, setCheckInForm] = useState({ selfieUrl: "https://basera.pk/demo-selfie.jpg", cnicPhotoUrl: "https://basera.pk/demo-cnic.jpg" });
  const [verification, setVerification] = useState(null);
  const [utilitySplit, setUtilitySplit] = useState(null);
  const [alumniForm, setAlumniForm] = useState({ hostelId: "h1", university: "NUST", graduationYear: 2025, monthsStayed: 14, referralEmail: "newstudent@example.com" });
  const [alumniRecord, setAlumniRecord] = useState(null);

  const activePayment = useMemo(() => manualPayments.find((item) => (item.id || item._id || item.reference) === proofForm.paymentId) || manualPayments[0], [manualPayments, proofForm.paymentId]);

  const refresh = () => {
    safeRequest(() => api.get("/manual-payments/my"), { results: [] }).then((result) => setManualPayments(result.results || []));
    safeRequest(() => api.get("/vendors"), { results: [] }).then((result) => setVendors(result.results || []));
    safeRequest(() => api.get("/vendors/orders/my"), { results: [] }).then((result) => setVendorOrders(result.results || []));
    safeRequest(() => api.get("/waitlist/rules"), { results: [] }).then((result) => setWaitlistRules(result.results || []));
    safeRequest(() => api.get("/ambassadors"), { results: [] }).then((result) => setAmbassadors(result.results || []));
    safeRequest(() => api.get("/move-in-pass/b1"), fallbackMoveIn).then((result) => setMoveInPass(result.pass || fallbackMoveIn.pass));
    safeRequest(() => api.get("/bookings/b1/agreement"), { agreement: null }).then((result) => setAgreement(result.agreement || null));
    safeRequest(() => api.get("/utility-bills/split/b1"), { totalUtilityShare: 2400, split: { share: 2400 } }).then(setUtilitySplit);
  };

  useEffect(() => {
    refresh();
  }, []);

  const createChallan = async (event) => {
    event.preventDefault();
    setMessage("Creating manual payment challan...");
    const result = await safeRequest(() => api.post("/manual-payments/challan", manualForm), {
      challan: { id: `mp-${Date.now()}`, reference: "HH-MAN-DEMO", ...manualForm, status: "challan_issued" },
      instructions: { bank: "Demo Bank", accountTitle: "Basera Escrow", accountNumber: "PK00-HH-DEMO-ESCROW" },
      demo: true
    });
    setManualPayments((current) => [result.challan, ...current]);
    setProofForm((current) => ({ ...current, paymentId: result.challan.reference || result.challan.id || result.challan._id }));
    setMessage(`${result.challan.reference || "Challan"} created. Pay to ${result.instructions.accountTitle} at ${result.instructions.bank}.`);
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    const target = proofForm.paymentId || activePayment?.reference || activePayment?.id || activePayment?._id;
    if (!target) return setMessage("Create or select a challan before uploading proof.");
    setMessage("Uploading payment proof...");
    const result = await safeRequest(() => api.post(`/manual-payments/${target}/proof`, proofForm), {
      payment: { ...activePayment, ...proofForm, status: "proof_submitted" },
      demo: true
    });
    setManualPayments((current) => current.map((item) => ((item.id || item._id || item.reference) === (target || result.payment.reference) ? result.payment : item)));
    setMessage(result.demo ? "Proof submitted in demo mode." : "Proof submitted for admin finance review.");
  };

  const shareParentPortal = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/parent/share", { ...parentForm, bookingId: "b1", roomIds: ["r1", "r4"] }), {
      portalUrl: "/parent/HHP-DEMO",
      demo: true
    });
    setPortalUrl(result.portalUrl);
    setMessage(result.demo ? "Parent portal link created in demo mode." : "Parent portal link created.");
  };

  const inviteFamily = async (event) => {
    event.preventDefault();
    setMessage("Creating family access...");
    const result = await safeRequest(() => api.post("/family/invite", familyForm), {
      portalUrl: "/parent/HHF-DEMO",
      demo: true
    });
    setFamilyPortalUrl(result.portalUrl);
    setMessage(result.demo ? "Family portal invited in demo mode." : "Family portal invite sent.");
  };

  const createGroupBooking = async (event) => {
    event.preventDefault();
    const payload = {
      roomIds: groupForm.roomIds.split(",").map((item) => item.trim()).filter(Boolean),
      invites: groupForm.invites.split(",").map((email) => ({ email: email.trim() })).filter((item) => item.email)
    };
    const result = await safeRequest(() => api.post("/group-bookings", payload), {
      group: { id: `grp-${Date.now()}`, ...payload, discountApplied: 5, status: "holding" },
      demo: true
    });
    setGroupBooking(result.group);
    setMessage(result.demo ? "Group booking created in demo mode." : "Group booking hold created.");
  };

  const signAgreement = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/bookings/b1/agreement/sign", signForm), {
      agreement: { bookingId: "b1", contractId: "HH-AGR-DEMO", status: "student_signed", studentSig: signForm },
      demo: true
    });
    setAgreement(result.agreement);
    setMessage(result.demo ? "Agreement signed in demo mode." : "Agreement signature saved.");
  };

  const downloadAgreement = async () => {
    setMessage("Preparing agreement PDF...");
    try {
      await downloadApiPdf({ api, endpoint: "/bookings/b1/agreement?format=pdf", filename: "basera-tenancy-agreement.pdf" });
      setMessage("Agreement PDF downloaded.");
    } catch {
      setMessage("Agreement PDF requires API server and student login.");
    }
  };

  const verifyCheckIn = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/bookings/b1/checkin-verify", checkInForm), {
      verification: { id: `checkin-${Date.now()}`, status: "matched", matchConfidence: 91 },
      demo: true
    });
    setVerification(result.verification);
    setMessage(result.demo ? "Check-in verified in demo mode." : "Check-in verification submitted.");
  };

  const linkAlumniStay = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post(`/hostels/${alumniForm.hostelId}/alumni/link`, {
      university: alumniForm.university,
      graduationYear: alumniForm.graduationYear,
      monthsStayed: alumniForm.monthsStayed,
      review: {
        rating: 4.7,
        pros: ["Stable rent", "Good study environment"],
        cons: ["Laundry queue on weekends"],
        text: "I lived here through a full academic year and can recommend it to juniors."
      }
    }), {
      record: { id: `alumni-${Date.now()}`, ...alumniForm, badge: "Alumni" },
      pointsEligible: 1500,
      demo: true
    });
    setAlumniRecord(result.record);
    setMessage(result.demo ? `Alumni stay linked in demo mode. Eligible points: ${result.pointsEligible}` : `Alumni stay linked. Eligible points: ${result.pointsEligible}`);
  };

  const sendAlumniReferral = async () => {
    const result = await safeRequest(() => api.post(`/hostels/${alumniForm.hostelId}/alumni/referral`, { email: alumniForm.referralEmail }), {
      referral: { pointsForAlumni: 1500, pointsForNewStudent: 1500, status: "invited" },
      demo: true
    });
    setMessage(result.demo ? "Alumni referral sent in demo mode." : `Referral sent. Both sides can earn ${result.referral.pointsForAlumni} points.`);
  };

  const orderVendor = async (event) => {
    event.preventDefault();
    const vendor = vendors.find((item) => item.id === vendorForm.vendorId) || vendors[0];
    const result = await safeRequest(() => api.post("/vendors/orders", { ...vendorForm, amount: vendor?.basePrice }), {
      order: { id: `vo-${Date.now()}`, vendorName: vendor?.name || "Vendor", service: vendorForm.service, amount: vendor?.basePrice || 900, status: "requested" },
      demo: true
    });
    setVendorOrders((current) => [result.order, ...current]);
    setMessage(result.demo ? "Vendor order created in demo mode." : "Vendor order requested.");
  };

  const createWaitlistRule = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/waitlist/rules", waitlistForm), {
      rule: { id: `wl-${Date.now()}`, ...waitlistForm, status: "active", matches: [] },
      demo: true
    });
    setWaitlistRules((current) => [result.rule, ...current]);
    setMessage(result.demo ? "Waitlist automation saved in demo mode." : "Waitlist automation saved.");
  };

  const runWaitlistRule = async (rule) => {
    const id = rule.id || rule._id;
    const result = await safeRequest(() => api.post(`/waitlist/rules/${id}/run`), {
      rule: { ...rule, status: "matched", matches: [{ roomId: "r4", title: "NUST Double Sharing", pricePerHead: 12500, availableBeds: 1 }] },
      matches: [{ roomId: "r4", title: "NUST Double Sharing", pricePerHead: 12500, availableBeds: 1 }],
      demo: true
    });
    setWaitlistRules((current) => current.map((item) => ((item.id || item._id) === id ? result.rule : item)));
    setMessage(`${result.matches?.length || 0} matching rooms found.`);
  };

  const applyAmbassador = async (event) => {
    event.preventDefault();
    const result = await safeRequest(() => api.post("/ambassadors/apply", { ...ambassadorForm, strengths: ["referrals", "campus tours", "student support"] }), {
      application: { id: `amb-${Date.now()}`, ...ambassadorForm, status: "applied", trustScore: 70 },
      demo: true
    });
    setAmbassadors((current) => [result.application, ...current]);
    setMessage(result.demo ? "Ambassador application submitted in demo mode." : "Ambassador application submitted.");
  };

  return (
    <section className="space-y-7">
      <div className="grid gap-5 md:grid-cols-4">
        <Metric icon={HandCoins} label="Manual Payments" value={manualPayments.length || 2} />
        <Metric icon={PackageCheck} label="Vendor Orders" value={vendorOrders.length || 1} />
        <Metric icon={BellRing} label="Search Automations" value={waitlistRules.length || 1} />
        <Metric icon={Users} label="Ambassadors" value={ambassadors.length || 2} />
      </div>

      {message && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

      <div className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-6">
          <SectionTitle icon={CreditCard} title="Manual Payment Challan" subtitle="Use this when no payment gateway is available. Admin approval posts ledger entries." />
          <form onSubmit={createChallan} className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold">Booking ID<input className="input" value={manualForm.bookingId} onChange={(event) => setManualForm((current) => ({ ...current, bookingId: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Amount<input className="input" type="number" value={manualForm.amount} onChange={(event) => setManualForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Method<select className="input" value={manualForm.method} onChange={(event) => setManualForm((current) => ({ ...current, method: event.target.value }))}><option value="bank_transfer">Bank transfer</option><option value="jazzcash_manual">JazzCash manual</option><option value="easypaisa_manual">Easypaisa manual</option><option value="cash_deposit">Cash deposit</option></select></label>
            <button type="submit" className="btn-primary md:col-span-3"><Send size={18} /> Generate Challan</button>
          </form>

          <form onSubmit={uploadProof} className="mt-7 rounded-lg border border-line bg-canvas p-4">
            <h3 className="flex items-center gap-2 font-bold"><FileUp size={18} /> Upload Proof</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold">Challan<select className="input" value={proofForm.paymentId} onChange={(event) => setProofForm((current) => ({ ...current, paymentId: event.target.value }))}>{manualPayments.map((item) => <option key={item.id || item._id || item.reference} value={item.id || item._id || item.reference}>{item.reference || item.id || item._id}</option>)}</select></label>
              <label className="grid gap-2 text-sm font-semibold">Transaction Ref<input className="input" value={proofForm.proofReference} onChange={(event) => setProofForm((current) => ({ ...current, proofReference: event.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold">Proof URL<input className="input" value={proofForm.proofUrl} onChange={(event) => setProofForm((current) => ({ ...current, proofUrl: event.target.value }))} /></label>
              <button type="submit" className="btn-secondary md:col-span-3"><ClipboardCheck size={18} /> Submit Proof</button>
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {(manualPayments.length ? manualPayments : [{ id: "mp-demo-1", reference: "HH-MAN-DEMO1", amount: 23500, status: "proof_submitted", method: "bank_transfer" }]).slice(0, 4).map((payment) => (
              <article key={payment.id || payment._id || payment.reference} className="grid gap-3 rounded-lg border border-line p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-bold">{payment.reference || payment.id || payment._id}</p>
                  <p className="text-sm text-slate-700">{payment.method} - {currency(payment.amount)}</p>
                </div>
                <span className="badge bg-primary-50 text-primary-800">{payment.status}</span>
                <button type="button" className="btn-secondary py-2" onClick={() => setProofForm((current) => ({ ...current, paymentId: payment.id || payment._id || payment.reference }))}>Select</button>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-7">
          <div className="panel p-6">
            <SectionTitle icon={QrCode} title="Move-in Pass" subtitle="QR handoff for security desk, host, and student records." />
            <div className="mt-5 rounded-lg border border-line bg-primary-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-700">Pass ID</p>
                  <h3 className="mt-1 text-2xl font-extrabold">{moveInPass.id || moveInPass.token}</h3>
                  <p className="mt-2 text-sm text-slate-700">{moveInPass.hostelName} - {moveInPass.roomTitle}</p>
                </div>
                <span className="grid h-16 w-16 place-items-center rounded-lg bg-white text-primary-800"><QrCode /></span>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {(moveInPass.checklist || []).map((item) => {
                  const label = typeof item === "string" ? item : item.label;
                  return <span key={label} className="chip bg-white"><BadgeCheck size={14} /> {label}</span>;
                })}
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <SectionTitle icon={Link2} title="Parent Portal" subtitle="Share a limited safety, booking, and payment view with guardians." />
            <form onSubmit={shareParentPortal} className="mt-5 grid gap-4">
              <input className="input" value={parentForm.parentName} onChange={(event) => setParentForm((current) => ({ ...current, parentName: event.target.value }))} placeholder="Parent name" />
              <input className="input" value={parentForm.parentEmail} onChange={(event) => setParentForm((current) => ({ ...current, parentEmail: event.target.value }))} placeholder="Parent email" />
              <input className="input" value={parentForm.parentPhone} onChange={(event) => setParentForm((current) => ({ ...current, parentPhone: event.target.value }))} placeholder="Parent phone" />
              <button type="submit" className="btn-primary"><ShieldCheck size={18} /> Create Share Link</button>
              {portalUrl && <a className="link break-all" href={portalUrl}>{window.location.origin}{portalUrl}</a>}
            </form>
          </div>
        </section>
      </div>

      <section className="panel p-6">
        <SectionTitle icon={ShieldCheck} title="V6 Family, Agreement & Check-in Tools" subtitle="Invite family, hold rooms for friends, sign tenancy terms, and verify move-in identity." />
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <form onSubmit={inviteFamily} className="rounded-lg border border-line bg-canvas p-5">
            <h3 className="font-bold">Family portal invite</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input className="input" value={familyForm.guardianName} onChange={(event) => setFamilyForm((current) => ({ ...current, guardianName: event.target.value }))} placeholder="Guardian name" />
              <input className="input" value={familyForm.guardianPhone} onChange={(event) => setFamilyForm((current) => ({ ...current, guardianPhone: event.target.value }))} placeholder="Guardian phone" />
              <select className="input" value={familyForm.relation} onChange={(event) => setFamilyForm((current) => ({ ...current, relation: event.target.value }))}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option></select>
            </div>
            <button type="submit" className="btn-primary mt-4"><Link2 size={18} /> Invite Family</button>
            {familyPortalUrl && <a href={familyPortalUrl} className="link mt-3 block break-all">{window.location.origin}{familyPortalUrl}</a>}
          </form>

          <form onSubmit={createGroupBooking} className="rounded-lg border border-line bg-canvas p-5">
            <h3 className="font-bold">Group booking hold</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">Invite emails<textarea className="input min-h-24" value={groupForm.invites} onChange={(event) => setGroupForm((current) => ({ ...current, invites: event.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold">Room IDs<textarea className="input min-h-24" value={groupForm.roomIds} onChange={(event) => setGroupForm((current) => ({ ...current, roomIds: event.target.value }))} /></label>
            </div>
            <button type="submit" className="btn-primary mt-4"><Users size={18} /> Create Group Hold</button>
            {groupBooking && <p className="mt-3 text-sm font-semibold text-primary-800">Group {groupBooking.id || groupBooking._id} - {groupBooking.discountApplied || 0}% discount hold</p>}
          </form>

          <div className="rounded-lg border border-line bg-canvas p-5">
            <h3 className="font-bold">Digital tenancy agreement</h3>
            <p className="mt-2 text-sm text-slate-700">{agreement?.contractId || "HH-AGR-DEMO"} - {agreement?.status || "generated"}</p>
            <form onSubmit={signAgreement} className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="input" value={signForm.name} onChange={(event) => setSignForm((current) => ({ ...current, name: event.target.value }))} placeholder="Signer name" />
              <input className="input" value={signForm.cnic} onChange={(event) => setSignForm((current) => ({ ...current, cnic: event.target.value }))} placeholder="CNIC" />
              <button type="submit" className="btn-primary md:col-span-1"><ClipboardCheck size={18} /> E-sign</button>
              <button type="button" className="btn-secondary md:col-span-1" onClick={downloadAgreement}><FileUp size={18} /> PDF</button>
            </form>
          </div>

          <form onSubmit={verifyCheckIn} className="rounded-lg border border-line bg-canvas p-5">
            <h3 className="font-bold">Anti-fraud check-in verification</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className="input" value={checkInForm.selfieUrl} onChange={(event) => setCheckInForm((current) => ({ ...current, selfieUrl: event.target.value }))} placeholder="Selfie URL" />
              <input className="input" value={checkInForm.cnicPhotoUrl} onChange={(event) => setCheckInForm((current) => ({ ...current, cnicPhotoUrl: event.target.value }))} placeholder="CNIC photo URL" />
            </div>
            <button type="submit" className="btn-primary mt-4"><ShieldCheck size={18} /> Verify Check-in</button>
            {verification && <p className="mt-3 text-sm font-semibold text-primary-800">{verification.status} - {verification.matchConfidence}% confidence</p>}
          </form>

          <form onSubmit={linkAlumniStay} className="rounded-lg border border-line bg-canvas p-5 xl:col-span-2">
            <h3 className="font-bold">Alumni network</h3>
            <p className="mt-1 text-sm text-slate-700">Link a past long stay and refer juniors to earn enhanced alumni loyalty points.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <input className="input" value={alumniForm.hostelId} onChange={(event) => setAlumniForm((current) => ({ ...current, hostelId: event.target.value }))} placeholder="Hostel ID" />
              <input className="input" value={alumniForm.university} onChange={(event) => setAlumniForm((current) => ({ ...current, university: event.target.value }))} placeholder="University" />
              <input className="input" type="number" value={alumniForm.graduationYear} onChange={(event) => setAlumniForm((current) => ({ ...current, graduationYear: Number(event.target.value) }))} placeholder="Graduation year" />
              <input className="input" type="number" value={alumniForm.monthsStayed} onChange={(event) => setAlumniForm((current) => ({ ...current, monthsStayed: Number(event.target.value) }))} placeholder="Months stayed" />
              <button type="submit" className="btn-primary"><Sparkles size={18} /> Link Stay</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <input className="input" value={alumniForm.referralEmail} onChange={(event) => setAlumniForm((current) => ({ ...current, referralEmail: event.target.value }))} placeholder="Referral email" />
              <button type="button" className="btn-secondary" onClick={sendAlumniReferral}><Send size={18} /> Alumni Referral</button>
            </div>
            {alumniRecord && <p className="mt-3 text-sm font-semibold text-primary-800">{alumniRecord.badge || "Alumni"} badge linked for {alumniRecord.university}</p>}
          </form>
        </div>
        <div className="mt-6 rounded-lg border border-line bg-primary-50 p-5">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Latest utility split</p>
          <p className="mt-2 text-3xl font-extrabold text-primary-800">{currency(utilitySplit?.totalUtilityShare || utilitySplit?.split?.share || 2400)}</p>
          <p className="mt-1 text-sm text-slate-700">Calculated by bill amount, beds, and occupancy days.</p>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section className="panel p-6">
          <SectionTitle icon={PackageCheck} title="Vendor Marketplace" subtitle="Order laundry, move-in transport, cleaning, or meal services through vetted partners." />
          <form onSubmit={orderVendor} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">Vendor<select className="input" value={vendorForm.vendorId} onChange={(event) => setVendorForm((current) => ({ ...current, vendorId: event.target.value }))}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Service<input className="input" value={vendorForm.service} onChange={(event) => setVendorForm((current) => ({ ...current, service: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Address<input className="input" value={vendorForm.address} onChange={(event) => setVendorForm((current) => ({ ...current, address: event.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold">Date<input className="input" type="date" value={vendorForm.scheduledFor} onChange={(event) => setVendorForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></label>
            <button type="submit" className="btn-primary md:col-span-2"><PackageCheck size={18} /> Request Service</button>
          </form>
          <div className="mt-5 grid gap-3">
            {(vendorOrders.length ? vendorOrders : [{ id: "vo-demo", vendorName: "Campus Laundry Express", service: "Wash & fold", amount: 900, status: "confirmed" }]).slice(0, 3).map((order) => (
              <article key={order.id || order._id} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between gap-3"><p className="font-bold">{order.vendorName}</p><span className="badge bg-accent-50 text-accent-700">{order.status}</span></div>
                <p className="mt-1 text-sm text-slate-700">{order.service} - {currency(order.amount)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <SectionTitle icon={BellRing} title="Automated Waitlist" subtitle="Let Basera monitor rooms and notify you when a match opens." />
          <form onSubmit={createWaitlistRule} className="mt-5 grid gap-4 md:grid-cols-2">
            <input className="input md:col-span-2" value={waitlistForm.title} onChange={(event) => setWaitlistForm((current) => ({ ...current, title: event.target.value }))} placeholder="Rule title" />
            <input className="input" value={waitlistForm.city} onChange={(event) => setWaitlistForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
            <input className="input" value={waitlistForm.university} onChange={(event) => setWaitlistForm((current) => ({ ...current, university: event.target.value }))} placeholder="University" />
            <input className="input" type="number" value={waitlistForm.maxBudget} onChange={(event) => setWaitlistForm((current) => ({ ...current, maxBudget: Number(event.target.value) }))} placeholder="Max budget" />
            <input className="input" value={waitlistForm.roomType} onChange={(event) => setWaitlistForm((current) => ({ ...current, roomType: event.target.value }))} placeholder="Room type" />
            <button type="submit" className="btn-primary md:col-span-2"><BellRing size={18} /> Save Rule</button>
          </form>
          <div className="mt-5 grid gap-3">
            {(waitlistRules.length ? waitlistRules : [{ id: "wl-1", title: "NUST shared room under 18k", city: "Islamabad", maxBudget: 18000, status: "active", matches: [] }]).slice(0, 4).map((rule) => (
              <article key={rule.id || rule._id} className="rounded-lg border border-line p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">{rule.title}</p>
                    <p className="text-sm text-slate-700">{rule.city} - up to {currency(rule.maxBudget)} - {rule.matches?.length || 0} matches</p>
                  </div>
                  <button type="button" className="btn-secondary py-2" onClick={() => runWaitlistRule(rule)}><Play size={16} /> Run</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-6">
        <SectionTitle icon={Sparkles} title="Campus Ambassador Program" subtitle="Student-led tours, referrals, safety feedback, and community support." />
        <form onSubmit={applyAmbassador} className="mt-5 grid gap-4 md:grid-cols-5">
          {["name", "email", "university", "city"].map((field) => (
            <input key={field} className="input" value={ambassadorForm[field]} onChange={(event) => setAmbassadorForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={field} />
          ))}
          <button type="submit" className="btn-primary"><Users size={18} /> Apply</button>
        </form>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(ambassadors.length ? ambassadors : [{ id: "amb-1", name: "Ayesha Khan", university: "NUST", city: "Islamabad", status: "approved", trustScore: 92, tasksCompleted: 18 }]).map((ambassador) => (
            <article key={ambassador.id || ambassador._id || ambassador.email} className="rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{ambassador.name}</p><p className="text-sm text-slate-700">{ambassador.university} - {ambassador.city}</p></div><span className="badge bg-primary-50 text-primary-800">{ambassador.status}</span></div>
              <p className="mt-3 text-sm text-slate-700">Trust score {ambassador.trustScore || 70} - {ambassador.tasksCompleted || 0} tasks completed</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="panel p-5">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary-800"><Icon size={20} /></span>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
    </article>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-800"><Icon size={20} /></span>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-700">{subtitle}</p>
      </div>
    </div>
  );
}
