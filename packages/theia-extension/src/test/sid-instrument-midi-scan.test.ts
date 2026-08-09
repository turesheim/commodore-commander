import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planMidiModeActivationSync,
  shouldScanMidiDevicesForModeActivation,
  shouldStartInitialMidiDeviceScan
} from '../browser/sid-instrument-midi-scan';

test('SID Instrument starts one initial MIDI scan after attach', () => {
  assert.equal(
    shouldStartInitialMidiDeviceScan({
      initialMidiScanStarted: false,
      midiScanning: false
    }),
    true
  );
  assert.equal(
    shouldStartInitialMidiDeviceScan({
      initialMidiScanStarted: true,
      midiScanning: false
    }),
    false
  );
  assert.equal(
    shouldStartInitialMidiDeviceScan({
      initialMidiScanStarted: false,
      midiScanning: true
    }),
    false
  );
});

test('SID Instrument scans before enabling MIDI with no known input devices', () => {
  assert.equal(
    shouldScanMidiDevicesForModeActivation({
      midiEnabled: true,
      midiDeviceCount: 0,
      midiScanning: false
    }),
    true
  );
  assert.equal(
    shouldScanMidiDevicesForModeActivation({
      midiEnabled: true,
      midiDeviceCount: 1,
      midiScanning: false
    }),
    false
  );
  assert.equal(
    shouldScanMidiDevicesForModeActivation({
      midiEnabled: false,
      midiDeviceCount: 0,
      midiScanning: false
    }),
    false
  );
  assert.equal(
    shouldScanMidiDevicesForModeActivation({
      midiEnabled: true,
      midiDeviceCount: 0,
      midiScanning: true
    }),
    false
  );
});

test('SID Instrument waits for scan results before enabling MIDI with no known inputs', () => {
  assert.deepEqual(
    planMidiModeActivationSync({
      midiEnabled: true,
      midiDeviceCount: 0,
      midiScanning: false
    }),
    {
      scanDevices: true,
      queueMidiSettings: false
    }
  );
});

test('SID Instrument sends MIDI settings when scan is not needed', () => {
  assert.deepEqual(
    planMidiModeActivationSync({
      midiEnabled: true,
      midiDeviceCount: 1,
      midiScanning: false
    }),
    {
      scanDevices: false,
      queueMidiSettings: true
    }
  );
  assert.deepEqual(
    planMidiModeActivationSync({
      midiEnabled: false,
      midiDeviceCount: 0,
      midiScanning: false
    }),
    {
      scanDevices: false,
      queueMidiSettings: true
    }
  );
});
