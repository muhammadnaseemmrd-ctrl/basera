import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, TOKEN_KEY, USER_KEY } from "../api/client";

// Mirrors client/src/store/useAuthStore.js's shape (user/token/loading/error, login/
// register/logout/refreshMe) but adapted for React Native: localStorage is synchronous
// so the web store can read it at module-init time, while AsyncStorage is async, so this
// store starts empty and exposes loadStoredAuth() for App.js to call once on boot.
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: "",
  hydrated: false,

  // Reads any previously-stored session from AsyncStorage. Call once from App.js before
  // rendering navigation so RootNavigator knows whether to show Auth or Main.
  loadStoredAuth: async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);
      set({
        token: token || null,
        user: userJson ? JSON.parse(userJson) : null,
        hydrated: true
      });
    } catch {
      set({ hydrated: true });
    }
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false, error: "" });
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Login failed. Check your email and password.";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  register: async (payload) => {
    set({ loading: true, error: "" });
    try {
      const { data } = await api.post("/auth/register", payload);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false, error: "" });
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed.";
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    set({ user: null, token: null, error: "" });
  },

  refreshMe: async () => {
    const currentToken = get().token;
    if (!currentToken) return null;
    try {
      const { data } = await api.get("/auth/me");
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ user: data.user });
      return data.user;
    } catch {
      await get().logout();
      return null;
    }
  }
}));
