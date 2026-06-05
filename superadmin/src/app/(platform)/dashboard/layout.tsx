import React from "react";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {children}
      
      {/* Global Toast Listener Node injected perfectly lala */}
      <Toaster />
    </div>
  );
}
