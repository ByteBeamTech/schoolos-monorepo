// Normalizer: converts raw vendor device events to SchoolOS standard format
// Attendance module calls this — never the vendor adapter directly

import type { DeviceEvent } from '../contracts';

export interface NormalizedAttendanceEvent {
  studentId?:   string;
  staffId?:     string;
  deviceId:     string;
  eventType:    'CHECK_IN' | 'CHECK_OUT';
  timestamp:    Date;
  confidence?:  number;  // biometric match confidence 0-100
}

export function normalizeDeviceEvent(
  raw: DeviceEvent,
  resolvedId?: string
): NormalizedAttendanceEvent {
  return {
    studentId:  resolvedId,
    deviceId:   raw.deviceId,
    eventType:  raw.eventType === 'CHECK_IN' ? 'CHECK_IN' : 'CHECK_OUT',
    timestamp:  raw.timestamp,
  };
}
