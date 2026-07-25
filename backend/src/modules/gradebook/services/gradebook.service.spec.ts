// backend/src/modules/gradebook/services/gradebook.service.spec.ts
//
// Narrow by design — guards that GradebookService.getClassResults() routes
// grade computation through the canonical shared grading.util (architecture
// freeze §3.5) rather than a local implementation. No spec file existed for
// this service before this change.

import { Test, TestingModule } from '@nestjs/testing';
import { GradebookService } from './gradebook.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('GradebookService', () => {
  let service: GradebookService;

  const mockPrismaService = {
    gradeBoundary: {
      findMany: jest.fn(),
      create:   jest.fn(),
      findFirst: jest.fn(),
      delete:   jest.fn(),
    },
    examSchedule: {
      findMany: jest.fn(),
    },
    mark: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradebookService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GradebookService>(GradebookService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClassResults', () => {
    it('grades each subject and the overall total using the configured GradeBoundary rows', async () => {
      mockPrismaService.examSchedule.findMany.mockResolvedValue([
        { id: 'sch-1', subject: { name: 'Math' }, maxMarks: 100 },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([
        { minMark: 90, maxMark: 100, grade: 'A+' },
        { minMark: 0, maxMark: 89.99, grade: 'B' },
      ]);
      mockPrismaService.mark.findMany.mockResolvedValue([
        {
          studentId: 'stu-1',
          scheduleId: 'sch-1',
          marksObtained: 95,
          isAbsent: false,
          student: { firstName: 'A', lastName: 'B', admissionNumber: 'ADM1', rollNumber: '1' },
        },
      ]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      expect(result.results[0].subjects['Math'].grade).toBe('A+');
      expect(result.results[0].grade).toBe('A+');
    });

    it('returns N/A rather than a hardcoded scale when no boundary matches', async () => {
      mockPrismaService.examSchedule.findMany.mockResolvedValue([
        { id: 'sch-1', subject: { name: 'Math' }, maxMarks: 100 },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);
      mockPrismaService.mark.findMany.mockResolvedValue([
        {
          studentId: 'stu-1',
          scheduleId: 'sch-1',
          marksObtained: 95,
          isAbsent: false,
          student: { firstName: 'A', lastName: 'B', admissionNumber: 'ADM1', rollNumber: '1' },
        },
      ]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      expect(result.results[0].grade).toBe('N/A');
    });
  });
});
