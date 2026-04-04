import { Test, TestingModule }  from '@nestjs/testing';
import { ConflictException }    from '@nestjs/common';
import { StudentsService }      from './students.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }         from '../../../core/compliance/audit.service';

const mockStudent = {
  id: 'stu-1', tenantId: 't-1', branchId: 'br-1',
  admissionNumber: 'ADM001', firstName: 'Aarav', lastName: 'Shah',
  academicYear: '2025-26', isActive: true, createdAt: new Date(),
  section: { class: { name: 'Class 5' }, name: 'A' },
};

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma:  jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findFirst: jest.fn().mockResolvedValue(null), // default: no conflict
              create:    jest.fn().mockResolvedValue(mockStudent),
              findMany:  jest.fn().mockResolvedValue([mockStudent]),
              count:     jest.fn().mockResolvedValue(1),
            },
          },
        },
        { provide: AuditService, useValue: { logCreate: jest.fn(), log: jest.fn() } },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma  = module.get(PrismaService);
  });

  // TEST 17
  it('creates a student and returns it', async () => {
    const result = await service.create('t-1', {
      branchId: 'br-1', admissionNumber: 'ADM001',
      firstName: 'Aarav', lastName: 'Shah', academicYear: '2025-26',
    } as any, 'actor-1');
    expect(result.admissionNumber).toBe('ADM001');
    expect(prisma.student.create).toHaveBeenCalled();
  });

  // TEST 18
  it('throws ConflictException for duplicate admission number', async () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(mockStudent);
    await expect(
      service.create('t-1', { admissionNumber: 'ADM001', branchId: 'br-1', firstName: 'X', lastName: 'Y', academicYear: '2025-26' } as any, 'actor-1'),
    ).rejects.toThrow(ConflictException);
  });

  // TEST 19
  it('findAll returns paginated list', async () => {
    const result = await service.findAll('t-1', { page: 1, limit: 20 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toBeDefined();
  });

  // TEST 20
  it('does not expose passwordHash in findAll response', async () => {
    const withPw = { ...mockStudent, passwordHash: 'secret-hash' };
    (prisma.student.findMany as jest.Mock).mockResolvedValue([withPw]);
    const result = await service.findAll('t-1', {});
    result.data.forEach((s: any) => {
      expect(s.passwordHash).toBeUndefined();
    });
  });
});
