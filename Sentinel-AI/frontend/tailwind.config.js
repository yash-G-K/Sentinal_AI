/** @type {import("tailwindcss").Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background:  "var(--bg)",
        foreground:  "var(--fg)",
        card:        "var(--card)",
        sidebar:     "var(--sidebar)",
        border:      "var(--border)",
        primary:     { DEFAULT: "var(--primary)", foreground: "var(--primary-fg)" },
        muted:       { DEFAULT: "var(--muted)",   foreground: "var(--muted-fg)" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
