import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { BedDouble } from "lucide-react";
import { api, safeRequest } from "../services/api";
import { DataTable, StatusPill } from "../components/ui";
import { currency } from "../utils/formatters";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const shapeRow = (booking) => {
  const property = booking.property || booking.propertyId || {};
  return {
    id: booking.id || booking._id,
    propertyName: property.name || "Property",
    city: property.city || "",
    dates: `${String(booking.checkInDate).slice(0, 10)} -> ${String(booking.checkOutDate).slice(0, 10)}`,
    nights: booking.nights,
    guestCount: booking.guestCount,
    total: currency(booking.totalPkr),
    status: booking.status
  };
};

export function StayBookingsPage() {
  useDocumentTitle("My Stays | Basera");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safeRequest(() => api.get("/stays/bookings/my"), { results: [] }).then((data) => {
      setRows((data.results || []).map(shapeRow));
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>My Stays | Basera</title>
      </Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">My Stays</h1>
            <p className="mt-2 text-neutral-700">Your hotel and guest house bookings for short tourist stays.</p>
          </div>
          <Link to="/stays" className="btn-primary px-6 py-2.5">Book another stay</Link>
        </div>

        <section className="panel overflow-hidden">
          <div className="px-7 py-6">
            <DataTable
              rows={rows}
              rowKey={(row) => row.id}
              loading={loading}
              empty="You have no stay bookings yet."
              emptyIcon={<BedDouble size={28} />}
              pageSize={8}
              columns={[
                { key: "propertyName", header: "Property", sortable: true },
                { key: "city", header: "City", sortable: true },
                { key: "dates", header: "Dates" },
                { key: "nights", header: "Nights", sortable: true },
                { key: "guestCount", header: "Guests" },
                { key: "total", header: "Total" },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> }
              ]}
            />
          </div>
        </section>
      </main>
    </>
  );
}
