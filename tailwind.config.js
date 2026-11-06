/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Kantumruy Pro'",
          "'Noto Sans Khmer'",
          "'Khmer OS Battambang'",
          "'Khmer OS'",
          "'Leelawadee UI'",
          "'Inter'",
          "system-ui",
          "sans-serif",
        ],
        khmer: [
          "'Kantumruy Pro'",
          "'Noto Sans Khmer'",
          "'Khmer OS Battambang'",
          "'Khmer OS'",
          "'Leelawadee UI'",
          "sans-serif",
        ],
        mono: ["'Inter'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dae6ff",
          200: "#bcd2ff",
          300: "#8eb4ff",
          400: "#598bff",
          500: "#3462f5",
          600: "#2143e3",
          700: "#1c35c4",
          800: "#1c2f9f",
          900: "#1d2d7e",
          950: "#151d4d",
        },
        ink: {
          50: "#f6f7fb",
          100: "#eceef6",
          200: "#d7dbea",
          300: "#b3bbd4",
          400: "#8993b6",
          500: "#6a7499",
          600: "#545d7e",
          700: "#444c67",
          800: "#3a4157",
          900: "#252a3b",
          950: "#151826",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.14)",
        pop: "0 24px 64px -24px rgba(15,23,42,.35)",
      },
      borderRadius: { xl2: "1rem" },
      animation: {
        "fade-in": "fadeIn .25s ease-out both",
        "slide-up": "slideUp .3s cubic-bezier(.16,1,.3,1) both",
        "slide-in": "slideIn .25s cubic-bezier(.16,1,.3,1) both",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
