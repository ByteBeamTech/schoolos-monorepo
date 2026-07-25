// backend/src/modules/examinations/services/examinations.service.spec.ts
//
// Narrow by design — guards that ExaminationsService.getStudentResult() and
// getClassResults() route grade computation through the canonical shared
// grading.util (architecture freeze §3.5), fetching tenant/session-scoped
// GradeBoundary rows via the exam's sessionId, instead of the two
// hardcoded A+/A/B+/B/C/D/F scales that previously existed here
// unconditionally (GradeBoundary was never consulted by this service
// before this change). No spec file existed for this service before this
// change.

import { Test, TestingModule } from '@nestjs/testing';
import { ExaminationsService } from './examinations.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('ExaminationsService', () => {
  let service: ExaminationsService;

  const mockPrismaService = {
    exam: {
      findFirst: jest.fn(),
      findMany:  jest.fn(),
      create:    jest.fn(),
      update:    jest.fn(),
      count:     jest.fn(),
    },
    examSchedule: {
      findFirst: jest.fn(),
      findMany:  jest.fn(),
      create:    jest.fn(),
    },
    mark: {
      findMany: jest.fn(),
      upsert:   jest.fn(),
    },
    student: {
      findMany: jest.fn(),
    },
    gradeBoundary: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExaminationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ExaminationsService>(ExaminationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStudentResult', () => {
    it('grades the result using GradeBoundary rows scoped to the exam session, not a hardcoded scale', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        schedules: [{ maxMarks: 100, passMarks: 33 }],
      });
      mockPrismaService.mark.findMany.mockResolvedValue([
        { marksObtained: 95, isAbsent: false, schedule: { passMarks: 33 } },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([
        { minMark: 90, maxMark: 100, grade: 'DISTINCTION' },
      ]);

      const result = await service.getStudentResult('tenant-1', 'exam-1', 'stu-1');

      // Previously always 'A+' regardless of configuration; now must reflect
      // the tenant/session's own configured boundary.
      expect(result.grade).toBe('DISTINCTION');
      expect(mockPrismaService.gradeBoundary.findMany).toHaveBeenCalledWith({
        where:   { tenantId: 'tenant-1', sessionId: 'session-1' },
        orderBy: { minMark: 'desc' },
      });
    });

    it('returns N/A when no GradeBoundary is configured, rather than a hardcoded grade', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue({
        id: 'exam-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        schedules: [{ maxMarks: 100, passMarks: 33 }],
      });
      mockPrismaService.mark.findMany.mockResolvedValue([
        { marksObtained: 95, isAbsent: false, schedule: { passMarks: 33 } },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getStudentResult('tenant-1', 'exam-1', 'stu-1');

      expect(result.grade).toBe('N/A');
    });
  });

  describe('getClassResults', () => {
    it('grades class results using GradeBoundary rows resolved from the exam session', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue({ sessionId: 'session-1' });
      mockPrismaService.examSchedule.findMany.mockResolvedValue([{ id: 'sch-1', maxMarks: 100 }]);
      mockPrismaService.mark.findMany.mockResolvedValue([
        { studentId: 'stu-1', scheduleId: 'sch-1', marksObtained: 95, isAbsent: false, schedule: { maxMarks: 100, passMarks: 33, subjectId: 'sub-1' } },
      ]);
      mockPrismaService.student.findMany.mockResolvedValue([
        { id: 'stu-1', firstName: 'A', lastName: 'B', admissionNumber: 'ADM1', rollNumber: '1' },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([
        { minMark: 90, maxMark: 100, grade: 'DISTINCTION' },
      ]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1');

      expect(result.results[0].grade).toBe('DISTINCTION');
    });
  });
});
