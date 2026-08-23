// Brand palette mirrored from client/tailwind.config.js so the mobile app and the
// web app share the same visual identity. React Native has no Tailwind, so this is
// exported as a plain JS object and used directly in StyleSheet definitions.

export const colors = {
  neutral: {
    0: "#FFFFFF",
    25: "#FCFCFD",
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1F2937",
    900: "#0F172A"
  },
  primary: {
    50: "#FFF3EF",
    100: "#FFE2D6",
    200: "#FFC4AD",
    300: "#FFA47F",
    400: "#FF8A5C",
    500: "#FF6B4A",
    600: "#F0512E",
    700: "#C93D1E",
    800: "#9C2F17",
    900: "#6F2110"
  },
  secondary: {
    50: "#EEF1F8",
    100: "#D7DEEC",
    200: "#AFC0DA",
    300: "#8496BC",
    400: "#5A6F9C",
    500: "#38507C",
    600: "#243B60",
    700: "#1B2A4A",
    800: "#131F38",
    900: "#0C1526"
  },
  accent: {
    50: "#FFFBEB",
    100: "#FFF3C4",
    200: "#FFE58A",
    600: "#FFC857",
    700: "#E0A63A"
  },
  success: {
    50: "#E6FAF2",
    100: "#C8F2DF",
    600: "#0E9F6E",
    700: "#087A55"
  },
  warning: {
    50: "#FFF7E6",
    100: "#FCEFC7",
    600: "#D9920A",
    700: "#A66A05"
  },
  danger: {
    50: "#FDECEC",
    100: "#FBD5D5",
    600: "#E02424",
    700: "#9B1C1C"
  },
  ink: "#182338",
  line: "#E5E7EB",
  canvas: "#FFF8F5",
  surface: "#FFFFFF",
  surface2: "#FFFCFB"
};

export default colors;
