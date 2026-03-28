export function EmptyState({ title, message, icon }: { title: string; message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-300 mb-4">{icon}</div>}
      <h3 className="text-slate-700 font-semibold text-lg">{title}</h3>
      <p className="text-slate-400 text-sm mt-1 max-w-xs">{message}</p>
    </div>
  );
}
