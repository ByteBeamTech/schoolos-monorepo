// backend/src/modules/gradebook/services/report-card.service.spec.ts
//
// Narrow by design. Covers two things:
//   1. ReportCardService.getStudentReportCard() routes grade computation
//      through the canonical shared grading.util (architecture freeze
//      §3.5) and no longer falls back to the locally hardcoded
//      A+/A/B+/B/C/D/F scale that previously existed here.
//   2. ReportCardService.getStudentReportCard() resolves subject names via
//      a separate lookup rather than an invalid
//      `schedules: { include: { subject: true } }` (ExamSchedule has no
//      `subject` relation) -- architecture freeze §13.1.

import { Test, TestingModule } from '@nestjs/testing';
import { ReportCardService } from './report-card.service';
import { PrismaService } from '@infra/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ReportCardService', () => {
  let service: ReportCardService;

  const mockPrismaService = {
    exam: {
      findFirst: jest.fn(),
    },
    student: {
      findFirst: jest.fn(),
    },
    mark: {
      findMany: jest.fn(),
    },
    gradeBoundary: {
      findMany: jest.fn(),
    },
    subject: {
      findMany: jest.fn(),
    },
    attendance: {
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportCardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<ReportCardService>(ReportCardService);
    jest.clearAllMocks();
    mockPrismaService.attendance.count.mockResolvedValue(0);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStudentReportCard', () => {
    // NOTE: schedules deliberately carry only the scalar `subjectId` column,
    // matching the real ExamSchedule model -- there is no `subject` relation
    // to include. Subject names are resolved via a separate lookup.
    const baseExam = {
      id: 'exam-1',
      name: 'Half Yearly',
      session: { name: '2025-26' },
      schedules: [
        { id: 'sch-1', classId: 'class-1', subjectId: 'sub-1', maxMarks: 100, passMarks: 33 },
      ],
    };
    const baseStudent = {
      id: 'stu-1',
      firstName: 'A',
      lastName: 'B',
      admissionNumber: 'ADM1',
      rollNumber: '1',
      section: { name: 'A', class: { id: 'class-1', name: '5' } },
    };

    const setUpMarks = () => {
      mockPrismaService.mark.findMany
        .mockResolvedValueOnce([{ scheduleId: 'sch-1', marksObtained: 95, isAbsent: false }]) // student's own marks
        .mockResolvedValueOnce([{ studentId: 'stu-1', marksObtained: 95, isAbsent: false }]); // class marks for ranking
      mockPrismaService.subject.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Math' }]);
    };

    it('grades the student using the configured GradeBoundary rows', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue(baseExam);
      mockPrismaService.student.findFirst.mockResolvedValue(baseStudent);
      setUpMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([
        { minMark: 90, maxMark: 100, grade: 'A+' },
      ]);

      const result = await service.getStudentReportCard('tenant-1', 'exam-1', 'stu-1', 'session-1');

      expect(result.subjects[0].grade).toBe('A+');
      expect(result.grade).toBe('A+');
    });

    it('returns N/A rather than the old hardcoded scale when no GradeBoundary is configured', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue(baseExam);
      mockPrismaService.student.findFirst.mockResolvedValue(baseStudent);
      setUpMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getStudentReportCard('tenant-1', 'exam-1', 'stu-1', 'session-1');

      // Previously this would have returned 'A+' from the hardcoded fallback
      // scale (95% >= 90). Architecture freeze §3.5 forbids that fallback.
      expect(result.subjects[0].grade).toBe('N/A');
      expect(result.grade).toBe('N/A');
    });

    it('resolves the subject name via a separate lookup, not a relation include', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue(baseExam);
      mockPrismaService.student.findFirst.mockResolvedValue(baseStudent);
      setUpMarks();
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getStudentReportCard('tenant-1', 'exam-1', 'stu-1', 'session-1');

      // exam.findFirst must not request schedules.include.subject.
      const examCallArgs = mockPrismaService.exam.findFirst.mock.calls[0][0];
      expect(examCallArgs.include.schedules?.include?.subject).toBeUndefined();

      // The subject name is still correctly resolved via the separate lookup.
      expect(result.subjects[0].name).toBe('Math');
    });

    it('falls back to the subjectId as the subject name when no matching subject is found', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue(baseExam);
      mockPrismaService.student.findFirst.mockResolvedValue(baseStudent);
      mockPrismaService.mark.findMany
        .mockResolvedValueOnce([{ scheduleId: 'sch-1', marksObtained: 95, isAbsent: false }])
        .mockResolvedValueOnce([{ studentId: 'stu-1', marksObtained: 95, isAbsent: false }]);
      mockPrismaService.subject.findMany.mockResolvedValue([]); // no matching subject row
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getStudentReportCard('tenant-1', 'exam-1', 'stu-1', 'session-1');

      expect(result.subjects[0].name).toBe('sub-1');
    });
  });
});
