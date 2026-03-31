"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, User, CreditCard } from "lucide-react";
import { useApi } from "@/lib/hooks";

export default function StudentDrawerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: student, loading } = useApi<any>(`/students/${id}`);
  
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => router.back()} />
      <aside className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 p-6 animate-slide-in-right">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">Student Profile</h2>
          <button onClick={() => router.back()}><X /></button>
        </div>
        {loading ? <p>Loading...</p> : <div><p className="text-lg font-medium">{student?.firstName} {student?.lastName}</p></div>}
      </aside>
    </>
  );
}
