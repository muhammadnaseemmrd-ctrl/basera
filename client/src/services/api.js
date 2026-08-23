import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("basera_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// The client-side demo-login fallback (see useAuthStore.demoLogin) issues a fake,
// non-JWT token like `client-demo-<id>` so the app stays usable in offline/demo mode.
// That token will never verify against the real backend, so any request made while
// it's active is guaranteed to fail. isDemoToken lets callers detect that up front.
export const isDemoToken = (token) => typeof token === "string" && token.startsWith("client-demo-");

export const safeRequest = async (request, fallback) => {
  if (isDemoToken(localStorage.getItem("basera_token"))) {
    // Skip the network round-trip entirely -- a demo token would just 401 against
    // the real backend, so go straight to the fallback/demo-data path instead.
    return fallback;
  }
  try {
    const response = await request();
    return response.data;
  } catch (error) {
    if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_DEMO_FALLBACK !== "true") {
      throw error;
    }
    return fallback;
  }
};
