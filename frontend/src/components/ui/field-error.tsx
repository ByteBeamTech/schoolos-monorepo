import { AlertCircle } from "lucide-react";
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 mt-1.5"
      style={{ fontSize: 11, color: "var(--text-danger)" }}>
      <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
      {message}
    </p>
  );
}
