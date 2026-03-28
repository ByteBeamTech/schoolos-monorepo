interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  description?: string;   // alias for subtitle (used by newer pages)
  icon?:        React.ReactNode;
  action?:      React.ReactNode;
}

export function PageHeader({ title, subtitle, description, icon, action }: PageHeaderProps) {
  const sub = subtitle ?? description;
  return (
    <div className="flex items-start justify-between mb-8">
      <div className="flex items-center gap-3">
        {icon && <div className="text-slate-400">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
