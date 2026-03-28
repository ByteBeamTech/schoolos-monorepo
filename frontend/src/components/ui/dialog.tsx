"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogContextValue { open: boolean; setOpen: (v: boolean) => void; }
const DialogContext = React.createContext<DialogContextValue>({ open: false, setOpen: () => {} });

interface DialogProps { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode; }
function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = React.useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open! : internal;
  const setOpen = (v: boolean) => { if (!controlled) setInternal(v); onOpenChange?.(v); };
  return <DialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</DialogContext.Provider>;
}
function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setOpen } = React.useContext(DialogContext);
  if (asChild && React.isValidElement(children)) return React.cloneElement(children as any, { onClick: () => setOpen(true) });
  return <span onClick={() => setOpen(true)}>{children}</span>;
}
function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = React.useContext(DialogContext);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={cn("relative z-50 bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto", className)}>
        <button onClick={() => setOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>
        {children}
      </div>
    </div>
  );
}
function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("px-6 pt-6 pb-4", className)}>{children}</div>; }
function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) { return <h2 className={cn("text-lg font-semibold text-slate-900", className)}>{children}</h2>; }
function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) { return <p className={cn("text-sm text-slate-500 mt-1", className)}>{children}</p>; }
function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("px-6 pb-6 pt-4 flex justify-end gap-3", className)}>{children}</div>; }
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
