// ─────────────────────────────────────────────────────────────────────────────
// theme-provider.tsx — place in src/components/theme-provider.tsx
// Manages dark/light mode via localStorage + .dark class on <html>
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContext {
  theme:     Theme;
  resolved:  "light" | "dark";
  setTheme:  (t: Theme) => void;
  toggle:    () => void;
}

const Ctx = createContext<ThemeContext>({
  theme: "light", resolved: "light",
  setTheme: () => {}, toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,    setThemeState] = useState<Theme>("light");
  const [resolved, setResolved]   = useState<"light" | "dark">("light");

  // On mount: read saved preference
  useEffect(() => {
    const saved = (localStorage.getItem("schoolos-theme") as Theme) || "light";
    setThemeState(saved);
  }, []);

  // Apply .dark class whenever theme or system preference changes
  useEffect(() => {
    const applyTheme = (t: Theme) => {
      let dark = false;
      if (t === "dark")   dark = true;
      if (t === "system") dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
      setResolved(dark ? "dark" : "light");
    };
    applyTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("schoolos-theme", t);
  };

  const toggle = () => setTheme(resolved === "dark" ? "light" : "dark");

  return (
    <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

// ─────────────────────────────────────────────────────────────────────────────
// ALSO: Update src/app/layout.tsx to include ThemeProvider + Geist font
// ─────────────────────────────────────────────────────────────────────────────
// Replace src/app/layout.tsx with this:
/*
import "./globals.css";
import { Providers }     from "./providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster }       from "sonner";

export const metadata = {
  title: "SchoolOS — School Management Platform",
  description: "Complete school ERP system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: "Geist, Inter, sans-serif" },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
*/
