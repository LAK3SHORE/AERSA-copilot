/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FFF8E3",
          2: "#FFFDF5",
          3: "#D0DB97",
        },
        ink: {
          DEFAULT: "#333333",
          2: "rgba(51,51,51,0.68)",
          3: "rgba(51,51,51,0.48)",
          4: "rgba(51,51,51,0.38)",
          5: "rgba(51,51,51,0.28)",
        },
        accent: {
          DEFAULT: "#84AC37",
          2: "#869C4E",
          3: "rgba(132,172,55,0.07)",
        },
        crit: "#B83025",
        alto: "#C26020",
        medio: "#9C7E10",
        bajo: "#5E7B5A",
        stepper: "#333333",
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
