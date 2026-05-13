/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F9F8F6",
          100: "#F2F0EB",
          200: "#E5E5E5",
          500: "#555555",
          900: "#111111",
        },
        night: {
          900: "#0F1014",
          800: "#16181D",
          700: "#262933",
          400: "#999BA3",
          100: "#F5F5F7",
        },
        accent: {
          DEFAULT: "#0047FF",
          hover: "#003BCC",
          dark: "#3366FF",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      borderRadius: { lg: "4px", md: "3px", sm: "2px" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
