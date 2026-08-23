import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowRight, BadgeCheck, Building2, FileCheck2, PenLine, ShieldCheck } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const steps = ["Account", "Identity", "Property", "Room", "Pricing", "Agreement"];
const documentFields = [
  { key: "cnic_front", label: "CNIC front" },
  { key: "cnic_back", label: "CNIC back" },
  { key: "property_proof", label: "Property proof / rent deed" },
  { key: "utility_bill", label: "Utility bill" }
];

export function ListerOnboardingPage() {
  const registerLandlord = useAuthStore((state) => state.registerLandlord);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState("");
  const [documents, setDocuments] = useState({});
  const [account, setAccount] = useState({
    name: "Sara Malik",
    email: "landlord@basera.pk",
    phone: "+923211234567",
    password: "password123",
    city: "Lahore",
    listerType: "individual_landlord"
  });
  const [room, setRoom] = useState({
    title: "New Verified PG Room",
    roomNumber: "PG-NEW",
    city: "Lahore",
    area: "DHA Phase 5",
    address: "DHA Phase 5, Lahore",
    nearestUniversity: "LUMS",
    roomType: "PG",
    listingCategory: "PG_ACCOMMODATION",
    totalBeds: 1,
    availableBeds: 1,
    genderPolicy: "GIRLS_ONLY",
    mealPlan: "BREAKFAST",
    curfewTime: "9:00 PM",
    pricePerHead: 32000,
    pricePerRoom: 32000,
    securityDeposit: 15000,
    amenities: "WiFi, Geyser, Laundry, Kitchen Access",
    description: "",
    descriptionUrdu: "",
    virtualTourUrl: "",
    panoramaUrl: "",
    instantBooking: false,
    trialStayAvailable: true
  });
  const [agreement, setAgreement] = useState({ accepted: false, signedBy: "Sara Malik", commissionAcknowledged: true, offPlatformPolicyAccepted: false });
  useDocumentTitle("Host Onboarding | Basera");

  const uploadDocument = async ({ key, label, file }) => {
    if (!file) return;
    setUploading(key);
    setMessage("");
    const formData = new FormData();
    formData.append("document", file);
    try {
      const { data } = await api.post("/uploads/document", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setDocuments((current) => ({
        ...current,
        [key]: { type: key, label, url: data.url, originalName: data.originalName || file.name, status: "pending" }
      }));
    } catch (error) {
      setMessage(error.response?.data?.message || "Upload failed. Use image or PDF under 8MB.");
    } finally {
      setUploading("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!agreement.accepted || !agreement.commissionAcknowledged || !agreement.offPlatformPolicyAccepted) {
      setMessage("Accept the Host agreement, commission acknowledgement, and off-platform payment policy.");
      return;
    }
    setMessage("Creating Host account...");
    try {
      await registerLandlord({
        ...account,
        verificationDocuments: Object.values(documents),
        agreementAccepted: agreement.accepted,
        agreementSignedBy: agreement.signedBy,
        commissionAcknowledged: agreement.commissionAcknowledged,
        offPlatformPolicyAccepted: agreement.offPlatformPolicyAccepted
      });
      setMessage("Submitting first room listing...");
      const payload = {
        ...room,
        amenities: room.amenities.split(",").map((item) => item.trim()).filter(Boolean),
        totalBeds: Number(room.totalBeds),
        availableBeds: Number(room.availableBeds),
        pricePerHead: Number(room.pricePerHead),
        pricePerRoom: Number(room.pricePerRoom),
        securityDeposit: Number(room.securityDeposit)
      };
      await api.post("/rooms", payload);
      setMessage("Onboarding complete. Your room is pending review for 24-48 hours.");
    } catch (error) {
      setMessage(error.message || "Onboarding failed.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Host Onboarding | Basera</title>
      </Helmet>
      <main className="container-page py-10">
        <div className="mx-auto max-w-6xl">
          <span className="badge bg-accent-50 text-accent-700"><BadgeCheck size={14} /> Verified Host flow</span>
          <h1 className="mt-4 text-4xl font-extrabold">List Your First Room</h1>
          <p className="mt-3 max-w-3xl text-slate-700">Complete account registration, CNIC verification, property proof, room setup, and the Basera Host agreement.</p>

          <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
            {steps.map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index)} className={`chip shrink-0 ${step === index ? "border-primary-700 bg-primary-50 text-primary-800" : ""}`}>
                {index + 1}. {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="panel mt-6 p-6 sm:p-8">
            {step === 0 && (
              <SectionTitle icon={Building2} title="Register as Host" text="Choose whether you are a hostel Host, individual Host, or PG operator." />
            )}
            {step === 0 && <AccountFields account={account} setAccount={setAccount} />}

            {step === 1 && (
              <>
                <SectionTitle icon={ShieldCheck} title="Identity Verification" text="Upload CNIC front and back. Face match is manual admin review in v2.0." />
                <DocumentGrid fields={documentFields.slice(0, 2)} documents={documents} uploading={uploading} onFile={uploadDocument} />
              </>
            )}

            {step === 2 && (
              <>
                <SectionTitle icon={FileCheck2} title="Property Verification" text="Upload deed, rent agreement, authorization letter, or utility bill." />
                <DocumentGrid fields={documentFields.slice(2)} documents={documents} uploading={uploading} onFile={uploadDocument} />
              </>
            )}

            {step === 3 && <RoomFields room={room} setRoom={setRoom} />}
            {step === 4 && <PricingFields room={room} setRoom={setRoom} />}
            {step === 5 && (
              <section>
                <SectionTitle icon={PenLine} title="Basera Host Agreement" text="E-sign the platform terms and acknowledge commission and off-platform payment rules before review." />
                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_360px]">
                  <div className="rounded-lg bg-primary-50 p-5 text-sm leading-7 text-slate-800">
                    I certify that my CNIC and property documents are authentic, that I am authorized to list this room, and that bookings, payments, refunds, disputes, and reviews will be handled through Basera.
                  </div>
                  <div className="grid gap-4">
                    <label className="grid gap-2 font-semibold">Signer name<input className="input" value={agreement.signedBy} onChange={(event) => setAgreement((current) => ({ ...current, signedBy: event.target.value }))} /></label>
                    <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={agreement.accepted} onChange={(event) => setAgreement((current) => ({ ...current, accepted: event.target.checked }))} />
                      I electronically sign the Basera Host Agreement.
                    </label>
                    <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={agreement.commissionAcknowledged} onChange={(event) => setAgreement((current) => ({ ...current, commissionAcknowledged: event.target.checked }))} />
                      I acknowledge Basera commission and payment-only-through-platform rules.
                    </label>
                    <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={agreement.offPlatformPolicyAccepted} onChange={(event) => setAgreement((current) => ({ ...current, offPlatformPolicyAccepted: event.target.checked }))} />
                      I will not collect confirmed tenant rent, deposits, or booking payments outside Basera.
                    </label>
                  </div>
                </div>
              </section>
            )}

            {message && <p className="mt-6 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(Math.max(0, step - 1))}>Back</button>
              {step < steps.length - 1 ? (
                <button type="button" className="btn-primary" onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>Next <ArrowRight size={18} /></button>
              ) : (
                <button type="submit" className="btn-primary">Submit for Review</button>
              )}
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

function SectionTitle({ icon: Icon, title, text }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-2xl font-bold"><Icon size={24} /> {title}</h2>
      <p className="mt-2 text-slate-700">{text}</p>
    </div>
  );
}

function AccountFields({ account, setAccount }) {
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      {["name", "email", "phone", "password", "city"].map((field) => (
        <label key={field} className="grid gap-2 font-semibold capitalize">
          {field}
          <input className="input" type={field === "password" ? "password" : "text"} value={account[field]} onChange={(event) => setAccount((current) => ({ ...current, [field]: event.target.value }))} />
        </label>
      ))}
      <label className="grid gap-2 font-semibold">
        Host type
        <select className="input" value={account.listerType} onChange={(event) => setAccount((current) => ({ ...current, listerType: event.target.value }))}>
          <option value="hostel_owner">Hostel Host</option>
          <option value="individual_landlord">Individual Host</option>
          <option value="pg_operator">PG Operator</option>
        </select>
      </label>
    </div>
  );
}

function DocumentGrid({ fields, documents, uploading, onFile }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="rounded-lg border border-line bg-canvas p-5">
          <p className="font-bold">{field.label}</p>
          <p className="mt-1 text-sm text-slate-700">{documents[field.key]?.originalName || "Image or PDF, max 8MB"}</p>
          <input type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => onFile({ ...field, file: event.target.files?.[0] })} className="mt-4 block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary-700 file:px-4 file:py-2 file:font-semibold file:text-white" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-600">{uploading === field.key ? "Uploading..." : documents[field.key]?.status || "Required"}</p>
        </div>
      ))}
    </div>
  );
}

