"use client";
import { useToast } from "./use-toast";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-6 right-6 z-100 flex flex-col gap-2 max-w-sm w-full pointer-events-none font-mono text-xs">
      {toasts.map(({ id, description, variant }) => (
        <div
          key={id}
          className={`p-4 rounded-xl font-bold shadow-2xl border flex items-center justify-between gap-3 pointer-events-auto animate-in slide-in-from-top-4 duration-300 ${
            variant === "destructive"
              ? "bg-red-950/90 border-red-500/30 text-red-400"
              : "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${variant === "destructive" ? "bg-red-400" : "bg-emerald-400"}`} />
            <span>{description}</span>
          </div>
          <button 
            onClick={() => dismiss(id)} 
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
