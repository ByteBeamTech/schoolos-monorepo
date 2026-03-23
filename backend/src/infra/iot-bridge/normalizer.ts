import type { DeviceEvent } from './contracts';

export interface NormalizedAttendanceEvent {
  studentId?:  string;
  staffId?:    string;
  deviceId:    string;
  eventType:   'CHECK_IN' | 'CHECK_OUT';
  timestamp:   Date;
  confidence?: number;
}

export function normalizeDeviceEvent(
  raw:        DeviceEvent,
  resolvedId?: string,
): NormalizedAttendanceEvent {
  return {
    studentId:  resolvedId,
    deviceId:   raw.deviceId,
    eventType:  raw.eventType === 'CHECK_IN' ? 'CHECK_IN' : 'CHECK_OUT',
    timestamp:  raw.timestamp,
  };
}
