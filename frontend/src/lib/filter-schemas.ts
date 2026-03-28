import type { FilterSchema } from "@/components/ui/filter-builder";

export const STUDENT_FILTER_SCHEMA: FilterSchema = {
  module: "STUDENTS", searchField: "search",
  fields: [
    { id: "search",       label: "Student",      type: "text",   placeholder: "Name or admission no…" },
    { id: "gender",       label: "Gender",        type: "select", options: [{ label:"Male",value:"MALE"},{ label:"Female",value:"FEMALE"},{ label:"Other",value:"OTHER"}] },
    { id: "isActive",     label: "Status",        type: "select", options: [{ label:"Active",value:"true"},{ label:"Inactive",value:"false"}] },
    { id: "academicYear", label: "Academic Year", type: "select", options: [] },
    { id: "sectionId",    label: "Section",       type: "select", options: [] },
  ],
};

export const INVOICE_FILTER_SCHEMA: FilterSchema = {
  module: "INVOICES", searchField: "search",
  fields: [
    { id: "search",    label: "Student",  type: "text",         placeholder: "Student name…" },
    { id: "status",    label: "Status",   type: "select",       options: [
      { label:"Draft",value:"DRAFT"},{ label:"Sent",value:"SENT"},
      { label:"Partially Paid",value:"PARTIALLY_PAID"},{ label:"Paid",value:"PAID"},
      { label:"Overdue",value:"OVERDUE"},{ label:"Cancelled",value:"CANCELLED"},
    ]},
    { id: "dueDate",   label: "Due Date", type: "date-range" },
    { id: "amount",    label: "Amount",   type: "number-range" },
  ],
};

export const ATTENDANCE_FILTER_SCHEMA: FilterSchema = {
  module: "ATTENDANCE", searchField: "search",
  fields: [
    { id: "search",    label: "Student", type: "text",   placeholder: "Student name…" },
    { id: "status",    label: "Status",  type: "select", options: [
      { label:"Present",value:"PRESENT"},{ label:"Absent",value:"ABSENT"},
      { label:"Late",value:"LATE"},{ label:"Half Day",value:"HALF_DAY"},
    ]},
    { id: "date",      label: "Date",    type: "date-range" },
    { id: "sectionId", label: "Section", type: "select", options: [] },
  ],
};

export const ADMISSION_FILTER_SCHEMA: FilterSchema = {
  module: "ADMISSIONS", searchField: "search",
  fields: [
    { id: "search",  label: "Applicant", type: "text",   placeholder: "Name…" },
    { id: "status",  label: "Status",    type: "select", options: [
      { label:"Inquiry",value:"INQUIRY"},{ label:"Applied",value:"APPLIED"},
      { label:"Screening",value:"SCREENING"},{ label:"Waitlisted",value:"WAITLISTED"},
      { label:"Enrolled",value:"ENROLLED"},{ label:"Rejected",value:"REJECTED"},
    ]},
    { id: "createdAt", label: "Date Applied", type: "date-range" },
    { id: "applyingForClass", label: "Class", type: "select", options: [] },
  ],
};

export const STAFF_FILTER_SCHEMA: FilterSchema = {
  module: "STAFF", searchField: "search",
  fields: [
    { id: "search",     label: "Staff",      type: "text",   placeholder: "Name…" },
    { id: "department", label: "Department", type: "select", options: [
      { label:"Academics",value:"Academics"},{ label:"Administration",value:"Administration"},
      { label:"Finance",value:"Finance"},{ label:"Library",value:"Library"},
    ]},
    { id: "isActive",   label: "Status",     type: "select", options: [
      { label:"Active",value:"true"},{ label:"Inactive",value:"false"},
    ]},
  ],
};
