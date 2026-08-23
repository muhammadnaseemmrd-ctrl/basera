import { useEffect, useState } from "react";
import { Bell, BedDouble, Building2, Download, FileCheck2, Grid2X2, MessageSquare, MessageSquarePlus, Newspaper, PenLine, Plus, ReceiptText, Send, ShieldCheck, Star, Users, WalletCards, Wrench, X } from "lucide-react";
import { DashboardShell } from "../components/DashboardShell";
import { StatTile, IconButton, ConfirmButton, useToastBridge } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";
import { AlertSubmitCard } from "../components/AlertSubmitCard";
import { HostCommunityPanel } from "../components/HostCommunityPanel";
import { MaintenancePanel } from "../components/MaintenancePanel";
import { ownerDashboard } from "../data/mockData";
import { useDocumentTitle } from "../utils/useDocumentTitle";
import { motion } from "framer-motion";
import { fadeUp, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { downloadApiPdf, downloadTextFile } from "../utils/downloadFile";

const navItems = [
  { label: "Overview", icon: Grid2X2 },
  { label: "Rooms", icon: BedDouble },
  { label: "Tenants", icon: Users },
  { label: "Payments", icon: WalletCards },
  { label: "Maintenance", icon: Wrench },
  { label: "Community", icon: Newspaper },
  { label: "Reports", icon: ReceiptText },
  { label: "Chat", icon: MessageSquare },
  { label: "Reviews", icon: Star }
];

const statusStyle = {
  available: "border-accent-700 bg-accent-50 text-accent-700",
  occupied: "border-primary-700 bg-primary-50 text-primary-800",
  maintenance: "border-[#C81E1E] bg-[#FEE2E2] text-[#C81E1E]"
};

const money = (value) => {
  if (typeof value === "number") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value;
};

const normalizeOwnerDashboard = (data = ownerDashboard) => ({
  revenue: data.revenue || ownerDashboard.revenue,
  occupancyRate: data.occupancyRate ?? 85,
  occupiedBeds: data.occupiedBeds ?? 42,
  totalBeds: data.totalBeds ?? 50,
  rooms: data.rooms || data.roomGrid?.map((room) => [room.number, room.status]) || ownerDashboard.rooms,
  requests: data.requests || ownerDashboard.requests,
  payments: (data.payments || ownerDashboard.payments).map((payment) => ({
    ...payment,
    amount: money(payment.amount)
  }))
});

const createEmptyListingForm = (user) => ({
  name: "",
  city: "Islamabad",
  area: "",
  address: "",
  type: "boys",
  minPrice: 15000,
  maxPrice: 25000,
  amenities: "WiFi, Mess, CCTV Security",
  description: "",
  ownerVerification: {
    identityDocument: null,
    propertyDocument: null,
    licenseDocument: null,
    agreement: {
      accepted: false,
      offPlatformPolicyAccepted: false,
      signedBy: user?.name || "",
      signerCnic: ""
    }
  }
});

const documentFields = [
  {
    key: "identityDocument",
    type: "identity",
    label: "Host CNIC / identity proof",
    required: true
  },
  {
    key: "propertyDocument",
    type: "property",
    label: "Property ownership or authorization proof",
    required: true
  },
  {
    key: "licenseDocument",
    type: "license",
    label: "Hostel registration or license",
    required: false
  }
];

export function OwnerDashboard() {
  const authUser = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState("Overview");
  const [dashboard, setDashboard] = useState(normalizeOwnerDashboard(ownerDashboard));
  const [roomsData, setRoomsData] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [reports, setReports] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkNotice, setBulkNotice] = useState("");
  const [listingOpen, setListingOpen] = useState(false);
  const [listingMessage, setListingMessage] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [listingForm, setListingForm] = useState(createEmptyListingForm(null));
  const motionSafe = useMotionSafe();
  useDocumentTitle("Host Property Dashboard | Basera");
  useToastBridge(listingMessage);
  useToastBridge(bulkNotice);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/owner"), ownerDashboard).then((result) => {
      setDashboard(normalizeOwnerDashboard(result));
    });
  }, []);

  useEffect(() => {
    if (activeTab === "Rooms") {
      safeRequest(() => api.get("/dashboard/owner/rooms"), { results: [] }).then((result) => {
        setRoomsData(result.results || []);
      });
    }
    if (activeTab === "Tenants") {
      safeRequest(() => api.get("/dashboard/owner/tenants"), { results: [] }).then((result) => {
        setTenants(result.results || []);
      });
    }
    if (activeTab === "Reports") {
      safeRequest(() => api.get("/dashboard/owner/reports"), null).then(setReports);
    }
  }, [activeTab]);

  const updateListing = (field) => (event) => {
    setListingForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateAgreement = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setListingForm((current) => ({
      ...current,
      ownerVerification: {
        ...current.ownerVerification,
        agreement: {
          ...current.ownerVerification.agreement,
          [field]: value
        }
      }
    }));
  };

  const setVerificationDocument = (key, document) => {
    setListingForm((current) => ({
      ...current,
      ownerVerification: {
        ...current.ownerVerification,
        [key]: document
      }
    }));
  };

  const uploadVerificationDocument = async ({ key, type, label, file }) => {
    if (!file) return;

    setUploadingKey(key);
    setListingMessage("");
    setVerificationDocument(key, {
      type,
      label,
      originalName: file.name,
      uploading: true
    });

    const formData = new FormData();
    formData.append("document", file);

    try {
      const { data } = await api.post("/uploads/document", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setVerificationDocument(key, {
        type,
        label,
        url: data.url,
        originalName: data.originalName || file.name,
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      setVerificationDocument(key, null);
      setListingMessage(error.response?.data?.message || "Document upload failed. Upload an image or PDF under 8MB.");
    } finally {
      setUploadingKey("");
    }
  };

  const submitListing = async (event) => {
    event.preventDefault();
    const verification = listingForm.ownerVerification;
    const agreement = verification.agreement;
    const verificationReady =
      verification.identityDocument?.url &&
      verification.propertyDocument?.url &&
      agreement.accepted &&
      agreement.offPlatformPolicyAccepted &&
      agreement.signedBy.trim() &&
      agreement.signerCnic.trim();

    if (!verificationReady) {
      setListingMessage("Upload identity proof, property proof, sign the Host agreement, and accept the off-platform payment policy before submitting.");
      return;
    }

    setListingMessage("Saving listing...");
    const payload = {
      ...listingForm,
      minPrice: Number(listingForm.minPrice),
      maxPrice: Number(listingForm.maxPrice),
      amenities: listingForm.amenities.split(",").map((item) => item.trim()).filter(Boolean),
      ownerVerification: {
        identityDocument: verification.identityDocument,
        propertyDocument: verification.propertyDocument,
        ...(verification.licenseDocument?.url ? { licenseDocument: verification.licenseDocument } : {}),
        agreement
      }
    };
    const result = await safeRequest(() => api.post("/hostels", payload), { demo: true, hostel: { id: `demo-${Date.now()}`, ...payload } });
    setListingMessage(result.demo ? "Listing and verification package saved in demo mode." : "Listing submitted for admin verification.");
    setListingForm(createEmptyListingForm(authUser));
  };

  const updateRequestStatus = (name, status) => {
    setDashboard((current) => ({
      ...current,
      requests: current.requests.map((request) => (request.name === name ? { ...request, status } : request))
    }));
  };

  const ownerNavItems = navItems.map((item) => ({ ...item, onClick: () => setActiveTab(item.label) }));

  const sendBulkMessage = async (event) => {
    event.preventDefault();
    const message = bulkMessage.trim();
    if (!message) return;
    setBulkNotice("Queuing tenant broadcast...");
    const result = await safeRequest(() => api.post("/dashboard/owner/bulk-message", { message, channel: "in-app" }), {
      demo: true,
      recipients: 42
    });
    setBulkNotice(result.demo ? `Broadcast queued in demo mode for ${result.recipients} tenants.` : `Broadcast queued for ${result.recipients} tenants.`);
    setBulkMessage("");
  };

  return (
    <DashboardShell
      title="Property Dashboard"
      subtitle="Revenue, occupancy, room inventory and tenant operations at a glance."
      navLabel="Property Workspace"
      navItems={ownerNavItems}
      active={activeTab}
      user={{
        name: authUser?.name || "Alex Rivera",
        role: "Host Panel",
        avatar: authUser?.avatar || "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=160&q=80"
      }}
    >
      <div className="mb-8 flex items-center justify-end gap-2">
        <IconButton icon={MessageSquarePlus} label="Messages" />
        <IconButton icon={Bell} label="Notifications" />
        <div>
          <button
            type="button"
            onClick={() => {
              setListingForm((current) => ({
                ...current,
                ownerVerification: {
                  ...current.ownerVerification,
                  agreement: {
                    ...current.ownerVerification.agreement,
                    signedBy: current.ownerVerification.agreement.signedBy || authUser?.name || ""
                  }
                }
              }));
              setListingOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} /> New Listing
          </button>
        </div>
      </div>

      {activeTab === "Overview" ? (
      <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-7">
          <div className="grid min-w-0 gap-7 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="panel min-w-0 p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Revenue Growth</h2>
                <span className="font-semibold text-accent-700">+12.5%</span>
              </div>
              <div className="mt-10 flex h-64 min-w-0 items-end gap-2 sm:gap-4">
                {dashboard.revenue.map((value, index) => (
                  <div key={`${value}-${index}`} className="grid min-w-0 flex-1 gap-4 text-center">
                    <div
                      className={`rounded-t-lg ${index === 2 ? "bg-primary-700" : "bg-primary-100"}`}
                      style={{ height: `${Math.max(82, value / 45)}px` }}
                    />
                    <span>{["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel min-w-0 p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Occupancy Rate</h2>
              <div className="mx-auto mt-9 grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(#FF6B4A 0 ${dashboard.occupancyRate}%, #FFE2D6 ${dashboard.occupancyRate}% 100%)` }}>
                <div className="grid h-32 w-32 place-items-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-5xl font-extrabold text-primary-800">{dashboard.occupancyRate}%</p>
                    <p className="text-slate-700">In Use</p>
                  </div>
                </div>
              </div>
              <p className="mt-8 text-center text-lg text-slate-700">{dashboard.occupiedBeds} of {dashboard.totalBeds} beds currently occupied</p>
            </div>
          </div>

          <section className="panel min-w-0 p-5 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Room Inventory Grid</h2>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-accent-700" /> Available</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-primary-700" /> Occupied</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#C81E1E]" /> Maintenance</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
              {dashboard.rooms.map(([number, status]) => (
                <button key={number} className={`rounded-md border px-3 py-4 text-lg font-semibold ${statusStyle[status]}`}>{number}</button>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="p-7">
              <h2 className="text-xl font-semibold">Recent Payments</h2>
            </div>
            <div className="grid gap-4 p-5 md:hidden">
              {dashboard.payments.map((payment) => (
                <article key={payment.tenant} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{payment.tenant}</p>
                      <p className="mt-1 text-sm text-slate-700">Room {payment.room}</p>
                    </div>
                    <span className={`badge ${payment.status === "Paid" ? "bg-accent-50 text-accent-700" : "bg-[#FDECE7] text-[#9B1C1C]"}`}>{payment.status}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <strong>{payment.amount}</strong>
                    <span className="text-sm text-slate-700">{payment.date}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-primary-50 uppercase tracking-widest text-slate-700">
                  <tr>
                    <th className="px-7 py-4">Tenant</th>
                    <th className="px-7 py-4">Room</th>
                    <th className="px-7 py-4">Amount</th>
                    <th className="px-7 py-4">Status</th>
                    <th className="px-7 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dashboard.payments.map((payment) => (
                    <tr key={payment.tenant}>
                      <td className="px-7 py-5">{payment.tenant}</td>
                      <td className="px-7 py-5">{payment.room}</td>
                      <td className="px-7 py-5">{payment.amount}</td>
                      <td className="px-7 py-5">
                        <span className={`badge ${payment.status === "Paid" ? "bg-accent-50 text-accent-700" : "bg-[#FDECE7] text-[#9B1C1C]"}`}>{payment.status}</span>
                      </td>
                      <td className="px-7 py-5">{payment.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="min-w-0 space-y-7">
          <section className="panel p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Booking Requests</h2>
              <span className="badge bg-primary-700 text-white">3 New</span>
            </div>
            <div className="grid gap-5">
              {dashboard.requests.map((request) => (
                <article key={request.name} className="rounded-lg border border-line bg-canvas p-5">
                  <div className="flex gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary-800"><Building2 size={20} /></span>
                    <div>
                      <p className="font-semibold">{request.name}</p>
                      <p className="text-sm text-slate-700">{request.room}</p>
                      <p className="mt-3 text-sm text-slate-700">{request.dates}</p>
                      {request.status && <span className="badge mt-3 bg-accent-50 text-accent-700">{request.status}</span>}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <ConfirmButton className="btn-secondary py-3 text-danger-700" confirmLabel="Reject" onConfirm={() => updateRequestStatus(request.name, "Rejected")}>Reject</ConfirmButton>
                    <button type="button" onClick={() => updateRequestStatus(request.name, "Accepted")} className="btn-primary py-3">Accept</button>
                  </div>
                </article>
              ))}
            </div>
            <button className="mt-7 w-full font-semibold text-primary-800">View All Requests</button>
          </section>

          <section className="rounded-lg bg-primary-800 p-7 text-white shadow-soft">
            <ReceiptText size={34} className="text-white/80" />
            <h2 className="mt-5 text-xl font-semibold">Upgrade Property</h2>
            <p className="mt-4 leading-7 text-white/90">Get verified badges and priority listing to boost occupancy rates by up to 30%.</p>
            <button className="mt-6 rounded-md bg-white px-6 py-3 font-semibold text-primary-800">Upgrade Pro</button>
          </section>

          <AlertSubmitCard audience="all" title="Submit Hostel Alert" />
        </aside>
      </motion.div>
      ) : (
        <OwnerOperationsTab
          activeTab={activeTab}
          dashboard={dashboard}
          roomsData={roomsData}
          tenants={tenants}
          reports={reports}
          bulkMessage={bulkMessage}
          bulkNotice={bulkNotice}
          setBulkMessage={setBulkMessage}
          sendBulkMessage={sendBulkMessage}
          hostName={authUser?.name || "Alex Rivera"}
        />
      )}
      {listingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="panel max-h-[92vh] w-full max-w-5xl overflow-y-auto p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">New Listing</h2>
                <p className="mt-1 text-sm text-slate-700">Submit hostel details, Host proofs, and the signed platform agreement.</p>
              </div>
              <button type="button" onClick={() => setListingOpen(false)} className="btn-ghost" aria-label="Close new listing form">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitListing} className="grid gap-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["1", "Hostel Details", Building2],
                  ["2", "Host Proofs", ShieldCheck],
                  ["3", "Agreement", PenLine]
                ].map(([number, label, Icon]) => (
                  <div key={label} className="rounded-lg border border-line bg-primary-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-700 text-sm font-bold text-white">{number}</span>
                      <Icon size={18} className="text-primary-800" />
                      <p className="font-bold">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <section className="rounded-lg border border-line p-5">
                <h3 className="text-lg font-bold">Hostel Details</h3>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold">
                    Hostel name
                    <input className="input" value={listingForm.name} onChange={updateListing("name")} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Type
                    <select className="input" value={listingForm.type} onChange={updateListing("type")}>
                      <option value="boys">Boys</option>
                      <option value="girls">Girls</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </label>
                  <label className="grid gap-2 font-semibold">
                    City
                    <select className="input" value={listingForm.city} onChange={updateListing("city")}>
                      <option>Islamabad</option>
                      <option>Lahore</option>
                      <option>Karachi</option>
                      <option>Rawalpindi</option>
                    </select>
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Area
                    <input className="input" value={listingForm.area} onChange={updateListing("area")} required />
                  </label>
                  <label className="grid gap-2 font-semibold md:col-span-2">
                    Address
                    <input className="input" value={listingForm.address} onChange={updateListing("address")} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Minimum rent
                    <input className="input" type="number" min="0" value={listingForm.minPrice} onChange={updateListing("minPrice")} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Maximum rent
                    <input className="input" type="number" min="0" value={listingForm.maxPrice} onChange={updateListing("maxPrice")} required />
                  </label>
                  <label className="grid gap-2 font-semibold md:col-span-2">
                    Amenities
                    <input className="input" value={listingForm.amenities} onChange={updateListing("amenities")} />
                  </label>
                  <label className="grid gap-2 font-semibold md:col-span-2">
                    Description
                    <textarea className="input min-h-28 resize-none" value={listingForm.description} onChange={updateListing("description")} />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-line p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Host Verification Documents</h3>
                    <p className="mt-1 text-sm text-slate-700">Identity and property proof are required before admin review.</p>
                  </div>
                  <span className="badge bg-primary-50 text-primary-800">Pending admin review</span>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {documentFields.map((field) => (
                    <DocumentUploadField
                      key={field.key}
                      field={field}
                      document={listingForm.ownerVerification[field.key]}
                      uploading={uploadingKey === field.key}
                      onFile={(file) => uploadVerificationDocument({ ...field, file })}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-line p-5">
                <h3 className="text-lg font-bold">Host Agreement Signature</h3>
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                  <div className="rounded-lg bg-primary-50 p-5 text-sm leading-6 text-slate-800">
                    <p className="font-bold text-ink">Basera Host Agreement v3</p>
                    <p className="mt-3">
                      I certify that the submitted identity and property documents are authentic, that I am authorized to list this hostel, and that I accept Basera policies for verified listings, student safety, platform payments, refunds, response times, and dispute review.
                    </p>
                    <p className="mt-3">
                      I understand that false documents or policy violations can result in listing rejection, verified badge removal, payout holds, or account suspension.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <label className="grid gap-2 font-semibold">
                      Legal signer name
                      <input className="input" value={listingForm.ownerVerification.agreement.signedBy} onChange={updateAgreement("signedBy")} required />
                    </label>
                    <label className="grid gap-2 font-semibold">
                      Signer CNIC
                      <input className="input" placeholder="35202-1234567-1" value={listingForm.ownerVerification.agreement.signerCnic} onChange={updateAgreement("signerCnic")} required />
                    </label>
                    <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={listingForm.ownerVerification.agreement.accepted} onChange={updateAgreement("accepted")} />
                      <span>I agree and electronically sign this Host agreement.</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm font-semibold">
                      <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-700" checked={listingForm.ownerVerification.agreement.offPlatformPolicyAccepted} onChange={updateAgreement("offPlatformPolicyAccepted")} />
                      <span>I will not collect confirmed booking rent, deposits, or tenant payments outside Basera.</span>
                    </label>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-sm font-semibold ${listingMessage.includes("failed") || listingMessage.includes("Upload") ? "text-[#991B1B]" : "text-accent-700"}`}>{listingMessage}</p>
                <button type="submit" disabled={Boolean(uploadingKey)} className="btn-primary sm:px-10 disabled:cursor-not-allowed disabled:opacity-70">
                  {uploadingKey ? "Uploading document..." : "Submit for Verification"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

function OwnerOperationsTab({
  activeTab,
  dashboard,
  roomsData,
  tenants,
  reports,
  bulkMessage,
  setBulkMessage,
  sendBulkMessage,
  hostName
}) {
  const [roomForm, setRoomForm] = useState({
    hostel: "h1",
    roomNumber: "",
    type: "double",
    totalBeds: 2,
    availableBeds: 1,
    pricePerBed: 18500,
    floor: 1
  });
  const [roomNotice, setRoomNotice] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  useToastBridge(roomNotice);
  useToastBridge(reportMessage);

  const addRoom = async (event) => {
    event.preventDefault();
    setRoomNotice("Saving room...");
    const payload = {
      ...roomForm,
      totalBeds: Number(roomForm.totalBeds),
      availableBeds: Number(roomForm.availableBeds),
      pricePerBed: Number(roomForm.pricePerBed),
      floor: Number(roomForm.floor)
    };
    const result = await safeRequest(() => api.post("/rooms", payload), { demo: true, room: { id: `demo-room-${Date.now()}`, ...payload } });
    setRoomNotice(result.demo ? "Room saved in demo mode." : "Room created.");
    setRoomForm((current) => ({ ...current, roomNumber: "" }));
  };

  const downloadPdfReport = async () => {
    setReportMessage("Preparing PDF report...");
    try {
      await downloadApiPdf({
        api,
        endpoint: "/documents/hosts/monthly-summary",
        filename: "basera-property-monthly-summary.pdf"
      });
      setReportMessage("PDF report downloaded.");
    } catch {
      setReportMessage("PDF report requires the API server and a valid Host login.");
    }
    setTimeout(() => setReportMessage(""), 2500);
  };

  const downloadCsvReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Occupancy Rate", `${reports?.occupancyRate || dashboard.occupancyRate}%`],
      ["Received Payments", reports?.receivedPayments ?? dashboard.payments.filter((item) => item.status === "Paid").length],
      ["Pending Payouts", reports?.pendingPayouts ?? dashboard.payments.filter((item) => item.status !== "Paid").length],
      ["Export Status", reports?.exportReady ? "Ready" : "Demo Ready"]
    ];
    downloadTextFile({
      text: rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"),
      filename: "basera-property-report.csv"
    });
    setReportMessage("CSV report downloaded.");
    setTimeout(() => setReportMessage(""), 2500);
  };

  if (activeTab === "Chat") {
    return <ChatPanel title="Host Messages" defaultHostelId="h1" />;
  }

  if (activeTab === "Maintenance") {
    return <MaintenancePanel title="Property Maintenance Queue" />;
  }

  if (activeTab === "Community") {
    return <HostCommunityPanel title="Property Community Operations" hostName={hostName || "Alex Rivera"} />;
  }

  if (activeTab === "Reviews") {
    return (
      <section className="grid gap-6">
        {[
          ["Ali Ahmed", "The management is very professional. Food quality is consistent and the internet speed is great for online classes.", 5],
          ["Hamza Sheikh", "Rooms are clean and complaints are handled quickly. AC cooling is strong during summer.", 4]
        ].map(([name, text, stars]) => (
          <article key={name} className="panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">{name}</h2>
                <p className="mt-1 text-primary-800">{"* ".repeat(stars).trim()}</p>
              </div>
              <span className="badge bg-accent-50 text-accent-700">Verified stay</span>
            </div>
            <p className="mt-4 leading-7 text-slate-700">{text}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-secondary py-2" type="button">Reply</button>
              <button className="btn-secondary py-2" type="button">Mark Resolved</button>
            </div>
          </article>
        ))}
      </section>
    );
  }

  if (activeTab === "Rooms") {
    const rooms = roomsData.length ? roomsData : dashboard.rooms.map(([number, status]) => ({
      id: number,
      roomNumber: number,
      type: status === "maintenance" ? "maintenance" : "shared",
      availableBeds: status === "available" ? 1 : 0,
      totalBeds: 2,
      pricePerBed: 18500,
      status
    }));

    return (
      <section className="grid gap-7 xl:grid-cols-[1fr_380px]">
        <div className="panel overflow-hidden">
          <div className="p-7">
            <h2 className="text-xl font-bold">Room Management</h2>
            <p className="mt-2 text-sm text-slate-700">Update inventory, pricing, availability, and maintenance status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-primary-50 text-sm uppercase tracking-widest text-slate-700">
                <tr>
                  <th className="px-7 py-4">Room</th>
                  <th className="px-7 py-4">Type</th>
                  <th className="px-7 py-4">Beds</th>
                  <th className="px-7 py-4">Rent</th>
                  <th className="px-7 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rooms.map((room) => (
                  <tr key={room.id || room._id || room.roomNumber}>
                    <td className="px-7 py-5 font-bold">{room.roomNumber}</td>
                    <td className="px-7 py-5 capitalize">{room.type}</td>
                    <td className="px-7 py-5">{room.availableBeds}/{room.totalBeds}</td>
                    <td className="px-7 py-5">PKR {Number(room.pricePerBed || 0).toLocaleString("en-PK")}</td>
                    <td className="px-7 py-5">
                      <span className={`badge ${room.availableBeds > 0 || room.status === "available" ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>
                        {room.status || (room.availableBeds > 0 ? "Available" : "Occupied")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={addRoom} className="panel h-fit p-7">
          <h2 className="text-xl font-bold">Add Room</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 font-semibold">Room number<input className="input" value={roomForm.roomNumber} onChange={(event) => setRoomForm((current) => ({ ...current, roomNumber: event.target.value }))} required /></label>
            <label className="grid gap-2 font-semibold">Type<select className="input" value={roomForm.type} onChange={(event) => setRoomForm((current) => ({ ...current, type: event.target.value }))}><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="dorm">Dorm</option></select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 font-semibold">Total beds<input className="input" type="number" min="1" value={roomForm.totalBeds} onChange={(event) => setRoomForm((current) => ({ ...current, totalBeds: event.target.value }))} /></label>
              <label className="grid gap-2 font-semibold">Available<input className="input" type="number" min="0" value={roomForm.availableBeds} onChange={(event) => setRoomForm((current) => ({ ...current, availableBeds: event.target.value }))} /></label>
            </div>
            <label className="grid gap-2 font-semibold">Monthly rent<input className="input" type="number" min="0" value={roomForm.pricePerBed} onChange={(event) => setRoomForm((current) => ({ ...current, pricePerBed: event.target.value }))} /></label>
            <button className="btn-primary" type="submit"><Plus size={18} /> Add Room</button>
          </div>
        </form>
      </section>
    );
  }

  if (activeTab === "Tenants") {
    const rows = tenants.length ? tenants : [
      { id: "t1", studentName: "Ali Ahmed", university: "NUST", hostelName: "Cozy Boys Hostel", room: "204", stayPeriod: "2026-06-08 (monthly)", amount: "PKR 20,350", status: "confirmed", verifiedStudent: true }
    ];

    return (
      <section className="panel overflow-hidden">
        <div className="p-7">
          <h2 className="text-xl font-bold">Tenant Management</h2>
          <p className="mt-2 text-sm text-slate-700">Track active tenants, room assignments, verification, and stay periods.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-primary-50 text-sm uppercase tracking-widest text-slate-700">
              <tr>
                <th className="px-7 py-4">Student</th>
                <th className="px-7 py-4">Hostel</th>
                <th className="px-7 py-4">Room</th>
                <th className="px-7 py-4">Stay</th>
                <th className="px-7 py-4">Amount</th>
                <th className="px-7 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((tenant) => (
                <tr key={tenant.id || tenant.studentName}>
                  <td className="px-7 py-5">
                    <p className="font-bold">{tenant.studentName}</p>
                    <p className="text-sm text-slate-700">{tenant.university} {tenant.verifiedStudent ? "- verified" : ""}</p>
                  </td>
                  <td className="px-7 py-5">{tenant.hostelName}</td>
                  <td className="px-7 py-5">{tenant.room}</td>
                  <td className="px-7 py-5">{tenant.stayPeriod}</td>
                  <td className="px-7 py-5">{tenant.amount}</td>
                  <td className="px-7 py-5"><span className="badge bg-accent-50 text-accent-700">{tenant.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (activeTab === "Reports") {
    return (
      <section className="grid gap-7 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-7 sm:grid-cols-2">
          <StatTile icon={Building2} label="Occupancy Rate" value={`${reports?.occupancyRate || dashboard.occupancyRate}%`} tone="blue" />
          <StatTile icon={WalletCards} label="Received Payments" value={reports?.receivedPayments ?? dashboard.payments.filter((item) => item.status === "Paid").length} tone="green" />
          <StatTile icon={ReceiptText} label="Pending Payouts" value={reports?.pendingPayouts ?? dashboard.payments.filter((item) => item.status !== "Paid").length} tone="amber" />
          <StatTile icon={FileCheck2} label="Export Status" value={reports?.exportReady ? "Ready" : "Demo Ready"} tone="neutral" />
          <article className="panel p-7 sm:col-span-2">
            <h2 className="text-xl font-bold">Export Reports</h2>
            <p className="mt-3 text-slate-700">{reports?.summary || "Download occupancy, revenue, payment, and tenant summaries for Host accounting."}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-secondary" type="button" onClick={downloadPdfReport}><Download size={18} /> PDF Report</button>
              <button className="btn-secondary" type="button" onClick={downloadCsvReport}><Download size={18} /> Excel Report</button>
            </div>
          </article>
        </div>
        <form onSubmit={sendBulkMessage} className="panel h-fit p-7">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Send size={20} /> Bulk Message Tenants</h2>
          <p className="mt-2 text-sm text-slate-700">Send rent reminders, maintenance updates, or policy notices.</p>
          <textarea className="input mt-5 min-h-36 resize-none" value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} placeholder="Write tenant broadcast..." />
          <button className="btn-primary mt-5 w-full" type="submit">Queue Broadcast</button>
        </form>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="p-7">
        <h2 className="text-xl font-bold">Payment Tracker</h2>
        <p className="mt-2 text-sm text-slate-700">Escrow status, Host payout readiness, and tenant payment history.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="bg-primary-50 text-sm uppercase tracking-widest text-slate-700">
            <tr><th className="px-7 py-4">Tenant</th><th className="px-7 py-4">Room</th><th className="px-7 py-4">Amount</th><th className="px-7 py-4">Status</th><th className="px-7 py-4">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dashboard.payments.map((payment) => (
              <tr key={payment.tenant}>
                <td className="px-7 py-5">{payment.tenant}</td>
                <td className="px-7 py-5">{payment.room}</td>
                <td className="px-7 py-5">{payment.amount}</td>
                <td className="px-7 py-5"><span className={`badge ${payment.status === "Paid" ? "bg-accent-50 text-accent-700" : "bg-[#FDECE7] text-[#9B1C1C]"}`}>{payment.status}</span></td>
                <td className="px-7 py-5">{payment.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DocumentUploadField({ field, document, uploading, onFile }) {
  const uploaded = Boolean(document?.url);

  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">{field.label}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
            {field.required ? "Required" : "Optional"}
          </p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${uploaded ? "bg-accent-50 text-accent-700" : "bg-primary-50 text-primary-800"}`}>
          <FileCheck2 size={20} />
        </span>
      </div>
      <input
        type="file"
        accept="image/*,.pdf,application/pdf"
        onChange={(event) => onFile(event.target.files?.[0])}
        className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary-700 file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      <div className="mt-4 min-h-10 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
        {uploading ? (
          "Uploading..."
        ) : uploaded ? (
          <span className="font-semibold text-accent-700">{document.originalName || "Document uploaded"}</span>
        ) : (
          "No document uploaded"
        )}
      </div>
    </div>
  );
}
