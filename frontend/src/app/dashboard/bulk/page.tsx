"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Lock, Upload, Zap } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { PageHeader } from "@/components/ui/page-header";
import { useApi, useBulkActions, useBulkCapabilities } from "@/lib/hooks";

const SAMPLE_CSV = `firstName,lastName,admissionNumber,academicYear,sectionId,rollNumber,phone,email
Rahul,Sharma,2024001,2024-2025,section-id-optional,1,9876543210,rahul@example.com
Priya,Patel,2024002,2024-2025,section-id-optional,2,9988776655,priya@example.com`;

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function AccessNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <Lock className="h-4 w-4" />
        {title}
      </div>
      <p>{body}</p>
    </div>
  );
}

export default function BulkPage() {
  const { user } = useAuthStore();
  const { data: classes } = useApi<any[]>("/academics/classes");
  const { data: feePlans } = useApi<any[]>("/billing/fee-plans");
  const { data: capabilities, loading: loadingCapabilities, error: capabilitiesError } = useBulkCapabilities();
  const {
    downloadStudentTemplate,
    generateInvoicesForClass,
    importStudentsFromFile,
    importStudentsFromText,
  } = useBulkActions();

  const [csvText, setCsvText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"csv" | "excel" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    feePlanId: "",
    classId: "",
    dueDate: "",
    academicYear: "",
  });
  const [generating, setGenerating] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const role = user?.role ?? "";
  const roleCanImportStudents = ["SCHOOL_ADMIN", "PRINCIPAL", "RECEPTIONIST"].includes(role);
  const roleCanGenerateInvoices = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(role);

  const canImportStudents = capabilities?.canImportStudents ?? roleCanImportStudents;
  const canGenerateInvoices = capabilities?.canGenerateInvoices ?? roleCanGenerateInvoices;
  const canAccessBulkPage =
    capabilities?.canAccessBulkPage ?? (roleCanImportStudents || roleCanGenerateInvoices);

  const loadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (!file) return;

    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = (readEvent) => setCsvText(String(readEvent.target?.result ?? ""));
      reader.readAsText(file);
      return;
    }

    setCsvText("");
  };

  const handleTemplateDownload = async (format: "csv" | "excel") => {
    setDownloadingFormat(format);
    try {
      const { blob, filename } = await downloadStudentTemplate(format);
      saveBlob(blob, filename);
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "Template download failed");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleImport = async () => {
    if (!canImportStudents) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = selectedFile
        ? await importStudentsFromFile(selectedFile)
        : await importStudentsFromText(csvText);
      setImportResult(result);
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const generateInvoices = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canGenerateInvoices) return;

    setGenerating(true);
    setInvoiceResult(null);
    try {
      const result = await generateInvoicesForClass(invoiceForm);
      setInvoiceResult(result);
    } catch (error: any) {
      alert(error?.response?.data?.message ?? "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const updateInvoiceField =
    (key: string) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInvoiceForm((previous) => ({ ...previous, [key]: event.target.value }));

  return (
    <div>
      <PageHeader
        title="Bulk Operations"
        subtitle="Import students in bulk, download ready-made templates, and generate invoices with permission-aware access."
      />

      {capabilitiesError && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Bulk permissions could not be verified from the server, so role-based fallback access is being used for this screen.
        </div>
      )}

      {!loadingCapabilities && !canAccessBulkPage && (
        <AccessNotice
          title="Bulk operations are locked for your account"
          body={`Your current role (${user?.role ?? "unknown"}) does not have students:import or billing:create permission. A school admin can grant bulk access from Access Control.`}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900">Student import from CSV or Excel</h2>
          </div>

          {!canImportStudents && !loadingCapabilities ? (
            <AccessNotice
              title="Import permission required"
              body="This action is controlled by the students:import permission. School admins, principals, and authorized front-desk users can be granted access."
            />
          ) : (
            <>
              <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs font-mono leading-relaxed text-slate-500">
                <p className="mb-1 font-semibold text-slate-700">Required columns</p>
                firstName, lastName, admissionNumber, academicYear
                <p className="mb-1 mt-2 font-semibold text-slate-700">Optional columns</p>
                sectionId, rollNumber, phone, email
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Load sample
                </button>
                <button
                  onClick={() => handleTemplateDownload("csv")}
                  disabled={downloadingFormat !== null}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingFormat === "csv" ? "Preparing CSV..." : "Download CSV form"}
                </button>
                <button
                  onClick={() => handleTemplateDownload("excel")}
                  disabled={downloadingFormat !== null}
                  className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {downloadingFormat === "excel" ? "Preparing Excel..." : "Download Excel form"}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Upload file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.tsv,.xls,.xlsx"
                  className="hidden"
                  onChange={loadFile}
                />
              </div>

              {selectedFile && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-slate-400">({Math.ceil(selectedFile.size / 1024)} KB)</span>
                </div>
              )}

              <textarea
                rows={8}
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                placeholder="Paste CSV here or upload a CSV / Excel file..."
                className="mb-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={handleImport}
                disabled={importing || (!selectedFile && !csvText.trim())}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import students"}
              </button>
            </>
          )}

          {importResult && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="mb-2 font-semibold text-slate-800">Import complete</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                  <p className="text-xs text-slate-500">Created</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{importResult.skipped}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{importResult.errors?.length ?? 0}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-red-500">
                  {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">Generate invoices for an entire class</h2>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            This action is permission-controlled and uses the billing:create access right. It creates invoices for active students in the selected class and skips students who already have one.
          </p>

          {!canGenerateInvoices && !loadingCapabilities ? (
            <AccessNotice
              title="Invoice generation permission required"
              body="This bulk billing action is available only when billing:create is granted to your role or user."
            />
          ) : (
            <form onSubmit={generateInvoices} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fee plan *
                </label>
                <select
                  required
                  value={invoiceForm.feePlanId}
                  onChange={updateInvoiceField("feePlanId")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select fee plan...</option>
                  {feePlans?.map((plan: any) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Class *
                </label>
                <select
                  required
                  value={invoiceForm.classId}
                  onChange={updateInvoiceField("classId")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select class...</option>
                  {classes?.map((currentClass: any) => (
                    <option key={currentClass.id} value={currentClass.id}>
                      {currentClass.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Due date *
                </label>
                <input
                  required
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={updateInvoiceField("dueDate")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate invoices for class"}
              </button>
            </form>
          )}

          {invoiceResult && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="mb-2 font-semibold text-slate-800">Generation complete</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{invoiceResult.generated}</p>
                  <p className="text-xs text-slate-500">Generated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{invoiceResult.skipped}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-700">{invoiceResult.total}</p>
                  <p className="text-xs text-slate-500">Total students</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
