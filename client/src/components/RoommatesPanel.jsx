import { Users } from "lucide-react";

// Category-level "who will be my roommate" labels only -- never a name, email, or phone.
// The occupant chose these labels on their own profile (see StudentProfile.jsx) and can
// opt out entirely via `visibleToProspectiveRoommates`, in which case the server simply
// omits that bed from the `occupants` array this panel renders.
const occupantTypeLabels = {
  student: "University Student",
  teacher: "Teacher",
  working_professional: "Working Professional",
  freelancer: "Freelancer",
  other: "Resident"
};

export function RoommatesPanel({ occupants = [] }) {
  const visible = (occupants || []).filter((occupant) => occupant && occupant.occupantType);
  if (!visible.length) return null;

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Users size={20} /> Who Lives Here Already
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Occupation and field are shared voluntarily by current occupants. Names and contact details stay private until a paid booking is confirmed.
      </p>
      <div className="mt-5 grid gap-3">
        {visible.map((occupant, index) => (
          <div key={`${occupant.bedIndex ?? index}`} className="rounded-lg border border-line bg-primary-50 p-4">
            <p className="font-bold text-primary-800">
              {occupantTypeLabels[occupant.occupantType] || "Resident"}
              {occupant.fieldOrSubject ? ` — ${occupant.fieldOrSubject}` : ""}
              {occupant.studyLevel ? ` (${occupant.studyLevel})` : ""}
            </p>
            {occupant.bio && <p className="mt-1 text-sm text-slate-700">{occupant.bio}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
