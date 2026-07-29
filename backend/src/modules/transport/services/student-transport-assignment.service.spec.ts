import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StudentTransportAssignmentService } from './student-transport-assignment.service';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '@core/compliance/audit.service';
import { TransportSettingsService } from './transport-settings.service';
import type { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

describe('StudentTransportAssignmentService', () => {
  let service: StudentTransportAssignmentService;
  let prisma: any;
  let audit: any;
  let settings: any;

  const branchUser = {
    id: 'u-1',
    tenantId: 't-1',
    role: 'TRANSPORT_MANAGER',
    branchId: 'b-1',
    branchIds: ['b-1'],
    email: 'tm@school.test',
    jti: 'jti-1',
  } as unknown as AuthenticatedUser;

  const route = { id: 'r-1', tenantId: 't-1', branchId: 'b-1', deletedAt: null };
  const student = { id: 'stu-1', tenantId: 't-1', branchId: 'b-1' };
  const pickupStop = { id: 'rs-pickup', routeId: 'r-1' };
  const dropStop = { id: 'rs-drop', routeId: 'r-1' };

  const activeAssignment = {
    id: 'a-1',
    tenantId: 't-1',
    branchId: 'b-1',
    studentId: 'stu-1',
    routeId: 'r-1',
    pickupRouteStopId: 'rs-pickup',
    dropRouteStopId: 'rs-drop',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    prisma = {
      student: { findFirst: jest.fn() },
      route: { findFirst: jest.fn() },
      routeStop: { findFirst: jest.fn() },
      transportStopPricing: { findFirst: jest.fn() },
      studentTransportAssignment: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
      eventOutbox: { create: jest.fn().mockResolvedValue(undefined) },
      $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };
    audit = { logCreate: jest.fn().mockResolvedValue(undefined), logUpdate: jest.fn().mockResolvedValue(undefined) };
    settings = { getOrCreate: jest.fn().mockResolvedValue({ allowMultipleActiveAssignments: false }) };

    const module = await Test.createTestingModule({
      providers: [
        StudentTransportAssignmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: TransportSettingsService, useValue: settings },
      ],
    }).compile();
    service = module.get(StudentTransportAssignmentService);
  });

  describe('assign', () => {
    const dto = { studentId: 'stu-1', routeId: 'r-1', pickupRouteStopId: 'rs-pickup', dropRouteStopId: 'rs-drop' };

    beforeEach(() => {
      prisma.student.findFirst.mockResolvedValue(student);
      prisma.route.findFirst.mockResolvedValue(route);
      prisma.routeStop.findFirst.mockImplementation(({ where }: any) =>
        where.id === 'rs-pickup' ? pickupStop : where.id === 'rs-drop' ? dropStop : null,
      );
    });

    it('creates the assignment and writes the event atomically', async () => {
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(null); // no existing active
      prisma.studentTransportAssignment.create = jest.fn().mockResolvedValue(activeAssignment);

      const result = await service.assign(branchUser, dto);

      expect(result).toBe(activeAssignment);
      expect(prisma.eventOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'transport.student.assigned' }) }),
      );
      expect(audit.logCreate).toHaveBeenCalled();
    });

    it('rejects a duplicate active assignment when allowMultipleActiveAssignments is false', async () => {
      settings.getOrCreate.mockResolvedValue({ allowMultipleActiveAssignments: false });
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(activeAssignment); // already has one

      await expect(service.assign(branchUser, dto)).rejects.toThrow(ConflictException);
    });

    it('allows a duplicate active assignment when the branch policy permits it', async () => {
      settings.getOrCreate.mockResolvedValue({ allowMultipleActiveAssignments: true });
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(activeAssignment);
      prisma.studentTransportAssignment.create = jest.fn().mockResolvedValue(activeAssignment);

      await expect(service.assign(branchUser, dto)).resolves.toBe(activeAssignment);
    });

    it('rejects when pickupRouteStopId is not actually a stop on the given route', async () => {
      prisma.routeStop.findFirst.mockImplementation(({ where }: any) => (where.id === 'rs-drop' ? dropStop : null));
      await expect(service.assign(branchUser, dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects when the student belongs to a different branch than the route', async () => {
      prisma.student.findFirst.mockResolvedValue({ ...student, branchId: 'b-OTHER' });
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(null);
      await expect(service.assign(branchUser, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('ends an ACTIVE assignment', async () => {
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(activeAssignment);
      prisma.studentTransportAssignment.update.mockResolvedValue({ ...activeAssignment, status: 'ENDED' });

      const result = await service.remove(branchUser, 'a-1', {});
      expect(result.status).toBe('ENDED');
    });

    it('rejects removing an already-ENDED assignment', async () => {
      prisma.studentTransportAssignment.findFirst.mockResolvedValue({ ...activeAssignment, status: 'ENDED' });
      await expect(service.remove(branchUser, 'a-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('transfer wizard (AF-007)', () => {
    const transferDto = { newRouteId: 'r-2', newPickupRouteStopId: 'rs2-pickup', newDropRouteStopId: 'rs2-drop' };
    const newRoute = { id: 'r-2', tenantId: 't-1', branchId: 'b-1', deletedAt: null };
    const newPickup = { id: 'rs2-pickup', routeId: 'r-2' };
    const newDrop = { id: 'rs2-drop', routeId: 'r-2' };

    beforeEach(() => {
      prisma.studentTransportAssignment.findFirst.mockResolvedValue(activeAssignment);
      prisma.route.findFirst.mockResolvedValue(newRoute);
      prisma.routeStop.findFirst.mockImplementation(({ where }: any) =>
        where.id === 'rs2-pickup' ? newPickup : where.id === 'rs2-drop' ? newDrop : null,
      );
    });

    it('preview returns fee delta and an impactToken', async () => {
      prisma.transportStopPricing.findFirst
        .mockResolvedValueOnce({ feeAmount: 500 }) // old
        .mockResolvedValueOnce({ feeAmount: 700 }); // new

      const preview = await service.previewTransfer(branchUser, 'a-1', transferDto);

      expect(preview.currentMonthlyFee).toBe(500);
      expect(preview.newMonthlyFee).toBe(700);
      expect(preview.feeDelta).toBe(200);
      expect(typeof preview.impactToken).toBe('string');
    });

    it('confirm succeeds with a matching impactToken and ends the old assignment atomically', async () => {
      prisma.transportStopPricing.findFirst.mockResolvedValue(null);
      const preview = await service.previewTransfer(branchUser, 'a-1', transferDto);

      const newAssignmentRow = { ...activeAssignment, id: 'a-2', routeId: 'r-2' };
      prisma.studentTransportAssignment.update.mockResolvedValue({ ...activeAssignment, status: 'TRANSFERRED' });
      prisma.studentTransportAssignment.create = jest.fn().mockResolvedValue(newAssignmentRow);

      const result = await service.confirmTransfer(branchUser, 'a-1', {
        ...transferDto,
        impactToken: preview.impactToken,
      });

      expect(result.newAssignment).toBe(newAssignmentRow);
      expect(prisma.studentTransportAssignment.update).toHaveBeenCalledWith({
        where: { id: 'a-1' },
        data: expect.objectContaining({ status: 'TRANSFERRED' }),
      });
      expect(prisma.eventOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'transport.student.transferred' }) }),
      );
    });

    it('confirm rejects a stale impactToken', async () => {
      await expect(
        service.confirmTransfer(branchUser, 'a-1', { ...transferDto, impactToken: 'stale' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.studentTransportAssignment.update).not.toHaveBeenCalled();
    });

    it('rejects transferring a non-ACTIVE assignment', async () => {
      prisma.studentTransportAssignment.findFirst.mockResolvedValue({ ...activeAssignment, status: 'ENDED' });
      await expect(service.previewTransfer(branchUser, 'a-1', transferDto)).rejects.toThrow(BadRequestException);
    });
  });
});
