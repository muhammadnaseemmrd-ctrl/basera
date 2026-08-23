import { create } from "zustand";
import { api, isDemoToken } from "../services/api";

const demoUsers = [
  {
    id: "u-student",
    name: "Ali Ahmed",
    email: "student@basera.pk",
    phone: "+923001234567",
    role: "student",
    university: "NUST",
    city: "Islamabad",
    gender: "male",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "u-owner",
    name: "Alex Rivera",
    email: "owner@basera.pk",
    phone: "+923451112233",
    role: "host",
    legacyRole: "owner",
    city: "Islamabad",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "u-landlord",
    name: "Sara Malik",
    email: "landlord@basera.pk",
    phone: "+923211234567",
    role: "host",
    legacyRole: "landlord",
    city: "Lahore",
    isVerified: false,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    landlordProfile: {
      listerType: "individual_landlord",
      verificationTier: "identity_verified",
      agreementAccepted: true,
      reviewStatus: "pending"
    }
  },
  {
    id: "u-admin",
    name: "Super Admin",
    email: "admin@basera.pk",
    phone: "+923009998877",
    role: "admin",
    isVerified: true
  },
  {
    id: "u-warden",
    name: "Imran Warden",
    email: "warden@basera.pk",
    phone: "+923221239988",
    role: "warden",
    city: "Islamabad",
    isVerified: true,
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80"
  }
];

const readJson = (key) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const dashboardPathForRole = (role) => {
  if (role === "host" || role === "owner" || role === "landlord") return "/host/dashboard";
  if (role === "admin") return "/admin";
  if (role === "finance") return "/admin";
  if (role === "warden") return "/warden/dashboard";
  return "/dashboard/student";
};

const demoLogin = ({ email, password }) => {
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_CLIENT_DEMO_LOGIN !== "true") return null;
  const user = demoUsers.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || password !== "password123") return null;
  return { user, token: `client-demo-${user.id}` };
};

export const useAuthStore = create((set, get) => ({
  user: readJson("basera_user"),
  token: localStorage.getItem("basera_token"),
  loading: false,
  error: "",

  login: async ({ email, password }) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("basera_token", data.token);
      localStorage.setItem("basera_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false, error: "" });
      return data.user;
    } catch (error) {
      const fallback = demoLogin({ email, password });
      if (fallback) {
        localStorage.setItem("basera_token", fallback.token);
        localStorage.setItem("basera_user", JSON.stringify(fallback.user));
        set({ user: fallback.user, token: fallback.token, loading: false, error: "" });
        return fallback.user;
      }
      const message = error.response?.data?.message || "Login failed. Check your email and password.";
      set({ loading: false, error: message });
      throw new Error(message, { cause: error });
    }
  },

  register: async (payload) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("basera_token", data.token);
      localStorage.setItem("basera_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false, error: "" });
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed.";
      set({ loading: false, error: message });
      throw new Error(message, { cause: error });
    }
  },

  registerLandlord: async (payload) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/register-landlord", payload);
      localStorage.setItem("basera_token", data.token);
      localStorage.setItem("basera_user", JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false, error: "" });
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Host registration failed.";
      set({ loading: false, error: message });
      throw new Error(message, { cause: error });
    }
  },

  logout: () => {
    localStorage.removeItem("basera_token");
    localStorage.removeItem("basera_user");
    set({ user: null, token: null, error: "" });
  },

  refreshMe: async () => {
    const currentToken = get().token;
    if (!currentToken) return null;
    if (isDemoToken(currentToken)) {
      // A demo token will always 401 against the real backend -- skip the call
      // instead of wastefully failing and logging the demo user out.
      return get().user;
    }
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("basera_user", JSON.stringify(data.user));
      set({ user: data.user });
      return data.user;
    } catch {
      get().logout();
      return null;
    }
  }
}));
