"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, Calendar, User, Tag, MessageCircle,
  Activity, ClipboardCheck, PlusCircle, CheckCircle2, Clock,
} from "lucide-react";
import {
  useLead, useFollowUpsForLead, useInteractionsForLead, useCrmActions,
} from "@/lib/hooks";
import { LeadStatusBadge, LEAD_STATUS_LABELS } from "@/components/crm/LeadStatusBadge";
import { FollowUpModal } from "@/components/crm/FollowUpModal";
import { LogInteractionForm } from "@/components/crm/LogInteractionForm";
import { useToast } from "@/lib/use-toast";
import type { LeadStatus, FollowUpStatus } from "@/lib/api";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { data: lead, refetch: refetchLead, loading } = useLead(id);
  const { data: followUps, refetch: refetchFups } = useFollowUpsForLead(id);
  const { data: interactions, refetch: refetchLogs } = useInteractionsForLead(id);
  const { changeLeadStatus, updateFollowUp } = useCrmActions();
  const { toast } = useToast();
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [tab, setTab] = useState<"timeline" | "followups" | "interactions">("timeline");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (loading) return <div className="p-6 text-zinc-400">Loading...</div>;
  if (!lead) return <div className="p-6 text-red-500">Lead not found.</div>;

  const changeStatus = async (status: LeadStatus) => {
    setUpdatingStatus(true);
    try {
      await changeLeadStatus(lead.id, { status });
      toast({ title: `Status updated to ${LEAD_STATUS_LABELS[status]}` });
      refetchLead();
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e?.response?.data?.message, variant: "destructive" });
    } finally { setUpdatingStatus(false); }
  };

  const completeFollowUp = async (fid: string) => {
    await updateFollowUp(fid, { status: "COMPLETED" as FollowUpStatus });
    refetchFups();
  };

  // Combined timeline
  const timeline = [
    ...(interactions ?? []).map((i) => ({ kind: "interaction" as const, at: i.interactedAt, payload: i })),
    ...(followUps ?? []).map((f) => ({ kind: "followup" as const, at: f.createdAt, payload: f })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <header className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold truncate">{lead.parentName}</h1>
              <LeadStatusBadge status={lead.status} />
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300">{lead.temperature}</span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {lead.studentName ? `Student: ${lead.studentName} • ` : ""}Grade {lead.gradeInterestedIn} • Enrol {lead.expectedEnrollYear}
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              <a href={`tel:${lead.parentPhone}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="w-3.5 h-3.5" /> {lead.parentPhone}
              </a>
              {lead.parentEmail && (
                <a href={`mailto:${lead.parentEmail}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {lead.parentEmail}
                </a>
              )}
              {lead.source?.name && (
                <span className="inline-flex items-center gap-1 text-zinc-500"><Tag className="w-3.5 h-3.5" /> {lead.source.name}</span>
              )}
              {lead.assignedTo && (
                <span className="inline-flex items-center gap-1 text-zinc-500"><User className="w-3.5 h-3.5" /> {lead.assignedTo.firstName ?? lead.assignedTo.email}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 min-w-[230px]">
            <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Change status</label>
            <select
              disabled={updatingStatus}
              value={lead.status}
              onChange={(e) => changeStatus(e.target.value as LeadStatus)}
              className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={() => setShowFollowUp(true)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
            >
              <PlusCircle className="w-4 h-4" /> Schedule follow-up
            </button>
            {lead.applicationId ? (
              <Link
                href={`/dashboard/admissions/${lead.applicationId}`}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                View application
              </Link>
            ) : (
              <button
                disabled
                title="Conversion to application will be enabled in Phase 2"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-400 cursor-not-allowed"
              >
                Convert to application (Phase 2)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Quick log + tabs */}
      <LogInteractionForm leadId={lead.id} onLogged={() => { refetchLogs(); refetchLead(); }} />

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")} icon={<Activity className="w-4 h-4" />}>Timeline</TabButton>
        <TabButton active={tab === "followups"} onClick={() => setTab("followups")} icon={<ClipboardCheck className="w-4 h-4" />}>Follow-ups ({followUps?.length ?? 0})</TabButton>
        <TabButton active={tab === "interactions"} onClick={() => setTab("interactions")} icon={<MessageCircle className="w-4 h-4" />}>Interactions ({interactions?.length ?? 0})</TabButton>
      </div>

      {tab === "timeline" && (
        <div className="space-y-3">
          {timeline.length === 0 && <p className="text-sm text-zinc-400">No activity yet — log a call or schedule a follow-up.</p>}
          {timeline.map((e, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-8 flex-shrink-0 pt-1">
                {e.kind === "interaction" ? (
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                ) : (
                  <ClipboardCheck className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    {e.kind === "interaction"
                      ? `${(e.payload as any).type} · ${(e.payload as any).direction}`
                      : `Follow-up: ${(e.payload as any).status}`}
                  </span>
                  <span>{new Date(e.at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-sm">
                  {e.kind === "interaction"
                    ? (e.payload as any).summary
                    : (e.payload as any).title}
                </div>
                {e.kind === "followup" && (e.payload as any).description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{(e.payload as any).description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "followups" && (
        <ul className="space-y-2">
          {(followUps ?? []).length === 0 && <p className="text-sm text-zinc-400">No follow-ups yet.</p>}
          {(followUps ?? []).map((f) => (
            <li key={f.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-medium ${f.status === "COMPLETED" ? "line-through text-zinc-400" : ""}`}>{f.title}</span>
                  <span className="text-xs text-zinc-400">· due {new Date(f.dueDate).toLocaleString()}</span>
                </div>
                {f.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{f.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  f.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : f.status === "CANCELLED" ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                }`}>
                  {f.status === "COMPLETED" ? <CheckCircle2 className="w-3 h-3 inline -mt-0.5 mr-1" /> : <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />}
                  {f.status}
                </span>
                {f.status !== "COMPLETED" && (
                  <button onClick={() => completeFollowUp(f.id)} className="text-xs underline text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Complete</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "interactions" && (
        <ul className="space-y-2">
          {(interactions ?? []).length === 0 && <p className="text-sm text-zinc-400">No interactions logged yet.</p>}
          {(interactions ?? []).map((i) => (
            <li key={i.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{i.type} · {i.direction}</span>
                <span>{new Date(i.interactedAt).toLocaleString()}</span>
              </div>
              <p className="text-sm mt-1">{i.summary}</p>
              {i.handledBy && <p className="text-xs text-zinc-400 mt-1">by {i.handledBy.firstName ?? i.handledBy.email}</p>}
            </li>
          ))}
        </ul>
      )}

      {showFollowUp && (
        <FollowUpModal
          leadId={lead.id}
          onClose={() => setShowFollowUp(false)}
          onCreated={() => { refetchFups(); refetchLead(); }}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px ${
        active
          ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      }`}
    >
      {icon}{children}
    </button>
  );
}
