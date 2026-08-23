import { useEffect, useState } from "react";
import { BookOpenCheck, CreditCard, Download, MessageSquare, Bookmark, Star, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../../utils/motion";
import { hostels } from "../../data/mockData";
import { useNavigate } from "react-router-dom";
import { api, safeRequest } from "../../services/api";
import { normalizeHostel } from "../../utils/normalize";
import { useToastBridge } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { downloadApiPdf } from "../../utils/downloadFile";

const fallbackStudentData = {
  stats: { activeBookings: 1, savedHostels: 12, totalReviews: 4 },
  activeBooking: { hostel: hostels[0], roomType: "Premium Double", expiryDate: "2026-06-15", status: "Current Stay" },
  recentBookings: []
};

export function StudentOverview() {
  const authUser = useAuthStore((state) => state.user);
  const [data, setData] = useState(fallbackStudentData);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [nearbyMessage, setNearbyMessage] = useState("");
  const hostel = normalizeHostel(data.activeBooking?.hostel || hostels[0]);
  const motionSafe = useMotionSafe();
  const navigate = useNavigate();
  useToastBridge(downloadMessage);
  useToastBridge(nearbyMessage);
  const recentRows = data.recentBookings.length ? data.recentBookings : [
    { id: "demo-1", hostelName: "Cozy Boys Hostel", stayPeriod: "Aug 2026 - Dec 2026", amount: "$1,100", status: "Confirmed" }
  ];

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/student"), fallbackStudentData).then((result) => {
      setData({
        stats: result.stats || fallbackStudentData.stats,
        activeBooking: result.activeBooking || fallbackStudentData.activeBooking,
        recentBookings: result.recentBookings || []
      });
    });
  }, []);

  const openNearby = (category) => {
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
          <motion.article variants={motionSafe ? fadeUp : undefined} className="panel flex flex-col gap-4 bg-primary-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-primary-800">Rent Due Reminder</p>
              <p className="mt-2 text-slate-700">Next monthly rent is due on 01 July 2026. Pay in-app to keep escrow and dispute protection active.</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/student/payments")} className="btn-primary shrink-0">
              <CreditCard size={18} /> Pay Rent Now
            </button>
          </motion.article>

          <motion.div variants={motionSafe ? stagger() : undefined} className="grid min-w-0 gap-7 md:grid-cols-3">
            {[
              ["Active Booking", String(data.stats.activeBookings).padStart(2, "0"), BookOpenCheck, "blue"],
              ["Saved Hostels", String(data.stats.savedHostels).padStart(2, "0"), Bookmark, "green"],
              ["Total Reviews", String(data.stats.totalReviews).padStart(2, "0"), Star, "red"]
            ].map(([label, value, Icon, tone]) => (
              <motion.button
                type="button"
                key={label}
                variants={motionSafe ? fadeUp : undefined}
                transition={motionSafe ? transitions.base : undefined}
                onClick={() => {
                  if (label === "Saved Hostels") navigate("/dashboard/student/saved");
                  if (label === "Active Booking") navigate("/dashboard/student/bookings");
                }}
                className="panel-interactive flex min-w-0 items-center gap-4 p-6 text-left"
              >
                <span className={`grid h-14 w-14 place-items-center rounded-xl ${tone === "green" ? "bg-success-50 text-success-700" : tone === "red" ? "bg-danger-50 text-danger-700" : "bg-primary-50 text-primary-800"}`}>
                  <Icon size={24} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</p>
                  <p className="text-3xl font-extrabold tracking-tight">{value}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>

          <motion.article variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="min-w-0 overflow-hidden rounded-2xl bg-primary-700 p-6 text-white shadow-card sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <span className="rounded-full bg-white/20 px-5 py-2 text-xs font-bold uppercase tracking-widest">{data.activeBooking?.status || "Current Stay"}</span>
                <h2 className="mt-8 break-words text-3xl font-extrabold sm:text-4xl">{hostel.name}</h2>
                <p className="mt-5 flex flex-wrap items-center gap-2 text-lg text-white/90 sm:text-xl">Block A, North Campus, Islamabad</p>
              </div>
              <img src={hostel.image} alt={hostel.name} className="h-36 w-44 rounded-lg border-4 border-white/20 object-cover" />
            </div>
            <div className="mt-12 grid gap-6 border-t border-white/20 pt-8 md:grid-cols-[1fr_1fr_240px] md:items-center">
              <div>
                <p className="text-white/70">Room Type</p>
                <p className="text-2xl font-semibold">{data.activeBooking?.roomType || "Premium Double"}</p>
              </div>
              <div>
                <p className="text-white/70">Expiry Date</p>
                <p className="text-2xl font-semibold">{data.activeBooking?.expiryDate || "June 15, 2026"}</p>
              </div>
              <button className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-primary-800 transition duration-250 ease-smooth hover:-translate-y-0.5 hover:shadow-float">
                <MessageSquare className="mr-3 inline" /> Chat with Host
              </button>
            </div>
          </motion.article>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between p-7">
              <h2 className="text-2xl font-bold">Recent Bookings</h2>
              <button type="button" onClick={() => navigate("/dashboard/student/bookings")} className="font-semibold text-primary-800">View All</button>
            </div>
            <div className="grid gap-4 p-5 md:hidden">
              {recentRows.map((row) => (
                <article key={row.id || row.hostelName} className="rounded-lg border border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold">{row.hostelName || row.hostel || "Hostel"}</p>
                      <p className="mt-1 text-sm text-slate-700">{row.stayPeriod || row.duration || "Monthly"}</p>
                    </div>
                    <span className="badge bg-accent-50 text-accent-700">{row.status || "Confirmed"}</span>
                  </div>
                  <p className="mt-4 font-semibold text-primary-800">{row.amount || `PKR ${row.totalAmount?.toLocaleString?.("en-PK") || "0"}`}</p>
                  <button type="button" className="btn-secondary mt-4 py-2" onClick={() => downloadInvoice(row)}>
                    <Download size={16} /> Download Invoice
                  </button>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-primary-50 text-sm uppercase tracking-widest text-slate-700">
                  <tr>
                    <th className="px-7 py-5">Hostel Name</th>
                    <th className="px-7 py-5">Stay Period</th>
                    <th className="px-7 py-5">Amount</th>
                    <th className="px-7 py-5">Status</th>
                    <th className="px-7 py-5">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentRows.map((row) => (
                    <tr key={row.id || row.hostelName}>
                      <td className="px-7 py-6">{row.hostelName || row.hostel || "Hostel"}</td>
                      <td className="px-7 py-6">{row.stayPeriod || row.duration || "Monthly"}</td>
                      <td className="px-7 py-6">{row.amount || `PKR ${row.totalAmount?.toLocaleString?.("en-PK") || "0"}`}</td>
                      <td className="px-7 py-6"><span className="badge bg-accent-50 text-accent-700">{row.status || "Confirmed"}</span></td>
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
          </section>
        </section>

        <div className="min-w-0 space-y-7">
          <aside className="panel h-fit min-w-0 p-8 text-center">
            <div className="relative mx-auto h-32 w-32 rounded-full border-4 border-primary-800 p-1">
              <img src={authUser?.avatar || user.avatar} alt={authUser?.name || user.name} className="h-full w-full rounded-full object-cover" />
              <span className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full bg-accent-700 text-white"><ShieldMini /></span>
            </div>
            <h2 className="mt-7 text-2xl font-bold">{authUser?.name || user.name}</h2>
            <p className="mt-2 text-lg text-slate-700">Architecture Student</p>
            <div className="mt-10 flex justify-between text-lg">
              <span>Profile Completion</span>
              <span>85%</span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-primary-100"><div className="h-3 w-[85%] rounded-full bg-primary-800" /></div>
            <button type="button" onClick={() => navigate("/dashboard/student/profile")} className="btn-secondary mt-7 w-full">Edit Profile</button>
          </aside>
          <aside className="panel h-fit min-w-0 p-6">
            <p className="text-sm font-bold uppercase tracking-widest text-primary-800">Nearby Help</p>
            <p className="mt-2 text-sm text-slate-700">Get live directions from your hostel to the nearest essentials.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[["pharmacy", "Pharmacy"], ["hospital", "Hospital"], ["atm", "ATM"], ["grocery", "Grocery"]].map(([category, label]) => (
                <button key={category} type="button" onClick={() => openNearby(category)} className="btn-secondary py-2.5 text-sm">
                  <Navigation size={14} /> {label}
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

function ShieldMini() {
  return <span className="text-sm font-bold">OK</span>;
}
