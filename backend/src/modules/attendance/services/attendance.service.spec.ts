import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException }   from '@nestjs/common';
import { EventEmitter2 }       from '@nestjs/event-emitter';
import { AttendanceService }   from './attendance.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }        from '../../../core/compliance/audit.service';
import { CalendarEngineService } from '../../academic-calendar/services/calendar-engine.service';

const mockSection = { id: 'sec-1', tenantId: 't-1', name: 'A', classId: 'cls-1' };
const mockAttendancePayload = {
  date: '2025-04-01', sectionId: 'sec-1', sessionId: 'sess-1',
  attendance: [
    { studentId: 'stu-1', status: 'PRESENT', remarks: null },
    { studentId: 'stu-2', status: 'ABSENT',  remarks: 'Sick' },
    { studentId: 'stu-3', status: 'LATE',    remarks: null },
  ],
};

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma:  jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: {
            section:    { findFirst: jest.fn().mockResolvedValue(mockSection) },
            academicSession: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'sess-1', tenantId: 't-1',
                startDate: new Date('2025-01-01'),
                endDate:   new Date('2025-12-31'),
                isLocked:  false,
              }),
            },
            attendance: {
              findFirst: jest.fn().mockResolvedValue(null),
              create:    jest.fn().mockResolvedValue({}),
              update:    jest.fn().mockResolvedValue({}),
            },
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: CalendarEngineService,
          useValue: {
            isWorkingDay: jest.fn().mockResolvedValue({ workingDay: true }),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma  = module.get(PrismaService);
  });

  // TEST 12
  it('marks attendance for all students in section using upsert', async () => {
    const result = await service.bulkMarkDaily('t-1', mockAttendancePayload as any, 'actor-1', 'SCHOOL_ADMIN');
    expect(prisma.attendance.create).toHaveBeenCalledTimes(3);
    expect(result.marked).toBe(3);
    expect(result.present).toBe(1);
    expect(result.absent).toBe(1);
  });

  // TEST 13
  it('throws NotFoundException for unknown section', async () => {
    (prisma.section.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.bulkMarkDaily('t-1', mockAttendancePayload as any, 'actor-1', 'SCHOOL_ADMIN'),
    ).rejects.toThrow(NotFoundException);
  });

  // TEST 14 — KEY TEST: Re-marking should NOT throw (was broken before Phase 1 fix)
  it('allows re-marking attendance (idempotent — no conflict exception)', async () => {
    (prisma.attendance.findFirst as jest.Mock).mockResolvedValue({ id: 'att-existing' });

    await expect(
      service.bulkMarkDaily('t-1', mockAttendancePayload as any, 'actor-1', 'SCHOOL_ADMIN'),
    ).resolves.toBeDefined();
  });

  // TEST 15
  it('returns correct summary counts: present, absent, late', async () => {
    const result = await service.bulkMarkDaily('t-1', mockAttendancePayload as any, 'actor-1', 'SCHOOL_ADMIN');
    expect(result).toMatchObject({
      date:      '2025-04-01',
      sectionId: 'sec-1',
      marked:    3,
      present:   1,
      absent:    1,
      late:      1,
    });
  });

  // TEST 16
  it('upsert is called with correct student status and actorId', async () => {
    await service.bulkMarkDaily('t-1', mockAttendancePayload as any, 'actor-99', 'SCHOOL_ADMIN');
    const firstCall = (prisma.attendance.create as jest.Mock).mock.calls[0][0];
    expect(firstCall.data.markedBy).toBe('actor-99');
    expect(firstCall.data.status).toBe('PRESENT');
  });
});
