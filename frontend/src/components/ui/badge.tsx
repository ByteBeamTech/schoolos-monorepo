import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "secondary" | "purple";

const variants: Record<BadgeVariant, string> = {
  success:   "bg-green-100  text-green-700  border-green-200",
  warning:   "bg-amber-100  text-amber-700  border-amber-200",
  error:     "bg-red-100    text-red-700    border-red-200",
  info:      "bg-blue-100   text-blue-700   border-blue-200",
  neutral:   "bg-slate-100  text-slate-600  border-slate-200",
  secondary: "bg-slate-100  text-slate-600  border-slate-200",
  purple:    "bg-purple-100 text-purple-700 border-purple-200",
};

interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, children, variant = "neutral", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      variants[variant],
      className
    )}>
      {label ?? children}
    </span>
  );
}
