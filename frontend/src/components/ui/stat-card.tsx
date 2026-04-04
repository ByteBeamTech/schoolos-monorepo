"use client";

interface StatCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  icon?:    React.ReactNode;
  color?:   "blue" | "green" | "amber" | "red" | "purple" | "slate";
  loading?: boolean;
}

const colorMap = {
  blue:   { icon: "bg-blue-600",   text: "text-blue-600"   },
  green:  { icon: "bg-green-600",  text: "text-green-600"  },
  amber:  { icon: "bg-amber-500",  text: "text-amber-600"  },
  red:    { icon: "bg-red-600",    text: "text-red-600"    },
  purple: { icon: "bg-purple-600", text: "text-purple-600" },
  slate:  { icon: "bg-slate-600",  text: "text-slate-600"  },
};

export function StatCard({ label, value, sub, icon, color = "blue", loading }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", padding: "20px" }} className="flex items-start gap-4 transition-shadow hover:shadow-md">
      {icon && (
        <div className={`${c.icon} text-white rounded-lg p-2.5 flex-shrink-0`}>
          <div className="w-5 h-5">{icon}</div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)" }}>{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-slate-100 rounded animate-pulse mt-1" />
        ) : (
          <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{value}</p>
        )}
        {sub && <p className={`text-xs ${c.text} mt-0.5 font-medium`}>{sub}</p>}
      </div>
    </div>
  );
}
