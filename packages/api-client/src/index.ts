// @schoolos/api-client
// Single API client — used by web (Next.js), mobile (React Native), and superadmin
// Rule: NEVER call fetch/axios directly in any frontend app

export * from './endpoints/auth';
export * from './endpoints/students';
export * from './endpoints/attendance';
export * from './endpoints/student-billing';
export * from './endpoints/academics';
export * from './endpoints/timetable';
export * from './endpoints/notifications';
export * from './endpoints/transport';
export * from './endpoints/homework';
export * from './endpoints/library';
export * from './endpoints/inventory';
export * from './endpoints/certificates';
export * from './endpoints/communication';
export * from './endpoints/hr';
export * from './endpoints/reception';
export * from './endpoints/payroll';
export * from './endpoints/admissions';
export * from './endpoints/exams';
export * from './endpoints/sessions';
export * from './endpoints/support';
export * from './interceptors';
export * from './types';
export * from './endpoints/behavior'; // behaviorApi के लिए
export * from './endpoints/bulk';
