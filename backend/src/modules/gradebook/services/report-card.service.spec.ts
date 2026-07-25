// backend/src/modules/gradebook/services/report-card.service.spec.ts
//
// Narrow by design — guards that ReportCardService.getStudentReportCard()
// routes grade computation through the canonical shared grading.util
// (architecture freeze §3.5) and no longer falls back to the locally
// hardcoded A+/A/B+/B/C/D/F scale that previously existed here. No spec
// file existed for this service before this change.

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
    const baseExam = {
      id: 'exam-1',
      name: 'Half Yearly',
      session: { name: '2025-26' },
      schedules: [
        { id: 'sch-1', classId: 'class-1', subjectId: 'sub-1', maxMarks: 100, passMarks: 33, subject: { name: 'Math' } },
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

    it('grades the student using the configured GradeBoundary rows', async () => {
      mockPrismaService.exam.findFirst.mockResolvedValue(baseExam);
      mockPrismaService.student.findFirst.mockResolvedValue(baseStudent);
      mockPrismaService.mark.findMany
        .mockResolvedValueOnce([{ scheduleId: 'sch-1', marksObtained: 95, isAbsent: false }]) // student's own marks
        .mockResolvedValueOnce([{ studentId: 'stu-1', marksObtained: 95, isAbsent: false }]); // class marks for ranking
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
      mockPrismaService.mark.findMany
        .mockResolvedValueOnce([{ scheduleId: 'sch-1', marksObtained: 95, isAbsent: false }])
        .mockResolvedValueOnce([{ studentId: 'stu-1', marksObtained: 95, isAbsent: false }]);
      mockPrismaService.gradeBoundary.findMany.mockResolvedValue([]);

      const result = await service.getStudentReportCard('tenant-1', 'exam-1', 'stu-1', 'session-1');

      // Previously this would have returned 'A+' from the hardcoded fallback
      // scale (95% >= 90). Architecture freeze §3.5 forbids that fallback.
      expect(result.subjects[0].grade).toBe('N/A');
      expect(result.grade).toBe('N/A');
    });
  });
});
