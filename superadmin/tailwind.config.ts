import type { Config } from "tailwindcss";

// UI-0.5 Task 5: Design token layer — PREP ONLY, not yet applied anywhere.
//
// This is purely additive. Every existing page uses raw Tailwind utility
// classes directly (bg-slate-950, text-orange-400, etc.) — none of those
// class names are touched, overridden, or removed here. Adding new named
// colors under `extend.colors` only makes new utility classes available
// (bg-primary, text-danger, etc.) for future use in UI-0.6+; it cannot
// change how any existing page renders today, because no existing page
// references these new names.
//
// Values below aren't invented — they're read off what the app already
// uses by convention (per the UI Architecture Audit v1, §1: "no
// centralized theme/token layer... colors are hardcoded per-component").
// primary/background/surface/border/text/muted come from the slate-950 +
// orange-500 shell used in every mature page's layout; success/warning/
// danger come from components/ui/badge.tsx's existing variant colors, so
// a badge and a future token-based button will agree on what "danger"
// looks like instead of drifting the way referrals/page.tsx did with its
// unrelated light theme.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:    "#f97316", // orange-500 — brand accent, used for active nav state, primary buttons, logo mark
        secondary:  "#334155", // slate-700 — neutral secondary actions
        success:    "#10b981", // emerald-500 — matches badge.tsx's "success" variant family
        warning:    "#f59e0b", // amber-500  — matches badge.tsx's "warning" variant family
        danger:     "#ef4444", // red-500    — matches badge.tsx's "error" variant family
        surface:    "#0f172a", // slate-900 — card/panel background (the "bg-slate-900 rounded-xl border border-slate-800" pattern used throughout)
        background: "#020617", // slate-950 — page background
        border:     "#1e293b", // slate-800 — used everywhere as border-slate-800
        text:       "#f1f5f9", // slate-100 — primary body text color set on <body> in app/layout.tsx
        muted:      "#64748b", // slate-500 — secondary/muted text (subtitles, timestamps, helper text)
      },
      borderRadius: {
        DEFAULT: "0.75rem", // matches rounded-xl, the dominant radius across cards/panels/buttons today
      },
      spacing: {
        page: "2rem", // matches the p-8 used on <main>'s inner max-w-7xl wrapper in platform-layout.tsx
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.4)", // subtle dark-theme card shadow, for future card-style components
      },
    },
  },
  plugins: [],
} satisfies Config;

