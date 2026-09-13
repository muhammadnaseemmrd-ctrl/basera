import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, ClipboardCheck, Download, MapPinned, Star, X, ArrowRightLeft, LogOut, ReceiptText } from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { StatusPill, ConfirmButton, useToastBridge, DataTable } from "../../components/ui";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { DisputeModal } from "../../components/DisputeModal";

const LIFECYCLE_LABELS = {
  none: "",
  switch_requested: "Switch requested",
  switch_approved: "Switch approved",
  leave_requested: "Leave requested",
  leave_approved: "Leave approved"
};

const LIFECYCLE_TONE = {
  switch_requested: "amber",
  leave_requested: "amber",
  switch_approved: "green",
  leave_approved: "green"
};

const FACILITY_OPTIONS = [["pharmacy", "Pharmacy"], ["hospital", "Hospital"], ["atm", "ATM"], ["grocery", "Grocery"]];

const fallback = {
  bookings: [
    { id: "b1", hostelId: "h1", hostelName: "Cozy Boys Hostel F-10", stayPeriod: "Aug 2026 - Dec 2026", amount: "PKR 23,500", status: "Confirmed" },
    { id: "b2", hostelId: "h2", hostelName: "Sunshine Student Home", stayPeriod: "Aug 2025 - Nov 2025", amount: "PKR 19,800", status: "Completed" }
  ]
};

