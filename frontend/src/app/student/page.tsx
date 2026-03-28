"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, Clock, FileText, Bell, User, LogOut, GraduationCap } from "lucide-react";

export default function StudentPortal() {
  const router = useRouter();
  useEffect(() => { if (!localStorage.getItem("accessToken")) router.push("/login"); }, [router]);
  const logout = () => { localStorage.clear(); router.push("/login"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-emerald-600">Student Portal</h1><p className="text-sm text-slate-500">Welcome back, Student!</p></div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Bell className="w-5 h-5"/></button>
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><User className="w-5 h-5"/></button>
            <button onClick={logout} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><LogOut className="w-4 h-4"/>Logout</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[["95%","Attendance","text-emerald-600"],["A+","Current Grade","text-blue-600"],["3","Pending Tasks","text-yellow-600"],["12","Days to Exam","text-purple-600"]].map(([v,l,c])=>(
            <Card key={l}><CardContent className="p-4 text-center"><p className={`text-3xl font-bold ${c}`}>{v}</p><p className="text-sm text-slate-500">{l}</p></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[
            { label:"Timetable", desc:"View class schedule", icon:<Clock className="w-8 h-8 text-blue-600"/>, bg:"bg-blue-100" },
            { label:"Homework", desc:"Pending assignments", icon:<BookOpen className="w-8 h-8 text-green-600"/>, bg:"bg-green-100" },
            { label:"Exams", desc:"Schedule & results", icon:<FileText className="w-8 h-8 text-yellow-600"/>, bg:"bg-yellow-100" },
            { label:"Library", desc:"Books & resources", icon:<GraduationCap className="w-8 h-8 text-purple-600"/>, bg:"bg-purple-100" },
          ].map(({ label, desc, icon, bg }) => (
            <Card key={label} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className={`w-16 h-16 ${bg} rounded-full flex items-center justify-center mb-4`}>{icon}</div>
                <h3 className="font-semibold text-lg">{label}</h3>
                <p className="text-sm text-slate-500 mt-1">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mb-8">
          <CardHeader><CardTitle>Today's Classes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[["M","Mathematics","Room 101","8:00-9:00","Completed","bg-slate-50","text-slate-400"],["S","Science","Lab 2","9:00-10:00","Ongoing","bg-blue-50 border-l-4 border-blue-500","text-blue-600"],["E","English","Room 105","10:30-11:30","Upcoming","bg-slate-50","text-slate-400"]].map(([abbr,subj,room,time,status,rowBg,statusColor])=>(
                <div key={subj} className={`flex items-center justify-between p-3 rounded-lg ${rowBg}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><span className="font-semibold text-blue-600">{abbr}</span></div>
                    <div><p className="font-medium">{subj}</p><p className="text-sm text-slate-500">{room}</p></div>
                  </div>
                  <div className="text-right"><p className="font-medium">{time}</p><p className={`text-sm ${statusColor}`}>{status}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Announcements</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-2 mb-2"><Bell className="w-4 h-4 text-yellow-600"/><span className="text-sm font-medium text-yellow-600">Important</span></div>
                <h4 className="font-semibold">Mid-term Exams Schedule Released</h4>
                <p className="text-sm text-slate-500 mt-1">Check your exam timetable in the Exams section.</p>
                <p className="text-xs text-slate-400 mt-2">2 hours ago</p>
              </div>
              <div className="p-4 border border-slate-100 rounded-lg">
                <h4 className="font-semibold">Sports Day Registration Open</h4>
                <p className="text-sm text-slate-500 mt-1">Register for events by this Friday.</p>
                <p className="text-xs text-slate-400 mt-2">1 day ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
