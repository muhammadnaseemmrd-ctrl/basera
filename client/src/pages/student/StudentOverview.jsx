import { useEffect, useState } from "react";
import { AlertTriangle, BookOpenCheck, CreditCard, Download, MessageSquare, Bookmark, Star, Navigation, Search, ShieldCheck, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../../utils/motion";
import { useNavigate } from "react-router-dom";
import { api, safeRequest } from "../../services/api";
import { normalizeHostel } from "../../utils/normalize";
import { formatDate } from "../../utils/formatters";
import { useToastBridge } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { downloadApiPdf } from "../../utils/downloadFile";

// Was previously seeded with a fake "Current Stay" (mock hostel, "Premium Double",
// a hardcoded expiry date) and non-zero stats. Because the fetch below used
// `result.activeBooking || fallbackStudentData.activeBooking`, a real student who
// genuinely has no active booking yet (i.e. `activeBooking: null` from the real
// API) would still see that fabricated stay -- `null` is falsy, so it silently
// fell back to the fake one instead of showing an honest empty state. Every
// brand-new real student would have hit this. Fixed by using real zero/null
// defaults and rendering an explicit empty state when there's no active booking.
const emptyStudentData = {
  stats: { activeBookings: 0, savedHostels: 0, totalReviews: 0 },
  activeBooking: null,
  recentBookings: []
};

export function StudentOverview() {
  const authUser = useAuthStore((state) => state.user);
  const [data, setData] = useState(emptyStudentData);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [nearbyMessage, setNearbyMessage] = useState("");
  const hostel = data.activeBooking?.hostel ? normalizeHostel(data.activeBooking.hostel) : null;
  const motionSafe = useMotionSafe();
  const navigate = useNavigate();
  useToastBridge(downloadMessage);
  useToastBridge(nearbyMessage);
  // Only ever render real bookings fetched from the API — a new student with no
  // bookings yet should see an empty state, never leftover demo data.
  const recentRows = data.recentBookings;

  useEffect(() => {
    api.get("/dashboard/student").then((response) => {
      const result = response.data;
      setData({
        stats: result.stats || emptyStudentData.stats,
        activeBooking: result.activeBooking || null,
        recentBookings: result.recentBookings || []
      });
    }).catch(() => {
      // Leave data at the honest empty default rather than showing fabricated
      // content on a failed request.
    });
  }, []);

  const openNearby = (category) => {
    if (!hostel) return;
    const requestDirections = (coords) =>
      safeRequest(
        () => api.get("/map/directions", { params: { hostelId: hostel.id, category, originLat: coords?.lat, originLng: coords?.lng } }),
        { directionsUrl: "https://www.google.com/maps", destinationName: "nearby facility" }
      ).then((result) => {
        window.open(result.directionsUrl || "https://www.google.com/maps", "_blank", "noreferrer");
        setNearbyMessage(`Directions ready for the nearest ${category}.`);
        setTimeout(() => setNearbyMessage(""), 2600);
      });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => requestDirections({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => requestDirections(null)
      );
    } else {
      requestDirections(null);
    }
  };

  const downloadInvoice = async (row) => {
    const bookingId = row.id || row._id || "b1";
    setDownloadMessage(`Preparing invoice for ${bookingId}...`);
    try {
      await downloadApiPdf({
        api,
        endpoint: `/documents/bookings/${bookingId}/receipt`,
        filename: `basera-receipt-${bookingId}.pdf`
      });
      setDownloadMessage("Invoice downloaded.");
    } catch {
      setDownloadMessage("Invoice download requires the API server and a valid login.");
    }
    setTimeout(() => setDownloadMessage(""), 2500);
  };

  return (
    <>
      <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-7">
          {data.activeBooking && (
            <motion.article variants={motionSafe ? fadeUp : undefined} className="flex flex-col gap-4 rounded-lg border border-error/20 bg-error-container p-5 text-on-error-container sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="mt-0.5 shrink-0 text-error" />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-widest">Rent Due Reminder</p>
                  <p className="mt-2">
                    {data.activeBooking.expiryDate
                      ? `Next payment is due on ${formatDate(data.activeBooking.expiryDate)}. Pay in-app to keep escrow and dispute protection active.`
                      : "Pay in-app to keep escrow and dispute protection active."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/student/payments")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-error px-5 py-3 text-sm font-semibold text-on-error transition hover:opacity-90"
              >
                <CreditCard size={18} /> Pay Rent Now
              </button>
            </motion.article>
          )}

          <motion.div variants={motionSafe ? stagger() : undefined} className="grid min-w-0 gap-7 md:grid-cols-3">
            {[
              ["Active Booking", String(data.stats.activeBookings).padStart(2, "0"), BookOpenCheck, "bg-primary-container text-on-primary-container"],
              ["Saved Hostels", String(data.stats.savedHostels).padStart(2, "0"), Bookmark, "bg-secondary-container text-on-secondary-container"],
              ["Total Reviews", String(data.stats.totalReviews).padStart(2, "0"), Star, "bg-tertiary-container text-on-tertiary-container"]
            ].map(([label, value, Icon, iconClass]) => (
              <motion.button
                type="button"
                key={label}
                variants={motionSafe ? fadeUp : undefined}
                transition={motionSafe ? transitions.base : undefined}
                onClick={() => {
                  if (label === "Saved Hostels") navigate("/dashboard/student/saved");
                  if (label === "Active Booking") navigate("/dashboard/student/bookings");
                }}
                className="flex min-w-0 items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-6 text-left shadow-sm transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${iconClass}`}>
                  <Icon size={24} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                  <p className="font-display text-3xl font-extrabold tracking-tight text-on-surface">{value}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>

          <motion.article variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="relative min-w-0 overflow-hidden rounded-lg border border-accent-200 bg-accent-50 p-6 sm:p-8">
            {hostel ? (
              <>
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent-700">
                      <ShieldCheck size={16} /> {data.activeBooking?.status || "Current Stay"}
                    </span>
                    <h2 className="mt-4 break-words font-display text-3xl font-extrabold text-on-surface sm:text-4xl">{hostel.name}</h2>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-lg text-on-surface-variant">{hostel.area ? `${hostel.area}, ${hostel.city}` : hostel.city}</p>
                  </div>
                  <img src={hostel.image} alt={hostel.name} className="h-36 w-44 rounded-lg border-4 border-white object-cover shadow-sm" />
                </div>
                <div className="mt-10 grid gap-6 border-t border-accent-200 pt-8 md:grid-cols-[1fr_1fr_240px] md:items-center">
                  <div>
                    <p className="text-sm text-on-surface-variant">Room Type</p>
                    <p className="text-2xl font-semibold text-on-surface">{data.activeBooking?.roomType || "Room"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-on-surface-variant">Expiry Date</p>
                    <p className="text-2xl font-semibold text-on-surface">{formatDate(data.activeBooking?.expiryDate) || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/student/chat")}
                    className="inline-flex items-center justify-center gap-2 rounded bg-accent-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition duration-250 ease-smooth hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md"
                  >
                    {/* Routes to Basera Support, not a direct host conversation -- customers are
                        platform-mediated by design (see StudentChat.jsx's lockToSupport mode). */}
                    <MessageSquare size={20} /> Message Support
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-100 text-accent-700">
                  <Search size={24} />
                </span>
                <p className="text-lg font-semibold text-on-surface">You don't have an active booking yet.</p>
                <button type="button" onClick={() => navigate("/rooms")} className="btn-primary">
                  Find a Hostel
                </button>
              </div>
            )}
          </motion.article>

          <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low p-6">
              <h2 className="font-display text-xl font-bold text-on-surface">Recent Bookings</h2>
              <button type="button" onClick={() => navigate("/dashboard/student/bookings")} className="text-sm font-semibold text-primary-600">View All</button>
            </div>
            {recentRows.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-7 py-14 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-container text-on-primary-container">
                  <Search size={24} />
                </span>
                <p className="text-lg font-semibold text-on-surface">You have no bookings yet.</p>
                <button type="button" onClick={() => navigate("/rooms")} className="btn-primary">
                  Find a Hostel
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 p-5 md:hidden">
                  {recentRows.map((row) => (
                    <article key={row.id || row.hostelName} className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-on-surface">{row.hostelName || row.hostel || "Hostel"}</p>
                          <p className="mt-1 text-sm text-on-surface-variant">{row.stayPeriod || row.duration || "Monthly"}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-tertiary-container/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-tertiary">{row.status || "Confirmed"}</span>
                      </div>
                      <p className="mt-4 font-semibold text-primary-600">{row.amount || `PKR ${row.totalAmount?.toLocaleString?.("en-PK") || "0"}`}</p>
                      <button type="button" className="btn-secondary mt-4 py-2" onClick={() => downloadInvoice(row)}>
                        <Download size={16} /> Download Invoice
                      </button>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-surface-container-low text-xs uppercase tracking-widest text-on-surface-variant">
                      <tr>
                        <th className="whitespace-nowrap px-7 py-5 font-semibold">Hostel Name</th>
                        <th className="whitespace-nowrap px-7 py-5 font-semibold">Stay Period</th>
                        <th className="whitespace-nowrap px-7 py-5 font-semibold">Amount</th>
                        <th className="whitespace-nowrap px-7 py-5 font-semibold">Status</th>
                        <th className="whitespace-nowrap px-7 py-5 font-semibold">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {recentRows.map((row) => (
                        <tr key={row.id || row.hostelName} className="text-on-surface transition-colors hover:bg-surface-container-low/60">
                          <td className="px-7 py-6">{row.hostelName || row.hostel || "Hostel"}</td>
                          <td className="px-7 py-6 text-on-surface-variant">{row.stayPeriod || row.duration || "Monthly"}</td>
                          <td className="px-7 py-6">{row.amount || `PKR ${row.totalAmount?.toLocaleString?.("en-PK") || "0"}`}</td>
                          <td className="px-7 py-6"><span className="inline-flex items-center rounded-full bg-tertiary-container/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-tertiary">{row.status || "Confirmed"}</span></td>
                          <td className="px-7 py-6">
                            <button type="button" className="btn-ghost" onClick={() => downloadInvoice(row)} aria-label="Download invoice">
                              <Download size={20} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </section>

        <div className="min-w-0 space-y-7">
          <aside className="relative h-fit min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-8 text-center shadow-sm">
            <button
              type="button"
              onClick={() => navigate("/dashboard/student/profile")}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary-600"
              aria-label="Edit profile"
            >
              <Pencil size={16} />
            </button>
            <div className="relative mx-auto h-24 w-24 rounded-full border-4 border-surface-container-lowest shadow-sm">
              <img src={authUser?.avatar || user.avatar} alt={authUser?.name || user.name} className="h-full w-full rounded-full object-cover" />
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface-container-lowest bg-accent-600 text-white">
                <ShieldCheck size={16} />
              </span>
            </div>
            <h2 className="mt-5 font-display text-xl font-bold text-on-surface">{authUser?.name || user.name}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {authUser?.occupantProfile?.fieldOrSubject
                ? `${authUser.occupantProfile.fieldOrSubject} Student`
                : "Student"}
            </p>
            <div className="mt-6 h-2.5 w-full rounded-full bg-surface-container-high">
              <div className="h-2.5 rounded-full bg-primary-600" style={{ width: "85%" }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <span>Profile Completion</span>
              <span className="text-primary-600">85%</span>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/student/profile")} className="btn-secondary mt-6 w-full">Edit Profile</button>
          </aside>
          <aside className="h-fit min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-on-surface"><Navigation size={16} className="text-tertiary" /> Nearby Services</p>
            <p className="mt-2 text-sm text-on-surface-variant">Get live directions from your hostel to the nearest essentials.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[["pharmacy", "Pharmacy"], ["hospital", "Hospital"], ["atm", "ATM"], ["grocery", "Grocery"]].map(([category, label]) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => openNearby(category)}
                  className="flex flex-col items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-center text-sm font-semibold text-on-surface transition-colors hover:bg-secondary-container"
                >
                  <Navigation size={16} className="text-tertiary" /> {label}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </motion.div>
    </>
  );
}

const user = {
  name: "Ali Ahmed",
  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80"
};
