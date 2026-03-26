import type { Metadata } from "next";
import "./globals.css";
import { TrpcProvider } from "@/lib/trpc/provider";

export const metadata: Metadata = {
  title: "SchoolOS Platform",
  description: "SchoolOS SaaS Management Console",
};

// BUG 3 FIX: TrpcProvider was missing from the component tree entirely.
// Any page that calls a trpc.* hook throws at render time because the
// tRPC + React Query context does not exist, producing a blank white page.
// TrpcProvider wraps the entire app here so all routes have access to it.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}

