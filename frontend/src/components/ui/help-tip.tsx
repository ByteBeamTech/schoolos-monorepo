"use client";
import { useState, useRef, useEffect } from "react";
import { HelpCircle, X, BookOpen, Lightbulb, AlertCircle } from "lucide-react";

export interface HelpContent {
  title:    string;
  body:     string;
  tip?:     string;       // Pro tip shown in yellow
  warning?: string;       // Warning shown in red
  link?:    { label: string; href: string };
}

interface HelpTipProps {
  content: HelpContent;
  size?:   "sm" | "md";
  side?:   "top" | "bottom" | "left" | "right";
}

export function HelpTip({ content, size = "md", side = "bottom" }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const positionClass = {
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const btnSize  = size === "sm" ? "w-5 h-5"     : "w-6 h-6";

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`${btnSize} inline-flex items-center justify-center rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1`}
        aria-label="Help"
      >
        <HelpCircle className={iconSize} />
      </button>

      {open && (
        <div className={`absolute ${positionClass} z-[9999] w-72 bg-white rounded-xl border border-slate-200 shadow-xl`}>
          {/* Arrow */}
          <div className={`absolute w-3 h-3 bg-white border-slate-200 rotate-45 ${
            side === "bottom" ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t" :
            side === "top"    ? "-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b" :
            side === "right"  ? "-left-1.5 top-1/2 -translate-y-1/2 border-l border-b" :
                                "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t"
          }`} />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-semibold text-slate-900">{content.title}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">{content.body}</p>

            {content.tip && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">{content.tip}</p>
              </div>
            )}

            {content.warning && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700 leading-relaxed">{content.warning}</p>
              </div>
            )}

            {content.link && (
              <a href={content.link.href} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                {content.link.label} →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Convenience: Label + HelpTip together ────────────────────────────────────
interface FieldLabelProps {
  label:    string;
  help:     HelpContent;
  required?: boolean;
  size?:    "sm" | "md";
}

export function FieldLabel({ label, help, required, size = "sm" }: FieldLabelProps) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <HelpTip content={help} size={size} />
    </div>
  );
}

// ── Section header with help ─────────────────────────────────────────────────
interface SectionHelpProps {
  title: string;
  help:  HelpContent;
}

export function SectionHelp({ title, help }: SectionHelpProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <HelpTip content={help} size="md" side="right" />
    </div>
  );
}
