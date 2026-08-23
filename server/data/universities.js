const universities = [
  { id: "nust", name: "NUST", city: "Islamabad", lat: 33.6416, lng: 72.9864, aliases: ["National University of Sciences and Technology", "H-12"] },
  { id: "fast-isb", name: "FAST-NU", city: "Islamabad", lat: 33.6569, lng: 73.0151, aliases: ["FAST", "NUCES Islamabad"] },
  { id: "bahria-isb", name: "Bahria University", city: "Islamabad", lat: 33.7174, lng: 73.0636, aliases: ["Bahria"] },
  { id: "air-isb", name: "Air University", city: "Islamabad", lat: 33.7136, lng: 73.0251, aliases: ["AU"] },
  { id: "iiui", name: "International Islamic University", city: "Islamabad", lat: 33.6587, lng: 73.0256, aliases: ["IIUI"] },
  { id: "lums", name: "LUMS", city: "Lahore", lat: 31.4705, lng: 74.4112, aliases: ["Lahore University of Management Sciences"] },
  { id: "pu", name: "Punjab University", city: "Lahore", lat: 31.5001, lng: 74.3097, aliases: ["University of the Punjab"] },
  { id: "uet-lahore", name: "UET Lahore", city: "Lahore", lat: 31.5792, lng: 74.3565, aliases: ["UET"] },
  { id: "iba", name: "IBA Karachi", city: "Karachi", lat: 24.9418, lng: 67.1137, aliases: ["IBA"] },
  { id: "ku", name: "University of Karachi", city: "Karachi", lat: 24.9414, lng: 67.1209, aliases: ["KU"] },
  { id: "ned", name: "NED University", city: "Karachi", lat: 24.9306, lng: 67.1148, aliases: ["NED"] },
  { id: "uop", name: "University of Peshawar", city: "Peshawar", lat: 34.0083, lng: 71.4875, aliases: ["UOP"] },
  { id: "arid", name: "PMAS Arid Agriculture University", city: "Rawalpindi", lat: 33.6511, lng: 73.0823, aliases: ["Arid University"] }
];

const normalize = (value = "") => String(value).trim().toLowerCase();

const findUniversity = (value, city) => {
  const needle = normalize(value);
  if (!needle && city) return universities.find((item) => normalize(item.city) === normalize(city));
  return universities.find((item) => {
    if (city && normalize(item.city) !== normalize(city)) return false;
    return normalize(item.name).includes(needle) || item.aliases.some((alias) => normalize(alias).includes(needle) || needle.includes(normalize(alias)));
  }) || universities.find((item) => normalize(item.name).includes(needle) || item.aliases.some((alias) => normalize(alias).includes(needle)));
};

module.exports = { universities, findUniversity };
