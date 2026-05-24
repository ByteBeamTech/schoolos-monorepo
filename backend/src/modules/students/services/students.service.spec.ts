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
      mockPrismaService.student.findFirst.mockResolvedValue(null);
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

    it('should throw an exception if admission number holds configuration conflicts inside campus', async () => {
      mockPrismaService.student.findFirst.mockResolvedValue({ id: 'existing-stu' });

      await expect(
        service.create('t-1', 'br-1', { 
          classId: 'cl-1',
          admissionNumber: 'ADM001', 
          branchId: 'br-1', 
          firstName: 'X', 
          lastName: 'Y', 
          academicYear: '2025-26' 
        } as any, 'actor-1')
      ).rejects.toThrow();
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
