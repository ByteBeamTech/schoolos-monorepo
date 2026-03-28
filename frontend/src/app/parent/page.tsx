"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, CreditCard, Bell, User, LogOut } from "lucide-react";

export default function ParentPortal() {
  const router = useRouter();
  useEffect(() => { if (!localStorage.getItem("accessToken")) router.push("/login"); }, [router]);
  const logout = () => { localStorage.clear(); router.push("/login"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-indigo-600">Parent Portal</h1><p className="text-sm text-slate-500">Welcome back!</p></div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><Bell className="w-5 h-5"/></button>
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><User className="w-5 h-5"/></button>
            <button onClick={logout} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><LogOut className="w-4 h-4"/>Logout</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[
            { label:"Attendance", desc:"View child's attendance", icon:<Calendar className="w-8 h-8 text-green-600"/>, bg:"bg-green-100" },
            { label:"Academics", desc:"Grades & Report Cards", icon:<BookOpen className="w-8 h-8 text-blue-600"/>, bg:"bg-blue-100" },
            { label:"Fee Payment", desc:"Pay fees & view receipts", icon:<CreditCard className="w-8 h-8 text-yellow-600"/>, bg:"bg-yellow-100" },
            { label:"Notices", desc:"School announcements", icon:<Bell className="w-8 h-8 text-purple-600"/>, bg:"bg-purple-100" },
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
          <CardHeader><CardTitle>My Children</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border border-slate-100 rounded-lg">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-indigo-600"/></div>
              <div><h4 className="font-semibold">Child Name</h4><p className="text-sm text-slate-500">Class X-A • Roll No: 25</p></div>
            </div>
            <p className="text-sm text-slate-400 mt-4">Select a child to view their details, attendance, and academic performance.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[["bg-green-500","Fee payment received","2 days ago"],["bg-blue-500","New homework assigned","3 days ago"],["bg-yellow-500","PTM scheduled","1 week ago"]].map(([dot,text,time])=>(
                <div key={text} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className={`w-2 h-2 ${dot} rounded-full`}/>
                  <div><p className="text-sm font-medium">{text}</p><p className="text-xs text-slate-400">{time}</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
