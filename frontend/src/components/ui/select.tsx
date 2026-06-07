"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectContextValue { value: string; onValueChange: (v: string) => void; open: boolean; setOpen: (v: boolean) => void; }
const SelectContext = React.createContext<SelectContextValue>({ value: "", onValueChange: () => {}, open: false, setOpen: () => {} });

interface SelectProps { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; children: React.ReactNode; disabled?: boolean; }
function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const controlled = value !== undefined;
  const active = controlled ? value! : internal;
  const change = (v: string) => { if (!controlled) setInternal(v); onValueChange?.(v); setOpen(false); };
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return <SelectContext.Provider value={{ value: active, onValueChange: change, open, setOpen }}><div ref={ref} className="relative">{children}</div></SelectContext.Provider>;
}
function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button type="button" onClick={() => setOpen(!open)} className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring", className)}>
      {children}<ChevronDown className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform", open && "rotate-180")} />
    </button>
  );
}
function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span className={cn(!value && "text-muted-foreground")}>{value || placeholder}</span>;
}
function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return <div className={cn("absolute z-50 top-full mt-1 left-0 right-0 bg-background border border-input rounded-lg shadow-lg max-h-60 overflow-y-auto", className)}>{children}</div>;
}
function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext);
  return <div onClick={() => ctx.onValueChange(value)} className={cn("px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
  ctx.value === value &&
    "bg-accent text-accent-foreground font-medium", className)}>{children}</div>;
}
function SelectGroup({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function SelectLabel({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide", className)}>{children}</div>; }
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel };
