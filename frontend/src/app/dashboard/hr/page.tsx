"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useApi } from "@/lib/hooks";
import { apiClient } from "@/lib/api";
import { UserPlus, Calendar, CheckCircle, XCircle, Settings } from "lucide-react";

const LEAVE_TYPES = ["CASUAL","SICK","EARNED","MATERNITY","PATERNITY","UNPAID","COMPENSATORY"];
const STATUS_COLORS: Record<string,string> = { PENDING:"bg-yellow-100 text-yellow-800", IN_REVIEW:"bg-blue-100 text-blue-800", APPROVED:"bg-green-100 text-green-800", REJECTED:"bg-red-100 text-red-800", ONBOARDED:"bg-purple-100 text-purple-800" };

export default function HRPage() {
  const [activeTab, setActiveTab] = useState("joining");
  const [showJoiningForm, setShowJoiningForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: joiningRequests, loading: loadingJoining, refetch: refetchJoining } = useApi<any[]>("/hr/joining", []);
  const { data: leaveRequests, loading: loadingLeave, refetch: refetchLeave } = useApi<any[]>("/hr/leave", []);

  const [jf, setJf] = useState({ candidateName:"", email:"", phone:"", position:"", department:"", proposedSalary:"", notes:"" });
  const [lf, setLf] = useState({ leaveType:"CASUAL", fromDate:"", toDate:"", reason:"" });
  const [wf, setWf] = useState({ workflowType:"joining", levels:[{ level:1, role:"PRINCIPAL" }] });

  const submitJoining = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiClient.post("/hr/joining", { ...jf, proposedSalary: jf.proposedSalary ? parseFloat(jf.proposedSalary) : undefined }); setShowJoiningForm(false); setJf({ candidateName:"", email:"", phone:"", position:"", department:"", proposedSalary:"", notes:"" }); refetchJoining(); }
    catch { alert("Failed to create joining request"); } finally { setSaving(false); }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await apiClient.post("/hr/leave/apply", lf); setShowLeaveForm(false); setLf({ leaveType:"CASUAL", fromDate:"", toDate:"", reason:"" }); refetchLeave(); }
    catch { alert("Failed to apply for leave"); } finally { setSaving(false); }
  };

  const approve = async (type: "joining"|"leave", id: string) => {
    try { await apiClient.post(`/hr/${type === "joining" ? "joining" : "leave"}/${id}/approve`, {}); type === "joining" ? refetchJoining() : refetchLeave(); }
    catch { alert("Failed to approve"); }
  };

  const reject = async (type: "joining"|"leave", id: string) => {
    const reason = prompt("Enter rejection reason:"); if (!reason) return;
    try { await apiClient.post(`/hr/${type === "joining" ? "joining" : "leave"}/${id}/reject`, { reason }); type === "joining" ? refetchJoining() : refetchLeave(); }
    catch { alert("Failed to reject"); }
  };

  const saveWorkflow = async () => {
    try { await apiClient.post("/hr/workflow/configure", wf); setShowWorkflow(false); alert("Workflow configured!"); }
    catch { alert("Failed to save workflow"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="HR Management" subtitle="Staff joining, leave requests, and HR workflows"
        action={<button onClick={()=>setShowWorkflow(true)} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Settings className="w-4 h-4"/>Configure Workflow</button>} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="joining">Joining Requests</TabsTrigger>
          <TabsTrigger value="leave">Leave Management</TabsTrigger>
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="joining" className="space-y-4">
          <div className="flex justify-end"><button onClick={()=>setShowJoiningForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"><UserPlus className="w-4 h-4"/>New Joining Request</button></div>
          {loadingJoining ? <div className="text-center py-8 text-slate-400">Loading...</div>
          : !(joiningRequests as any[])?.length ? <EmptyState title="No joining requests" message="Create a new joining request to get started" />
          : <div className="grid gap-4">{(joiningRequests as any[]).map((req:any) => (
            <Card key={req.id}><CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{req.candidateName}</h3>
                  <p className="text-sm text-slate-500">{req.position} • {req.department || "N/A"}</p>
                  <p className="text-sm">{req.email} • {req.phone}</p>
                  {req.proposedSalary && <p className="text-sm">Salary: ₹{req.proposedSalary.toLocaleString()}</p>}
                  <p className="text-xs text-slate-400 mt-1">Level {req.currentLevel}/{req.maxLevel} • {new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>{req.status}</span>
                  {(req.status==="PENDING"||req.status==="IN_REVIEW") && (
                    <div className="flex gap-2">
                      <button onClick={()=>approve("joining",req.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"><CheckCircle className="w-3.5 h-3.5"/>Approve</button>
                      <button onClick={()=>reject("joining",req.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><XCircle className="w-3.5 h-3.5"/>Reject</button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent></Card>
          ))}</div>}
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <div className="flex justify-end"><button onClick={()=>setShowLeaveForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"><Calendar className="w-4 h-4"/>Apply Leave</button></div>
          {loadingLeave ? <div className="text-center py-8 text-slate-400">Loading...</div>
          : !(leaveRequests as any[])?.length ? <EmptyState title="No leave requests" message="Apply for leave to see requests here" />
          : <div className="grid gap-4">{(leaveRequests as any[]).map((req:any) => (
            <Card key={req.id}><CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{req.leaveType} Leave</h3>
                  <p className="text-sm">{new Date(req.fromDate).toLocaleDateString()} — {new Date(req.toDate).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500">{req.totalDays} day(s) • {req.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[req.status]}`}>{req.status}</span>
                  {req.status==="PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={()=>approve("leave",req.id)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Approve</button>
                      <button onClick={()=>reject("leave",req.id)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent></Card>
          ))}</div>}
        </TabsContent>

        <TabsContent value="balances">
          <Card><CardHeader><CardTitle>Leave Balances</CardTitle><CardDescription>View and manage staff leave balances</CardDescription></CardHeader>
          <CardContent><p className="text-slate-500">Select a staff member to view their leave balance.</p></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Joining Dialog */}
      <Dialog open={showJoiningForm} onOpenChange={setShowJoiningForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Joining Request</DialogTitle></DialogHeader>
          <form onSubmit={submitJoining} className="space-y-4 px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              {[["Name *","candidateName",true,"text"],["Email *","email",true,"email"],["Phone *","phone",true,"text"],["Position *","position",true,"text"],["Department","department",false,"text"],["Proposed Salary","proposedSalary",false,"number"]].map(([l,k,req,t])=>(
                <div key={k as string}><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{l}</Label>
                <Input type={t as string} required={!!req} value={(jf as any)[k as string]} onChange={e=>setJf(p=>({...p,[k as string]:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              ))}
            </div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</Label><Textarea value={jf.notes} onChange={e=>setJf(p=>({...p,notes:e.target.value}))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={()=>setShowJoiningForm(false)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?"Saving...":"Submit"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <form onSubmit={submitLeave} className="space-y-4 px-6 pb-6">
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leave Type</Label>
              <Select value={lf.leaveType} onValueChange={v=>setLf(p=>({...p,leaveType:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From Date</Label><Input type="date" value={lf.fromDate} onChange={e=>setLf(p=>({...p,fromDate:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To Date</Label><Input type="date" value={lf.toDate} onChange={e=>setLf(p=>({...p,toDate:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            </div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason</Label><Textarea value={lf.reason} onChange={e=>setLf(p=>({...p,reason:e.target.value}))} required className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={()=>setShowLeaveForm(false)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving?"Applying...":"Apply"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Workflow Dialog */}
      <Dialog open={showWorkflow} onOpenChange={setShowWorkflow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Approval Workflow</DialogTitle></DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Workflow Type</Label>
              <Select value={wf.workflowType} onValueChange={v=>setWf(p=>({...p,workflowType:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="joining">Joining Approval</SelectItem><SelectItem value="leave">Leave Approval</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Approval Levels</Label>
              {wf.levels.map((lvl,idx)=>(
                <div key={idx} className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-slate-500 w-16">Level {lvl.level}:</span>
                  <Select value={lvl.role} onValueChange={v=>{ const nl=[...wf.levels]; nl[idx].role=v; setWf(p=>({...p,levels:nl})); }}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="HR_MANAGER">HR Manager</SelectItem><SelectItem value="PRINCIPAL">Principal</SelectItem><SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem></SelectContent>
                  </Select>
                </div>
              ))}
              <button type="button" onClick={()=>setWf(p=>({...p,levels:[...p.levels,{level:p.levels.length+1,role:"SCHOOL_ADMIN"}]}))} className="mt-2 px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">+ Add Level</button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={()=>setShowWorkflow(false)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg">Cancel</button>
              <button onClick={saveWorkflow} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
