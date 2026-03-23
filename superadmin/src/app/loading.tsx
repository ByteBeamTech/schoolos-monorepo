"use client";
import { useEffect, useState } from "react";

export default function Loading() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-300">
      <div className="relative flex items-center justify-center">
        <div className="w-20 h-20 border-4 border-orange-900/30 border-t-orange-500 rounded-full animate-spin" />
        <div className="absolute w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
          </svg>
        </div>
      </div>
      <div className="mt-6 text-center">
        <h2 className="text-2xl font-black tracking-tight text-white">
          Byte Beam <span className="text-orange-500">SchoolOS</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1 tracking-widest uppercase">Superadmin Panel</p>
      </div>
    </div>
  );
}
