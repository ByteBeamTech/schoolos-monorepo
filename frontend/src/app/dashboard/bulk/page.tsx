"use client";
/**
 * Bulk Import Wizard — /dashboard/bulk/page.tsx
 *
 * Step 1: Choose import type (Students / Staff / Fee Plans)
 * Step 2: Download template CSV
 * Step 3: Upload CSV → parse + preview with error highlighting
 * Step 4: Confirm → import → show results summary
 *
 * Also includes: Bulk Invoice Generation for a class
 */
import { useState, useCallback } from "react";
import {
  Upload, Download, CheckCircle, AlertTriangle,
  FileSpreadsheet, Users, CreditCard, ArrowRight, RotateCcw,
} from "lucide-react";
import { PageHeader }  from "@/components/ui/page-header";
import { Badge }       from "@/components/ui/badge";
import { useApi }      from "@/lib/hooks";
import { apiClient }   from "@/lib/api";
import { useToast }    from "@/lib/use-toast";

type ImportType = "students" | "staff";
type WizardStep = "choose" | "upload" | "preview" | "done";

interface ParsedRow {
  rowNum: number;
  data:   Record<string, string>;
  errors: string[];
}

const STUDENT_COLUMNS = [
  "firstName","lastName","admissionNumber","academicYear",
  "gender","dateOfBirth","sectionName","rollNumber",
  "guardianName","guardianPhone","guardianEmail",
];

const STAFF_COLUMNS = [
  "firstName","lastName","email","phone",
  "role","designation","department","joiningDate","employeeId",
];

function parseCSV(text: string, expectedCols: string[]): ParsedRow[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return [];

  const headerLine = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const dataLines  = lines.slice(1);

  return dataLines.map((line, i) => {
    const cells = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const data: Record<string, string> = {};
    const errors: string[] = [];

    headerLine.forEach((col, idx) => { data[col] = cells[idx] ?? ""; });

    // Validate required fields
    if (expectedCols.includes("firstName")       && !data.firstname && !data.firstName)       errors.push("firstName required");
    if (expectedCols.includes("admissionNumber")  && !data.admissionnumber && !data.admissionNumber) errors.push("admissionNumber required");
    if (expectedCols.includes("email")            && data.email && !data.email.includes("@")) errors.push("invalid email");

    return { rowNum: i + 2, data, errors };
  });
}

