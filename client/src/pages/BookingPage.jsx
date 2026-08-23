import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, CheckCircle2, CreditCard, Info, ShieldCheck, Tag } from "lucide-react";
import { hostels, roomListings } from "../data/mockData";
import { currency } from "../utils/formatters";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { normalizeHostel, normalizeRoom } from "../utils/normalize";
import { DepthCard } from "../components/DepthCard";

const steps = ["Details", "Payment", "Confirmation"];
const methods = ["JazzCash", "Easypaisa", "Card", "Cash on Arrival"];
const bookingTypes = [
  ["MONTHLY", "Monthly Rental"],
  ["SEMESTER", "Semester Booking"],
  ["ANNUAL", "Annual Booking"],
  ["ADVANCE_RESERVE", "Advance Seat Reserve"],
  ["TRIAL", "Trial Stay"]
];
const instalmentPlans = [
  ["FULL", "Full upfront"],
  ["TWO_PART", "2-part split"],
  ["SEMESTER_4X", "Semester 4x"],
  ["TOKEN_BALANCE", "Token + balance"]
];
// Mirrors the server defaults (DEPOSIT_PROTECTION_FEE_RATE / DEPOSIT_PROTECTION_FEE_CAP_PKR
// in server/.env.example) for a client-side preview only -- the server always
// recomputes and is the source of truth for the actual fee charged.
const DEPOSIT_PROTECTION_FEE_RATE = 0.03;
const DEPOSIT_PROTECTION_FEE_CAP_PKR = 2000;

