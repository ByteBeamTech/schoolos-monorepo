// Standard interfaces all hardware adapters must implement

export interface IDeviceAdapter {
  connect(config: DeviceConfig): Promise<void>;
  disconnect(): Promise<void>;
  onEvent(handler: (event: DeviceEvent) => void): void;
  getStatus(): DeviceStatus;
}

export interface DeviceConfig {
  ip: string;
  port: number;
  deviceId: string;
  vendor: string;
  model?: string;
}

export interface DeviceEvent {
  deviceId:  string;
[O  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'DOOR_OPEN' | 'DOOR_CLOSE' | 'ALARM';
  userId?:   string;       // biometric user ID on device
  timestamp: Date;
  raw?:      unknown;      // original vendor payload
}

export interface DeviceStatus {
  isConnected: boolean;
  lastPing:    Date | null;
  vendor:      string;
  model:       string;
}

export type DeviceCategory = 'biometric' | 'rfid' | 'gps' | 'cctv';
