// /apps/schoolos/backend/src/modules/students/services/students.service.spec.ts
// /apps/schoolos/backend/src/modules/students/services/students.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '@infra/database/prisma.service';
// 🟢 FIXED: Adjusted relative path mapping hierarchy depth to find the module cleanly
import { AuditService } from '../../../core/compliance/audit.service'; 
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    student: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // PR-2.5 (test infra cleanup): 'class' was entirely missing from this
    // mock. StudentsService.create() runs inside $transaction and calls
    // tx.class.findFirst() as its first step (see students.service.ts) --
    // without this key, every create() test failed with
    // "Cannot read properties of undefined (reading 'findFirst')" before
    // reaching any of the logic the tests are meant to exercise.
    class: {
      findFirst: jest.fn(),
    },
    section: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    $executeRaw: jest.fn(),
  };

  const mockAuditService = {
    logCreate: jest.fn(),
    logUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully register a student profile context matching institutional guidelines', async () => {
      mockPrismaService.class.findFirst.mockResolvedValue({ id: 'cl-1', tenantId: 't-1', branchId: 'br-1' });
      mockPrismaService.student.count.mockResolvedValue(0);
      mockPrismaService.student.create.mockResolvedValue({ id: 'stu-1', firstName: 'Aarav' });

      const result = await service.create('t-1', 'br-1', {
        classId: 'cl-1',
        admissionNumber: 'ADM001',
        firstName: 'Aarav',
        lastName: 'Shah',
        academicYear: '2025-26',
      } as any, 'actor-1');

      expect(result).toBeDefined();
      expect(mockPrismaService.student.create).toHaveBeenCalled();
    });

    // PR-2.5 NOTE: this test's name/intent ("admission number ... conflicts")
    // does not match what StudentsService.create() actually checks today --
    // grep confirms there is no admission-number-uniqueness lookup anywhere
    // in create() (see students.service.ts). The original mock
    // (student.findFirst returning an existing row) was never consulted by
    // the real code, so this test could never have caught a real duplicate-
    // admission-number bug even before PR-1/PR-2. Rewritten here to exercise
    // a throw path that genuinely exists (missing/invalid class) rather than
    // silently leaving a mock that asserts nothing real. Whether admission
    // numbers should be enforced unique is a product question for the
    // Students module owner, not something to decide inside a test-infra PR.
    it('should throw NotFoundException when the target class does not exist', async () => {
      mockPrismaService.class.findFirst.mockResolvedValue(null);

      await expect(
        service.create('t-1', 'br-1', {
          classId: 'nonexistent-class',
          admissionNumber: 'ADM001',
          branchId: 'br-1',
          firstName: 'X',
          lastName: 'Y',
          academicYear: '2025-26'
        } as any, 'actor-1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should fetch paginated arrays list using correct branch matching context length signatures', async () => {
      mockPrismaService.student.findMany.mockResolvedValue([{ id: 'stu-1' }]);
      mockPrismaService.student.count.mockResolvedValue(1);

      const result = await service.findAll('t-1', 'br-1', { page: 1, limit: 20 });

      expect(result).toBeDefined();
      expect(mockPrismaService.student.findMany).toHaveBeenCalled();
    });

    it('should fallback securely on empty filter arguments payload maps', async () => {
      mockPrismaService.student.findMany.mockResolvedValue([]);
      mockPrismaService.student.count.mockResolvedValue(0);

      const result = await service.findAll('t-1', 'br-1', {});

      expect(result).toBeDefined();
    });
  });
});
