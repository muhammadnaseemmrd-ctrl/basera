import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";

// Non-component helpers for the hostel-ops pages. Kept out of opsUi.jsx so that file
// only exports components (React fast refresh requirement).

export const money = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
export const dateShort = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
// validation endpoints return every problem in `errors`; show them all, not just the first
export const errMsg = (error, fallback = "Something went wrong.") => {
  const data = error?.response?.data;
  // strings from hostel-ops validators, { field, message } objects from express-validator
  if (Array.isArray(data?.errors) && data.errors.length) {
    const list = data.errors.map((e) => (typeof e === "string" ? e : e?.message)).filter(Boolean);
    if (list.length > 1 || data.message === "Validation failed.") return list.join(" ");
  }
  return data?.message || error?.message || fallback;
};

/** Load JSON from the API with loading/error state and a reload() handle. A null path loads nothing. */
export function useLoad(path) {
  // state only changes in the request callbacks; "loading" is derived from whether the
  // stored result belongs to the current path + reload tick
  const [state, setState] = useState({ path: null, tick: -1, data: null, error: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let ignore = false;
    api.get(path).then(
      ({ data }) => !ignore && setState({ path, tick, data, error: "" }),
      (error) => !ignore && setState({ path, tick, data: null, error: errMsg(error) })
    );
    return () => {
      ignore = true;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const samePath = state.path === path;
  const fresh = samePath && state.tick === tick;
  return { data: samePath ? state.data : null, loading: Boolean(path) && !fresh, error: fresh ? state.error : "", reload };
}

export const SEAT_STYLE = {
  free: "border-accent-700 bg-accent-50 text-accent-800",
  reserved: "border-[#B45309] bg-[#FEF3C7] text-[#92400E]",
  occupied: "border-primary-700 bg-primary-50 text-primary-900",
  leaving: "border-[#0E7490] bg-[#ECFEFF] text-[#155E75]",
  booked_offline: "border-[#6D28D9] bg-[#EDE9FE] text-[#5B21B6]",
  maintenance: "border-[#C81E1E] bg-[#FEE2E2] text-[#991B1B]"
};
export const SEAT_LABEL = { free: "Free", reserved: "Reserved", occupied: "Occupied", leaving: "Leaving", booked_offline: "Booked (offline)", maintenance: "Maintenance" };

/** Uploads a proof screenshot; resolves to a hosted URL or throws. */
export async function uploadProof(file) {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post("/uploads/image", form);
  if (data.demo || !/^https?:\/\//i.test(data.url || "")) {
    throw new Error("Image storage is not configured on the server, so screenshots can't be saved yet. Enter the transaction ID instead.");
  }
  return data.url;
}
