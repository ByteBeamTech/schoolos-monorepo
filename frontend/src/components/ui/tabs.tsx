"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue { value: string; onValueChange: (v: string) => void; }
const TabsContext = React.createContext<TabsContextValue>({ value: "", onValueChange: () => {} });

interface TabsProps { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; children: React.ReactNode; className?: string; }
function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const active = controlled ? value! : internal;
  const change = (v: string) => { if (!controlled) setInternal(v); onValueChange?.(v); };
  return <TabsContext.Provider value={{ value: active, onValueChange: change }}><div className={cn("w-full", className)}>{children}</div></TabsContext.Provider>;
}
function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("inline-flex h-9 items-center gap-1 rounded-lg bg-slate-100 p-1 text-slate-500", className)}>{children}</div>;
}
function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button onClick={() => ctx.onValueChange(value)} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all", active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900", className)}>
      {children}
    </button>
  );
}
function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
