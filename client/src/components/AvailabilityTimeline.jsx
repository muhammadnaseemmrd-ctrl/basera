import { CalendarDays, CheckCircle2, Lock, LockKeyhole, MessageSquare } from "lucide-react";

const occupantTypeLabels = {
  student: "University Student",
  teacher: "Teacher",
  working_professional: "Working Professional",
  freelancer: "Freelancer",
  other: "Resident"
};

export function AvailabilityTimeline({ room, availability, occupants = [] }) {
  const availableBeds = availability?.availableBeds ?? room?.availableBeds ?? 0;
  const totalBeds = availability?.totalBeds || room?.totalBeds || 1;
  const availableIndices = availability?.availableBedIndices || [];
  const blocks = availability?.blocks || [];
  const steps = [
    { label: "Live beds", note: `${availableBeds} of ${totalBeds} beds available now`, icon: CalendarDays, active: availableBeds > 0 },
    { label: "Visit window", note: room?.trialStayAvailable ? "Trial stay or visit request supported" : "Host approval required", icon: MessageSquare, active: true },
    { label: "Payment protection", note: "Rent and deposit stay inside Basera escrow", icon: LockKeyhole, active: true },
    { label: "Move-in unlock", note: "Contact details unlock after paid confirmed booking", icon: CheckCircle2, active: true }
  ];

  return (
    <section className="panel p-6">
      <h2 className="text-xl font-bold">Availability Timeline</h2>
      <p className="mt-2 text-sm text-slate-700">A clear booking path from bed availability to move-in contact unlock.</p>
      {totalBeds > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from({ length: totalBeds }, (_, bedIndex) => bedIndex).map((bedIndex) => {
            const isAvailable = availableIndices.includes(bedIndex);
            const block = blocks.find((item) => item.bedIndex === bedIndex);
            const isBookedOffline = block?.reason === "booked_offline";
            const occupant = occupants.find((item) => item.bedIndex === bedIndex);
            const occupantTitle = occupant
              ? `Occupied — ${occupantTypeLabels[occupant.occupantType] || "Resident"}${occupant.fieldOrSubject ? ` (${occupant.fieldOrSubject})` : ""}`
              : "Occupied";
            return (
              <span
                key={bedIndex}
                title={isBookedOffline ? "Booked (offline)" : block ? block.reason : isAvailable ? "Available" : occupantTitle}
                className={`grid h-9 w-9 place-items-center rounded-md border text-sm font-bold ${
                  isAvailable
                    ? "border-accent-700 bg-accent-50 text-accent-700"
                    : isBookedOffline
                      ? "border-[#B45309] bg-[#FEF3C7] text-[#92400E]"
                      : block
                        ? "border-[#C81E1E] bg-[#FEE2E2] text-[#991B1B]"
                        : "border-primary-700 bg-primary-50 text-primary-800"
                }`}
              >
                {isAvailable ? <CheckCircle2 size={15} /> : isBookedOffline ? <Lock size={13} /> : bedIndex + 1}
              </span>
            );
          })}
        </div>
      )}
      <div className="mt-5 grid gap-4">
        {steps.map(({ label, note, icon: Icon, active }, index) => (
          <div key={label} className="grid grid-cols-[42px_1fr] gap-3">
            <div className="grid justify-items-center">
              <span className={`grid h-10 w-10 place-items-center rounded-full ${active ? "bg-primary-700 text-white" : "bg-primary-50 text-primary-800"}`}>
                <Icon size={18} />
              </span>
              {index < steps.length - 1 && <span className="h-8 w-px bg-line" />}
            </div>
            <div className="pb-4">
              <p className="font-bold">{label}</p>
              <p className="mt-1 text-sm text-slate-700">{note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
