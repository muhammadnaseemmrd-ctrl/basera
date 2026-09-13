import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Bell, Camera, CheckCircle2, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { StudentBudgetPlanner, TrustScoreCard } from "../../components/RoomDecisionTools";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const fallback = {
  profile: {
    name: "Ali Ahmed",
    email: "student@basera.pk",
    phone: "+923001234567",
    city: "Islamabad",
    university: "NUST",
    gender: "male",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    occupantProfile: {
      occupantType: "student",
      fieldOrSubject: "",
      studyLevel: "",
      bio: "",
      visibleToProspectiveRoommates: true
    }
  }
};

const occupantTypeOptions = [
  { value: "student", label: "University student" },
  { value: "teacher", label: "Teacher" },
  { value: "working_professional", label: "Working professional" },
  { value: "freelancer", label: "Freelancer" },
  { value: "other", label: "Other" }
];

const documentFields = [
  { type: "cnic", label: "CNIC / identity proof" },
  { type: "university_id", label: "University ID card" }
];

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export function StudentProfile() {
  useDocumentTitle("Profile | Basera");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [trustScore, setTrustScore] = useState(null);

  const [form, setForm] = useState(fallback.profile);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/student/profile"), fallback).then((result) => {
      const next = result?.profile || fallback.profile;
      setForm({ ...fallback.profile, ...next });
      safeRequest(() => api.get(`/students/${next.id || "u-student"}/trust-score`), { trustScore: null }).then((scoreResult) => {
        setTrustScore(scoreResult.trustScore || null);
      });
    });
  }, []);

  const completion = useMemo(() => {
    const fields = ["name", "email", "phone", "city", "university", "gender"];
    const filled = fields.filter((k) => String(form[k] || "").trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [form]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const result = await safeRequest(() => api.put("/dashboard/student/profile", form), { profile: form, saved: true });
    setForm({ ...fallback.profile, ...(result.profile || form) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const uploadStudentDocument = async ({ type, label, file }) => {
    if (!file) return;
    setUploading(type);
    setVerificationMessage("");

    const formData = new FormData();
    formData.append("document", file);

    try {
      const { data } = await api.post("/uploads/document", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const result = await safeRequest(
        () =>
          api.post("/dashboard/student/verification-documents", {
            type,
            url: data.url,
            originalName: data.originalName || file.name
          }),
        {
          document: {
            type,
            url: data.url,
            originalName: data.originalName || file.name,
            status: "pending",
            uploadedAt: new Date().toISOString()
          },
          demo: true
        }
      );
      setForm((current) => ({
        ...current,
        verificationDocuments: [
          ...(current.verificationDocuments || []).filter((document) => document.type !== type),
          result.document
        ]
      }));
      setVerificationMessage(`${label} uploaded for admin review.`);
    } catch (error) {
      setVerificationMessage(error.response?.data?.message || "Document upload failed. Upload an image or PDF under 8MB.");
    } finally {
      setUploading("");
    }
  };

  const enablePushNotifications = async () => {
    setNotificationMessage("Saving notification preference...");
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      let subscription = {
        endpoint: `demo-push://${form.email || "student"}`,
        keys: { auth: "demo", p256dh: "demo" }
      };

      if (vapidKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotificationMessage("Notifications were not enabled because browser permission was not granted.");
          return;
        }
        const registration = await navigator.serviceWorker.register("/service-worker.js");
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      const response = await safeRequest(() => api.post("/notifications/push/subscribe", { subscription }), { subscribed: true, demo: true });
      setNotificationMessage(response.demo ? "Demo notification preference saved." : "Push notifications enabled for rent and escrow updates.");
    } catch (error) {
      setNotificationMessage(error.message || "Unable to enable notifications on this browser.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Profile | Basera</title>
      </Helmet>

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Profile</h2>
          <p className="mt-2 text-neutral-700">Keep your details up to date for smoother bookings.</p>
        </div>
        <div className="panel flex items-center gap-4 px-5 py-4">
          <div className="h-2 w-32 rounded-full bg-neutral-100">
            <div className="h-2 rounded-full bg-primary-700" style={{ width: `${completion}%` }} />
          </div>
          <span className="text-sm font-semibold text-neutral-700">{completion}% complete</span>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-[420px_1fr]">
        <aside className="panel p-7">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-line bg-neutral-50">
              <img src={form.avatar} alt={form.name} className="h-full w-full object-cover" />
              <button type="button" className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white shadow-card">
                <Camera size={16} className="text-neutral-700" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{form.name}</p>
              <p className="truncate text-sm text-neutral-700">{form.email}</p>
            </div>
          </div>
          <div className="divider my-6" />
          <dl className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-600">City</dt>
              <dd className="font-semibold text-neutral-800">{form.city}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-600">University</dt>
              <dd className="font-semibold text-neutral-800">{form.university}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-600">Gender</dt>
              <dd className="font-semibold text-neutral-800">{form.gender}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-600">Verification</dt>
              <dd className={`font-semibold ${form.isVerified ? "text-accent-700" : "text-primary-800"}`}>
                {form.isVerified ? "Verified" : "Pending"}
              </dd>
            </div>
          </dl>
        </aside>

        <section className="space-y-7">
          <TrustScoreCard trustScore={trustScore} />
          <StudentBudgetPlanner rent={25000} utilities={2200} />
          <form onSubmit={onSubmit} className="panel grid gap-6 p-7 sm:p-10">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="grid gap-2 font-semibold">
                Full name
                <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Phone
                <input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Email
                <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                City
                <input className="input" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                University
                <input className="input" value={form.university} onChange={(e) => setForm((p) => ({ ...p, university: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Student ID
                <input className="input" value={form.studentId || ""} onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Gender
                <select className="input" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-neutral-600">
                {saved ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-accent-700">
                    <CheckCircle2 size={16} /> Saved
                  </span>
                ) : (
                  "Changes update your dashboard profile."
                )}
              </div>
              <button className="btn-primary sm:px-10" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>

          <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
            <div className="flex flex-col gap-3 border-b border-outline-variant bg-surface-container-low p-6 sm:flex-row sm:items-start sm:justify-between sm:p-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Documents</p>
                <h3 className="mt-1 flex items-center gap-2 font-display text-xl font-bold text-on-surface"><ShieldCheck size={22} /> Student Verification</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Upload identity and university proof to unlock verified-stay reviews and faster approvals.</p>
              </div>
              <span className={`inline-flex h-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${form.isVerified ? "bg-tertiary-container/20 text-tertiary" : "bg-primary-container/15 text-primary-600"}`}>
                {form.isVerified ? "Verified student" : "Review pending"}
              </span>
            </div>

            <div className="grid gap-4 p-7 sm:p-10 md:grid-cols-2">
              {documentFields.map((field) => {
                const uploaded = (form.verificationDocuments || []).find((document) => document.type === field.type);
                return (
                  <div key={field.type} className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-on-surface">{field.label}</p>
                        <p className="mt-1 text-sm text-on-surface-variant">{uploaded ? uploaded.originalName || "Document uploaded" : "Image or PDF, max 8MB"}</p>
                      </div>
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded ${uploaded ? "bg-tertiary-container text-on-tertiary-container" : "bg-primary-container text-on-primary-container"}`}>
                        <FileCheck2 size={20} />
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      onChange={(event) => uploadStudentDocument({ ...field, file: event.target.files?.[0] })}
                      className="block w-full text-sm text-on-surface-variant file:mr-4 file:rounded file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                    />
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      {uploaded ? <ShieldCheck size={13} className="text-tertiary" /> : null}
                      {uploading === field.type ? "Uploading..." : uploaded?.status || "Required"}
                    </p>
                  </div>
                );
              })}
            </div>
            {verificationMessage && <p className="mx-7 mb-7 rounded-md bg-primary-container/15 px-4 py-3 text-sm font-semibold text-primary-600 sm:mx-10">{verificationMessage}</p>}
          </section>

          <form onSubmit={onSubmit} className="panel p-7 sm:p-10">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Users size={22} /> Roommate Visibility</h3>
            <p className="mt-2 text-sm text-neutral-700">
              If you're in a shared room, students browsing before they book can see this category-level info to judge fit
              (e.g. "1 teacher, Mathematics"). Your name, email, and phone are never shown -- those stay private until a paid
              booking is confirmed, same as everywhere else on Basera.
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <label className="grid gap-2 font-semibold">
                I am a...
                <select
                  className="input"
                  value={form.occupantProfile?.occupantType || "student"}
                  onChange={(e) => setForm((p) => ({ ...p, occupantProfile: { ...p.occupantProfile, occupantType: e.target.value } }))}
                >
                  {occupantTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 font-semibold">
                Field / subject (optional)
                <input
                  className="input"
                  placeholder="e.g. Computer Science, Mathematics"
                  value={form.occupantProfile?.fieldOrSubject || ""}
                  onChange={(e) => setForm((p) => ({ ...p, occupantProfile: { ...p.occupantProfile, fieldOrSubject: e.target.value } }))}
                />
              </label>
              {form.occupantProfile?.occupantType === "student" && (
                <label className="grid gap-2 font-semibold">
                  Study level (optional)
                  <input
                    className="input"
                    placeholder="e.g. Undergraduate, Postgraduate"
                    value={form.occupantProfile?.studyLevel || ""}
                    onChange={(e) => setForm((p) => ({ ...p, occupantProfile: { ...p.occupantProfile, studyLevel: e.target.value } }))}
                  />
                </label>
              )}
              <label className="grid gap-2 font-semibold md:col-span-2">
                Short bio for prospective roommates (optional)
                <textarea
                  className="input min-h-[80px]"
                  maxLength={280}
                  placeholder="e.g. Quiet, early sleeper, can help with calculus."
                  value={form.occupantProfile?.bio || ""}
                  onChange={(e) => setForm((p) => ({ ...p, occupantProfile: { ...p.occupantProfile, bio: e.target.value } }))}
                />
              </label>
            </div>
            <label className="mt-5 flex items-center gap-3 font-semibold text-neutral-800">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary-700"
                checked={form.occupantProfile?.visibleToProspectiveRoommates !== false}
                onChange={(e) => setForm((p) => ({ ...p, occupantProfile: { ...p.occupantProfile, visibleToProspectiveRoommates: e.target.checked } }))}
              />
              Show this info to students browsing my room before they book
            </label>
            <div className="mt-6 flex justify-end">
              <button className="btn-primary sm:px-10" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save roommate visibility"}
              </button>
            </div>
          </form>

          <section className="panel p-7 sm:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold"><Bell size={22} /> Notification Preferences</h3>
                <p className="mt-2 text-sm text-neutral-700">Enable rent reminders, payment receipts, deposit updates, and dispute notices.</p>
              </div>
              <button type="button" className="btn-primary" onClick={enablePushNotifications}>Enable Alerts</button>
            </div>
            {notificationMessage && <p className="mt-5 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{notificationMessage}</p>}
          </section>
        </section>
      </div>
    </>
  );
}
