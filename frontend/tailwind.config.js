/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light editorial palette — cream ground, dark teal text, green accents.
        cream: {
          DEFAULT: "#F8F3E1", // page ground
          2: "#F1EAD0",       // raised surface (input, hover)
          3: "#E8DFC0",       // selected / active surface
        },
        ink: {
          DEFAULT: "#091413", // primary text
          2: "#1d2e2b",       // secondary text
          3: "#3d524e",       // tertiary / labels
          4: "#6b7c78",       // muted / captions
          5: "#94a3a0",       // very muted / dividers
        },
        accent: {
          DEFAULT: "#285A48", // deep — primary buttons, important borders
          2: "#408A71",       // mid — links, hover, secondary buttons
          3: "#B0E4CC",       // mint — subtle borders, success, highlights
        },
        crit: "#B23A3A",      // CRÍTICO — muted red on cream
        alto: "#D87A2C",      // ALTO — burnt orange
        medio: "#C49A2C",     // MEDIO — ochre
        bajo: "#7A8A7E",      // BAJO — slate sage
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      letterSpacing: {
        widish: "0.04em",
        wide2: "0.08em",
      },
      boxShadow: {
        edge: "inset 0 0 0 1px rgba(9,20,19,0.06)",
        edgeStrong: "inset 0 0 0 1px rgba(9,20,19,0.12)",
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
