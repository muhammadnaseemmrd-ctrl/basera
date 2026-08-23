import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../services/api";
import { StatusPill, DataTable, useToastBridge } from "./ui";
import { downloadApiPdf } from "../utils/downloadFile";

export function TenantLedger({ rows = [] }) {
  const items = rows.length ? rows : [
    { bookingId: "b1", tenant: "Noor Fatima", room: "PG-1", month: "June 2026", rent: "PKR 32,000", status: "Paid", receipt: "HH-PG-001" },
    { bookingId: "b1", tenant: "Danish Raza", room: "ST-2", month: "June 2026", rent: "PKR 42,000", status: "Pending", receipt: "HH-ST-002" }
  ];
  const [message, setMessage] = useState("");
  useToastBridge(message);

  const downloadReceipt = async (row) => {
    const bookingId = row.bookingId || row.id || row._id || row.receipt || "b1";
    setMessage(`Preparing receipt ${row.receipt || bookingId}...`);
    try {
      await downloadApiPdf({
        api,
        endpoint: `/documents/bookings/${bookingId}/receipt`,
        filename: `basera-receipt-${bookingId}.pdf`
      });
      setMessage("Receipt downloaded.");
    } catch {
      setMessage("Receipt download requires the API server and a valid Host login.");
    }
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <section className="panel overflow-hidden">
      <div className="p-7 pb-4">
        <h2 className="text-xl font-bold">Tenant Ledger</h2>
        <p className="mt-2 text-sm text-slate-700">Month-by-month rent receipts per tenant and room. Click a column to sort.</p>
      </div>
      <div className="px-7 pb-7">
        <DataTable
          rows={items}
          rowKey={(row) => `${row.tenant}-${row.month}`}
          pageSize={8}
          empty="No ledger entries yet."
          columns={[
            { key: "tenant", header: "Tenant", sortable: true, render: (row) => <span className="font-semibold text-ink">{row.tenant}</span> },
            { key: "room", header: "Room", sortable: true },
            { key: "month", header: "Month", sortable: true },
            { key: "rent", header: "Rent", sortable: true, sortValue: (row) => Number(String(row.rent).replace(/[^0-9.]/g, "")) || 0 },
            { key: "status", header: "Status", sortable: true, render: (row) => <StatusPill status={row.status} /> },
            { key: "receipt", header: "Receipt", render: (row) => <button type="button" className="btn-ghost py-1.5" onClick={() => downloadReceipt(row)}><Download size={16} /> {row.receipt}</button> }
          ]}
        />
      </div>
    </section>
  );
}