function RoomFields({ room, setRoom }) {
  const [generating, setGenerating] = useState(false);

  const generateDescription = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/rooms/generate-description", {
        title: room.title,
        roomType: room.roomType,
        listingCategory: room.listingCategory,
        city: room.city,
        area: room.area,
        nearestUniversity: room.nearestUniversity,
        pricePerHead: room.pricePerHead,
        amenities: room.amenities.split(",").map((item) => item.trim()).filter(Boolean)
      });
      setRoom((current) => ({ ...current, description: data.english || current.description, descriptionUrdu: data.urdu || current.descriptionUrdu }));
    } catch {
      setRoom((current) => ({
        ...current,
        description: `${current.title} is a verified ${current.roomType} listing near ${current.nearestUniversity} with student-friendly amenities and transparent pricing.`
      }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section>
      <SectionTitle icon={Building2} title="List First Room" text="Set room type, gender policy, university distance, and rules." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {["title", "roomNumber", "city", "area", "address", "nearestUniversity", "curfewTime"].map((field) => (
          <label key={field} className="grid gap-2 font-semibold">
            {field}
            <input className="input" value={room[field]} onChange={(event) => setRoom((current) => ({ ...current, [field]: event.target.value }))} />
          </label>
        ))}
        <label className="grid gap-2 font-semibold">Room type<select className="input" value={room.roomType} onChange={(event) => setRoom((current) => ({ ...current, roomType: event.target.value }))}>{["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "BUNK_DORM", "SEMI_PRIVATE", "PG", "STUDIO", "ENTIRE_FLOOR"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Listing category<select className="input" value={room.listingCategory} onChange={(event) => setRoom((current) => ({ ...current, listingCategory: event.target.value }))}>{["HOSTEL_ROOM", "PRIVATE_ROOM", "PG_ACCOMMODATION", "SHARED_ROOM", "ENTIRE_FLOOR"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Gender policy<select className="input" value={room.genderPolicy} onChange={(event) => setRoom((current) => ({ ...current, genderPolicy: event.target.value }))}>{["BOYS_ONLY", "GIRLS_ONLY", "CO_ED", "FAMILIES", "PROFESSIONALS"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Meal plan<select className="input" value={room.mealPlan} onChange={(event) => setRoom((current) => ({ ...current, mealPlan: event.target.value }))}>{["NONE", "BREAKFAST", "TWO_MEALS", "FULL_BOARD", "KITCHEN_ACCESS"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Virtual tour URL
          <input className="input" value={room.virtualTourUrl} onChange={(event) => setRoom((current) => ({ ...current, virtualTourUrl: event.target.value }))} placeholder="Matterport, YouTube, or 360 walkthrough link" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Panorama image URL
          <input className="input" value={room.panoramaUrl} onChange={(event) => setRoom((current) => ({ ...current, panoramaUrl: event.target.value }))} placeholder="Optional 360 image URL" />
        </label>
        <div className="md:col-span-2">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">Room description</p>
            <button type="button" onClick={generateDescription} className="btn-secondary py-2" disabled={generating}>
              {generating ? "Generating..." : "Generate Description"}
            </button>
          </div>
          <textarea className="input min-h-32" value={room.description} onChange={(event) => setRoom((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the room, amenities, rules, and nearby campus access." />
        </div>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Urdu description
          <textarea className="input min-h-28" value={room.descriptionUrdu} onChange={(event) => setRoom((current) => ({ ...current, descriptionUrdu: event.target.value }))} />
        </label>
      </div>
    </section>
  );
}

function PricingFields({ room, setRoom }) {
  return (
    <section>
      <SectionTitle icon={BadgeCheck} title="Pricing & Availability" text="Set per-head/per-room rent, deposit, bed count, and booking rules." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {["totalBeds", "availableBeds", "pricePerHead", "pricePerRoom", "securityDeposit"].map((field) => (
          <label key={field} className="grid gap-2 font-semibold">
            {field}
            <input className="input" type="number" min="0" value={room[field]} onChange={(event) => setRoom((current) => ({ ...current, [field]: event.target.value }))} />
          </label>
        ))}
        <label className="grid gap-2 font-semibold md:col-span-2">
          Amenities
          <input className="input" value={room.amenities} onChange={(event) => setRoom((current) => ({ ...current, amenities: event.target.value }))} />
        </label>
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-primary-700" checked={room.instantBooking} onChange={(event) => setRoom((current) => ({ ...current, instantBooking: event.target.checked }))} /> Instant booking</label>
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-primary-700" checked={room.trialStayAvailable} onChange={(event) => setRoom((current) => ({ ...current, trialStayAvailable: event.target.checked }))} /> Trial stay available</label>
      </div>
    </section>
  );
}
