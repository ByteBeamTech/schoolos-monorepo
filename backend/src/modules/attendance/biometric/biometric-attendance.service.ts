import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 }      from '@nestjs/event-emitter';
import { PrismaService } from '@infra/database/prisma.service';
import { GenericBiometricAdapter } from '../../../infra/iot-bridge/adapters/biometric/generic';
import { normalizeDeviceEvent }    from '../../../infra/iot-bridge/normalizer';
import type { DeviceConfig, DeviceEvent } from '../../../infra/iot-bridge/contracts';

export interface RegisteredDevice {
  id:         string;
  tenantId:   string;
  config:     DeviceConfig;
  sectionId?: string;
  adapter?:   InstanceType<typeof GenericBiometricAdapter>;
}

// TODO (found during PR-5C's Attendance audit, not fixed here --
// production-safety discipline, same treatment as PR-5B's
// ApplicationService.finalize() finding): this service is not registered
// as a provider in AttendanceModule, has no controller, and has zero
// callers anywhere in the codebase (confirmed via grep) -- fully dead
// code. Not given an entitlement check for the same reason
// ApplicationService.finalize() wasn't: wiring one into dead code has no
// effect and would be misleading about actual coverage.
//
// PR-5C's broader conclusion (see PR-5 handoff doc): Attendance has no
// license-governed concept at all right now, live or dead -- core
// attendance/leave marking is intentionally unrestricted (no numeric
// quota makes product sense, and the one piece of commercial-intent
// evidence in the codebase, flag-definitions.ts's MODULE_ATTENDANCE,
// explicitly marks it core/always-on for every tier). IF this service is
// ever wired up (real biometric hardware integration), it would be the
// one plausible feature-gate candidate here (hardware/device-integration
// features are a natural "premium add-on," matching the WhatsApp/AI
// precedent) -- but per explicit instruction, no feature string or
// entitlement check is introduced speculatively. Revisit when/if this
// service actually gets a controller and a live caller.
@Injectable()
export class BiometricAttendanceService {
  private readonly logger  = new Logger(BiometricAttendanceService.name);
  private readonly devices = new Map<string, RegisteredDevice>();

  constructor(
    private readonly prisma:  PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  async registerDevice(tenantId: string, deviceId: string, config: DeviceConfig, sectionId?: string) {
    const device: RegisteredDevice = { id: deviceId, tenantId, config, sectionId };
    this.devices.set(`${tenantId}:${deviceId}`, device);
    this.logger.log(`Device registered: ${deviceId} for tenant ${tenantId}`);
    return { registered: true, deviceId, tenantId };
  }

  async simulateCheckIn(tenantId: string, deviceId: string, biometricUserId: string) {
    const raw: DeviceEvent = {
      deviceId,
      eventType: 'CHECK_IN',
      userId:    biometricUserId,
      timestamp: new Date(),
    };
    await this.handleDeviceEvent(tenantId, raw);
  }

  private async handleDeviceEvent(tenantId: string, raw: DeviceEvent) {
    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        metadata: { path: ['biometricId'], equals: raw.userId },
      },
    });

    const normalized = normalizeDeviceEvent(raw, student?.id);

    if (!normalized.studentId) {
      this.logger.warn(`Biometric userId ${raw.userId} not mapped to any student`);
      return;
    }

    const session = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
    });
    if (!session) {
      this.logger.warn(`No current session for tenant ${tenantId}`);
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (normalized.eventType === 'CHECK_IN') {
      await this.prisma.attendance.upsert({
        where: {
          tenantId_studentId_date_period: {
            tenantId,
            studentId: normalized.studentId,
            date:      today,
            period:    0,
          },
        },
        create: {
          tenantId,
          studentId: normalized.studentId,
          sessionId: session.id,
          date:      today,
          status:    'PRESENT' as any,
          period:    null,
          markedBy:  'BIOMETRIC',
        },
        update: {
          status:   'PRESENT' as any,
          markedBy: 'BIOMETRIC',
        },
      });

      this.logger.log(`Biometric check-in: student ${normalized.studentId}`);

      this.emitter.emit('attendance.biometric.checkin', {
        tenantId,
        studentId:  normalized.studentId,
        deviceId:   normalized.deviceId,
        timestamp:  normalized.timestamp,
        confidence: normalized.confidence,
      });
    }
  }

  getDeviceStatus(tenantId: string, deviceId: string) {
    const device = this.devices.get(`${tenantId}:${deviceId}`);
    if (!device?.adapter) return { isConnected: false, deviceId };
    return device.adapter.getStatus();
  }

  listDevices(tenantId: string) {
    const result: { deviceId: string; sectionId?: string; status: any }[] = [];
    for (const [, device] of this.devices) {
      if (device.tenantId !== tenantId) continue;
      result.push({
        deviceId:  device.id,
        sectionId: device.sectionId,
        status:    device.adapter?.getStatus() ?? { isConnected: false },
      });
    }
    return result;
  }
}
