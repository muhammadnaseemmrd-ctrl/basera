import { create } from "zustand";
import { translate } from "../i18n/translations";

const STORAGE_KEY = "basera_locale";
const readLocale = () => localStorage.getItem(STORAGE_KEY) || "en";

// Keeps the root <html> element's dir/lang in sync with the active locale so Urdu
// renders right-to-left everywhere, not just inside a single component.
const applyDocumentDirection = (locale) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "ur" ? "ur" : "en";
  document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
};

// Apply immediately on module load (not just on first render) so a page refresh with a
// saved Urdu preference paints RTL right away instead of flashing LTR first.
applyDocumentDirection(readLocale());

export const useLocaleStore = create((set, get) => ({
  locale: readLocale(),

  setLocale: (locale) =>
    set(() => {
      localStorage.setItem(STORAGE_KEY, locale);
      applyDocumentDirection(locale);
      return { locale };
    }),

  toggleLocale: () => {
    const next = get().locale === "ur" ? "en" : "ur";
    get().setLocale(next);
  },

  // Shorthand translator bound to the current locale, e.g. useLocaleStore((s) => s.t)("bookNow").
  t: (key, vars) => translate(get().locale, key, vars)
}));
