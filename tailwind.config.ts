import type { Config } from "tailwindcss";

// Design tokens for SignalWell AI.
// Palette is a calm, clinical slate/paper system deliberately avoiding
// purple gradients and neon SaaS accents — see docs/DESIGN.md.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F3",
        ink: "#1A1D1F",
        slate: {
          50: "#F5F6F7",
          100: "#E7E9EB",
          200: "#C9CDD1",
          300: "#A6ACB2",
          400: "#7C848C",
          500: "#5A636B",
          600: "#414A52",
          700: "#2E353B",
          800: "#20262A",
          900: "#15191C"
        },
        signal: {
          500: "#2F6E5E",
          600: "#255A4D",
          700: "#1D4A40"
        },
        monitor: "#B8862E",
        elevated: "#B0472F"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px"
      },
      maxWidth: {
        prose: "68ch"
      }
    }
  },
  plugins: []
};

export default config;
