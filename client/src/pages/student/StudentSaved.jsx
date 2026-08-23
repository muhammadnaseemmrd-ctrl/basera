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
        <h2 className="text-3xl font-extrabold tracking-tight">Saved Hostels</h2>
        <p className="mt-2 text-neutral-700">Shortlist places you might want to book later.</p>
      </div>

      {savedHostels.length ? (
        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {savedHostels.map((hostel) => (
            <HostelCard key={hostel.id} hostel={hostel} />
          ))}
        </div>
      ) : (
        <div className="panel grid place-items-center p-12 text-center">
          <div>
            <h3 className="text-xl font-bold">No saved hostels yet</h3>
            <p className="mt-2 text-neutral-700">Browse listings and tap the heart icon to save hostels.</p>
          </div>
        </div>
      )}
    </>
  );
}

