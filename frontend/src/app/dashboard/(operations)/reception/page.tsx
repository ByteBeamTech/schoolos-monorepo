"use client";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi, useStaff } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { MessageSquare, UserCheck, Users, Plus, Printer, CheckCircle, Clock } from "lucide-react";
import { useToast } from '@/lib/use-toast';


const COMPLAINT_CATEGORIES = ["ACADEMIC","DISCIPLINE","FACILITY","TRANSPORT","BILLING","STAFF_BEHAVIOR","SAFETY","FOOD","OTHER"];
const COMPLAINANT_TYPES = ["PARENT","STUDENT","STAFF","VISITOR","OTHER"];
const VISIT_PURPOSES = ["MEETING","DELIVERY","INTERVIEW","PARENT_MEETING","INSPECTION","VENDOR","MAINTENANCE","OTHER"];
const PRIORITY_COLORS: Record<string, string> = { LOW:"bg-gray-100 text-gray-800", MEDIUM:"bg-yellow-100 text-yellow-800", HIGH:"bg-orange-100 text-orange-800", URGENT:"bg-red-100 text-red-800" };
const STATUS_COLORS: Record<string, string> = { OPEN:"bg-blue-100 text-blue-800", IN_PROGRESS:"bg-yellow-100 text-yellow-800", RESOLVED:"bg-green-100 text-green-800", CLOSED:"bg-gray-100 text-gray-800", CHECKED_IN:"bg-green-100 text-green-800", CHECKED_OUT:"bg-gray-100 text-gray-800" };

