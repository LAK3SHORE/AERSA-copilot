/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Editorial Audit Terminal palette — warm dark, bone fg, amber accent.
        ink: {
          50: "#f6f4ee",   // bone — primary text on dark
          100: "#e9e5db",
          200: "#cdc8bb",
          300: "#a8a293",
          400: "#7c7568",
          500: "#5a5447",
          600: "#3d3830",
          700: "#27241e",
          800: "#161410",
          900: "#0d0c0a",   // base ground
          950: "#080706",
        },
        amber: {
          // sharp single-accent for primary actions / current selection.
          400: "#f0b25c",
          500: "#dc8b1f",
          600: "#b86d10",
          700: "#92560d",
        },
        crit: "#e84545",      // CRÍTICO red
        alto: "#f0904e",      // ALTO orange
        medio: "#f0c14e",     // MEDIO yellow
        bajo: "#9aa195",      // BAJO muted grey-green
      },
      fontFamily: {
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        sans: ['"Geist"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      letterSpacing: {
        widish: "0.04em",
        wide2: "0.08em",
      },
      boxShadow: {
        edge: "inset 0 0 0 1px rgba(246,244,238,0.06)",
        edgeStrong: "inset 0 0 0 1px rgba(246,244,238,0.12)",
      },
      animation: {
        "rise-in": "rise-in 0.5s cubic-bezier(0.2, 0.6, 0.2, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "blink": "blink 1.1s steps(2, end) infinite",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
