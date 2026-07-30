import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TripAttendanceService } from './trip-attendance.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('TripAttendanceService', () => {
  let service: TripAttendanceService;
  let prisma: any;
  let audit: any;

  const branchUser = {
    id: 'u-1',
    tenantId: 't-1',
    role: 'TRANSPORT_MANAGER',
    branchId: 'b-1',
    branchIds: ['b-1'],
    email: 'tm@school.test',
    jti: 'jti-1',
  } as unknown as AuthenticatedUser;

  const morningTrip = { id: 'trip-1', tenantId: 't-1', branchId: 'b-1', routeId: 'r-1', tripType: 'MORNING' };
  const eveningTrip = { ...morningTrip, id: 'trip-2', tripType: 'EVENING' };

  beforeEach(async () => {
    prisma = {
      trip: { findFirst: jest.fn() },
      studentTransportAssignment: { findMany: jest.fn() },
      tripAttendance: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    audit = { logCreate: jest.fn().mockResolvedValue(undefined), logUpdate: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        TripAttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TripAttendanceService);
  });

  describe('getRoster', () => {
    it('defaults to PICKUP for a MORNING trip and joins existing attendance', async () => {
      prisma.trip.findFirst.mockResolvedValue(morningTrip);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([
        { id: 'a-1', studentId: 'stu-1', student: { id: 'stu-1', firstName: 'Aarav', lastName: 'Sharma' } },
      ]);
      prisma.tripAttendance.findMany.mockResolvedValue([
        { studentId: 'stu-1', status: 'BOARDED', markedAt: new Date('2026-08-01T07:35:00Z') },
      ]);

      const result = await service.getRoster(branchUser, 'trip-1');

      expect(result.boardingType).toBe('PICKUP');
      expect(result.roster[0]).toMatchObject({
        studentId: 'stu-1',
        studentName: 'Aarav Sharma',
        attendanceStatus: 'BOARDED',
      });
    });

    it('defaults to DROP for an EVENING trip', async () => {
      prisma.trip.findFirst.mockResolvedValue(eveningTrip);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([]);
      prisma.tripAttendance.findMany.mockResolvedValue([]);

      const result = await service.getRoster(branchUser, 'trip-2');
      expect(result.boardingType).toBe('DROP');
      expect(prisma.tripAttendance.findMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-2', boardingType: 'DROP' },
      });
    });

    it('reports NOT_MARKED for a student with no attendance row yet', async () => {
      prisma.trip.findFirst.mockResolvedValue(morningTrip);
      prisma.studentTransportAssignment.findMany.mockResolvedValue([
        { id: 'a-1', studentId: 'stu-2', student: { id: 'stu-2', firstName: 'Diya', lastName: 'Verma' } },
      ]);
      prisma.tripAttendance.findMany.mockResolvedValue([]);

      const result = await service.getRoster(branchUser, 'trip-1');
      expect(result.roster[0].attendanceStatus).toBe('NOT_MARKED');
    });

    it('throws NotFoundException for a trip outside the caller scope', async () => {
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(service.getRoster(branchUser, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAttendance', () => {
    it('creates a new attendance row when none exists yet', async () => {
      prisma.trip.findFirst.mockResolvedValue(morningTrip);
      prisma.tripAttendance.findFirst.mockResolvedValue(null);
      const created = { id: 'ta-1', tripId: 'trip-1', studentId: 'stu-1', boardingType: 'PICKUP', status: 'BOARDED' };
      prisma.tripAttendance.create.mockResolvedValue(created);

      const result = await service.markAttendance(branchUser, 'trip-1', { studentId: 'stu-1', status: 'BOARDED' });

      expect(result).toBe(created);
      expect(prisma.tripAttendance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tripId: 'trip-1', studentId: 'stu-1', boardingType: 'PICKUP', status: 'BOARDED' }),
      });
      expect(audit.logCreate).toHaveBeenCalled();
    });

    it('updates (re-marks) an existing attendance row instead of duplicating (Student No-show -> corrected to BOARDED)', async () => {
      prisma.trip.findFirst.mockResolvedValue(morningTrip);
      const existing = { id: 'ta-1', status: 'ABSENT' };
      prisma.tripAttendance.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, status: 'BOARDED' };
      prisma.tripAttendance.update.mockResolvedValue(updated);

      const result = await service.markAttendance(branchUser, 'trip-1', { studentId: 'stu-1', status: 'BOARDED' });

      expect(result).toBe(updated);
      expect(prisma.tripAttendance.update).toHaveBeenCalledWith({
        where: { id: 'ta-1' },
        data: expect.objectContaining({ status: 'BOARDED' }),
      });
      expect(prisma.tripAttendance.create).not.toHaveBeenCalled();
      expect(audit.logUpdate).toHaveBeenCalled();
    });

    it('respects an explicit boardingType override even on a MORNING trip', async () => {
      prisma.trip.findFirst.mockResolvedValue(morningTrip);
      prisma.tripAttendance.findFirst.mockResolvedValue(null);
      prisma.tripAttendance.create.mockResolvedValue({ id: 'ta-1' });

      await service.markAttendance(branchUser, 'trip-1', { studentId: 'stu-1', status: 'BOARDED', boardingType: 'DROP' });

      expect(prisma.tripAttendance.findFirst).toHaveBeenCalledWith({
        where: { tripId: 'trip-1', studentId: 'stu-1', boardingType: 'DROP' },
      });
    });
  });
});
