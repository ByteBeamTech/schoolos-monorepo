export const STORE_REGISTRY = {
  'auth':            () => import('../stores/auth'),
  'students':        () => import('../stores/students'),
  'staff':           () => import('../stores/staff'),
  'attendance':      () => import('../stores/attendance'),
  'student-billing': () => import('../stores/student-billing'),
  'academics':       () => import('../stores/academics'),
  'notifications':   () => import('../stores/notifications'),
  'transport':       () => import('../stores/transport'),
  'examinations':    () => import('../stores/examinations'),
  'timetable':       () => import('../stores/timetable'),
  'gradebook':       () => import('../stores/gradebook'),
  'hr':              () => import('../stores/hr'),
  'reception':       () => import('../stores/reception'),
  'payroll':         () => import('../stores/payroll'),
  'communication':   () => import('../stores/communication'),
  'ui':              () => import('../stores/ui'),
} as const;

export type StoreDomain = keyof typeof STORE_REGISTRY;

export async function loadStore(domain: StoreDomain) {
  const loader = STORE_REGISTRY[domain];
  if (!loader) throw new Error(`Store not found: ${domain}`);
  return loader();
}
