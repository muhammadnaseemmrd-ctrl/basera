import { create } from "zustand";

const readTheme = () => localStorage.getItem("basera_theme") || "light";

export const useAppStore = create((set) => ({
  city: "Islamabad",
  gender: "Male",
  budget: 25000,
  saved: ["h1", "h3"],
  theme: readTheme(),
  setSearch: (payload) => set((state) => ({ ...state, ...payload })),
  setTheme: (theme) =>
    set(() => {
      localStorage.setItem("basera_theme", theme);
      return { theme };
    }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("basera_theme", theme);
      return { theme };
    }),
  toggleSaved: (id) =>
    set((state) => ({
      saved: state.saved.includes(id)
        ? state.saved.filter((item) => item !== id)
        : [...state.saved, id]
    }))
}));
