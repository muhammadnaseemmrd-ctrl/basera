import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, CheckCircle2, Info, Lock, ShieldCheck, Tag } from "lucide-react";
import { hostels, roomListings } from "../data/mockData";
import { currency } from "../utils/formatters";
import { motion } from "framer-motion";
import { fadeUp, stagger, transitions, useMotionSafe } from "../utils/motion";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { normalizeHostel, normalizeRoom } from "../utils/normalize";
import { DepthCard } from "../components/DepthCard";

const stepLabels = ["Confirm Room", "Your Details", "Payment", "Confirmation"];
const paymentMethods = [
  { value: "jazzcash", label: "JazzCash", icon: "account_balance_wallet", hint: "Pay securely via JazzCash mobile wallet.", needsMobile: true },
  { value: "easypaisa", label: "EasyPaisa", icon: "account_balance_wallet", hint: "Pay securely via EasyPaisa mobile wallet.", needsMobile: true },
  { value: "stripe", label: "Card", icon: "credit_card", hint: "Secure checkout with OTP confirmation.", needsMobile: false },
  { value: "cash", label: "Cash on Arrival", icon: "payments", hint: "Book a visit before payment.", needsMobile: false }
];
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
  const [mobileNo, setMobileNo] = useState("");
  const [depositProtectionOptIn, setDepositProtectionOptIn] = useState(false);
  const [guestFullName, setGuestFullName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCnic, setGuestCnic] = useState("");
  const [guestAffiliation, setGuestAffiliation] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
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
  // This is the checkout flow -- if the real room/hostel fetch fails (removed
  // listing, bad link, transient error), the page must never silently fall back to
  // mockData's fake hostel/pricing and let someone proceed to payment against a
  // listing that doesn't actually exist. notFound blocks checkout instead.
  const [notFound, setNotFound] = useState(false);
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
  const showSidebar = step === 1 || step === 3;

  useEffect(() => {
    if (user?.name && !guestFullName) setGuestFullName(user.name);
    if (user?.phone && !guestPhone) setGuestPhone(user.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    let ignore = false;

    const request = roomId ? () => api.get(`/rooms/${roomId}`) : () => api.get(`/hostels/${fallbackHostel.slug}`);

    request().then((response) => {
      if (ignore) return;
      const data = response.data;
      if (roomId) {
        if (!data?.room) {
          setNotFound(true);
          return;
        }
        const room = normalizeRoom(data.room);
        setBookingData({ hostel: fallbackHostel, rooms: [room], room });
        setAvailability(data.availability || { isAvailable: room.availableBeds > 0, availableBeds: room.availableBeds });
      } else {
        if (!data?.hostel) {
          setNotFound(true);
          return;
        }
        setBookingData({
          hostel: normalizeHostel(data.hostel),
          rooms: data.rooms || []
        });
      }
    }).catch(() => {
      if (!ignore) setNotFound(true);
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
        mobileNo,
        totalAmount: rent,
        serviceFee,
        discountAmount,
        discountCode: couponCode,
        securityDeposit,
        depositProtectionOptIn,
        guestFullName,
        guestPhone,
        guestCnic,
        guestAffiliation,
        emergencyContactName,
        emergencyContactPhone
      });
      setBookingResult(data);
      setStep(4);
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
    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!guestFullName.trim() || !guestPhone.trim() || !guestCnic.trim()) {
        setError("Please fill in your full name, phone number, and CNIC before continuing.");
        return;
      }
      setError("");
      setStep(3);
      return;
    }
    if (step === 3) createBooking();
  };

  if (notFound) {
    return (
      <main className="container-page py-24 text-center">
        <Helmet>
          <title>Listing not found | Basera</title>
        </Helmet>
        <h1 className="font-display text-3xl font-bold text-on-surface">This listing isn't available</h1>
        <p className="mt-3 text-on-surface-variant">It may have been removed, or the link is incorrect. You haven't been charged anything.</p>
        <Link to="/hostels" className="btn-primary mt-6 inline-flex">Browse hostels</Link>
      </main>
    );
  }

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
        <div className="relative mx-auto mb-12 flex max-w-2xl items-center justify-between">
          <div className="absolute left-0 right-0 top-4 h-0.5 -translate-y-1/2 bg-line" />
          <div
            className="absolute left-0 top-4 h-0.5 -translate-y-1/2 bg-primary-700 transition-all duration-300"
            style={{ width: `${((step - 1) / (stepLabels.length - 1)) * 100}%` }}
          />
          {stepLabels.map((label, index) => {
            const idx = index + 1;
            const status = step > idx ? "done" : step === idx ? "active" : "upcoming";
            return <StepMarker key={label} index={idx} label={label} status={status} />;
          })}
        </div>

        <motion.div
          variants={motionSafe ? fadeUp : undefined}
          transition={motionSafe ? transitions.base : undefined}
          className={showSidebar ? "grid gap-8 xl:grid-cols-[1fr_400px]" : "mx-auto max-w-3xl"}
        >
          <section className="panel p-7 sm:p-10">
            {step === 1 && (
              <div>
                <h1 className="font-display text-4xl font-extrabold">Confirm your booking</h1>
                <p className="mt-2 text-slate-700">Review your selection and set your move-in details before proceeding.</p>

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
                        type="button"
                        onClick={() => setBeds(value)}
                        className={`grid min-h-[104px] place-items-center rounded-lg border p-5 text-center font-bold transition-colors ${
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
                          className={`rounded-lg border p-4 text-left font-semibold transition-colors ${bookingType === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}
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
                        <button key={value} type="button" onClick={() => setInstalmentPlan(value)} className={`rounded-lg border p-4 text-left font-semibold transition-colors ${instalmentPlan === value ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}>
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
                        <button key={index} type="button" onClick={() => setBedIndex(index)} className={`rounded-lg border px-5 py-3 font-bold transition-colors ${bedIndex === index ? "border-primary-700 bg-primary-50 text-primary-800" : "border-line bg-white"}`}>
                          Bed {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {availability && (
                  <p className={`mt-8 rounded-lg border px-4 py-3 text-sm font-semibold ${availability.isAvailable ? "border-primary-200 bg-primary-50 text-primary-800" : "border-danger-100 bg-danger-50 text-danger-700"}`}>
                    {availability.isAvailable ? `${availability.availableBeds} bed(s) available for the selected date.` : "This room is not available for the selected date."}
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="font-display text-4xl font-extrabold">Your Details</h1>
                <p className="mt-2 text-slate-700">Please provide accurate information for host verification.</p>

                <div className="mt-8 flex items-center gap-5 border-b border-line pb-8">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-line bg-surface2">
                    <span className="material-symbols-outlined text-4xl text-slate-500">person</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink">Identity Verification</h3>
                    <p className="mt-1 text-sm text-slate-600">A CNIC photo match happens during move-in check-in, not at booking time.</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  <label className="grid gap-2 font-semibold md:col-span-2">
                    Full Name (as per CNIC)
                    <input className="input" placeholder="e.g. Ahmed Khan" value={guestFullName} onChange={(event) => setGuestFullName(event.target.value)} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    Phone Number
                    <input className="input" type="tel" placeholder="0300 1234567" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} required />
                  </label>
                  <label className="grid gap-2 font-semibold">
                    CNIC Number
                    <input className="input" placeholder="xxxxx-xxxxxxx-x" value={guestCnic} onChange={(event) => setGuestCnic(event.target.value)} required />
                  </label>
                  <label className="grid gap-2 font-semibold md:col-span-2">
                    University / Employer Name
                    <input className="input" placeholder="e.g. NUST University" value={guestAffiliation} onChange={(event) => setGuestAffiliation(event.target.value)} />
                  </label>
                </div>

                <div className="mt-8 border-t border-line pt-8">
                  <h3 className="mb-4 font-bold text-ink">Emergency Contact</h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="grid gap-2 font-semibold">
                      Contact Name
                      <input className="input" placeholder="Name" value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
                    </label>
                    <label className="grid gap-2 font-semibold">
                      Contact Phone
                      <input className="input" type="tel" placeholder="0300 1234567" value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
                    </label>
                  </div>
                </div>

                <label className="mt-8 grid gap-2 border-t border-line pt-8 font-semibold">
                  Special Requirements (Optional)
                  <textarea value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} className="input min-h-[100px] resize-y" placeholder="Any dietary needs, accessibility requirements, or specific room preferences..." />
                </label>

                <div className="mt-8 flex items-start gap-3 rounded-lg bg-secondary-50 p-4">
                  <Lock size={18} className="mt-0.5 shrink-0 text-secondary-700" />
                  <p className="text-sm text-secondary-700">
                    <strong>Privacy note:</strong> Your CNIC and phone number stay private on Basera. They are only shared with the host after your booking payment is confirmed -- never before.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="font-display text-4xl font-extrabold">Select Payment Method</h1>
                <p className="mt-2 text-slate-700">Choose how you'd like to pay for your booking.</p>

                <div className="mt-8 grid gap-3">
                  {paymentMethods.map((method) => {
                    const active = paymentMethod === method.value;
                    return (
                      <label
                        key={method.value}
                        className={`cursor-pointer rounded-lg border p-4 transition-colors ${active ? "border-primary-700 bg-primary-50" : "border-line bg-white hover:bg-surface2"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method.value}
                              checked={active}
                              onChange={() => setPaymentMethod(method.value)}
                              className="h-5 w-5 accent-primary-700"
                            />
                            <span className="font-bold text-ink">{method.label}</span>
                          </div>
                          <span className="material-symbols-outlined text-primary-700">{method.icon}</span>
                        </div>
                        {active && method.needsMobile && (
                          <div className="mt-4 pl-9">
                            <label className="grid gap-2 text-sm font-semibold text-slate-700">
                              Mobile Number
                              <input
                                className="input bg-white"
                                placeholder="03XX XXXXXXX"
                                value={mobileNo}
                                onChange={(event) => setMobileNo(event.target.value)}
                              />
                            </label>
                          </div>
                        )}
                        <p className="mt-2 pl-9 text-sm text-slate-600">{method.hint}</p>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-2 rounded-lg border border-line bg-surface2 p-3">
                  <Lock size={18} className="shrink-0 text-primary-700" />
                  <span className="text-sm text-slate-700">Secured by Basera Escrow. Your funds are safe until you move in.</span>
                </div>

                <label className="mt-6 flex items-start gap-3 text-sm text-slate-700">
                  <input type="checkbox" defaultChecked className="mt-1 h-5 w-5 accent-primary-700" />
                  I agree to Basera's escrow policy, refundable deposit rules, and booking terms.
                </label>

                <div className="mt-8 overflow-hidden rounded-lg border border-line">
                  <div className="bg-primary-50 px-5 py-4 font-bold text-primary-800">Instalment Schedule Preview</div>
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

            {step === 4 && (
              <div className="flex flex-col items-center text-center">
                <div className="grid h-24 w-24 place-items-center rounded-full bg-success-50">
                  <CheckCircle2 size={56} className="text-success-600" />
                </div>
                <h1 className="mt-6 font-display text-4xl font-extrabold">Booking Confirmed</h1>
                <p className="mt-3 text-slate-700">Your request has been sent to the property owner.</p>

                <div className="mt-8 w-full rounded-lg border border-line bg-surface2 p-6 text-left">
                  <div className="mb-4 flex items-start justify-between border-b border-line pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Reference Number</p>
                      <p className="mt-1 text-xl font-extrabold text-ink">{bookingResult?.booking?.id || bookingResult?.booking?._id || "#HH-2026"}</p>
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Property</p>
                      <p className="mt-1 font-semibold text-ink">{displayName}</p>
                      <p className="text-sm text-slate-600">{hostel.name !== displayName ? hostel.name : "Premium room"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Move-in Date</p>
                      <p className="mt-1 font-semibold text-ink">{checkIn}</p>
                    </div>
                  </div>
                </div>

                {bookingResult?.booking?.hostContact && (
                  <div className="mt-6 w-full rounded-lg bg-primary-50 p-5 text-left text-primary-800">
                    <p className="font-bold">Host Contact Released</p>
                    <p className="mt-2">{bookingResult.booking.hostContact.name}</p>
                    <p>{bookingResult.booking.hostContact.phone}</p>
                  </div>
                )}

                <div className="mt-10 w-full text-left">
                  <h3 className="mb-6 font-bold text-ink">Next Steps</h3>
                  <div className="grid gap-6">
                    <NextStep index={1} title="Host Contact" description="The host will review your request and contact you within 24 hours." active />
                    <NextStep index={2} title="Schedule Visit" description="Arrange a physical or virtual tour with the host before move-in." />
                    <NextStep index={3} title="Confirm Move-in" description="Finalize paperwork and secure your spot on move-in day." />
                  </div>
                </div>

                <div className="mt-10 flex w-full flex-col justify-center gap-4 sm:flex-row">
                  <Link to="/dashboard/student/bookings" className="btn-primary w-full sm:w-auto">View My Booking</Link>
                  <Link to="/hostels" className="btn-secondary w-full sm:w-auto">Browse More</Link>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={downloadReceipt} className="btn-ghost">Download Receipt PDF</button>
                  <button type="button" onClick={() => downloadDocument("confirmation")} className="btn-ghost">Download Confirmation Letter</button>
                </div>
              </div>
            )}
          </section>

          {showSidebar && (
            <DepthCard as="aside" outerClassName="h-fit xl:sticky xl:top-28" className="panel h-fit overflow-hidden" maxRotate={3}>
              <div className="relative h-64">
                <img src={displayImage} alt={displayName} className="h-full w-full object-cover" />
                <span className="badge absolute right-5 top-5 gap-1 bg-white text-primary-700 shadow-card">
                  <ShieldCheck size={14} /> <span className="text-[11px] font-bold uppercase tracking-wider">Verified</span>
                </span>
              </div>
              <div className="p-7">
                <h2 className="text-2xl font-extrabold">{displayName}</h2>
                <p className="mt-2 flex items-center gap-2 text-slate-700">District 4, {displayCity}</p>
                <div className="my-7 border-t border-line" />
                <PriceRow label="Monthly Rent" value={currency(rent)} />
                <PriceRow label="Security Deposit" value={currency(securityDeposit)} />
                <PriceRow label="Service Fee" value={currency(serviceFee)} />
                <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-line bg-surface2 p-4">
                  <div>
                    <p className="text-sm font-bold text-ink">Deposit Protection</p>
                    <p className="mt-1 text-xs text-slate-600">Pilot feature -- not yet backed by a licensed insurer.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap text-sm font-semibold text-ink">
                      +{currency(depositProtectionOptIn ? depositProtectionFee : Math.min(DEPOSIT_PROTECTION_FEE_CAP_PKR, Math.round(securityDeposit * DEPOSIT_PROTECTION_FEE_RATE)))}
                    </span>
                    <ToggleSwitch checked={depositProtectionOptIn} onChange={(event) => setDepositProtectionOptIn(event.target.checked)} />
                  </div>
                </div>
                {discounts.map((discount) => (
                  <PriceRow key={discount.id || discount._id || discount.name} label={<span className="flex items-center gap-2 text-accent-700"><Tag size={16} /> {discount.name}</span>} value={`-${currency(discount.amountOff || 0)}`} green />
                ))}
                <div className="my-5 grid gap-3 rounded-lg bg-primary-50 p-4">
                  <p className="text-sm font-bold text-primary-800">Discount Code</p>
                  {loyaltyOffer && (
                    <button
                      type="button"
                      onClick={() => setCouponCode(loyaltyOffer.couponCode)}
                      className="flex flex-col rounded-lg border border-accent-600 bg-accent-50 px-4 py-3 text-left text-sm font-semibold text-accent-700"
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
                </div>
                <div className="mt-7 flex gap-4 rounded-lg border border-line bg-surface2 p-5 text-slate-700">
                  <Info size={20} className="mt-0.5 shrink-0 text-primary-700" />
                  <p className="text-sm">Rent is held in Basera escrow. Host payout releases after move-in + 48 hours if no dispute is raised.</p>
                </div>
              </div>
            </DepthCard>
          )}
        </motion.div>

        {step < 4 && (
          <div className="mt-8 rounded-lg border border-line bg-primary-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => (step === 1 ? history.back() : setStep(step - 1))} className="flex items-center gap-3 font-bold text-primary-800">
                <ArrowLeft size={22} /> {step === 1 ? "Back to Listing" : "Back"}
              </button>
              {error && <p className="text-sm font-semibold text-danger-700">{error}</p>}
              <button onClick={next} disabled={submitting} className="btn-primary px-9 disabled:cursor-not-allowed disabled:opacity-70">
                {submitting ? "Creating Booking..." : step === 1 ? "Continue to Details" : step === 2 ? "Continue to Payment" : "Pay Now"}
                {step === 3 ? <Lock size={18} /> : <ArrowRight size={20} />}
              </button>
            </div>
          </div>
        )}
      </motion.main>
    </>
  );
}

function StepMarker({ index, label, status }) {
  const isDone = status === "done";
  const isActive = status === "active";
  const isCurrent = isDone || isActive;
  return (
    <div className="flex flex-col items-center gap-2 bg-canvas px-2">
      <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${isCurrent ? "bg-primary-700 text-white" : "border-2 border-line bg-white text-slate-500"}`}>
        {isDone ? <span className="material-symbols-outlined text-[16px]">check</span> : index}
      </span>
      <span className={`text-center text-xs font-semibold ${isCurrent ? "text-primary-700" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <div className="peer h-6 w-11 rounded-full bg-line transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-700 peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  );
}

function NextStep({ index, title, description, active = false }) {
  return (
    <div className="flex items-start gap-4">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${active ? "bg-primary-700 text-white" : "border border-line bg-surface2 text-slate-600"}`}>{index}</span>
      <div>
        <h4 className="font-semibold text-ink">{title}</h4>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </div>
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
