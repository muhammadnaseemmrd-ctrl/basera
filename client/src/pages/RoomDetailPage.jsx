import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, CalendarDays, Clock, MapPin, MessageSquare, ShieldCheck, Video, X, Navigation } from "lucide-react";
import { BedBar } from "../components/BedBar";
import { GenderBadge } from "../components/GenderBadge";
import { MealPlan } from "../components/MealPlan";
import { HostelMap } from "../components/HostelMap";
import { NeighbourhoodIntelligence } from "../components/NeighbourhoodIntelligence";
import { RentSplitCalculator } from "../components/RentSplitCalculator";
import { AvailabilityTimeline } from "../components/AvailabilityTimeline";
import { RoommatesPanel } from "../components/RoommatesPanel";
import { CostOfLivingCard } from "../components/CostOfLivingCard";
import { ParentAssurancePanel } from "../components/ParentAssurancePanel";
import { RentOfferBox, RoomMatchPanel, StudentBudgetPlanner } from "../components/RoomDecisionTools";
import { roomListings } from "../data/mockData";
import { currency } from "../utils/formatters";
import { normalizeRoom } from "../utils/normalize";
import { api, safeRequest } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useDocumentTitle } from "../utils/useDocumentTitle";

export function RoomDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const openSupportChat = () => {
    // Customers are platform-mediated by design -- this routes to Basera Support
    // (StudentChat.jsx's lockToSupport mode), never straight to the room's host.
    if (!user) {
      navigate("/login", { state: { from: "/dashboard/student/chat" } });
      return;
    }
    navigate("/dashboard/student/chat");
  };
  const fallback = useMemo(() => roomListings.find((room) => room.id === id) || roomListings[0], [id]);
  const fallbackAvailability = useMemo(
    () => ({ totalBeds: fallback.totalBeds, availableBeds: fallback.availableBeds, isAvailable: fallback.availableBeds > 0 }),
    [fallback]
  );
  const [roomData, setRoomData] = useState(null);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [occupants, setOccupants] = useState(fallback.occupants || []);
  // See HostelDetailPage for the same fix: a real 404 (or any fetch failure) used
  // to leave this page silently showing a random mockData room forever, as if it
  // were the real listing at this URL. Now it shows an honest "not found" state.
  const [notFound, setNotFound] = useState(false);
  const room = roomData?.id === id || roomData?._id === id ? roomData : fallback;
  const availability = availabilityData?.roomId === id ? availabilityData.value : fallbackAvailability;
  const [message, setMessage] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [match, setMatch] = useState({ score: 82, label: "Good fit", breakdown: { budgetFit: 84, campusFit: 78, preferenceFit: 88, trustScore: 80 } });
  const [forecast, setForecast] = useState(null);
  const [latestOffer, setLatestOffer] = useState(null);
  const [directionsUrl, setDirectionsUrl] = useState("");
  useDocumentTitle(`${room.title} | Basera Rooms`);
  const hostDisplayName = room.lister?.contactGate ? room.lister?.name : `${String(room.lister?.name || "Verified Host").split(" ")[0]} H.`;

  useEffect(() => {
    let ignore = false;
    api.get(`/rooms/${id}`).then((response) => {
      if (ignore) return;
      const result = response.data;
      if (!result?.room) {
        setNotFound(true);
        return;
      }
      setRoomData(normalizeRoom(result.room));
      setAvailabilityData({ roomId: id, value: result.availability || fallbackAvailability });
      setOccupants(result.occupants || []);
    }).catch(() => {
      if (!ignore) setNotFound(true);
    });
    if (user) {
      safeRequest(() => api.get(`/rooms/${id}/match-score`), { match: null }).then((result) => {
        if (!ignore) setMatch(result.match || null);
      });
    }
    safeRequest(() => api.get(`/rooms/${id}/vacancy-forecast`), { forecast: null }).then((result) => {
      if (!ignore) setForecast(result.forecast || null);
    });
    return () => {
      ignore = true;
    };
  }, [fallback, fallbackAvailability, id, user]);

  const joinWaitlist = async () => {
    if (!user) {
      setMessage("Login as a student to join the waitlist.");
      return;
    }
    setMessage("Joining waitlist...");
    const result = await safeRequest(() => api.post(`/rooms/${room.id}/waitlist`), { demo: true, message: "You joined the waitlist in demo mode." });
    setMessage(result.message || "You joined the waitlist.");
  };

  const requestTrial = async () => {
    if (!user) {
      setMessage("Login as a student to request a trial stay.");
      return;
    }
    setMessage("Submitting trial stay request...");
    const result = await safeRequest(() => api.post(`/rooms/${room.id}/trial`, { days: 3 }), { demo: true });
    setMessage(result.demo ? "Trial stay requested in demo mode." : "Trial stay requested.");
  };

  const openDirections = (category = "pharmacy") => {
    const requestDirections = (coords) =>
      safeRequest(
        () => api.get("/map/directions", { params: { roomId: room.id, category, originLat: coords?.lat, originLng: coords?.lng } }),
        { directionsUrl: "https://www.google.com/maps", destinationName: "nearby facility" }
      ).then((result) => {
        setDirectionsUrl(result.directionsUrl || "https://www.google.com/maps");
        setMessage(`Directions ready for ${result.destinationName || "nearby facility"}.`);
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

  if (notFound) {
    return (
      <main className="container-page py-24 text-center">
        <Helmet>
          <title>Room not found | Basera</title>
        </Helmet>
        <h1 className="font-display text-3xl font-bold text-on-surface">Room not found</h1>
        <p className="mt-3 text-on-surface-variant">This listing may have been removed, or the link is incorrect.</p>
        <Link to="/rooms" className="btn-primary mt-6 inline-flex">Browse rooms</Link>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>{room.title} | Basera Rooms</title>
        <meta name="description" content={`Book ${room.roomType} in ${room.area}, ${room.city} with ${availability.availableBeds} beds available.`} />
      </Helmet>
      <main className="container-page pb-28 pt-8 lg:pb-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <GenderBadge value={room.genderPolicy} />
          <MealPlan value={room.mealPlan} cost={room.mealCost} />
          {room.instantBooking && <span className="badge bg-accent-700 text-white"><BadgeCheck size={14} /> Instant booking</span>}
          {room.trialStayAvailable && <span className="badge bg-primary-50 text-primary-800">Trial stay available</span>}
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-5 md:grid-cols-[1fr_300px]">
            <img src={room.photos[0]} alt={room.title} className="h-[430px] w-full rounded-xl border border-line object-cover" />
            <div className="grid gap-5">
              {room.photos.slice(1, 3).map((photo, index) => (
                <div key={photo} className="relative overflow-hidden rounded-xl border border-line">
                  <img src={photo} alt={`${room.title} ${index + 2}`} className="h-full min-h-[200px] w-full object-cover" />
                  {index === 1 && <div className="absolute inset-0 grid place-items-center bg-black/30 font-bold text-white">+ walkthrough</div>}
                </div>
              ))}
            </div>
          </div>

          <aside className="panel h-fit p-6 lg:sticky lg:top-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-700">{room.roomType?.replace("_", " ")} - {room.listingCategory?.replace("_", " ")}</p>
            <h1 className="mt-3 text-3xl font-extrabold">{room.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-slate-700"><MapPin size={18} /> {room.area}, {room.city}</p>
            <div className="my-6 border-t border-line" />
            <div className="flex items-end justify-between">
              <p><span className="text-3xl font-extrabold text-primary-800">{currency(room.pricePerHead)}</span><span className="text-sm text-slate-600"> /head</span></p>
              <p className="text-sm text-slate-700">Deposit {currency(room.securityDeposit)}</p>
            </div>
            <div className="mt-5">
              <BedBar total={availability.totalBeds || room.totalBeds} available={availability.availableBeds ?? room.availableBeds} />
            </div>
            <div className="mt-6 grid gap-3">
              {availability.isAvailable ? (
                <Link to={`/booking?room=${room.id}`} className="btn-primary w-full">Book This Room</Link>
              ) : (
                <button type="button" onClick={joinWaitlist} className="btn-primary w-full">Join Waitlist</button>
              )}
              <button type="button" onClick={requestTrial} disabled={!room.trialStayAvailable} className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60">
                <CalendarDays size={16} /> Request 3-Day Trial
              </button>
              <button type="button" onClick={() => setTourOpen(true)} className="btn-secondary w-full"><Video size={16} /> Virtual Tour</button>
              <button type="button" onClick={openSupportChat} className="btn-secondary w-full"><MessageSquare size={16} /> Message Support</button>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Nearby help</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[["pharmacy", "Pharmacy"], ["hospital", "Hospital"], ["atm", "ATM"], ["grocery", "Grocery"]].map(([category, label]) => (
                  <button key={category} type="button" onClick={() => openDirections(category)} className="btn-secondary py-2 text-sm"><Navigation size={14} /> {label}</button>
                ))}
              </div>
            </div>
            {message && <p className="mt-4 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}
            {directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-800"><Navigation size={16} /> Open directions in Google Maps</a>}
          </aside>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="panel p-6">
              <h2 className="text-xl font-bold">Room Amenities & Rules</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {room.amenities.map((amenity) => <span key={amenity} className="chip">{amenity}</span>)}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-primary-50 p-4"><p className="font-bold">Nearest University</p><p className="mt-1 text-slate-700">{room.nearestUniversity} - {room.distanceToUniversity} min</p></div>
                <div className="rounded-lg bg-primary-50 p-4"><p className="font-bold">Curfew</p><p className="mt-1 text-slate-700">{room.curfewTime || "No curfew"}</p></div>
                <div className="rounded-lg bg-primary-50 p-4"><p className="font-bold">Meal Plan</p><p className="mt-1 text-slate-700">{room.mealPlan?.replace("_", " ")}</p></div>
              </div>
            </section>
            <AvailabilityTimeline room={room} availability={availability} occupants={occupants} />
            <RoommatesPanel occupants={occupants} />
            <RoomMatchPanel match={match} forecast={forecast} room={room} />
            <CostOfLivingCard room={room} />
            <StudentBudgetPlanner rent={room.pricePerHead} utilities={room.utilityEstimate || 2200} />
            <section>
              <h2 className="mb-5 text-xl font-bold">Location</h2>
              <HostelMap hostels={[{ ...room, name: room.title, price: room.pricePerHead, slug: room.id, rating: 4.7, reviews: 16, detailUrl: `/rooms/${room.id}` }]} height="320px" />
            </section>
            <NeighbourhoodIntelligence entity={room} title="Room Area Intelligence" />
            <RentSplitCalculator totalRent={room.pricePerRoom || room.pricePerHead} securityDeposit={room.securityDeposit} />
          </div>
          <aside className="grid h-fit gap-6">
            <RentOfferBox room={room} onCreated={(offer) => {
              setLatestOffer(offer);
              setMessage(`Offer ${offer.status || "pending"} for ${currency(offer.offeredPrice)} created.`);
            }} />
            {latestOffer && (
              <section className="panel p-5">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Latest offer</p>
                <p className="mt-2 text-xl font-extrabold text-primary-800">{currency(latestOffer.offeredPrice)}</p>
                <p className="mt-1 text-sm text-slate-700">{latestOffer.status}</p>
              </section>
            )}
            <section className="panel p-6">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-700 font-bold text-white">{room.lister?.name?.slice(0, 2) || "HH"}</span>
                <div>
                  <h2 className="text-lg font-bold">{hostDisplayName}</h2>
                  <span className="mt-1 inline-flex items-center gap-1 rounded border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-800">
                    <ShieldCheck size={12} /> Verified
                  </span>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-accent-200 bg-accent-50 p-4 text-sm text-accent-700">
                <ShieldCheck className="mb-2" size={20} />
                {room.lister?.verificationTier?.replace("_", " ") || "Verified"} Host badge. Contact details unlock after paid booking confirmation.
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-700"><Clock size={16} /> Typical response time: 30 minutes</p>
              <p className="mt-4 rounded-lg bg-primary-50 p-4 text-sm font-semibold text-primary-800">
                Contact gating active: phone, WhatsApp, and email are revealed only after a paid confirmed booking.
              </p>
            </section>
            <ParentAssurancePanel room={room} />
          </aside>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-4 shadow-soft lg:hidden">
          {availability.isAvailable ? <Link to={`/booking?room=${room.id}`} className="btn-primary w-full">Book Now - {currency(room.pricePerHead)}</Link> : <button type="button" onClick={joinWaitlist} className="btn-primary w-full">Join Waitlist</button>}
        </div>

        {tourOpen && (
          <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/70 p-4">
            <div className="panel w-full max-w-5xl overflow-hidden bg-surface">
              <div className="flex items-center justify-between border-b border-line p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-800">Virtual room tour</p>
                  <h2 className="mt-1 text-xl font-bold">{room.title}</h2>
                </div>
                <button type="button" onClick={() => setTourOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white" aria-label="Close virtual tour">
                  <X size={18} />
                </button>
              </div>
              <div className="bg-slate-950">
                {room.virtualTourUrl ? (
                  <iframe src={room.virtualTourUrl} title={`${room.title} virtual tour`} className="h-[70vh] w-full" allowFullScreen />
                ) : (
                  <div className="relative h-[70vh]">
                    <img src={room.panoramaUrl || room.photos?.[0]} alt={`${room.title} panorama`} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-6 text-white">
                      <p className="text-lg font-bold">360 walkthrough media pending</p>
                      <p className="mt-1 text-sm text-slate-200">The API supports `virtualTourUrl` and `panoramaUrl`; hosts can upload production walkthrough media for this room.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
