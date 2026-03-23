// Generic biometric adapter
// Use this as the base for all biometric vendor adapters

import type { IDeviceAdapter, DeviceConfig, DeviceEvent, DeviceStatus } from '../../../contracts';

export abstract class GenericBiometricAdapter implements IDeviceAdapter {
  protected config!: DeviceConfig;
  protected connected = false;
  protected lastPing: Date | null = null;
  private handlers: Array<(event: DeviceEvent) => void> = [];

  async connect(config: DeviceConfig): Promise<void> {
    this.config    = config;
    this.connected = true;
    this.lastPing  = new Date();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  onEvent(handler: (event: DeviceEvent) => void): void {
    this.handlers.push(handler);
  }

  protected emit(event: DeviceEvent): void {
    this.handlers.forEach(h => h(event));
  }

  getStatus(): DeviceStatus {
    return {
      isConnected: this.connected,
      lastPing:    this.lastPing,
      vendor:      this.config?.vendor ?? 'unknown',
      model:       this.config?.model  ?? 'unknown',
    };
  }
}
