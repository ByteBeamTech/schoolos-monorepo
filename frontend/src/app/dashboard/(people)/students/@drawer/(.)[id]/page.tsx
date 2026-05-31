"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  X,
  User,
  Phone,
  Droplets,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  Bus,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { useApi } from "@/lib/hooks";

export default function StudentDrawerPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const { data: student, loading } = useApi<any>(`/students/${id}`);

  const { data: attendance } = useApi<any>(
    `/attendance/student/${id}?fromDate=${new Date(
      new Date().getFullYear(),
      0,
      1
    )
      .toISOString()
      .split("T")[0]}&toDate=${new Date()
      .toISOString()
      .split("T")[0]}`
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };

    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={() => router.back()}
      />

      <aside className="fixed top-0 right-0 h-full w-[550px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Student Snapshot</h2>

          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-6">Loading...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
                  {student?.firstName?.[0] ?? ""}
                  {student?.lastName?.[0] ?? ""}
                </div>

                <div>
                  <h3 className="text-xl font-bold">
                    {student?.firstName} {student?.lastName}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {student?.admissionNumber}
                  </p>

                  <div className="mt-2">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      {student?.status ?? "ENROLLED"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-4 h-4" />
                <h4 className="font-semibold">Academic Info</h4>
              </div>

              <div className="space-y-3 text-sm">
                <Row
                  label="Class"
                  value={student?.section?.class?.name ?? "-"}
                />
                <Row
                  label="Section"
                  value={student?.section?.name ?? "-"}
                />
                <Row
                  label="Roll Number"
                  value={student?.rollNumber ?? "-"}
                />
                <Row
                  label="Session"
                  value={student?.academicYear ?? "-"}
                />
              </div>
            </div>

            {/* Blood Group */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-4 h-4 text-red-500" />
                <h4 className="font-semibold">Medical</h4>
              </div>

              <Row
                label="Blood Group"
                value={student?.bloodGroup ?? "Not Set"}
              />
            </div>

            {/* Attendance */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-4 h-4" />
                <h4 className="font-semibold">Attendance</h4>
              </div>

              <div className="space-y-3 text-sm">
                <Row
                  label="Attendance %"
                  value={`${attendance?.summary?.percentage ?? 0}%`}
                />

                <Row
                  label="Present"
                  value={attendance?.summary?.present ?? 0}
                />

                <Row
                  label="Absent"
                  value={attendance?.summary?.absent ?? 0}
                />
              </div>
            </div>

            {/* Guardian */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4" />
                <h4 className="font-semibold">Guardian</h4>
              </div>

              <div className="space-y-3 text-sm">
                <Row
                  label="Name"
                  value={
                    student?.guardianLinks?.[0]?.guardian
                      ? `${student.guardianLinks[0].guardian.firstName} ${student.guardianLinks[0].guardian.lastName}`
                      : "Not Linked"
                  }
                />

                <Row
                  label="Phone"
                  value={
                    student?.guardianLinks?.[0]?.guardian?.phone ?? "-"
                  }
                />
              </div>
            </div>

            {/* Fees */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4" />
                <h4 className="font-semibold">Fees</h4>
              </div>

              <p className="text-sm text-slate-500">
                Fee module integration coming soon
              </p>
            </div>

            {/* Transport */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bus className="w-4 h-4" />
                <h4 className="font-semibold">Transport</h4>
              </div>

              <p className="text-sm text-slate-500">
                No transport assigned
              </p>
            </div>

            {/* Library */}
            <div className="border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4" />
                <h4 className="font-semibold">Library</h4>
              </div>

              <p className="text-sm text-slate-500">
                Library integration coming soon
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <Link
                href={`/dashboard/students/${id}`}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Full Profile
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
