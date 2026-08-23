import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, X } from "lucide-react";
import { api, safeRequest } from "../../services/api";
import { DataTable, StatusPill } from "../../components/ui";
import { currency } from "../../utils/formatters";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const emptyForm = {
  propertyType: "guest_house",
  name: "",
  city: "",
  area: "",
  address: "",
  description: "",
  nightlyRatePkr: 15000,
  maxGuests: 2,
  totalRooms: 1,
  checkInTime: "14:00",
  checkOutTime: "12:00",
  facilities: "",
  contactPhone: ""
};

const shapeBookingRow = (booking) => {
  const property = booking.property || booking.propertyId || {};
  return {
    id: booking.id || booking._id,
    propertyName: property.name || "Property",
    dates: `${String(booking.checkInDate).slice(0, 10)} -> ${String(booking.checkOutDate).slice(0, 10)}`,
    guestCount: booking.guestCount,
    total: currency(booking.totalPkr),
    contactPhone: booking.contactPhone,
    status: booking.status
  };
};

export function StayManagerPage() {
  useDocumentTitle("Manage Stays | Basera Host");
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      safeRequest(() => api.get("/stays/owner/properties"), { results: [] }),
      safeRequest(() => api.get("/stays/owner/bookings"), { results: [] })
    ]).then(([propertyData, bookingData]) => {
      setProperties(propertyData.results || []);
      setBookings((bookingData.results || []).map(shapeBookingRow));
      setLoading(false);
    });
  };

  useEffect(load, []);

  const submitProperty = async (event) => {
    event.preventDefault();
    setMessage("Saving property...");
    const payload = {
      ...form,
      nightlyRatePkr: Number(form.nightlyRatePkr),
      maxGuests: Number(form.maxGuests),
      totalRooms: Number(form.totalRooms),
      facilities: form.facilities.split(",").map((item) => item.trim()).filter(Boolean)
    };
    const result = await safeRequest(() => api.post("/stays/properties", payload), { property: { id: `demo-${Date.now()}`, ...payload }, demo: true });
    setMessage(result.demo ? "Property saved in demo mode." : "Property published.");
    setForm(emptyForm);
    setFormOpen(false);
    setProperties((current) => [result.property, ...current]);
    setTimeout(() => setMessage(""), 2400);
  };

  return (
    <>
      <Helmet>
        <title>Manage Stays | Basera Host</title>
      </Helmet>
      <main className="container-page py-10 lg:py-14">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Hotels & Guest Houses</h1>
            <p className="mt-2 text-neutral-700">List short-stay properties, manage nightly rates and facilities, and see incoming bookings -- separate from your monthly hostel rooms.</p>
          </div>
          <button type="button" className="btn-primary px-6 py-2.5" onClick={() => setFormOpen((open) => !open)}>
            <Plus size={18} /> {formOpen ? "Close" : "Add property"}
          </button>
        </div>

        {formOpen && (
          <section className="panel mb-8 p-7">
            <form onSubmit={submitProperty} className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 font-semibold">
                Property type
                <select className="input" value={form.propertyType} onChange={(event) => setForm((p) => ({ ...p, propertyType: event.target.value }))}>
                  <option value="guest_house">Guest House</option>
                  <option value="hotel">Hotel</option>
                </select>
              </label>
              <label className="grid gap-2 font-semibold">
                Name
                <input className="input" value={form.name} onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))} required />
              </label>
              <label className="grid gap-2 font-semibold">
                City
                <input className="input" value={form.city} onChange={(event) => setForm((p) => ({ ...p, city: event.target.value }))} required />
              </label>
              <label className="grid gap-2 font-semibold">
                Area
                <input className="input" value={form.area} onChange={(event) => setForm((p) => ({ ...p, area: event.target.value }))} required />
              </label>
              <label className="grid gap-2 font-semibold md:col-span-2">
                Address
                <input className="input" value={form.address} onChange={(event) => setForm((p) => ({ ...p, address: event.target.value }))} required />
              </label>
              <label className="grid gap-2 font-semibold md:col-span-2">
                Description
                <textarea className="input min-h-[80px]" value={form.description} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Nightly rate (PKR)
                <input type="number" min={0} className="input" value={form.nightlyRatePkr} onChange={(event) => setForm((p) => ({ ...p, nightlyRatePkr: event.target.value }))} required />
              </label>
              <label className="grid gap-2 font-semibold">
                Max guests
                <input type="number" min={1} className="input" value={form.maxGuests} onChange={(event) => setForm((p) => ({ ...p, maxGuests: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Total rooms available
                <input type="number" min={1} className="input" value={form.totalRooms} onChange={(event) => setForm((p) => ({ ...p, totalRooms: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Contact phone
                <input className="input" value={form.contactPhone} onChange={(event) => setForm((p) => ({ ...p, contactPhone: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Check-in time
                <input className="input" value={form.checkInTime} onChange={(event) => setForm((p) => ({ ...p, checkInTime: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold">
                Check-out time
                <input className="input" value={form.checkOutTime} onChange={(event) => setForm((p) => ({ ...p, checkOutTime: event.target.value }))} />
              </label>
              <label className="grid gap-2 font-semibold md:col-span-2">
                Facilities (comma separated)
                <input className="input" placeholder="Parking, Hot Water, Generator Backup, Family Rooms" value={form.facilities} onChange={(event) => setForm((p) => ({ ...p, facilities: event.target.value }))} />
              </label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}><X size={16} /> Cancel</button>
                <button type="submit" className="btn-primary px-8">Publish property</button>
              </div>
            </form>
          </section>
        )}

        {message && <p className="mb-6 rounded-md bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800">{message}</p>}

        <section className="panel mb-8 overflow-hidden">
          <div className="flex items-center justify-between p-7 pb-0">
            <h2 className="text-xl font-bold">Your properties</h2>
            <span className="chip">{properties.length} listed</span>
          </div>
          <div className="grid gap-5 p-7 md:grid-cols-2 xl:grid-cols-3">
            {properties.length ? properties.map((property) => (
              <div key={property.id || property._id} className="rounded-lg border border-line p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary-800">{property.propertyType === "hotel" ? "Hotel" : "Guest House"}</p>
                <h3 className="mt-2 text-lg font-bold">{property.name}</h3>
                <p className="mt-1 text-sm text-slate-700">{property.area}, {property.city}</p>
                <p className="mt-3 text-lg font-extrabold text-primary-800">{currency(property.nightlyRatePkr)}<span className="text-sm font-semibold text-slate-600"> /night</span></p>
                <p className="mt-1 text-sm text-slate-600">{property.totalRooms} rooms - up to {property.maxGuests} guests</p>
              </div>
            )) : !loading && (
              <p className="text-slate-700">No properties yet. Add your first guest house or hotel above.</p>
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-7 pb-0">
            <h2 className="text-xl font-bold">Incoming bookings</h2>
            <span className="chip">{bookings.length} total</span>
          </div>
          <div className="px-7 pb-7 pt-4">
            <DataTable
              rows={bookings}
              rowKey={(row) => row.id}
              loading={loading}
              empty="No stay bookings yet."
              pageSize={8}
              columns={[
                { key: "propertyName", header: "Property", sortable: true },
                { key: "dates", header: "Dates" },
                { key: "guestCount", header: "Guests" },
                { key: "contactPhone", header: "Guest contact" },
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
