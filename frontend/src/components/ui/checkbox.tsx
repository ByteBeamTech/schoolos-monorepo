import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, disabled, id }, ref) => (
    <button ref={ref} type="button" role="checkbox" id={id} aria-checked={checked} disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn("h-4 w-4 rounded border border-slate-300 flex items-center justify-center transition-colors flex-shrink-0", checked ? "bg-blue-600 border-blue-600" : "bg-white hover:border-slate-400", disabled && "opacity-50 cursor-not-allowed", className)}>
      {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
    </button>
  )
);
Checkbox.displayName = "Checkbox";
export { Checkbox };
