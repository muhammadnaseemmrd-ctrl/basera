import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Expo only exposes env vars prefixed with EXPO_PUBLIC_ to client bundles (the RN/Expo
// equivalent of the web client's VITE_ prefix convention). Set EXPO_PUBLIC_API_URL in
// app/.env for local dev, or in your EAS/build environment for production builds.
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api/v1";

// Same storage key the web client uses for localStorage ("basera_token"/"basera_user"),
// kept identical here (via AsyncStorage) so the two clients stay conceptually consistent.
export const TOKEN_KEY = "basera_token";
export const USER_KEY = "basera_user";

export const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Mirrors client/src/services/api.js's safeRequest helper: screens call the API through
// this wrapper so a slow/unreachable backend degrades to a fallback value instead of
// crashing the screen. There is no demo-token concept on mobile (no client-side demo
// login), so this version is a straightforward try/catch around the request.
export const safeRequest = async (request, fallback) => {
  try {
    const response = await request();
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.warn("[Basera API] request failed, using fallback:", error?.message || error);
    }
    return fallback;
  }
};
