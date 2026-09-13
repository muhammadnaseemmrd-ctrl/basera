import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, CreditCard, ReceiptText, ShieldCheck, LogOut } from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { StatusPill, useToastBridge, DataTable } from "../../components/ui";
import { currency } from "../../utils/formatters";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { downloadApiPdf } from "../../utils/downloadFile";

const fallback = {
  results: [
    {
      id: "b1",
      hostelName: "Cozy Boys Hostel F-10",
      totalRent: 20000,
      securityDeposit: 20000,
      serviceFee: 400,
      discountAmount: 500,
      totalAmount: 39900,
      paymentStatus: "paid",
      status: "confirmed",
      nextRentDueDate: "2026-07-01",
      instalments: [
        { dueDate: "2026-06-01", amount: 39900, status: "PAID" },
        { dueDate: "2026-07-01", amount: 20000, status: "PENDING" }
      ]
    }
  ]
};

export function StudentPayments() {
  useDocumentTitle("My Payments | Basera");
  const [rows, setRows] = useState(fallback.results);
  const [depositCases, setDepositCases] = useState({});
  const [message, setMessage] = useState("");
  const monthlyCommission = rows.reduce((sum, row) => sum + Number(row.monthlyPlatformFee || 0), 0);
  const settledRows = rows.filter((row) => row.lifecycleStatus === "leave_approved" && row.leaveSettlement);
  useToastBridge(message);

  useEffect(() => {
    safeRequest(() => api.get("/bookings/my"), fallback).then(async (result) => {
      const nextRows = result.results || fallback.results;
      setRows(nextRows);
      const deposits = await Promise.all(
        nextRows.map(async (row) => {
          const id = row.id || row._id;
          const response = await safeRequest(() => api.get(`/bookings/${id}/deposit`), {
            deposit: { caseId: `HH-DEP-${id}`, booking: id, amount: row.securityDeposit || 0, status: "HELD" },
            demo: true
          });
          return [id, response.deposit];
        })
      );
      setDepositCases(Object.fromEntries(deposits));
    });
  }, []);

  const download = async (booking, type = "receipt") => {
    setMessage(`Preparing ${type}...`);
    try {
      const bookingId = booking.id || booking._id;
      const studentId = booking.student?.id || booking.student?._id || booking.student || "u-student";
      const endpoints = {
        receipt: `/documents/bookings/${bookingId}/receipt`,
        ledger: `/documents/bookings/${bookingId}/rent-ledger`,
        certificate: `/documents/certificate/${studentId}`,
        deposit: `/documents/deposit/${bookingId}/receipt`,
        refund: `/documents/deposit/${bookingId}/refund-notice`
      };
      await downloadApiPdf({
        api,
        endpoint: endpoints[type] || endpoints.receipt,
        filename: `basera-${type}-${bookingId}.pdf`
      });
      setMessage(`${type} downloaded.`);
    } catch {
      setMessage("Document download is available when the API is running with a valid token.");
    }
    setTimeout(() => setMessage(""), 2500);
  };

  const handleDepositAction = async (booking, action) => {
    const id = booking.id || booking._id;
    setMessage(action === "accept" ? "Accepting deposit deduction..." : "Opening deposit dispute...");
    const endpoint = action === "accept" ? `/bookings/${id}/deposit/accept` : `/bookings/${id}/deposit/dispute`;
    const response = await safeRequest(() => api.post(endpoint, { description: "Student requested deposit review from payments dashboard." }), {
      deposit: { ...(depositCases[id] || {}), status: action === "accept" ? "ACCEPTED" : "DISPUTED" },
      demo: true
    });
    setDepositCases((current) => ({ ...current, [id]: response.deposit || { ...(current[id] || {}), status: "DISPUTED" } }));
    setMessage(response.demo ? "Deposit action recorded in demo mode." : "Deposit action submitted.");
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <section className="space-y-7">
      <div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">My Payments</h2>
        <p className="mt-2 text-on-surface-variant">Track rent dues, instalments, receipts, deposit escrow, and late fees.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        {[
          ["Outstanding", rows.filter((row) => row.paymentStatus !== "paid").reduce((sum, row) => sum + Number(row.totalRent || row.totalAmount || 0), 0), CreditCard, "bg-primary-container text-on-primary-container"],
          ["Paid This Year", rows.filter((row) => row.paymentStatus === "paid").reduce((sum, row) => sum + Number(row.totalAmount || 0), 0), ReceiptText, "bg-tertiary-container text-on-tertiary-container"],
          ["Deposit Held", rows.reduce((sum, row) => sum + Number(row.securityDeposit || 0), 0), ShieldCheck, "bg-secondary-container text-on-secondary-container"],
          ["Monthly Fee", monthlyCommission, ArrowRightLeft, "bg-primary-container text-on-primary-container"]
        ].map(([label, value, Icon, iconClass]) => (
          <article key={label} className="flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${iconClass}`}><Icon size={22} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-on-surface">{currency(value)}</p>
            </div>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
        <div className="border-b border-outline-variant bg-surface-container-low p-6 pb-4">
          <h3 className="font-display text-xl font-bold text-on-surface">Payment History & Instalments</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Click a column to sort.</p>
        </div>
        <div className="px-6 pb-6 pt-4">
          <DataTable
            rows={rows}
            rowKey={(row) => row.id || row._id}
            pageSize={8}
            empty="No payment history yet."
            columns={[
              { key: "hostelName", header: "Booking", sortable: true, render: (row) => <span className="font-semibold text-ink">{row.hostelName || row.room?.title || row.hostel?.name || row.id || row._id}</span> },
              { key: "totalRent", header: "Rent", sortable: true, sortValue: (row) => row.totalRent || row.totalAmount || 0, render: (row) => currency(row.totalRent || row.totalAmount) },
              { key: "serviceFee", header: "Service Fee", render: (row) => currency(row.serviceFee || 0) },
              { key: "discountAmount", header: "Discount", render: (row) => <span className="text-success-700">-{currency(row.discountAmount || 0)}</span> },
              { key: "securityDeposit", header: "Deposit", render: (row) => currency(row.securityDeposit || 0) },
              { key: "nextRentDueDate", header: "Next Due", sortable: true, sortValue: (row) => String(row.nextRentDueDate || row.checkIn || ""), render: (row) => String(row.nextRentDueDate || row.checkIn || "").slice(0, 10) },
              { key: "status", header: "Status", sortable: true, sortValue: (row) => row.paymentStatus || row.status, render: (row) => <StatusPill status={row.paymentStatus || row.status} /> },
              { key: "documents", header: "Documents", render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary py-2" onClick={() => download(row, "receipt")}>Receipt</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => download(row, "ledger")}>Ledger</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => download(row, "certificate")}>Certificate</button>
                </div>
              ) }
            ]}
          />
        </div>
      </section>
      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Move-out & switch management</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Request a hostel switch, leave notice, or review your monthly platform fee from My Bookings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/student/bookings" className="chip"><ArrowRightLeft size={14} /> Switch requests</Link>
            <Link to="/dashboard/student/bookings" className="chip"><LogOut size={14} /> Leave notice</Link>
          </div>
        </div>
      </section>
      {settledRows.length > 0 && (
        <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <h3 className="text-xl font-bold">Final Settlement</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Your Host approved a move-out on these bookings. Refund figures below are estimates pending deposit inspection.</p>
          <div className="mt-5 grid gap-4">
            {settledRows.map((row) => {
              const id = row.id || row._id;
              const settlement = row.leaveSettlement;
              return (
                <article key={`settlement-${id}`} className="grid gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 lg:grid-cols-[1fr_1fr_1fr] lg:items-center">
                  <div>
                    <p className="font-bold">{row.hostelName || row.room?.title || row.hostel?.name || id}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">Moved out {String(row.moveOutDate || settlement.moveOutDate || "").slice(0, 10)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Prorated rent refund</p>
                    <p className="font-extrabold text-primary-600">{currency(settlement.proratedRentRefund || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Estimated total refund</p>
                    <p className="font-extrabold text-primary-600">{currency(settlement.estimatedTotalRefund || 0)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={22} /> Security Deposit Cases</h3>
        <div className="mt-5 grid gap-4">
          {rows.map((row) => {
            const id = row.id || row._id;
            const deposit = depositCases[id] || {};
            return (
              <article key={`deposit-${id}`} className="grid gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 lg:grid-cols-[1fr_160px_260px] lg:items-center">
                <div>
                  <p className="font-bold">{row.hostelName || row.room?.title || row.hostel?.name || id}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Case {deposit.caseId || `HH-DEP-${id}`} - auto refund review after move-out inspection.</p>
                </div>
                <div>
                  <p className="font-extrabold text-primary-600">{currency(deposit.amount || row.securityDeposit || 0)}</p>
                  <span className="badge mt-2 bg-primary-container/15 text-primary-600">{deposit.status || "HELD"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary py-2" onClick={() => download(row, "deposit")}>Deposit Receipt</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => download(row, "refund")}>Refund Notice</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => handleDepositAction(row, "accept")}>Accept Deduction</button>
                  <button type="button" className="btn-secondary py-2" onClick={() => handleDepositAction(row, "dispute")}>Dispute</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
