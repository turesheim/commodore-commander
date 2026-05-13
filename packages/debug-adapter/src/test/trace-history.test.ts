import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TraceHistory,
  formatObservedWrite,
  formatRegisterChangeHistory,
  formatTraceHistory
} from '../trace-history';

test('trace history keeps a bounded newest-first view', () => {
  const history = new TraceHistory(2);

  history.record({
    reason: 'entry',
    pc: 0x0801,
    registers: []
  });
  history.record({
    reason: 'step',
    pc: 0x0802,
    registers: []
  });
  history.record({
    reason: 'step',
    pc: 0x0803,
    registers: []
  });

  assert.deepEqual(history.entries().map((entry) => entry.pc), [0x0802, 0x0803]);
  assert.deepEqual(history.newest().map((entry) => entry.pc), [0x0803, 0x0802]);
});

test('trace history records register changes between samples', () => {
  const history = new TraceHistory();

  history.record({
    reason: 'entry',
    pc: 0x0801,
    registers: [{ name: 'A', value: 0x00, bitSize: 8 }]
  });
  history.record({
    reason: 'step',
    pc: 0x0802,
    instruction: 'LDA #$01',
    registers: [{ name: 'A', value: 0x01, bitSize: 8 }]
  });

  const changes = history.registerChanges('a');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changedRegisters[0].name, 'A');
  assert.equal(changes[0].changedRegisters[0].previousValue, 0x00);
  assert.equal(changes[0].changedRegisters[0].value, 0x01);
  assert.equal(
    formatRegisterChangeHistory('A', changes, 10),
    '#2 PC $0802 A $00 -> $01 after LDA #$01'
  );
});

test('trace history tracks last observed writes by address', () => {
  const history = new TraceHistory();

  history.record({
    reason: 'data breakpoint',
    pc: 0x0810,
    registers: [],
    memoryAccess: {
      accessType: 'write',
      startAddress: 0x0400,
      endAddress: 0x0401,
      valuePreview: [0x20, 0x41],
      truncated: false
    }
  });

  assert.equal(
    formatObservedWrite(history.lastObservedWrite(0x0401)),
    'Last observed write for $0401: #1 [data breakpoint] PC $0810 $0400-$0401 value $41 bytes $20 $41'
  );
});

test('trace history formatting includes instruction, reason, and changes', () => {
  const history = new TraceHistory();

  history.record({
    reason: 'entry',
    pc: 0x0801,
    registers: [{ name: 'X', value: 0x00, bitSize: 8 }]
  });
  history.record({
    reason: 'step',
    pc: 0x0803,
    instruction: 'INX',
    registers: [{ name: 'X', value: 0x01, bitSize: 8 }]
  });

  assert.equal(
    formatTraceHistory(history.newest(), 10),
    '#2 $0803 INX [step] changed X:$00->$01\n#1 $0801 instruction unavailable [entry]'
  );
});
