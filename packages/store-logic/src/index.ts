// @schoolos/store-logic
// Shared Zustand stores — used by web, mobile, and superadmin
// Rule: NEVER use local useState for server data. Use these stores.

export { useAuthStore }         from './stores/auth';
export { useStudentsStore }     from './stores/students';
export { useStaffStore }        from './stores/staff';
export { useAttendanceStore }   from './stores/attendance';
export { useBillingStore }      from './stores/student-billing';
export { useAcademicsStore }    from './stores/academics';
export { useNotificationsStore }from './stores/notifications';
export { useTransportStore }    from './stores/transport';
export { useExaminationsStore } from './stores/examinations';
export { useTimetableStore }    from './stores/timetable';
export { useGradebookStore }    from './stores/gradebook';
export { useHRStore }           from './stores/hr';
export { useReceptionStore }    from './stores/reception';
export { usePayrollStore }      from './stores/payroll';
export { useCommunicationStore }from './stores/communication';
export { useUIStore }           from './stores/ui';

// Re-export types
export type { AuthUser }             from './stores/auth';
export type { Student }              from './stores/students';
export type { StaffMember }          from './stores/staff';
export type { Invoice, FeePlan }     from './stores/student-billing';
export type { TransportRoute, TransportAssignment } from './stores/transport';
export type { JoiningRequest, StaffLeave }  from './stores/hr';
export type { Complaint, Visitor }   from './stores/reception';
export type { Payslip }              from './stores/payroll';
export type { Announcement, Circular } from './stores/communication';
