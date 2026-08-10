// backend/src/modules/student-billing/plans/services/fee-plan-assignment.service.spec.ts

import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FeePlanAssignmentService } from './fee-plan-assignment.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../../core/compliance/audit.service';

describe('FeePlanAssignmentService', () => {
  let service: FeePlanAssignmentService;
  let prisma: any;
  let audit: any;

  const validDto = { sessionId: 's-1', feePlanId: 'fp-1', classId: 'c-1' } as any;

  beforeEach(async () => {
    prisma = {
      academicSession: { findFirst: jest.fn().mockResolvedValue({ id: 's-1', tenantId: 't-1' }) },
      feePlan:  { findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }) },
      class:    { findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }) },
      section:  { findFirst: jest.fn().mockResolvedValue({ id: 'sec-1' }) },
      feePlanAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany:  jest.fn().mockResolvedValue([]),
        create:    jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'fpa-new', ...data })),
      },
    };
    audit = { logCreate: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FeePlanAssignmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(FeePlanAssignmentService);
  });

  describe('create — scoping', () => {
    it('1: creates a valid class-level assignment (sectionId omitted)', async () => {
      const result = await service.create('t-1', 'b-1', validDto, 'u-1');
      expect(result.classId).toBe('c-1');
      expect(result.sectionId).toBeNull();
      expect(audit.logCreate).toHaveBeenCalled();
    });

    it('2: creates a valid section-level assignment, and a duplicate check scopes by that section, not just class', async () => {
      const dto = { ...validDto, sectionId: 'sec-1' };
      const result = await service.create('t-1', 'b-1', dto, 'u-1');
      expect(result.sectionId).toBe('sec-1');
      expect(prisma.feePlanAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sectionId: 'sec-1' }) }),
      );
    });

    it('3: rejects when the session does not belong to this tenant (cross-tenant rejection)', async () => {
      prisma.academicSession.findFirst.mockResolvedValue(null);
      await expect(service.create('t-1', 'b-1', validDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.feePlanAssignment.create).not.toHaveBeenCalled();
    });

    it('4: rejects when the class does not belong to this branch (cross-branch rejection)', async () => {
      prisma.class.findFirst.mockResolvedValue(null);
      await expect(service.create('t-1', 'b-1', validDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
      // Confirms the query actually filters by branchId, not just id --
      // a class existing in a DIFFERENT branch must not satisfy this check.
      expect(prisma.class.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ branchId: 'b-1' }) }),
      );
    });

    it('5: rejects when the class does not belong to the given session (cross-session rejection)', async () => {
      prisma.class.findFirst.mockResolvedValue(null); // simulates a class that exists, but for a different sessionId
      await expect(service.create('t-1', 'b-1', validDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.class.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sessionId: 's-1' }) }),
      );
    });

    it('6: rejects a duplicate class-level assignment for the same class+session', async () => {
      prisma.feePlanAssignment.findFirst.mockResolvedValue({ id: 'existing-fpa' });
      await expect(service.create('t-1', 'b-1', validDto, 'u-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.feePlanAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects when the fee plan does not belong to this branch/session', async () => {
      prisma.feePlan.findFirst.mockResolvedValue(null);
      await expect(service.create('t-1', 'b-1', validDto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when a supplied sectionId does not belong to the given class', async () => {
      prisma.section.findFirst.mockResolvedValue(null);
      const dto = { ...validDto, sectionId: 'sec-wrong-class' };
      await expect(service.create('t-1', 'b-1', dto, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveForClassSection — section wins over class', () => {
    it('returns the section-specific assignment when one exists', async () => {
      const sectionAssignment = { id: 'fpa-section', sectionId: 'sec-1' };
      prisma.feePlanAssignment.findFirst.mockResolvedValueOnce(sectionAssignment);

      const result = await service.resolveForClassSection('t-1', 'b-1', 's-1', 'c-1', 'sec-1');
      expect(result).toBe(sectionAssignment);
      // Only one query needed -- the class-level fallback must not fire
      // once a section match is already found.
      expect(prisma.feePlanAssignment.findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to the class-level assignment when no section-specific one exists', async () => {
      const classAssignment = { id: 'fpa-class', sectionId: null };
      prisma.feePlanAssignment.findFirst
        .mockResolvedValueOnce(null)          // section-specific lookup misses
        .mockResolvedValueOnce(classAssignment); // class-level lookup hits

      const result = await service.resolveForClassSection('t-1', 'b-1', 's-1', 'c-1', 'sec-1');
      expect(result).toBe(classAssignment);
      expect(prisma.feePlanAssignment.findFirst).toHaveBeenCalledTimes(2);
    });

    it('resolves directly to class-level when the student has no section at all', async () => {
      const classAssignment = { id: 'fpa-class', sectionId: null };
      prisma.feePlanAssignment.findFirst.mockResolvedValueOnce(classAssignment);

      const result = await service.resolveForClassSection('t-1', 'b-1', 's-1', 'c-1', null);
      expect(result).toBe(classAssignment);
      // No section-specific query attempted at all when sectionId is null.
      expect(prisma.feePlanAssignment.findFirst).toHaveBeenCalledTimes(1);
    });

    it('returns null when neither a section-level nor class-level assignment exists', async () => {
      prisma.feePlanAssignment.findFirst.mockResolvedValue(null);
      const result = await service.resolveForClassSection('t-1', 'b-1', 's-1', 'c-1', 'sec-1');
      expect(result).toBeNull();
    });
  });
});
