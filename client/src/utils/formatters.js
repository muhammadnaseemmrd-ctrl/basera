export const currency = (value) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK")}`;

export const rating = (value) => Number(value || 0).toFixed(1);

// Formats an ISO/parsable date string as "15 Dec 2026" for display anywhere a raw
// date needs to be shown to users. Returns the original value unchanged if it can't
// be parsed, so it never throws or silently shows "Invalid Date".
export const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