export function StudentBookings() {
  useDocumentTitle("My Bookings | Basera");
  const [data, setData] = useState(fallback);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "", mediaType: "", mediaUrl: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [disputeBooking, setDisputeBooking] = useState(null);
  const [reportMessage, setReportMessage] = useState("");
  const [cancelPreview, setCancelPreview] = useState(null);
  const [directionInfo, setDirectionInfo] = useState(null);
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [lifecycleModal, setLifecycleModal] = useState(null);
  useToastBridge(invoiceMessage);
  useToastBridge(lifecycleMessage);
  useToastBridge(reportMessage);
  useToastBridge(reviewMessage);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/student/bookings"), fallback).then(setData);
  }, []);

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewBooking) return;
    setReviewMessage("Submitting review...");
    const result = await safeRequest(
      () =>
        api.post("/reviews", {
          hostel: reviewBooking.hostelId || "h1",
          rating: Number(reviewForm.rating),
          comment: reviewForm.comment,
          mediaType: reviewForm.mediaUrl ? reviewForm.mediaType || "video" : undefined,
          mediaUrl: reviewForm.mediaUrl || undefined
        }),
      { demo: true }
    );
    setReviewMessage(result.demo ? "Review saved in demo mode." : "Review submitted as a verified stay.");
    setReviewForm({ rating: 5, comment: "", mediaType: "", mediaUrl: "" });
    setTimeout(() => {
      setReviewBooking(null);
      setReviewMessage("");
    }, 1200);
  };

  const downloadReceipt = async (row) => {
    setInvoiceMessage(`Preparing receipt for ${row.id}...`);
    try {
      const response = await api.get(`/bookings/${row.id}/receipt`, { responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `basera-${row.id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      setInvoiceMessage("Receipt downloaded.");
    } catch {
      setInvoiceMessage("Receipt download needs the API server and a valid login token.");
    }
    setTimeout(() => setInvoiceMessage(""), 2400);
  };

  const downloadChecklist = async (row) => {
    setInvoiceMessage(`Preparing move-in checklist for ${row.id}...`);
    try {
      const response = await api.get(`/bookings/${row.id || row._id}/checklist/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `basera-${row.id || row._id}-checklist.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      setInvoiceMessage("Move-in checklist downloaded.");
    } catch {
      setInvoiceMessage("Checklist download needs the API server and a valid login token.");
    }
    setTimeout(() => setInvoiceMessage(""), 2400);
  };

  const reportOffPlatform = async (row) => {
    setReportMessage(`Reporting off-platform request for ${row.hostelName}...`);
    const result = await safeRequest(
      () =>
        api.post(`/bookings/${row.id || row._id}/report-off-platform`, {
          description: "Host requested direct payment outside Basera."
        }),
      { demo: true, studentCredit: 500 }
    );
    setReportMessage(
      result.demo
        ? `Report recorded in demo mode. Student protection credit: PKR ${Number(result.studentCredit || 0).toLocaleString("en-PK")}.`
        : "Report submitted. Escrow release is blocked while the team reviews it."
    );
    setTimeout(() => setReportMessage(""), 3600);
  };

  const previewCancellation = async (row) => {
    setInvoiceMessage(`Calculating refund for ${row.id}...`);
    const result = await safeRequest(() => api.get(`/bookings/${row.id || row._id}/cancellation-preview`), {
      bookingId: row.id,
      preview: { refundAmount: 0, nonRefundableAmount: 0, policyLabel: "Preview is available when the API server is running." },
      demo: true
    });
    setCancelPreview({ booking: row, preview: result.preview, demo: result.demo });
    setInvoiceMessage("");
  };

  const openDirections = (row, category = "pharmacy") => {
    setDirectionInfo({ booking: row, loading: true });
    const requestDirections = (coords) =>
      safeRequest(
        () => api.get(`/bookings/${row.id || row._id}/directions`, { params: { category, originLat: coords?.lat, originLng: coords?.lng } }),
        { directionsUrl: "https://www.google.com/maps", destinationName: "nearby facility" }
      ).then((result) => setDirectionInfo({ booking: row, loading: false, ...result }));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => requestDirections({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => requestDirections(null)
      );
    } else {
      requestDirections(null);
    }
  };

  const openLifecycleModal = async (row, type) => {
    if (type === "leave") {
      const result = await safeRequest(() => api.get(`/bookings/${row.id || row._id}/leave-preview`), {
        preview: { proratedRentRefund: 0, securityDeposit: 0, estimatedTotalRefund: 0, policyLabel: "Preview is available when the API server is running." }
      });
      setLifecycleModal({ booking: row, type, reason: "", moveOutDate: "", targetRoom: "", preview: result.preview });
    } else {
      setLifecycleModal({ booking: row, type, reason: "", moveOutDate: "", targetRoom: "", preview: null });
    }
  };

  const submitLifecycleModal = async () => {
    if (!lifecycleModal) return;
    const { booking, type, reason, moveOutDate, targetRoom } = lifecycleModal;
    const endpoint = type === "switch" ? `/bookings/${booking.id || booking._id}/switch` : `/bookings/${booking.id || booking._id}/leave`;
    const payload = type === "switch"
      ? { reason: reason || "Student requested a room switch", targetRoom }
      : { reason: reason || "Student requested to leave the hostel", moveOutDate: moveOutDate || undefined };
    const result = await safeRequest(() => api.post(endpoint, payload), { demo: true });
    setLifecycleModal(null);
    setLifecycleMessage(result.demo ? `${type === "switch" ? "Switch" : "Leave"} request queued in demo mode.` : `${type === "switch" ? "Switch" : "Leave"} request sent to your Host for approval.`);
    setData((current) => ({
      ...current,
      bookings: current.bookings.map((row) => (
        (row.id || row._id) === (booking.id || booking._id)
          ? { ...row, lifecycleStatus: type === "switch" ? "switch_requested" : "leave_requested" }
          : row
      ))
    }));
    setTimeout(() => setLifecycleMessage(""), 2600);
  };

  const loadMonthlyCommission = async (row) => {
    const result = await safeRequest(() => api.post(`/bookings/${row.id || row._id}/commission`, {}), { commission: 0 });
    setLifecycleMessage(`Monthly platform fee for this booking: PKR ${Number(result.commission || 0).toLocaleString("en-PK")}`);
    setTimeout(() => setLifecycleMessage(""), 2800);
  };

  const cancelBooking = async () => {
    if (!cancelPreview?.booking) return;
    setInvoiceMessage(`Cancelling ${cancelPreview.booking.id}...`);
    const result = await safeRequest(
      () => api.put(`/bookings/${cancelPreview.booking.id || cancelPreview.booking._id}/cancel`, { cancelReason: "Cancelled from student dashboard" }),
      { status: "cancelled", refundPreview: cancelPreview.preview, demo: true }
    );
    setData((current) => ({
      ...current,
      bookings: current.bookings.map((booking) => (
        (booking.id || booking._id) === (cancelPreview.booking.id || cancelPreview.booking._id)
          ? { ...booking, status: "cancelled", refundPreview: result.refundPreview }
          : booking
      ))
    }));
    setCancelPreview(null);
    setInvoiceMessage(result.demo ? "Booking cancelled in demo mode." : "Booking cancelled. Refund processing is queued.");
    setTimeout(() => setInvoiceMessage(""), 2800);
  };

  return (
    <>
      <Helmet>
        <title>My Bookings | Basera</title>
      </Helmet>
      <div className="mb-7">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">My Bookings</h2>
        <p className="mt-2 text-on-surface-variant">Manage your hostel reservations, payments, and stay details.</p>
      </div>

      <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low p-6">
          <h3 className="font-display text-xl font-bold text-on-surface">All bookings</h3>
          <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant">{data.bookings.length} total</span>
        </div>
        <div className="px-6 pb-6 pt-5">
          <DataTable
            rows={data.bookings}
            rowKey={(row) => row.id}
            pageSize={8}
            empty="You have no bookings yet."
            columns={[
              { key: "id", header: "Booking ID", sortable: true, render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
              { key: "hostelName", header: "Hostel", sortable: true },
              { key: "stayPeriod", header: "Stay Period", sortable: true },
              { key: "amount", header: "Amount", sortable: true, sortValue: (row) => Number(String(row.amount).replace(/[^0-9.]/g, "")) || 0 },
              { key: "status", header: "Status", sortable: true, render: (row) => (
                <div className="flex flex-col items-start gap-1.5">
                  <StatusPill status={row.status} />
                  {LIFECYCLE_LABELS[row.lifecycleStatus] ? <StatusPill tone={LIFECYCLE_TONE[row.lifecycleStatus]}>{LIFECYCLE_LABELS[row.lifecycleStatus]}</StatusPill> : null}
                </div>
              ) },
              { key: "invoice", header: "Invoice", render: (row) => <button className="btn-ghost py-1.5" type="button" onClick={() => downloadReceipt(row)} aria-label="Download invoice"><Download size={18} /></button> },
              { key: "checklist", header: "Checklist", render: (row) => <button className="btn-secondary py-2" type="button" onClick={() => downloadChecklist(row)}><ClipboardCheck size={16} /> PDF</button> },
              { key: "review", header: "Review", render: (row) => (
                <button className={`btn-secondary py-2 ${row.lifecycleStatus === "leave_approved" ? "ring-2 ring-primary-500" : ""}`} type="button" onClick={() => setReviewBooking(row)}>
                  <Star size={16} /> {row.lifecycleStatus === "leave_approved" ? "Leave a review" : "Review"}
                </button>
              ) },
              { key: "dispute", header: "Dispute", render: (row) => (
                <div>
                  <button className="btn-secondary py-2" type="button" onClick={() => setDisputeBooking(row)}>Raise issue</button>
                  {row.instalments?.length ? <p className="mt-2 text-xs text-on-surface-variant">{row.instalments.length} instalments</p> : null}
                </div>
              ) },
              { key: "safety", header: "Safety", render: (row) => <ConfirmButton className="btn-secondary py-2 text-danger-700" confirmLabel="Report payment" onConfirm={() => reportOffPlatform(row)}><AlertTriangle size={16} /> Report direct pay</ConfirmButton> },
              { key: "cancel", header: "Cancel", render: (row) => <button className="btn-secondary py-2" type="button" onClick={() => previewCancellation(row)} disabled={String(row.status).toLowerCase() === "cancelled"}>Preview</button> },
              { key: "manage", header: "Manage", render: (row) => {
                const lifecyclePending = row.lifecycleStatus && row.lifecycleStatus !== "none" && !row.lifecycleStatus.endsWith("_approved");
                return (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary py-2" type="button" onClick={() => openDirections(row)}><MapPinned size={16} /> Directions</button>
                    <button className="btn-secondary py-2" type="button" disabled={lifecyclePending} onClick={() => openLifecycleModal(row, "switch")}><ArrowRightLeft size={16} /> Switch</button>
                    <button className="btn-secondary py-2" type="button" disabled={lifecyclePending} onClick={() => openLifecycleModal(row, "leave")}><LogOut size={16} /> Leave</button>
                    <button className="btn-secondary py-2" type="button" onClick={() => loadMonthlyCommission(row)}><ReceiptText size={16} /> Fee</button>
                  </div>
                );
              } }
            ]}
          />
        </div>
      </section>
      {reviewBooking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="w-full max-w-xl rounded-lg border border-outline-variant bg-surface-container-lowest p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">Leave a Verified Review</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{reviewBooking.hostelName}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setReviewBooking(null)} aria-label="Close review modal">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitReview} className="grid gap-5">
              <label className="grid gap-2 font-semibold">
                Rating
                <select className="input" value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                </select>
              </label>
              <label className="grid gap-2 font-semibold">
                Review
                <textarea
                  className="input min-h-32 resize-none"
                  value={reviewForm.comment}
                  onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder="Share food, cleanliness, internet, safety, and Host response details..."
                  required
                />
              </label>
              {/* Optional video/voice testimonial URL for now (simple text input). If this
                  proves popular, swap in the existing Cloudinary upload service for a real
                  upload widget instead of a raw URL field. */}
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <label className="grid gap-2 font-semibold">
                  Media type
                  <select className="input" value={reviewForm.mediaType} onChange={(event) => setReviewForm((current) => ({ ...current, mediaType: event.target.value }))}>
                    <option value="">None</option>
                    <option value="video">Video</option>
                    <option value="audio">Voice</option>
                  </select>
                </label>
                <label className="grid gap-2 font-semibold">
                  Video/voice testimonial URL (optional)
                  <input
                    className="input"
                    type="url"
                    value={reviewForm.mediaUrl}
                    onChange={(event) => setReviewForm((current) => ({ ...current, mediaUrl: event.target.value }))}
                    placeholder="https://..."
                  />
                </label>
              </div>
              {reviewMessage && <p className="rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-600">{reviewMessage}</p>}
              <button className="btn-primary justify-self-end px-8" type="submit">Submit Review</button>
            </form>
          </section>
        </div>
      )}
      {directionInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-lg border border-outline-variant bg-surface-container-lowest p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">Navigate to nearby facility</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Open directions to the nearest pharmacy or support point.</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setDirectionInfo(null)} aria-label="Close directions">
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map(([category, label]) => (
                <button key={category} type="button" className="btn-secondary py-1.5 text-sm" onClick={() => openDirections(directionInfo.booking, category)}>{label}</button>
              ))}
            </div>
            {directionInfo.loading ? <p className="text-sm text-on-surface-variant">Preparing directions…</p> : (
              <div className="grid gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <p className="font-semibold">Destination: {directionInfo.destinationName}</p>
                {directionInfo.usedFallbackOrigin && <p className="text-xs text-on-surface-variant">Using your hostel's location (location access unavailable).</p>}
                <a href={directionInfo.directionsUrl} target="_blank" rel="noreferrer" className="btn-primary justify-self-start">Open Google Maps</a>
              </div>
            )}
          </section>
        </div>
      )}
      {lifecycleModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-lg border border-outline-variant bg-surface-container-lowest p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">{lifecycleModal.type === "switch" ? "Request a Room Switch" : "Request to Leave"}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{lifecycleModal.booking.hostelName}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setLifecycleModal(null)} aria-label="Close request modal">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4">
              {lifecycleModal.type === "switch" && (
                <label className="grid gap-2 font-semibold">
                  Target Room ID
                  <input
                    className="input"
                    value={lifecycleModal.targetRoom}
                    onChange={(event) => setLifecycleModal((current) => ({ ...current, targetRoom: event.target.value }))}
                    placeholder="Find a room on /rooms and paste its ID here"
                    required
                  />
                </label>
              )}
              {lifecycleModal.type === "leave" && (
                <label className="grid gap-2 font-semibold">
                  Planned move-out date
                  <input
                    type="date"
                    className="input"
                    value={lifecycleModal.moveOutDate}
                    onChange={(event) => setLifecycleModal((current) => ({ ...current, moveOutDate: event.target.value }))}
                  />
                </label>
              )}
              <label className="grid gap-2 font-semibold">
                Reason
                <textarea
                  className="input min-h-24 resize-none"
                  value={lifecycleModal.reason}
                  onChange={(event) => setLifecycleModal((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Let your Host know why you're requesting this..."
                />
              </label>
              {lifecycleModal.type === "leave" && lifecycleModal.preview && (
                <div className="grid gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm">
                  <p className="font-semibold">Estimated settlement</p>
                  <div className="flex justify-between"><span>Prorated rent refund</span><strong>PKR {Number(lifecycleModal.preview.proratedRentRefund || 0).toLocaleString("en-PK")}</strong></div>
                  <div className="flex justify-between"><span>Security deposit</span><strong>PKR {Number(lifecycleModal.preview.securityDeposit || 0).toLocaleString("en-PK")}</strong></div>
                  <div className="flex justify-between"><span>Estimated total</span><strong className="text-primary-600">PKR {Number(lifecycleModal.preview.estimatedTotalRefund || 0).toLocaleString("en-PK")}</strong></div>
                  <p className="text-xs text-on-surface-variant">{lifecycleModal.preview.policyLabel}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" className="btn-secondary" onClick={() => setLifecycleModal(null)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={submitLifecycleModal} disabled={lifecycleModal.type === "switch" && !lifecycleModal.targetRoom}>
                  Send Request
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {disputeBooking && <DisputeModal booking={disputeBooking} onClose={() => setDisputeBooking(null)} />}
      {cancelPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section className="w-full max-w-lg rounded-lg border border-outline-variant bg-surface-container-lowest p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">Cancellation Preview</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{cancelPreview.booking.hostelName}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setCancelPreview(null)} aria-label="Close cancellation preview">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <div className="flex justify-between gap-3"><span>Refund amount</span><strong className="text-primary-600">PKR {Number(cancelPreview.preview?.refundAmount || 0).toLocaleString("en-PK")}</strong></div>
              <div className="flex justify-between gap-3"><span>Non-refundable</span><strong>PKR {Number(cancelPreview.preview?.nonRefundableAmount || 0).toLocaleString("en-PK")}</strong></div>
              <p className="text-sm leading-6 text-on-surface-variant">{cancelPreview.preview?.policyLabel}</p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setCancelPreview(null)}>Keep Booking</button>
              <button type="button" className="btn-primary" onClick={cancelBooking}>Cancel Booking</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
