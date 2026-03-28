// core/feature-flags/flag-definitions.ts
// Single source of truth for every flag in SchoolOS.
// Used by the seed script and the admin UI to show available flags.

export const TIER = {
  STARTER:    ['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'],
  GROWTH:     ['GROWTH', 'PRO', 'ENTERPRISE'],
  PRO:        ['PRO', 'ENTERPRISE'],
  ENTERPRISE: ['ENTERPRISE'],
  ALL:        [],  // no tier restriction
} as const;

export interface FlagDefinition {
  name:              string;
  category:          'MODULE' | 'FEATURE' | 'SYSTEM';
  label:             string;
  description:       string;
  defaultValue:      boolean;
  allowedTiers:      string[];
  tenantControllable: boolean; // can tenant admin toggle this themselves?
}

// ─── MODULE FLAGS — commercial gating ─────────────────────────────────────────
// These control entire application modules on/off per tenant.
// A school on STARTER cannot access MODULE_LIBRARY at all.
export const MODULE_FLAGS: FlagDefinition[] = [
  // Always-on core (all tiers)
  { name: 'MODULE_STUDENTS',        category: 'MODULE', label: 'Students',           description: 'Student master records and profiles',              defaultValue: true,  allowedTiers: TIER.ALL,        tenantControllable: false },
  { name: 'MODULE_ATTENDANCE',      category: 'MODULE', label: 'Attendance',         description: 'Daily and period-wise attendance marking',         defaultValue: true,  allowedTiers: TIER.ALL,        tenantControllable: false },
  { name: 'MODULE_STUDENT_BILLING', category: 'MODULE', label: 'Student Billing',    description: 'Fee plans, invoices, payments and receipts',       defaultValue: true,  allowedTiers: TIER.ALL,        tenantControllable: false },
  { name: 'MODULE_NOTIFICATIONS',   category: 'MODULE', label: 'Notifications',      description: 'Email, SMS and WhatsApp messaging',                defaultValue: true,  allowedTiers: TIER.ALL,        tenantControllable: false },
  { name: 'MODULE_STAFF',           category: 'MODULE', label: 'Staff',              description: 'Staff profiles, attendance and leave',             defaultValue: true,  allowedTiers: TIER.ALL,        tenantControllable: false },

  // Growth tier
  { name: 'MODULE_ACADEMICS',       category: 'MODULE', label: 'Academics',          description: 'Classes, sections, subjects management',           defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_EXAMINATIONS',    category: 'MODULE', label: 'Examinations',       description: 'Exam scheduling, marks entry and results',         defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_GRADEBOOK',       category: 'MODULE', label: 'Gradebook',          description: 'Grade aggregation and report cards',               defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_TIMETABLE',       category: 'MODULE', label: 'Timetable',          description: 'Period scheduling and substitution management',    defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_LIBRARY',         category: 'MODULE', label: 'Library',            description: 'Book catalog, issue, return and fine management',  defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_TRANSPORT',       category: 'MODULE', label: 'Transport',          description: 'Routes, vehicles, GPS and student assignment',     defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_COMMUNICATION',   category: 'MODULE', label: 'Communication',      description: 'Announcements, circulars and notice board',        defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },
  { name: 'MODULE_HOMEWORK',        category: 'MODULE', label: 'Homework',           description: 'Assignment creation, submission and grading',      defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: false },

  // Pro tier
  { name: 'MODULE_HR',              category: 'MODULE', label: 'HR',                 description: 'Leave management, joining workflows and HR ops',   defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_PAYROLL',         category: 'MODULE', label: 'Payroll',            description: 'Salary processing, payslips and TDS',              defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_ACCOUNTING',      category: 'MODULE', label: 'Accounting',         description: 'Budgets, expenses and ledger management',          defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_INVENTORY',       category: 'MODULE', label: 'Inventory',          description: 'Asset tracking and stock management',              defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_CERTIFICATES',    category: 'MODULE', label: 'Certificates',       description: 'Certificate and document generation',              defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_ADMISSIONS',      category: 'MODULE', label: 'Admissions',         description: 'Enquiry, application and admission pipeline',      defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_CRM',             category: 'MODULE', label: 'CRM',                description: 'Lead management and follow-up tracking',           defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_BULK',            category: 'MODULE', label: 'Bulk Operations',    description: 'Data import/export and UDISE compliance',          defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_RECEPTION',       category: 'MODULE', label: 'Reception',          description: 'Visitor management and front-office operations',   defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_REPORTING',       category: 'MODULE', label: 'Reporting',          description: 'Analytics dashboards and custom reports',          defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'MODULE_SUPPORT',         category: 'MODULE', label: 'Support Tickets',    description: 'In-app customer support ticket system',            defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },

  // Enterprise tier
  { name: 'MODULE_ACCESS_CONTROL',  category: 'MODULE', label: 'Access Control',     description: 'Custom role permissions and RBAC management',      defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'MODULE_SSO',             category: 'MODULE', label: 'SSO / OAuth',        description: 'Single sign-on with Google, Microsoft, SAML',      defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'MODULE_API_ACCESS',      category: 'MODULE', label: 'API Access',         description: 'REST API access for integrations',                 defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'MODULE_CUSTOM_DOMAIN',   category: 'MODULE', label: 'Custom Domain',      description: 'Branded domain for the school portal',             defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
];

// ─── FEATURE FLAGS — beta / AI / experimental ─────────────────────────────────
// These toggle specific capabilities within modules.
// Can be gated by tier but also toggled per-tenant by superadmin.
export const FEATURE_FLAGS: FlagDefinition[] = [
  { name: 'FEATURE_AI_SMART_REMINDERS',     category: 'FEATURE', label: 'AI Smart Reminders',     description: 'AI-generated fee reminder messages',              defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'FEATURE_AI_DROPOUT_PREDICTION',  category: 'FEATURE', label: 'AI Dropout Prediction',  description: 'Flag students at risk of dropping out',           defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: false },
  { name: 'FEATURE_AI_CHATBOT',             category: 'FEATURE', label: 'AI Parent Chatbot',      description: 'WhatsApp bot for parent queries',                 defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'FEATURE_AI_REPORT_INSIGHTS',     category: 'FEATURE', label: 'AI Report Insights',     description: 'GPT-generated analysis on reports',               defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'FEATURE_BIOMETRIC_ATTENDANCE',   category: 'FEATURE', label: 'Biometric Attendance',   description: 'Fingerprint and RFID attendance marking',         defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_WHATSAPP_INTEGRATION',   category: 'FEATURE', label: 'WhatsApp Integration',   description: 'Send messages via WhatsApp Business API',         defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_PARENT_PORTAL',          category: 'FEATURE', label: 'Parent Portal',          description: 'Web portal for parents to track their child',     defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_STUDENT_PORTAL',         category: 'FEATURE', label: 'Student Portal',         description: 'Self-service portal for students',                defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_TEACHER_PORTAL',         category: 'FEATURE', label: 'Teacher Portal',         description: 'Dedicated portal for teachers',                   defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_INSTALLMENT_PLANS',      category: 'FEATURE', label: 'Installment Plans',      description: 'Allow fee payment in multiple instalments',       defaultValue: false, allowedTiers: TIER.GROWTH,     tenantControllable: true  },
  { name: 'FEATURE_GPS_TRACKING',           category: 'FEATURE', label: 'GPS Bus Tracking',       description: 'Real-time GPS tracking for school buses',         defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: true  },
  { name: 'FEATURE_ONLINE_ADMISSION',       category: 'FEATURE', label: 'Online Admission Form',  description: 'Public-facing online admission application form',  defaultValue: false, allowedTiers: TIER.PRO,        tenantControllable: true  },
  { name: 'FEATURE_CUSTOM_REPORTS',         category: 'FEATURE', label: 'Custom Report Builder',  description: 'Drag-and-drop custom report creation',            defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'FEATURE_MULTI_BRANCH',           category: 'FEATURE', label: 'Multi-Branch Management',description: 'Manage multiple campuses under one school',        defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
  { name: 'FEATURE_AUDIT_EXPORT',           category: 'FEATURE', label: 'Audit Log Export',       description: 'Export compliance audit logs to CSV/PDF',         defaultValue: false, allowedTiers: TIER.ENTERPRISE, tenantControllable: false },
];

// ─── All flags combined ───────────────────────────────────────────────────────
export const ALL_FLAGS: FlagDefinition[] = [...MODULE_FLAGS, ...FEATURE_FLAGS];

// ─── Helper: get flags a tenant can control themselves ────────────────────────
export function getTenantControllableFlags(): FlagDefinition[] {
  return ALL_FLAGS.filter(f => f.tenantControllable);
}

// ─── Helper: get flags allowed for a given tier ───────────────────────────────
export function getFlagsForTier(tier: string): FlagDefinition[] {
  return ALL_FLAGS.filter(f =>
    f.allowedTiers.length === 0 || f.allowedTiers.includes(tier)
  );
}