export default function ReceptionPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("visitors");
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: complaints, loading: loadingComplaints, refetch: refetchComplaints } = useApi<any[]>("/reception/complaints", []);
  const { data: visitors, loading: loadingVisitors, refetch: refetchVisitors } = useApi<any[]>("/reception/visitors?status=CHECKED_IN", []);
  const { data: visitorStats } = useApi<any>("/reception/visitors/stats/today", []);
  const { data: staffList } = useStaff();
  const fallbackStaff = [
    { id: "staff-demo-1", employeeId: "EMP-101", designation: "Principal", department: "Administration", user: { firstName: "Anita", lastName: "Sharma", role: "PRINCIPAL" } },
    { id: "staff-demo-2", employeeId: "EMP-102", designation: "Receptionist", department: "Front Office", user: { firstName: "Rahul", lastName: "Verma", role: "RECEPTIONIST" } },
    { id: "staff-demo-3", employeeId: "EMP-103", designation: "HR Manager", department: "HR", user: { firstName: "Meera", lastName: "Patel", role: "HR_MANAGER" } },
    { id: "staff-demo-4", employeeId: "EMP-104", designation: "Teacher", department: "Mathematics", user: { firstName: "Karan", lastName: "Singh", role: "TEACHER" } },
  ];
  const staff = staffList && staffList.length > 0 ? staffList : fallbackStaff;
  const today = new Date().toISOString().split("T")[0];
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [staffAttendance, setStaffAttendance] = useState<Record<string, string>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const { data: attendanceRecords, refetch: refetchAttendance } = useApi<any[]>(`/reception/staff-attendance?fromDate=${attendanceDate}&toDate=${attendanceDate}`, [attendanceDate]);

  useEffect(() => {
    if (!staff.length) return;
    const nextStatus: Record<string, string> = {};
    staff.forEach((member: any) => {
      const match = (attendanceRecords ?? []).find((record: any) => record.staffId === member.id);
      nextStatus[member.id] = match?.status || "PRESENT";
    });
    setStaffAttendance(nextStatus);
    setAttendanceSaved(false);
  }, [attendanceDate, staff, attendanceRecords]);

  const attendanceSummary = useMemo(() => {
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    Object.values(staffAttendance).forEach((status) => {
      if (status in summary) summary[status as keyof typeof summary] += 1;
    });
    return summary;
  }, [staffAttendance]);

  const [cf, setCf] = useState({ complainantName:"", complainantPhone:"", complainantType:"PARENT", category:"OTHER", subject:"", description:"", priority:"MEDIUM" });
  const [vf, setVf] = useState({ visitorName:"", phone:"", email:"", company:"", purpose:"MEETING", personToMeet:"", department:"", idType:"", idNumber:"", vehicleNumber:"", remarks:"" });

  const submitComplaint = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiClient.post("/reception/complaints", cf); setShowComplaintForm(false); setCf({ complainantName:"", complainantPhone:"", complainantType:"PARENT", category:"OTHER", subject:"", description:"", priority:"MEDIUM" }); refetchComplaints(); }
    catch { toast.error("Failed to create complaint"); } finally { setSaving(false); }
  };

  const checkInVisitor = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiClient.post("/reception/visitors", vf); setShowVisitorForm(false); setVf({ visitorName:"", phone:"", email:"", company:"", purpose:"MEETING", personToMeet:"", department:"", idType:"", idNumber:"", vehicleNumber:"", remarks:"" }); refetchVisitors(); }
    catch { toast.error("Failed to check in visitor"); } finally { setSaving(false); }
  };

  const checkOut = async (id: string) => {
    try { await apiClient.post(`/reception/visitors/${id}/checkout`, {}); refetchVisitors(); }
    catch { toast.error("Failed to check out"); }
  };

  const printPass = async (id: string) => {
    try {
      const res = await apiClient.get(`/reception/visitors/${id}/pass`);
      const p = (res as any).data || res;
      const w = window.open("", "_blank");
      if (w) { w.document.write(`<html><head><title>Pass</title></head><body style="font-family:Arial;padding:20px"><div style="border:2px solid #333;padding:20px;width:300px"><h2>VISITOR PASS</h2><p><b>Pass #:</b> ${p.passNumber}</p><p><b>Name:</b> ${p.visitorName}</p><p><b>To Meet:</b> ${p.personToMeet}</p><p><b>Purpose:</b> ${p.purpose}</p><p><b>Check-in:</b> ${new Date(p.checkIn).toLocaleString()}</p></div><script>window.print();</script></body></html>`); }
    } catch { toast.error("Failed to get pass"); }
  };

  const resolveComplaint = async (id: string) => {
    const resolution = prompt("Enter resolution:");
    if (!resolution) return;
    try { await apiClient.post(`/reception/complaints/${id}/resolve`, { resolution }); refetchComplaints(); }
    catch { toast.error("Failed to resolve"); }
  };

  const markAllStaff = (status: string) => {
    const next: Record<string, string> = {};
    staff.forEach((member: any) => {
      next[member.id] = status;
    });
    setStaffAttendance(next);
  };

  const saveStaffAttendance = async () => {
    if (!staff.length) return;
    setAttendanceSaving(true);
    try {
      await apiClient.post("/reception/staff-attendance/bulk", {
        date: attendanceDate,
        records: staff.map((member: any) => ({
          staffId: member.id,
          date: attendanceDate,
          status: staffAttendance[member.id] || "PRESENT",
        })),
      });
      setAttendanceSaved(true);
      refetchAttendance();
      toast.success("Staff attendance saved successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to save staff attendance");
    } finally {
      setAttendanceSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reception & Front Office" subtitle="Manage visitors, complaints, and front desk" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:"Checked In", value: visitorStats?.checkedIn ?? 0, icon:<UserCheck className="w-6 h-6 text-green-600"/>, bg:"bg-green-100" },
          { label:"Checked Out", value: visitorStats?.checkedOut ?? 0, icon:<Clock className="w-6 h-6 text-gray-600"/>, bg:"bg-gray-100" },
          { label:"Today Total", value: visitorStats?.total ?? 0, icon:<Users className="w-6 h-6 text-blue-600"/>, bg:"bg-blue-100" },
          { label:"Open Complaints", value: (complaints as any[])?.filter(c=>c.status==="OPEN").length ?? 0, icon:<MessageSquare className="w-6 h-6 text-orange-600"/>, bg:"bg-orange-100" },
        ].map(({ label, value, icon, bg }) => (
          <Card key={label}><CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 ${bg} rounded-full`}>{icon}</div>
            <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
          <TabsTrigger value="attendance">Staff Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="visitors" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowVisitorForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4"/> Check In Visitor
            </Button>
          </div>
          {loadingVisitors ? <div className="text-center py-8 text-slate-400">Loading...</div>
          : !(visitors as any[])?.length ? <EmptyState title="No visitors checked in" message="Check in a visitor to see them here" />
          : <div className="grid gap-4">{(visitors as any[]).map((v:any) => (
            <Card key={v.id}><CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-semibold text-lg">{v.visitorName}</h3><span className="text-xs border border-slate-200 rounded px-2 py-0.5">{v.passNumber}</span></div>
                  <p className="text-sm text-slate-500">{v.phone}{v.company && ` • ${v.company}`}</p>
                  <p className="text-sm">To Meet: <span className="font-medium">{v.personToMeet}</span></p>
                  <p className="text-sm">Purpose: {v.purpose}</p>
                  <p className="text-xs text-slate-400 mt-1">Check-in: {new Date(v.checkIn).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[v.status]}`}>{v.status.replace("_"," ")}</span>
                  <div className="flex gap-2">
                    <button onClick={() => printPass(v.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><Printer className="w-3.5 h-3.5"/>Print Pass</button>
                    {v.status === "CHECKED_IN" && <button onClick={() => checkOut(v.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><CheckCircle className="w-3.5 h-3.5"/>Check Out</button>}
                  </div>
                </div>
              </div>
            </CardContent></Card>
          ))}</div>}
        </TabsContent>

        <TabsContent value="complaints" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowComplaintForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4"/> New Complaint
            </Button>
          </div>
          {loadingComplaints ? <div className="text-center py-8 text-slate-400">Loading...</div>
          : !(complaints as any[])?.length ? <EmptyState title="No complaints" message="Create a complaint to track issues" />
          : <div className="grid gap-4">{(complaints as any[]).map((c:any) => (
            <Card key={c.id}><CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-semibold">{c.subject}</h3><span className="text-xs border border-slate-200 rounded px-2 py-0.5">{c.ticketNumber}</span></div>
                  <p className="text-sm text-slate-500">{c.complainantName} ({c.complainantType})</p>
                  <p className="text-sm mt-1">{c.description?.substring(0,100)}...</p>
                  <p className="text-xs text-slate-400 mt-1">Category: {c.category} • {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[c.priority]}`}>{c.priority}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status.replace("_"," ")}</span>
                  {(c.status==="OPEN"||c.status==="IN_PROGRESS") && <button onClick={()=>resolveComplaint(c.id)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Resolve</button>}
                </div>
              </div>
            </CardContent></Card>
          ))}</div>}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total", value: staff.length, color: "bg-blue-100 text-blue-700" },
              { label: "Present", value: attendanceSummary.PRESENT, color: "bg-emerald-100 text-emerald-700" },
              { label: "Absent", value: attendanceSummary.ABSENT, color: "bg-red-100 text-red-700" },
              { label: "Late", value: attendanceSummary.LATE, color: "bg-amber-100 text-amber-700" },
              { label: "Leave", value: attendanceSummary.ON_LEAVE + attendanceSummary.HALF_DAY, color: "bg-purple-100 text-purple-700" },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                  <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${item.color}`}>{item.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Staff Attendance</CardTitle>
                <CardDescription>Record attendance for the selected day</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Date</span>
                  <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="w-auto min-w-[150px]" />
                </div>
                <div className="flex gap-2">
                  {['PRESENT', 'ABSENT', 'LATE'].map((status) => (
                    <button key={status} type="button" onClick={() => markAllStaff(status)} className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
                      Mark all {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-[1.5fr_1fr_2fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Staff</span>
                  <span>Department</span>
                  <span className="justify-self-end">Status</span>
                </div>
                {staff.map((member: any) => {
                  const name = `${member.user?.firstName ?? ""} ${member.user?.lastName ?? ""}`.trim() || member.name || `Staff ${member.employeeId}`;
                  const status = staffAttendance[member.id] || "PRESENT";
                  const statusColors: Record<string, string> = {
                    PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-200",
                    ABSENT: "bg-red-100 text-red-700 border-red-200",
                    LATE: "bg-amber-100 text-amber-700 border-amber-200",
                    HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
                    ON_LEAVE: "bg-purple-100 text-purple-700 border-purple-200",
                    HOLIDAY: "bg-slate-200 text-slate-700 border-slate-300",
                  };
                  return (
                    <div key={member.id} className="grid grid-cols-[1.5fr_1fr_2fr] items-center gap-3 border-t border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {(member.user?.firstName?.[0] ?? "S") + (member.user?.lastName?.[0] ?? "") || member.employeeId?.slice(0,2) || "ST"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                          <p className="text-xs text-slate-400">{member.employeeId || member.designation}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">{member.department || member.designation || "General"}</span>
                      <div className="justify-self-end flex flex-wrap gap-1.5">
                        {['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setStaffAttendance((prev) => ({ ...prev, [member.id]: option }))}
                            className={`rounded-full border px-2 py-1 text-[10px] font-medium transition-colors ${status === option ? statusColors[option] : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}
                          >
                            {option === 'HALF_DAY' ? 'HALF' : option === 'ON_LEAVE' ? 'LEAVE' : option}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {attendanceSaved && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Staff attendance saved for {attendanceDate}.
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" onClick={saveStaffAttendance} disabled={attendanceSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {attendanceSaving ? "Saving..." : "Save Attendance"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Complaint Dialog */}
      <Dialog open={showComplaintForm} onOpenChange={setShowComplaintForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Complaint</DialogTitle></DialogHeader>
          <form onSubmit={submitComplaint} className="space-y-4 px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name *</Label><Input value={cf.complainantName} onChange={e=>setCf(p=>({...p,complainantName:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone</Label><Input value={cf.complainantPhone} onChange={e=>setCf(p=>({...p,complainantPhone:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</Label>
                <Select value={cf.complainantType} onValueChange={v=>setCf(p=>({...p,complainantType:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPLAINANT_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</Label>
                <Select value={cf.category} onValueChange={v=>setCf(p=>({...p,category:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPLAINT_CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject *</Label><Input value={cf.subject} onChange={e=>setCf(p=>({...p,subject:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description *</Label><Textarea value={cf.description} onChange={e=>setCf(p=>({...p,description:e.target.value}))} required rows={3} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Priority</Label>
              <Select value={cf.priority} onValueChange={v=>setCf(p=>({...p,priority:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={()=>setShowComplaintForm(false)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving?"Saving...":"Submit"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Visitor Dialog */}
      <Dialog open={showVisitorForm} onOpenChange={setShowVisitorForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Visitor Check-in</DialogTitle></DialogHeader>
          <form onSubmit={checkInVisitor} className="space-y-4 px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name *</Label><Input value={vf.visitorName} onChange={e=>setVf(p=>({...p,visitorName:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone *</Label><Input value={vf.phone} onChange={e=>setVf(p=>({...p,phone:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Company</Label><Input value={vf.company} onChange={e=>setVf(p=>({...p,company:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Purpose</Label>
                <Select value={vf.purpose} onValueChange={v=>setVf(p=>({...p,purpose:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISIT_PURPOSES.map(p=><SelectItem key={p} value={p}>{p.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Person to Meet *</Label><Input value={vf.personToMeet} onChange={e=>setVf(p=>({...p,personToMeet:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Department</Label><Input value={vf.department} onChange={e=>setVf(p=>({...p,department:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">ID Type</Label><Input value={vf.idType} onChange={e=>setVf(p=>({...p,idType:e.target.value}))} placeholder="Aadhar, DL..." className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">ID Number</Label><Input value={vf.idNumber} onChange={e=>setVf(p=>({...p,idNumber:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            </div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Vehicle Number</Label><Input value={vf.vehicleNumber} onChange={e=>setVf(p=>({...p,vehicleNumber:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={()=>setShowVisitorForm(false)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving?"Checking in...":"Check In"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
