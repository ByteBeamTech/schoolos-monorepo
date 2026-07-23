// First tests for AuditService. It had none, which is how an invalid `action`
// value (rejected by Prisma, swallowed by this service's own try/catch) could
// silently produce no audit trail at all -- most recently for every refund.

import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { AuditService, AuditLogParams } from './audit.service';
import { PrismaService } from '@infra/database/prisma.service';

const baseParams: AuditLogParams = {
  tenantId:   't-1',
  actorId:    'u-1',
  action:     'CREATE',
  entityType: 'Invoice',
  entityId:   'inv-1',
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'a-1' }) } };
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AuditService);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('writer selection', () => {
    it('writes through its own PrismaService when no transaction is supplied', async () => {
      await service.log(baseParams);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('writes through the caller transaction when one IS supplied, and not its own client', async () => {
      const tx: any = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'a-2' }) } };

      await service.log(baseParams, tx);

      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
      // The point of the parameter: the row must NOT go out on a separate
      // connection that commits independently of the caller.
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it.each([
      ['logCreate', 'CREATE'],
      ['logUpdate', 'UPDATE'],
      ['logDelete', 'DELETE'],
    ])('%s forwards the transaction and writes action=%s', async (method, expected) => {
      const tx: any = { auditLog: { create: jest.fn().mockResolvedValue({}) } };

      await (service as any)[method]({ ...baseParams }, tx);

      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe(expected);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('logPayment forwards the transaction and maps each status to its enum action', async () => {
      const cases: Array<[string, string]> = [
        ['initiated', 'PAYMENT_INITIATED'],
        ['success',   'PAYMENT_SUCCESS'],
        ['failed',    'PAYMENT_FAILED'],
      ];
      for (const [status, expected] of cases) {
        const tx: any = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
        await service.logPayment({ ...baseParams, paymentStatus: status as any }, tx);
        expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe(expected);
      }
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('best-effort behaviour is UNCHANGED by this commit', () => {
    it('swallows a write failure without a transaction (pre-existing behaviour)', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(service.log(baseParams)).resolves.toBeUndefined();
    });

    it('swallows a write failure WITH a transaction too — it does not abort the caller', async () => {
      const tx: any = { auditLog: { create: jest.fn().mockRejectedValue(new Error('db down')) } };

      // Deliberate: rethrowing here would roll back the caller's transaction,
      // which for a payment settlement would discard an already-captured
      // payment over a missing audit row. Changing this is a separate,
      // explicit decision (see the note on log()).
      await expect(service.log(baseParams, tx)).resolves.toBeUndefined();
    });
  });

  describe('row shape is preserved', () => {
    it('connects tenant and actor, and passes fields through unchanged', async () => {
      await service.log({
        ...baseParams,
        actorRole: 'ACCOUNTANT',
        before:    { status: 'DRAFT' },
        after:     { status: 'SENT' },
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
        metadata:  { note: 'x' },
      });

      const data = prisma.auditLog.create.mock.calls[0][0].data;
      expect(data.tenant.connect.id).toBe('t-1');
      expect(data.actor.connect.id).toBe('u-1');
      expect(data.entityType).toBe('Invoice');
      expect(data.entityId).toBe('inv-1');
      expect(data.before).toEqual({ status: 'DRAFT' });
      expect(data.after).toEqual({ status: 'SENT' });
      expect(data.ipAddress).toBe('10.0.0.1');
      expect(data.metadata).toEqual({ note: 'x' });
    });

    it('omits the actor relation for system-originated entries', async () => {
      await service.log({ ...baseParams, actorId: undefined });
      expect(prisma.auditLog.create.mock.calls[0][0].data.actor).toBeUndefined();
    });
  });
});

// Defence in depth behind the compile-time type: this scans the repository for
// audit action strings and checks them against the enum in the schema. It
// catches the sites that still write `as any`, which suppresses the type.
describe('audit action strings are valid AuditAction members', () => {
  const SRC = path.resolve(__dirname, '../..');
  const ENUMS = path.resolve(__dirname, '../../../prisma/schema/enums.prisma');

  function enumValues(): Set<string> {
    const block = fs.readFileSync(ENUMS, 'utf8').match(/enum AuditAction \{([\s\S]*?)\}/);
    if (!block) throw new Error('AuditAction enum not found in enums.prisma');
    return new Set(block[1].split(/\s+/).filter(Boolean));
  }

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
    }
    return out;
  }

  it('every `action: <literal> as any` in the codebase names a real enum member', () => {
    const valid = enumValues();
    expect(valid.size).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/action:\s*'([A-Z][A-Z_]*)'\s+as\s+any/g)) {
        if (!valid.has(m[1])) offenders.push(`${path.relative(SRC, file)}: ${m[1]}`);
      }
    }

    expect(offenders).toEqual([]);
    // If this fails: the named value is not in the AuditAction enum. Prisma
    // rejects it and AuditService.log() swallows the error, so the audit row
    // would silently never be written. Use a real enum member, or add one to
    // enums.prisma with a migration.
  });
});
