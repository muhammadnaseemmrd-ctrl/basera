/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto Flex", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        headline: ["Plus Jakarta Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
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
        /* "The Gold Standard" — Deep Teal primary scale (basera.pk rebrand, Sept 2026) */
        primary: {
          50: "#E6F2F3",
          100: "#CCE5E7",
          200: "#9FF0FB",
          300: "#82D3DE",
          400: "#4DABB8",
          500: "#006D77",
          600: "#00535B",
          700: "#004F56",
          800: "#003940",
          900: "#001F23"
        },
        /* Slate Grey secondary scale */
        secondary: {
          50: "#F1F1F6",
          100: "#DEE0FF",
          200: "#C1C4E5",
          300: "#A5A8C9",
          400: "#797DAA",
          500: "#5D617D",
          600: "#595D78",
          700: "#414560",
          800: "#2A2D47",
          900: "#161A32"
        },
        /* Warm terracotta accent — retained for trust badges/highlights per brand direction */
        accent: {
          50: "#FDEDE9",
          100: "#FBD9D0",
          200: "#F4B3A0",
          600: "#C0392B",
          700: "#9E2E22"
        },
        tertiary: {
          container: "#286D67",
          DEFAULT: "#01544F",
          light: "#A9ECE4"
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
          50: "#FFDAD6",
          100: "#FBD5D5",
          600: "#BA1A1A",
          700: "#93000A"
        },
        ink: "#1B1C1C",
        line: "#DEE2E6",
        canvas: "#FCF9F8",
        surface: "#FFFFFF",
        surface2: "#F8F9FA",
        /* Literal Gold Standard token names — for screens ported directly from Stitch designs */
        "on-surface": "#1B1C1C",
        "on-surface-variant": "#3E494A",
        "surface-dim": "#DCD9D9",
        "surface-bright": "#FCF9F8",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F6F3F2",
        "surface-container": "#F0EDED",
        "surface-container-high": "#EAE7E7",
        "surface-container-highest": "#E5E2E1",
        outline: "#6F797A",
        "outline-variant": "#BEC8CA",
        "surface-variant": "#E5E2E1",
        "surface-tint": "#006972",
        "primary-container": "#006D77",
        "on-primary-container": "#9BECF7",
        "secondary-container": "#DBDEFF",
        "on-secondary-container": "#5D617D",
        "on-tertiary-container": "#A9ECE4",
        error: "#BA1A1A",
        "on-error": "#FFFFFF",
        "error-container": "#FFDAD6",
        "on-error-container": "#93000A"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        md: "0.375rem",
        xl: "0.75rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        soft: "0 24px 60px rgba(2, 6, 23, 0.10)",
        card: "0 10px 30px rgba(2, 6, 23, 0.08)",
        float: "0 18px 44px rgba(2, 6, 23, 0.12)"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
        standard: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      },
      transitionDuration: {
        250: "250ms",
        350: "350ms"
      }
    }
  },
  plugins: []
}
