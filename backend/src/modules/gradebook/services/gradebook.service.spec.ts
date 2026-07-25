// backend/src/modules/gradebook/services/gradebook.service.spec.ts
//
// Narrow by design. Covers two things:
//   1. GradebookService.getClassResults() routes grade computation through
//      the canonical shared grading.util (architecture freeze §3.5).
//   2. GradebookService.getClassResults() resolves subject names and
//      student details via separate lookups rather than an invalid
//      `include: { subject: true }` / `include: { student: true }` (neither
//      relation exists on ExamSchedule/Mark) -- architecture freeze §13.1.

import { Test, TestingModule } from '@nestjs/testing';
import { GradebookService } from './gradebook.service';
import { PrismaService } from '@infra/database/prisma.service';

describe('GradebookService', () => {
  let service: GradebookService;

  const mockPrismaService = {
    gradeBoundary: {
      findMany:  jest.fn(),
      create:    jest.fn(),
      findFirst: jest.fn(),
      delete:    jest.fn(),
    },
    examSchedule: {
      findMany: jest.fn(),
    },
    mark: {
      findMany: jest.fn(),
    },
    subject: {
      findMany: jest.fn(),
    },
    student: {
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
    const setUpSchedulesAndMarks = () => {
      // ExamSchedule.findMany must NOT be queried with a `subject` include
      // (ExamSchedule has no such relation) -- only scalar columns.
      mockPrismaService.examSchedule.findMany.mockResolvedValue([
        { id: 'sch-1', subjectId: 'sub-1', maxMarks: 100 },
      ]);
      mockPrismaService.subject.findMany.mockResolvedValue([
        { id: 'sub-1', name: 'Math' },
      ]);
      // Mark.findMany must NOT be queried with a `student` include (Mark has
      // no such relation) -- only scalar columns.
      mockPrismaService.mark.findMany.mockResolvedValue([
        { studentId: 'stu-1', scheduleId: 'sch-1', marksObtained: 95, isAbsent: false },
      ]);
      mockPrismaService.student.findMany.mockResolvedValue([
        { id: 'stu-1', firstName: 'A', lastName: 'B', admissionNumber: 'ADM1', rollNumber: '1' },
      ]);
    };

    it('grades each subject and the overall total using the configured GradeBoundary rows', async () => {
      setUpSchedulesAndMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([
        { minMark: 90, maxMark: 100, grade: 'A+' },
        { minMark: 0, maxMark: 89.99, grade: 'B' },
      ]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      expect(result.results[0].subjects['Math'].grade).toBe('A+');
      expect(result.results[0].grade).toBe('A+');
    });

    it('returns N/A rather than a hardcoded scale when no boundary matches', async () => {
      setUpSchedulesAndMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      expect(result.results[0].grade).toBe('N/A');
    });

    it('resolves subject names and student details via separate lookups, not a relation include', async () => {
      setUpSchedulesAndMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      // examSchedule.findMany must not request a `subject` include.
      const scheduleCallArgs = mockPrismaService.examSchedule.findMany.mock.calls[0][0];
      expect(scheduleCallArgs.include).toBeUndefined();

      // mark.findMany must not request a `student` include.
      const markCallArgs = mockPrismaService.mark.findMany.mock.calls[0][0];
      expect(markCallArgs.include).toBeUndefined();

      // Subject and student details are still correctly resolved via the
      // separate lookups.
      expect(result.results[0].subjects['Math']).toBeDefined();
      expect(result.results[0].studentName).toBe('A B');
      expect(result.results[0].admissionNo).toBe('ADM1');
    });

    it('falls back to the scheduleId as the subject key when no matching subject is found', async () => {
      mockPrismaService.examSchedule.findMany.mockResolvedValue([
        { id: 'sch-1', subjectId: 'sub-missing', maxMarks: 100 },
      ]);
      mockPrismaService.subject.findMany.mockResolvedValue([]);
      mockPrismaService.mark.findMany.mockResolvedValue([
        { studentId: 'stu-1', scheduleId: 'sch-1', marksObtained: 95, isAbsent: false },
      ]);
      mockPrismaService.student.findMany.mockResolvedValue([
        { id: 'stu-1', firstName: 'A', lastName: 'B', admissionNumber: 'ADM1', rollNumber: '1' },
      ]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getClassResults('tenant-1', 'exam-1', 'class-1', 'session-1');

      expect(result.results[0].subjects['sch-1']).toBeDefined();
    });
  });
});
