import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, safeRequest } from "../../services/api";
import { HostelCard } from "../../components/HostelCard";
import { hostels } from "../../data/mockData";
import { useAppStore } from "../../store/useAppStore";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

const fallback = { savedIds: ["h1", "h3"] };

export function StudentSaved() {
  useDocumentTitle("Saved Hostels | Basera");
  const savedFromStore = useAppStore((s) => s.saved);
  const [data, setData] = useState(fallback);

  useEffect(() => {
    safeRequest(() => api.get("/dashboard/student/saved"), fallback).then(setData);
  }, []);

  const effectiveSaved = data.savedIds?.length ? data.savedIds : savedFromStore;

  const savedHostels = useMemo(() => hostels.filter((h) => effectiveSaved.includes(h.id)), [effectiveSaved]);

  return (
    <>
      <Helmet>
        <title>Saved Hostels | Basera</title>
      </Helmet>

      <div className="mb-7">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">Saved Hostels</h2>
        <p className="mt-2 text-on-surface-variant">Review and manage your shortlisted accommodations.</p>
      </div>

      {savedHostels.length ? (
        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {savedHostels.map((hostel) => (
            <HostelCard key={hostel.id} hostel={hostel} />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border border-outline-variant bg-surface-container-lowest p-12 text-center shadow-sm">
          <div>
            <h3 className="font-display text-xl font-bold text-on-surface">No Saved Hostels Yet</h3>
            <p className="mt-2 max-w-md text-on-surface-variant">You haven't shortlisted any accommodations. Explore available options and save your favorites here.</p>
          </div>
        </div>
      )}
    </>
  );
}

