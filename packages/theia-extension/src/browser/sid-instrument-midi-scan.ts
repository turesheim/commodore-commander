export interface InitialMidiScanState {
  readonly initialMidiScanStarted: boolean;
  readonly midiScanning: boolean;
}

export interface MidiModeScanState {
  readonly midiEnabled: boolean;
  readonly midiDeviceCount: number;
  readonly midiScanning: boolean;
}

export interface MidiModeActivationSyncPlan {
  readonly scanDevices: boolean;
  readonly queueMidiSettings: boolean;
}

export function shouldStartInitialMidiDeviceScan(
  state: InitialMidiScanState
): boolean {
  return !state.initialMidiScanStarted && !state.midiScanning;
}

export function shouldScanMidiDevicesForModeActivation(
  state: MidiModeScanState
): boolean {
  return state.midiEnabled && state.midiDeviceCount === 0 && !state.midiScanning;
}

export function planMidiModeActivationSync(
  state: MidiModeScanState
): MidiModeActivationSyncPlan {
  return {
    scanDevices: shouldScanMidiDevicesForModeActivation(state),
    queueMidiSettings: true
  };
}
