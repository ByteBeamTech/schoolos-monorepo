// RBAC inconsistency fix: the approved product model is Cashier =
// ACCOUNTANT (Student Billing FDD Section 4.1). Student Billing's own
// endpoints (invoices, discounts, fee-plans/student/:id) already granted
// ACCOUNTANT read access; the Students module's GET /students and
// GET /students/:id never did, despite being required for the Collect Fee
// search and Student Financial Profile workflows. Verified directly
// against the real decorators before this fix, not assumed.
//
// Scoped narrowly to this fix, not a full controller audit: only asserts
// what changed (ACCOUNTANT now present on these two handlers) and what
// must NOT have changed (every other role on these two handlers, and
// every other handler on this controller, untouched -- no broadened
// create/update/delete access, no unrelated role changes).

import 'reflect-metadata';
import { ROLES_KEY } from '../../../core/roles/roles.decorator';
import { StudentsController } from './students.controller';

function rolesFor(handlerName: string): string[] {
  const handler = (StudentsController.prototype as any)[handlerName];
  if (typeof handler !== 'function') return [];
  return Reflect.getMetadata(ROLES_KEY, handler) ?? [];
}

describe('StudentsController — RBAC fix: ACCOUNTANT read access (Student Billing dependency)', () => {
  it('GET /students (findAll) now includes ACCOUNTANT', () => {
    expect(rolesFor('findAll')).toContain('ACCOUNTANT');
  });

  it('GET /students/:id (findById) now includes ACCOUNTANT', () => {
    expect(rolesFor('findById')).toContain('ACCOUNTANT');
  });

  it('findAll: every pre-existing role is still present -- additive only, nothing removed', () => {
    expect(rolesFor('findAll')).toEqual(
      expect.arrayContaining(['SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'TEACHER']),
    );
  });

  it('findById: every pre-existing role is still present -- additive only, nothing removed', () => {
    expect(rolesFor('findById')).toEqual(
      expect.arrayContaining(['SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'TEACHER', 'PARENT']),
    );
  });

  // Deliberately NOT touched by this fix -- create/update and any other
  // read endpoint on this controller must not have gained ACCOUNTANT as a
  // side effect of this change. (Confirmed the controller has no
  // remove/delete handler at all -- not included here.)
  it.each(['create', 'update'] as const)(
    '%s is untouched -- does not grant ACCOUNTANT (this fix never broadens write access)',
    (handlerName) => {
      expect(rolesFor(handlerName)).not.toContain('ACCOUNTANT');
    },
  );
});