export function BookingPage() {
  const [step, setStep] = useState(1);
  const [beds, setBeds] = useState(1);
  const [duration, setDuration] = useState("monthly");
  const [bookingType, setBookingType] = useState("MONTHLY");
  const [instalmentPlan, setInstalmentPlan] = useState("FULL");
  const [bedIndex, setBedIndex] = useState(0);
  const [checkIn, setCheckIn] = useState("2026-06-08");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("jazzcash");
  const [depositProtectionOptIn, setDepositProtectionOptIn] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [discounts, setDiscounts] = useState([]);
  const [loyaltyOffer, setLoyaltyOffer] = useState(null);
  const [discountMessage, setDiscountMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const hostelSlug = searchParams.get("hostel");
  const roomId = searchParams.get("room");
  const fallbackHostel = hostels.find((item) => item.slug === hostelSlug) || hostels[0];
  const fallbackRoom = roomListings.find((item) => item.id === roomId) || null;
  const [bookingData, setBookingData] = useState({ hostel: fallbackHostel, rooms: fallbackRoom ? [fallbackRoom] : [], room: fallbackRoom });
  const hostel = bookingData.hostel;
  const selectedRoom = useMemo(
    () => bookingData.room || bookingData.rooms.find((room) => room.type === "double" || room.roomType === "DOUBLE") || bookingData.rooms[0] || null,
    [bookingData.room, bookingData.rooms]
  );
  const motionSafe = useMotionSafe();
  const displayName = selectedRoom?.title || hostel.name;
  const displayImage = selectedRoom?.image || selectedRoom?.photos?.[0] || hostel.image;
  const displayCity = selectedRoom?.city || hostel.city;
  const rent = beds * (selectedRoom?.pricePerHead || selectedRoom?.pricePerBed || hostel.price);
  const securityDeposit = selectedRoom?.securityDeposit || 5000;
  const serviceFee = 400;
  const depositProtectionFee = depositProtectionOptIn ? Math.min(DEPOSIT_PROTECTION_FEE_CAP_PKR, Math.round(securityDeposit * DEPOSIT_PROTECTION_FEE_RATE)) : 0;
  const autoDiscount = discounts.reduce((sum, discount) => sum + Number(discount.amountOff || 0), 0);
  const discountAmount = Math.min(rent, autoDiscount);
  const total = Math.max(0, rent + securityDeposit + serviceFee + depositProtectionFee - discountAmount);
  const previewInstalments = useMemo(() => buildInstalmentPreview(total, instalmentPlan, bookingType), [bookingType, instalmentPlan, total]);

  useEffect(() => {
    let ignore = false;

    const request = roomId ? () => api.get(`/rooms/${roomId}`) : () => api.get(`/hostels/${fallbackHostel.slug}`);
    const fallback = roomId ? { room: fallbackRoom, availability: null } : { hostel: fallbackHostel, rooms: [] };

    safeRequest(request, fallback).then((data) => {
      if (!ignore) {
        if (roomId) {
          const room = normalizeRoom(data.room || fallbackRoom);
          setBookingData({ hostel: fallbackHostel, rooms: [room], room });
          setAvailability(data.availability || { isAvailable: room.availableBeds > 0, availableBeds: room.availableBeds });
        } else {
          setBookingData({
            hostel: normalizeHostel(data.hostel || fallbackHostel),
            rooms: data.rooms || []
          });
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [fallbackHostel, fallbackRoom, roomId]);

  useEffect(() => {
    if (!selectedRoom?.id && !selectedRoom?._id) return;
    const roomId = selectedRoom._id || selectedRoom.id;
    safeRequest(
      () => api.get(`/rooms/${roomId}/availability`, { params: { from: checkIn, to: checkIn } }),
      { isAvailable: true, availableBeds: selectedRoom.availableBeds || 1 }
    ).then(setAvailability);
  }, [checkIn, selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;
    safeRequest(
      () =>
        api.get("/discounts/applicable", {
          params: {
            amount: rent,
            city: selectedRoom.city || hostel.city,
            roomType: selectedRoom.roomType
          }
        }),
      { results: [] }
    ).then((result) => setDiscounts(result.results || []));
  }, [hostel.city, rent, selectedRoom]);

  useEffect(() => {
    if (!user) return;
    safeRequest(() => api.get("/engagement/loyalty"), { claims: [] }).then((result) => {
      const approved = (result.claims || []).find((claim) => claim.status === "approved" && claim.couponCode);
      setLoyaltyOffer(approved || null);
    });
  }, [user]);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setDiscountMessage("Checking discount code...");
    const result = await safeRequest(
      () =>
        api.post("/discounts/validate", {
          couponCode,
          amount: rent,
          city: selectedRoom?.city || hostel.city,
          roomType: selectedRoom?.roomType
        }),
      { valid: false, message: "Discount code is not valid for this booking." }
    );
    if (result.valid) {
      setDiscounts((current) => [...current.filter((discount) => discount.couponCode !== result.discount.couponCode), { ...result.discount, amountOff: result.amountOff }]);
      setDiscountMessage(`${result.discount.name} applied.`);
    } else {
      setDiscountMessage(result.message || "Discount code is not valid.");
    }
  };

  const createBooking = async () => {
    if (!user) {
      navigate("/login", { state: { from: roomId ? `/booking?room=${roomId}` : `/booking?hostel=${hostel.slug}` } });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/bookings", {
        hostel: roomId ? undefined : hostel.id,
        room: selectedRoom?._id || selectedRoom?.id || "r2",
        checkIn,
        duration,
        bookingType,
        instalmentPlan,
        bedIndex,
        moveInDate: checkIn,
        beds,
        specialRequests,
        paymentMethod,
        totalAmount: rent,
        serviceFee,
        discountAmount,
        discountCode: couponCode,
        securityDeposit,
        depositProtectionOptIn
      });
      setBookingResult(data);
      setStep(3);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Booking could not be created. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = async () => {
    downloadDocument("receipt");
  };

  const downloadDocument = async (type) => {
    const bookingId = bookingResult?.booking?._id || bookingResult?.booking?.id;
    if (!bookingId) return;
    try {
      const endpoint = type === "confirmation" ? `/documents/bookings/${bookingId}/confirmation` : `/bookings/${bookingId}/receipt`;
      const response = await api.get(endpoint, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `basera-${type}-${bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Document could not be downloaded. Please try again from your bookings page.");
    }
  };

  const next = () => {
    if (step === 1) setStep(2);
    if (step === 2) createBooking();
  };

  return (
    <>
      <Helmet>
        <title>Booking Details | Basera</title>
      </Helmet>

      <motion.main
        className="container-page py-12"
        initial={motionSafe ? "hidden" : false}
        animate={motionSafe ? "show" : undefined}
        variants={motionSafe ? stagger() : undefined}
      >
        <div className="mx-auto mb-12 max-w-5xl">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4">
            {steps.map((label, index) => (
              <StepMarker key={label} index={index + 1} label={label} active={step >= index + 1} showLine={index < steps.length - 1} />
            ))}
          </div>
        </div>

        <motion.div variants={motionSafe ? fadeUp : undefined} transition={motionSafe ? transitions.base : undefined} className="grid gap-8 xl:grid-cols-[1fr_480px]">
          <section className="panel p-7 sm:p-10">
            {step === 1 && (
              <div>
                <h1 className="text-4xl font-extrabold">Booking Details</h1>
                <div className="mt-10 grid gap-7 md:grid-cols-2">
                  <label className="grid gap-3 font-semibold">
                    Move-in Date
                    <div className="relative">
                      <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="input pr-12" />
                      <CalendarDays className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    </div>
                  </label>
                  <label className="grid gap-3 font-semibold">
                    Stay Duration
                    <select value={duration} onChange={(event) => setDuration(event.target.value)} className="input">
                      <option value="monthly">Monthly (flexible)</option>
                      <option value="semester">Semester (6 months)</option>
                      <option value="weekly">Weekly short stay</option>
                    </select>
                  </label>
                </div>

                <div className="mt-8">
                  <p className="mb-4 font-semibold">Number of Beds</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2].map((value) => (
                      <button
                        key={value}
                        onClick={() => setBeds(value)}
                        className={`grid min-h-[104px] place-items-center rounded-lg border p-5 text-center font-bold ${
                          beds === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"
                        }`}
                      >
                        <BedDouble size={28} />
                        <span>{value} {value === 1 ? "Bed" : "Beds"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-4 font-semibold">Booking Type</p>
                    <div className="grid gap-3">
                      {bookingTypes.map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setBookingType(value);
                            setDuration(value === "SEMESTER" ? "semester" : value === "ANNUAL" ? "annual" : value === "TRIAL" ? "trial" : "monthly");
                            setInstalmentPlan(value === "SEMESTER" ? "SEMESTER_4X" : value === "ADVANCE_RESERVE" ? "TOKEN_BALANCE" : "FULL");
                          }}
                          className={`rounded-lg border p-4 text-left font-semibold ${bookingType === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-4 font-semibold">Instalment Plan</p>
                    <div className="grid gap-3">
                      {instalmentPlans.map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setInstalmentPlan(value)} className={`rounded-lg border p-4 text-left font-semibold ${instalmentPlan === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {availability?.availableBedIndices?.length ? (
                  <div className="mt-8">
                    <p className="mb-4 font-semibold">Choose Bed</p>
                    <div className="flex flex-wrap gap-3">
                      {availability.availableBedIndices.map((index) => (
                        <button key={index} type="button" onClick={() => setBedIndex(index)} className={`rounded-lg border px-5 py-3 font-bold ${bedIndex === index ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}>
                          Bed {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="mt-8 grid gap-3 font-semibold">
                  Special Requests
                  <textarea value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} className="input min-h-40 resize-none" placeholder="Any specific requirements (e.g., quiet floor, high floor, accessibility needs)..." />
                </label>
                {availability && (
                  <p className={`mt-5 rounded-md px-4 py-3 text-sm font-semibold ${availability.isAvailable ? "bg-accent-50 text-accent-700" : "bg-[#FEE2E2] text-[#9B1C1C]"}`}>
                    {availability.isAvailable ? `${availability.availableBeds} bed(s) available for the selected date.` : "This room is not available for the selected date."}
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="text-4xl font-extrabold">Payment Method</h1>
                <p className="mt-3 text-slate-700">Select the payment option you want to use for the booking deposit.</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {methods.map((method) => {
                    const value = method === "Card" ? "stripe" : method === "Cash on Arrival" ? "cash" : method.toLowerCase();
                    return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`rounded-lg border p-5 text-left ${paymentMethod === value ? "border-primary-700 bg-primary-50" : "border-line bg-white"}`}
                    >
                      <CreditCard className="mb-5 text-primary-800" />
                      <p className="font-bold">{method}</p>
                      <p className="mt-2 text-sm text-slate-700">{method === "Cash on Arrival" ? "Book a visit before payment." : "Secure checkout with OTP confirmation."}</p>
                    </button>
                  )})}
                </div>
                <label className="mt-8 flex items-start gap-3 text-sm text-slate-700">
                  <input type="checkbox" defaultChecked className="mt-1 h-5 w-5 accent-primary-700" />
                  I agree to Basera's escrow policy, refundable deposit rules, and booking terms.
                </label>

                <div className="mt-6 rounded-lg border border-line bg-canvas p-5">
                  <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={depositProtectionOptIn}
                      onChange={(event) => setDepositProtectionOptIn(event.target.checked)}
                      className="mt-1 h-5 w-5 accent-primary-700"
                    />
                    <span>
                      Add Deposit Protection for {currency(depositProtectionOptIn ? depositProtectionFee : Math.min(DEPOSIT_PROTECTION_FEE_CAP_PKR, Math.round(securityDeposit * DEPOSIT_PROTECTION_FEE_RATE)))}
                    </span>
                  </label>
                  <p className="mt-2 pl-8 text-xs text-slate-600">
                    Platform-backed protection for your security deposit, currently in pilot on Basera -- it is <strong>not yet underwritten by a licensed insurance partner</strong>.
                    If you opt in, you can file a claim from your booking after move-out and Basera will review it as a case; this is not a guaranteed payout.
                  </p>
                </div>

                <div className="mt-8 overflow-hidden rounded-lg border border-line">
                  <div className="bg-primary-50 px-5 py-4 font-bold">Instalment Schedule Preview</div>
                  <div className="divide-y divide-line">
                    {previewInstalments.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex items-center justify-between px-5 py-4">
                        <span>{item.label}</span>
                        <strong>{currency(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid min-h-[440px] place-items-center text-center">
                <div>
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-50 text-accent-700">
                    <CheckCircle2 size={44} />
                  </span>
                  <h1 className="mt-7 text-4xl font-extrabold">Booking Confirmed</h1>
                  <p className="mt-4 text-slate-700">
                    Booking ID: {bookingResult?.booking?.id || bookingResult?.booking?._id || "#HH-2026"}.
                    Confirmation has been queued for email and SMS delivery.
                  </p>
                  {bookingResult?.booking?.hostContact && (
                    <div className="mx-auto mt-7 max-w-md rounded-lg bg-accent-50 p-5 text-left text-accent-700">
                      <p className="font-bold">Host Contact Released</p>
                      <p className="mt-2">{bookingResult.booking.hostContact.name}</p>
                      <p>{bookingResult.booking.hostContact.phone}</p>
                    </div>
                  )}
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={downloadReceipt} className="btn-secondary">Download Receipt PDF</button>
                    <button type="button" onClick={() => downloadDocument("confirmation")} className="btn-secondary">Download Confirmation Letter</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <DepthCard as="aside" outerClassName="h-fit xl:sticky xl:top-28" className="panel h-fit overflow-hidden" maxRotate={3}>
            <div className="relative h-64">
              <img src={displayImage} alt={displayName} className="h-full w-full object-cover" />
              <span className="badge absolute right-5 top-5 bg-accent-50 text-accent-700"><ShieldCheck size={14} /> Verified</span>
            </div>
            <div className="p-7">
              <h2 className="text-2xl font-extrabold">{displayName}</h2>
              <p className="mt-2 flex items-center gap-2 text-slate-700">District 4, {displayCity}</p>
              <div className="my-7 border-t border-line" />
              <PriceRow label="Monthly Rent" value={currency(rent)} />
              <PriceRow label="Security Deposit" value={currency(securityDeposit)} />
              <PriceRow label="Service Fee" value={currency(serviceFee)} />
              {depositProtectionOptIn && <PriceRow label="Deposit Protection (pilot)" value={currency(depositProtectionFee)} />}
              {discounts.map((discount) => (
                <PriceRow key={discount.id || discount._id || discount.name} label={<span className="flex items-center gap-2 text-accent-700"><Tag size={16} /> {discount.name}</span>} value={`-${currency(discount.amountOff || 0)}`} green />
              ))}
              <div className="my-5 grid gap-3 rounded-lg bg-primary-50 p-4">
                <p className="text-sm font-bold text-primary-800">Discount Code</p>
                {loyaltyOffer && (
                  <button
                    type="button"
                    onClick={() => setCouponCode(loyaltyOffer.couponCode)}
                    className="flex flex-col rounded-lg border border-accent-700 bg-accent-50 px-4 py-3 text-left text-sm font-semibold text-accent-700"
                  >
                    <span>Use loyalty discount</span>
                    <span className="mt-1 text-lg font-extrabold">{loyaltyOffer.couponCode} - {loyaltyOffer.approvedDiscountPercent}% off</span>
                  </button>
                )}
                <div className="flex gap-2">
                  <input className="input bg-white" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="HH-2026" />
                  <button type="button" onClick={validateCoupon} className="btn-secondary shrink-0">Apply</button>
                </div>
                {discountMessage && <p className="text-sm font-semibold text-primary-800">{discountMessage}</p>}
              </div>
              <div className="my-7 border-t border-line" />
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-700">Total Due Today</p>
                  <p className="mt-2 text-3xl font-extrabold text-primary-800">{currency(total)}</p>
                </div>
                <p className="text-sm font-semibold text-[#C81E1E]">Escrow protected</p>
              </div>
              <div className="mt-7 flex gap-4 rounded-lg bg-primary-50 p-5 text-slate-700">
                <Info className="text-primary-800" />
                <p>Rent is held in Basera escrow. Host payout releases after move-in + 48 hours if no dispute is raised.</p>
              </div>
            </div>
          </DepthCard>
        </motion.div>

        <div className="mt-8 rounded-lg bg-primary-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={() => (step === 1 ? history.back() : setStep(step - 1))} className="flex items-center gap-3 font-bold text-primary-800">
              <ArrowLeft size={22} /> {step === 1 ? "Back to Listing" : "Back"}
            </button>
            {error && <p className="text-sm font-semibold text-[#991B1B]">{error}</p>}
            {step < 3 && (
              <button onClick={next} disabled={submitting} className="btn-primary px-9 disabled:cursor-not-allowed disabled:opacity-70">
                {submitting ? "Creating Booking..." : step === 1 ? "Continue to Payment" : "Confirm Booking"} <ArrowRight size={20} />
              </button>
            )}
          </div>
        </div>
      </motion.main>
    </>
  );
}

function StepMarker({ index, label, active, showLine }) {
  const motionSafe = useMotionSafe();
  return (
    <>
      <div className="grid justify-items-center gap-3">
        <motion.span
          className={`grid h-12 w-12 place-items-center rounded-full text-lg font-bold shadow-card ${active ? "bg-primary-800 text-white" : "bg-[#DDE5F7] text-slate-700"}`}
          whileHover={motionSafe ? { rotateX: -14, rotateY: 14, scale: 1.05 } : undefined}
          animate={motionSafe && active ? { y: [0, -3, 0], rotateX: [0, -6, 0] } : undefined}
          transition={motionSafe ? { duration: 1.8, repeat: active ? Infinity : 0, ease: "easeInOut" } : undefined}
          style={{ transformStyle: "preserve-3d" }}
        >
          {index}
        </motion.span>
        <p className={`text-sm font-semibold ${active ? "text-primary-800" : "text-slate-700"}`}>Step {index} {label}</p>
      </div>
      {showLine && <div className="h-[2px] bg-line" />}
    </>
  );
}

function PriceRow({ label, value, green = false }) {
  return (
    <div className="mb-4 flex justify-between gap-5 text-lg">
      <span className="text-slate-700">{label}</span>
      <strong className={green ? "text-accent-700" : "text-ink"}>{value}</strong>
    </div>
  );
}

function buildInstalmentPreview(total, plan, bookingType) {
  if (plan === "TOKEN_BALANCE" || bookingType === "ADVANCE_RESERVE") {
    const token = Math.max(5000, Math.round(total * 0.1));
    return [
      { label: "Reservation token", amount: token },
      { label: "Balance on move-in", amount: total - token }
    ];
  }
  if (plan === "TWO_PART") {
    const first = Math.ceil(total / 2);
    return [
      { label: "Due today", amount: first },
      { label: "Due on 15th", amount: total - first }
    ];
  }
  if (plan === "SEMESTER_4X") {
    const part = Math.ceil(total / 4);
    return [1, 2, 3, 4].map((index) => ({ label: `Instalment ${index}`, amount: index === 4 ? total - part * 3 : part }));
  }
  return [{ label: "Due today", amount: total }];
}
