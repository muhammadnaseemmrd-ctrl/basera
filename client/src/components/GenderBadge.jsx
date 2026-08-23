import { ShieldCheck } from "lucide-react";

const labels = {
  BOYS_ONLY: "Boys only",
  GIRLS_ONLY: "Female only",
  CO_ED: "Co-ed floors",
  FAMILIES: "Families",
  PROFESSIONALS: "Professionals"
};

export function GenderBadge({ value = "BOYS_ONLY" }) {
  const female = value === "GIRLS_ONLY";
  return (
    <span className={`badge ${female ? "bg-[#FCE7F3] text-[#9D174D]" : "bg-primary-50 text-primary-800"}`}>
      <ShieldCheck size={14} /> {labels[value] || value}
    </span>
  );
}
