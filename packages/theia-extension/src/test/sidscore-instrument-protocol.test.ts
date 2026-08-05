import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSetInstrumentPayload,
  readInstrumentState
} from '../node/sidscore-runtime-service-impl';

test('SET_INSTRUMENT payload writes vibrato settings after instrument name', () => {
  const payload = createSetInstrumentPayload({
    voiceIndex: 2,
    waveMask: 0x06,
    attack: 1,
    decay: 2,
    sustain: 3,
    release: 4,
    vibratoDelay: 9,
    vibratoRate: 22,
    vibratoAmp: 33,
    vibratoInc: 44,
    pulseWidth: 0x0900,
    pulseSweep: -5,
    pulseMin: 0x0100,
    pulseMax: 0x0f00,
    filterModeMask: 0x03,
    filterCutoff: 1200,
    filterResonance: 8,
    gateMode: 'legato',
    gateMin: 3,
    sync: true,
    ring: false,
    instrumentName: 'lead'
  }, 99);

  assert.equal(payload.readUInt32LE(0), 99);
  assert.equal(payload.readUInt8(4), 2);
  assert.equal(payload.readUInt8(5), 0x06);
  assert.equal(payload.readInt16LE(12), -5);
  assert.equal(payload.toString('utf8', 28, 32), 'lead');
  assert.deepEqual([...payload.subarray(32)], [9, 22, 33, 44]);
});

test('SET_INSTRUMENT payload clamps vibrato settings to u8 range', () => {
  const payload = createSetInstrumentPayload({
    voiceIndex: 1,
    waveMask: 0x01,
    attack: 0,
    decay: 0,
    sustain: 0,
    release: 0,
    vibratoDelay: -1,
    vibratoRate: 260,
    vibratoAmp: 512,
    vibratoInc: -20,
    pulseWidth: 0x0800,
    pulseSweep: 0,
    pulseMin: 0,
    pulseMax: 0x0fff,
    filterModeMask: 0,
    filterCutoff: 0,
    filterResonance: 0,
    gateMode: 'retrigger',
    gateMin: 0,
    sync: false,
    ring: false,
    instrumentName: 'plain'
  }, 100);

  assert.deepEqual([...payload.subarray(payload.length - 4)], [0, 255, 255, 0]);
});

test('INSTRUMENT_STATE payload reads optional vibrato extension', () => {
  const state = readInstrumentState(instrumentStatePayload(true));

  assert.equal(state.requestId, 77);
  assert.equal(state.voiceIndex, 3);
  assert.equal(state.source, 'override');
  assert.equal(state.instrumentName, 'pad');
  assert.equal(state.vibratoDelay, 4);
  assert.equal(state.vibratoRate, 18);
  assert.equal(state.vibratoAmp, 27);
  assert.equal(state.vibratoInc, 36);
});

test('INSTRUMENT_STATE payload defaults missing vibrato extension to off', () => {
  const state = readInstrumentState(instrumentStatePayload(false));

  assert.equal(state.instrumentName, 'pad');
  assert.equal(state.vibratoDelay, 0);
  assert.equal(state.vibratoRate, 0);
  assert.equal(state.vibratoAmp, 0);
  assert.equal(state.vibratoInc, 0);
});

function instrumentStatePayload(includeVibrato: boolean): Buffer {
  const bytes: number[] = [];
  u32(bytes, 77);
  u8(bytes, 3);
  u8(bytes, 2);
  u16(bytes, 0);
  u8(bytes, 0x05);
  u8(bytes, 1);
  u8(bytes, 2);
  u8(bytes, 3);
  u8(bytes, 4);
  u16(bytes, 0x0900);
  i16(bytes, -7);
  u16(bytes, 0x0100);
  u16(bytes, 0x0f00);
  u8(bytes, 0x03);
  u16(bytes, 1200);
  u8(bytes, 8);
  u8(bytes, 1);
  u8(bytes, 3);
  u8(bytes, 1);
  u8(bytes, 0);
  str(bytes, 'pad');
  if (includeVibrato) {
    u8(bytes, 4);
    u8(bytes, 18);
    u8(bytes, 27);
    u8(bytes, 36);
  }
  return Buffer.from(bytes);
}

function u8(bytes: number[], value: number): void {
  bytes.push(value & 0xff);
}

function u16(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function i16(bytes: number[], value: number): void {
  u16(bytes, value);
}

function u32(bytes: number[], value: number): void {
  bytes.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function str(bytes: number[], value: string): void {
  const encoded = Buffer.from(value, 'utf8');
  u16(bytes, encoded.length);
  bytes.push(...encoded);
}