export default function BulkPage() {
  const { toast } = useToast();

  const [importType, setImportType] = useState<ImportType>("students");
  const [step,       setStep]       = useState<WizardStep>("choose");
  const [rows,       setRows]       = useState<ParsedRow[]>([]);
  const [fileName,   setFileName]   = useState("");
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [dragging,   setDragging]   = useState(false);

  // Bulk invoice state
  const { data: classes }   = useApi<any[]>("/academics/classes");
  const { data: feePlans }  = useApi<any[]>("/billing/fee-plans");
  const [invClassId,  setInvClassId]  = useState("");
  const [invPlanId,   setInvPlanId]   = useState("");
  const [invDueDate,  setInvDueDate]  = useState("");
  const [invRunning,  setInvRunning]  = useState(false);
  const [invResult,   setInvResult]   = useState<any>(null);

  const columns = importType === "students" ? STUDENT_COLUMNS : STAFF_COLUMNS;
  const errorRows  = rows.filter(r => r.errors.length > 0);
  const validRows  = rows.filter(r => r.errors.length === 0);

  const downloadTemplate = () => {
    const header = columns.join(",");
    const sample = importType === "students"
      ? "Aarav,Shah,ADM001,2025-26,MALE,2015-04-10,A,1,Rajesh Shah,9876543210,rajesh@email.com"
      : "Sunita,Verma,sunita@school.com,9876543211,TEACHER,Mathematics Teacher,Academics,2024-06-01,EMP001";
    const csv  = `${header}\n${sample}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${importType}_import_template.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${importType} template downloaded`);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a .csv file");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text   = e.target?.result as string;
      const parsed = parseCSV(text, columns);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }, [columns]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const runImport = async () => {
    if (!validRows.length) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    try {
      const csvRows = validRows.map(r => Object.values(r.data).join(",")).join("\n");
      const header  = columns.join(",");
      const res = await apiClient.post(`/bulk/${importType}/import-text`, { csv: `${header}\n${csvRows}` });
      setResult(res.data);
      setStep("done");
      toast.success(`Import complete: ${res.data.created} created`);
    } catch (err: any) {
      toast.error(err);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep("choose"); setRows([]); setFileName(""); setResult(null);
  };

  const runBulkInvoices = async () => {
    if (!invClassId || !invPlanId || !invDueDate) { toast.error("Select class, fee plan, and due date"); return; }
    setInvRunning(true);
    try {
      const res = await apiClient.post("/bulk/invoices/generate-for-class", {
        classId: invClassId, feePlanId: invPlanId, dueDate: invDueDate,
      });
      setInvResult(res.data);
      toast.success(`Generated ${res.data.generated} invoices`);
    } catch (err: any) { toast.error(err); }
    finally { setInvRunning(false); }
  };

  return (
    <div>
      <PageHeader title="Bulk Operations" subtitle="Import students or staff from CSV · Generate invoices for a class" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Import Wizard ────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

            {/* Step indicator */}
            <div className="flex items-center gap-0 border-b border-slate-100 px-5 py-3">
              {(["choose","upload","preview","done"] as WizardStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s ? "bg-blue-600 text-white" :
                    ["choose","upload","preview","done"].indexOf(step) > i ? "bg-emerald-500 text-white" :
                    "bg-slate-100 text-slate-400"
                  }`}>{i + 1}</div>
                  <span className={`text-xs font-medium capitalize hidden sm:block ${step === s ? "text-blue-600" : "text-slate-400"}`}>
                    {s === "choose" ? "Type" : s}
                  </span>
                  {i < 3 && <div className="w-8 h-px bg-slate-200 mx-1"/>}
                </div>
              ))}
            </div>

            <div className="p-6">
              {/* STEP 1: Choose */}
              {step === "choose" && (
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-4">What would you like to import?</p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {([
                      { id:"students" as ImportType, label:"Students", icon:<Users className="w-6 h-6"/>, desc:"Import student records with guardian info" },
                      { id:"staff"    as ImportType, label:"Staff",    icon:<Users className="w-6 h-6"/>, desc:"Import staff / teacher accounts" },
                    ]).map(({ id, label, icon, desc }) => (
                      <button key={id} onClick={() => setImportType(id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${importType === id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                        <div className={`mb-2 ${importType === id ? "text-blue-600" : "text-slate-400"}`}>{icon}</div>
                        <p className={`font-semibold text-sm ${importType === id ? "text-blue-700" : "text-slate-700"}`}>{label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-6">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Required columns for {importType}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map(c => (
                        <span key={c} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md font-mono">{c}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={downloadTemplate}
                      className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                      <Download className="w-4 h-4"/> Download Template
                    </button>
                    <button onClick={() => setStep("upload")}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors">
                      Continue <ArrowRight className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Upload */}
              {step === "upload" && (
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">Upload your {importType} CSV</p>
                  <p className="text-xs text-slate-400 mb-4">Must match the template format. Max 5000 rows.</p>

                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                      dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                    }`}
                    onClick={() => document.getElementById("csvInput")?.click()}
                  >
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                    <p className="text-sm font-medium text-slate-600">Drag & drop your CSV here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                    <input id="csvInput" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileInput}/>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setStep("choose")} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">← Back</button>
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                      <Download className="w-4 h-4"/> Re-download Template
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Preview */}
              {step === "preview" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fileName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {rows.length} rows · <span className="text-emerald-600 font-medium">{validRows.length} valid</span>
                        {errorRows.length > 0 && <span className="text-red-500 font-medium"> · {errorRows.length} errors</span>}
                      </p>
                    </div>
                    <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
                      <RotateCcw className="w-3 h-3"/> Start over
                    </button>
                  </div>

                  {errorRows.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                      <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4"/> {errorRows.length} rows have errors (will be skipped)
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {errorRows.slice(0, 5).map(r => (
                          <p key={r.rowNum} className="text-xs text-red-600">Row {r.rowNum}: {r.errors.join(", ")}</p>
                        ))}
                        {errorRows.length > 5 && <p className="text-xs text-red-400">...and {errorRows.length - 5} more</p>}
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden mb-4 max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0">
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 w-10">#</th>
                          {columns.slice(0, 6).map(c => (
                            <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500">{c}</th>
                          ))}
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.slice(0, 50).map(r => (
                          <tr key={r.rowNum} className={r.errors.length ? "bg-red-50/30" : "hover:bg-slate-50"}>
                            <td className="px-3 py-2 text-slate-400">{r.rowNum}</td>
                            {columns.slice(0, 6).map(c => (
                              <td key={c} className="px-3 py-2 text-slate-700 truncate max-w-[80px]">
                                {r.data[c.toLowerCase()] ?? r.data[c] ?? "—"}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {r.errors.length
                                ? <Badge label="Error" variant="error"/>
                                : <Badge label="Valid" variant="success"/>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep("upload")} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors">← Back</button>
                    <button onClick={runImport} disabled={importing || !validRows.length}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
                      {importing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                      {importing ? "Importing…" : `Import ${validRows.length} rows`}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Done */}
              {step === "done" && result && (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
                  <p className="text-lg font-bold text-slate-900 mb-1">Import Complete!</p>
                  <div className="flex justify-center gap-6 mt-4 mb-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600">{result.created}</p>
                      <p className="text-sm text-slate-500">Created</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-500">{result.skipped}</p>
                      <p className="text-sm text-slate-500">Skipped</p>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left mb-4 max-h-40 overflow-y-auto">
                      {result.errors.slice(0, 10).map((e, i) => (
                        <p key={i} className="text-xs text-amber-700">{e}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={reset} className="px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Import More
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Bulk Invoices ──────────────────────────────────────────── */}
        <div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-slate-400"/>
              <h3 className="font-semibold text-slate-800 text-sm">Bulk Invoice Generation</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Generate fee invoices for all students in a class at once.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
                <select value={invClassId} onChange={e => setInvClassId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select class…</option>
                  {(classes ?? []).filter((c: any) => c.isActive !== false).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fee Plan</label>
                <select value={invPlanId} onChange={e => setInvPlanId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select plan…</option>
                  {(feePlans ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.academicYear})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due Date</label>
                <input type="date" value={invDueDate} onChange={e => setInvDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <button onClick={runBulkInvoices} disabled={invRunning || !invClassId || !invPlanId || !invDueDate}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {invRunning && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {invRunning ? "Generating…" : "Generate Invoices"}
              </button>
            </div>

            {invResult && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4"/> Done
                </p>
                <p className="text-xs text-emerald-600 mt-1">{invResult.generated} generated · {invResult.skipped} skipped</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
