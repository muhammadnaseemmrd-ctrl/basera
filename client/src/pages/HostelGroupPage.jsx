import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { Building2, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { HostelCard } from "../components/HostelCard";
import { api, safeRequest } from "../services/api";
import { normalizeHostels } from "../utils/normalize";
import { useDocumentTitle } from "../utils/useDocumentTitle";

const fallbackGroup = {
  name: "Royal Group of Hostels",
  slug: "royal-group-of-hostels",
  description: "A trusted multi-branch student housing brand operating verified boys and girls hostels across Islamabad and Lahore.",
  logoUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=300&q=80",
  verified: true,
  foundedYear: 2015,
  citiesPresent: ["Islamabad", "Lahore"],
  hostels: []
};

export function HostelGroupPage() {
  const { slug } = useParams();
  const [group, setGroup] = useState(fallbackGroup);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(`${group.name} | Basera`);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    safeRequest(() => api.get(`/hostel-groups/${slug}`), { group: fallbackGroup }).then((data) => {
      if (!ignore) {
        setGroup(data.group || fallbackGroup);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [slug]);

  const hostels = normalizeHostels(group.hostels || []);

  return (
    <>
      <Helmet>
        <title>{group.name} | Basera</title>
        <meta name="description" content={group.description} />
      </Helmet>
      <main className="container-page py-10 lg:py-14">
        <section className="panel flex flex-col gap-6 p-7 sm:flex-row sm:items-center">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary-50">
            {group.logoUrl ? (
              <img src={group.logoUrl} alt={group.name} className="h-full w-full object-cover" />
            ) : (
              <Building2 size={32} className="text-primary-800" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
              {group.verified && (
                <span className="badge bg-accent-700 text-white">
                  <ShieldCheck size={14} /> Verified Group
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-slate-700">{group.description}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
              {group.foundedYear && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={15} /> Since {group.foundedYear}
                </span>
              )}
              {!!group.citiesPresent?.length && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} /> {group.citiesPresent.join(", ")}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Building2 size={15} /> {hostels.length} branch{hostels.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">Branches</h2>
          {loading ? (
            <p className="mt-4 text-slate-700">Loading branches...</p>
          ) : hostels.length ? (
            <div className="mt-6 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
              {hostels.map((hostel) => (
                <HostelCard key={hostel.id} hostel={hostel} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-slate-700">
              No branches listed yet. <Link to="/hostels" className="font-semibold text-primary-800 hover:underline">Browse all hostels</Link>.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
