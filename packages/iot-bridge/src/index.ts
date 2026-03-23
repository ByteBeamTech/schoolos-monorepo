// @schoolos/iot-bridge
// Hardware adapter pattern — standardizes signals from all physical devices
//
// Rule: modules/attendance/biometric NEVER imports vendor SDKs directly.
//       It imports from this package only.
//
// Adding a new device brand:
//   1. Create packages/iot-bridge/src/adapters/{category}/{vendor}/
//   2. Implement the IDeviceAdapter interface from contracts/
//   3. Register in the normalizer
//   4. Zero changes needed in attendance/biometric

export * from './contracts';
export * from './normalizer';
export * from './adapters/biometric/generic';
