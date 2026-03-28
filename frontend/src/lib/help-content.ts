// SchoolOS Help Content Library
// Every ? tooltip in the app pulls from here.
// Add new entries as new features are built.

import type { HelpContent } from "@/components/ui/help-tip";

export const HELP: Record<string, HelpContent> = {

  // ── Academics ─────────────────────────────────────────────────────────────
  "academic-session": {
    title:   "Academic Session",
    body:    "An academic session (e.g. 2024-25) is the school year period. All classes, attendance, exams, and fees are tied to a session. Only one session can be active (current) at a time.",
    tip:     "Create the new session before the school year starts and mark it as current. Old sessions become read-only.",
    warning: "Locking a session prevents any further edits to attendance and marks for that year.",
  },
  "class": {
    title:   "Class",
    body:    "A class represents a grade level (e.g. Class 5, Grade 10). Each class has one or more sections. Classes are linked to an academic session.",
    tip:     "Use display order to control how classes appear in dropdowns and reports.",
  },
  "section": {
    title:   "Section",
    body:    "A section is a division within a class (e.g. Class 5 - A, Class 5 - B). Each section has a capacity limit and is assigned a class teacher.",
    tip:     "Students are enrolled into sections, not classes directly.",
  },
  "subject": {
    title:   "Subject",
    body:    "Subjects are the courses taught in your school (e.g. Mathematics, English). Mark subjects as elective if they are optional for students.",
  },

  // ── Students ──────────────────────────────────────────────────────────────
  "admission-number": {
    title:   "Admission Number",
    body:    "A unique identifier assigned to each student when they are enrolled. This number is used on fee receipts, report cards, and ID cards.",
    tip:     "Use a consistent format like 2024001, 2024002 for easy sorting.",
    warning: "Admission numbers cannot be changed after a student is enrolled.",
  },
  "roll-number": {
    title:   "Roll Number",
    body:    "A number assigned to a student within their section for a specific academic session. Used for attendance and exam mark sheets.",
    tip:     "Roll numbers reset each academic session. They are unique within a section, not across the school.",
  },
  "guardian": {
    title:   "Guardian",
    body:    "A parent or legal guardian linked to a student. Guardians receive fee receipts, attendance alerts, and exam result notifications via SMS/WhatsApp/Email.",
    tip:     "Mark one guardian as primary — they receive all automated notifications.",
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  "attendance-period": {
    title:   "Attendance Period",
    body:    "Daily attendance marks a student present/absent for the whole day. Period attendance marks them for each subject period separately.",
    tip:     "Use period attendance for secondary schools where subject-wise records are needed for board exams.",
  },
  "attendance-status": {
    title:   "Attendance Status",
    body:    "PRESENT: Student attended. ABSENT: Did not attend. LATE: Came after the scheduled time. HALF_DAY: Attended only half the school day. ON_LEAVE: Pre-approved leave.",
    tip:     "Late and Half-Day are counted differently in the monthly attendance report — check your school's policy.",
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  "fee-plan": {
    title:   "Fee Plan",
    body:    "A fee plan is a template that defines what fees a class of students must pay (e.g. Tuition, Transport, Library). You assign a fee plan to students to generate their invoices.",
    tip:     "Create one fee plan per class per academic year. Use optional fee items for charges that only some students pay.",
  },
  "fee-item": {
    title:   "Fee Item",
    body:    "A fee item is a single charge within a fee plan (e.g. Tuition Fee: ₹5000, Computer Lab: ₹500). Each item has its own amount and due date.",
    tip:     "Mark items as Optional if not all students in the class need to pay them (e.g. transport, hostel).",
  },
  "invoice": {
    title:   "Invoice",
    body:    "An invoice is a fee bill generated for a specific student for a fee plan. It shows all charges, discounts, and the amount due.",
    warning: "Once an invoice is marked PAID, it cannot be edited. Create a refund if a correction is needed.",
  },
  "discount": {
    title:   "Discount",
    body:    "A reduction applied to a student's fee. Discounts require approval based on category (Sibling, Merit, Staff Child, etc.) and go through a workflow before being applied to invoices.",
    tip:     "Discount approval workflows prevent unauthorized fee waivers and create an audit trail.",
  },
  "late-fee": {
    title:   "Late Fee",
    body:    "An automatic penalty added to overdue invoices. The system calculates 1% of the due amount per day, capped at ₹500. Late fees run every night via a scheduled job.",
    warning: "Disable late fees for a student by resolving their invoice before the cron job runs at midnight.",
  },

  // ── HR ────────────────────────────────────────────────────────────────────
  "joining-request": {
    title:   "Joining Request",
    body:    "A multi-level approval workflow for onboarding new staff. HR creates the request, then it goes through approvers (e.g. Principal → School Admin) before the staff member is officially added.",
    tip:     "Configure the approval levels in HR → Workflow Settings to match your school's hierarchy.",
  },
  "leave-balance": {
    title:   "Leave Balance",
    body:    "The number of leaves a staff member is entitled to per year by type (Casual, Sick, Earned, etc.). Set at the start of each year by HR.",
    tip:     "Leave balance is deducted automatically when a leave is approved. Check the balance before approving requests.",
  },
  "leave-type": {
    title:   "Leave Types",
    body:    "CASUAL: Unplanned leaves for personal reasons. SICK: Medical leave, usually requires a certificate. EARNED: Accrued leave that can be carried forward. MATERNITY/PATERNITY: Statutory leave. UNPAID: When balance is exhausted.",
  },

  // ── Payroll ───────────────────────────────────────────────────────────────
  "payroll-structure": {
    title:   "Payroll Structure",
    body:    "The salary breakdown for a staff member: Basic, HRA (House Rent Allowance), DA (Dearness Allowance), TA (Travel Allowance), and deductions like PF, ESI, and TDS.",
    tip:     "Set the effective date to the joining date for new staff. Changes take effect from the next payslip generation.",
  },
  "payslip": {
    title:   "Payslip",
    body:    "A monthly salary statement generated from the payroll structure. Shows gross pay, all deductions, and net salary. Must be approved before marking as paid.",
    warning: "Once a payslip is marked PAID, it is locked. Create a supplementary payslip for corrections.",
  },

  // ── Transport ─────────────────────────────────────────────────────────────
  "transport-route": {
    title:   "Transport Route",
    body:    "A named bus or vehicle route with a driver, vehicle number, and associated fee. Students are assigned to routes based on their pickup area.",
    tip:     "The route fee is added as a transport charge in the student's fee plan — make sure it matches.",
  },

  // ── Library ───────────────────────────────────────────────────────────────
  "book-issue": {
    title:   "Book Issue",
    body:    "The process of lending a book from the library to a student or staff. The system tracks the issue date, due date, and return date. Overdue books generate alerts.",
    tip:     "Set the return due date based on your library policy (typically 7-14 days for students).",
  },

  // ── Reception ─────────────────────────────────────────────────────────────
  "visitor-pass": {
    title:   "Visitor Pass",
    body:    "A digital entry record created when a visitor checks in at the school gate. Records their name, ID proof, purpose, and who they are visiting. Auto-generates a pass number.",
    tip:     "Print the visitor pass at check-in for physical verification. The pass expires when the visitor checks out.",
  },
  "complaint-ticket": {
    title:   "Complaint Ticket",
    body:    "A formal record of a complaint raised by a parent, student, or staff. Each complaint gets a unique ticket number and is tracked through Open → In Progress → Resolved.",
    tip:     "Assign complaints to staff members for accountability. All updates are logged in the activity trail.",
  },

  // ── Access Control ────────────────────────────────────────────────────────
  "permission": {
    title:   "Permission",
    body:    "A specific action a user can perform (e.g. students:create, billing:record_payment). Permissions are grouped by module and granted to roles.",
    warning: "Changes to permissions take effect on the user's next login. Ask them to log out and back in.",
  },
  "role": {
    title:   "User Role",
    body:    "Roles define what a user can see and do. SCHOOL_ADMIN has full access. PRINCIPAL can manage academics. ACCOUNTANT handles billing. TEACHER manages attendance and homework. LIBRARIAN manages books.",
    tip:     "Use Access Control to add or remove specific permissions for a role without changing the role itself.",
  },

  // ── School Management ─────────────────────────────────────────────────────
  "branch": {
    title:   "Branch / Campus",
    body:    "A physical location of your school (e.g. Main Campus, North Wing, Preschool Block). Each branch can have its own principal, contact, and address.",
    tip:     "Branches help organise reporting when your school group operates from multiple locations.",
  },
  "branding": {
    title:   "School Branding",
    body:    "Customise how your school appears on fee receipts, certificates, and report cards. Upload your school logo and set your brand colours.",
    tip:     "The logo appears on all printed documents. Use a high-resolution PNG with transparent background for best results.",
  },
  "gstin": {
    title:   "GSTIN",
    body:    "Your school's Goods and Services Tax Identification Number. Required for generating GST-compliant fee invoices for parents who need tax receipts.",
    tip:     "If your school is GST-registered, enter the 15-digit GSTIN. Leave blank if not applicable (most schools under ₹20L turnover are exempt).",
  },

  // ── Support ───────────────────────────────────────────────────────────────
  "support-priority": {
    title:   "Ticket Priority",
    body:    "LOW: General queries, no urgency. MEDIUM: Affecting some users, needs resolution soon. HIGH: Affecting many users or core functions. CRITICAL: System is down or data is at risk.",
    tip:     "Choose the right priority — CRITICAL tickets are escalated automatically to senior support within 1 hour.",
  },
  "sla": {
    title:   "SLA (Service Level Agreement)",
    body:    "The committed response and resolution time for your support ticket based on priority. CRITICAL: 1h response / 4h resolve. HIGH: 4h / 8h. MEDIUM: 8h / 24h. LOW: 24h / 72h.",
    warning: "SLA timers run 24/7. If your ticket is marked SLA Breached, our team has been automatically alerted.",
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  "health-score": {
    title:   "Tenant Health Score",
    body:    "A score from 0-100 indicating how actively a school is using SchoolOS. Calculated from login activity (30pts), student count (20pts), features used (25pts), and payment health (25pts).",
    tip:     "Scores below 40 are flagged as Critical and trigger a check-in from the customer success team.",
  },
  "mrr": {
    title:   "MRR (Monthly Recurring Revenue)",
    body:    "The total predictable monthly revenue from all active subscriptions. Calculated as the sum of each tenant's monthly subscription charge based on their pricing model (per-student or flat fee).",
    tip:     "ARR = MRR × 12. Use this to forecast annual revenue and identify growth trends.",
  },
};
