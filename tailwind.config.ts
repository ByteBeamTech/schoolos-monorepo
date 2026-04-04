import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode via .dark class on <html> — toggled by ThemeProvider
  darkMode: ["class"],

  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      // ── Font family ──────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Geist Mono", "Fira Code", "monospace"],
      },

      // ── Colors that reference CSS variables (auto dark-mode aware) ───────
      colors: {
        brand: {
          DEFAULT: "var(--brand)",
          hover:   "var(--brand-hover)",
          light:   "var(--brand-light)",
          text:    "var(--brand-text)",
        },
        surface: {
          base:    "var(--bg-base)",
          DEFAULT: "var(--bg-surface)",
          raised:  "var(--bg-raised)",
          muted:   "var(--bg-muted)",
          accent:  "var(--bg-accent)",
        },
        content: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          accent:    "var(--text-accent)",
        },
        divider: {
          DEFAULT: "var(--border)",
          light:   "var(--border-light)",
        },
        // Semantic status colors
        status: {
          success: "#16a34a",
          warning: "#d97706",
          danger:  "#dc2626",
          info:    "#2563eb",
        },
        primary: {
          DEFAULT:    "#2563eb",
          foreground: "#ffffff",
          50:         "#eff6ff",
          100:        "#dbeafe",
          500:        "#3b82f6",
          600:        "#2563eb",
          700:        "#1d4ed8",
        },
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        sm:  "var(--radius-sm)",
        md:  "var(--radius-md)",
        lg:  "var(--radius-lg)",
        xl:  "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        DEFAULT: "var(--radius-md)",
      },

      // ── Box shadow ───────────────────────────────────────────────────────
      boxShadow: {
        sm:   "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md:   "var(--shadow-md)",
        lg:   "var(--shadow-lg)",
        brand: "0 4px 12px rgba(37,99,235,0.25)",
        inner: "inset 0 1px 2px rgba(0,0,0,0.08)",
      },

      // ── Animations ───────────────────────────────────────────────────────
      keyframes: {
        slideInRight: {
          from: { transform: "translateX(100%)", opacity: "0" },
          to:   { transform: "translateX(0)",    opacity: "1" },
        },
        slideInLeft: {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to:   { transform: "translateX(0)",     opacity: "1" },
        },
        slideInDown: {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400% 0" },
          "100%": { backgroundPosition:  "400% 0" },
        },
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to:   { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to:   { height: "0", opacity: "0" },
        },
      },
      animation: {
        "slide-in-right": "slideInRight 0.25s cubic-bezier(0.4,0,0.2,1) forwards",
        "slide-in-left":  "slideInLeft  0.25s cubic-bezier(0.4,0,0.2,1) forwards",
        "slide-in-down":  "slideInDown  0.2s  cubic-bezier(0.4,0,0.2,1) forwards",
        "fade-in":        "fadeIn       0.2s  cubic-bezier(0.4,0,0.2,1) forwards",
        "scale-in":       "scaleIn      0.15s cubic-bezier(0.4,0,0.2,1) forwards",
        "shimmer":        "shimmer      1.4s  ease infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up   0.2s ease-out",
      },

      // ── Spacing extras ───────────────────────────────────────────────────
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },

      // ── Screen breakpoints ───────────────────────────────────────────────
      screens: {
        xs: "480px",
      },

      // ── Typography scale ─────────────────────────────────────────────────
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.05em" }],
        "xs":  ["12px", { lineHeight: "16px" }],
        "sm":  ["13px", { lineHeight: "20px" }],
        "base":["14px", { lineHeight: "22px" }],
        "md":  ["15px", { lineHeight: "24px" }],
        "lg":  ["16px", { lineHeight: "24px" }],
        "xl":  ["18px", { lineHeight: "28px" }],
        "2xl": ["20px", { lineHeight: "28px" }],
        "3xl": ["24px", { lineHeight: "32px" }],
        "4xl": ["28px", { lineHeight: "36px" }],
      },
    },
  },

  plugins: [
    require("tailwindcss-animate"),
    // Custom plugin: scrollbar utilities
    function({ addUtilities }: { addUtilities: Function }) {
      addUtilities({
        ".scrollbar-none": {
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": { display: "none" },
        },
        ".scrollbar-thin": {
          "scrollbar-width": "thin",
          "scrollbar-color": "var(--border) transparent",
        },
      });
    },
  ],
};

export default config;
