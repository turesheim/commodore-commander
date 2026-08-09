import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { test } from 'node:test';

import {
  ViceMonitorConnection,
  ViceMonitorCommandId,
  ViceMonitorRequests,
  type ViceMonitorEvent,
  type ViceMonitorTrafficEvent,
  monitorErrorMessage
} from '../vice-monitor';

test('register reads include the main memory-space byte required by VICE', () => {
  const [command, body] = ViceMonitorRequests.registersGet();

  assert.equal(command, ViceMonitorCommandId.REGISTERS_GET);
  assert.deepEqual([...body], [0x00]);
});

test('register descriptors include the main memory-space byte required by VICE', () => {
  const [command, body] = ViceMonitorRequests.registersAvailable();

  assert.equal(command, ViceMonitorCommandId.REGISTERS_AVAILABLE);
  assert.deepEqual([...body], [0x00]);
});

test('checkpoint creation includes the main memory-space byte required by VICE', () => {
  const [command, body] = ViceMonitorRequests.setCheckpoint({
    startAddress: 0x1000,
    endAddress: 0x1002,
    exec: true,
    enabled: true,
    stopWhenHit: true
  });

  assert.equal(command, ViceMonitorCommandId.CHECKPOINT_SET);
  assert.equal(body.toString('hex'), '001002100101040000');
});

test('data checkpoint creation can stop on loads and stores without exec', () => {
  const [command, body] = ViceMonitorRequests.setCheckpoint({
    startAddress: 0xc000,
    endAddress: 0xc000,
    load: true,
    store: true,
    exec: false,
    enabled: true,
    stopWhenHit: true
  });

  assert.equal(command, ViceMonitorCommandId.CHECKPOINT_SET);
  assert.equal(body.toString('hex'), '00c000c00101030000');
});

test('checkpoint conditions encode checkpoint number and expression', () => {
  const [command, body] = ViceMonitorRequests.setCheckpointCondition(
    0x1234,
    'A == $01'
  );

  assert.equal(command, ViceMonitorCommandId.CHECKPOINT_CONDITION_SET);
  assert.equal(body.toString('hex'), '341200000841203d3d20243031');
});

test('checkpoint toggles encode checkpoint number and enabled state', () => {
  const [command, body] = ViceMonitorRequests.toggleCheckpoint(0x1234, false);

  assert.equal(command, ViceMonitorCommandId.CHECKPOINT_TOGGLE);
  assert.equal(body.toString('hex'), '3412000000');
});

test('memory writes encode VICE memory-set body with side effects', () => {
  const [command, body] = ViceMonitorRequests.memorySet(
    0x0400,
    Buffer.from([0x01, 0x02, 0x03])
  );

  assert.equal(command, ViceMonitorCommandId.MEMORY_SET);
  assert.equal(body.toString('hex'), '0100040204000000010203');
});

test('register writes encode VICE register-set body', () => {
  const [command, body] = ViceMonitorRequests.registersSet([
    { id: 0x10, value: 0x1234, byteLength: 2 }
  ]);

  assert.equal(command, ViceMonitorCommandId.REGISTERS_SET);
  assert.equal(body.toString('hex'), '00010003103412');
});

test('pause ping uses an empty body', () => {
  const [command, body] = ViceMonitorRequests.suspend();

  assert.equal(command, ViceMonitorCommandId.PING);
  assert.equal(body.length, 0);
});

test('bank discovery uses the binary monitor banks-available command', () => {
  const [command, body] = ViceMonitorRequests.banksAvailable();

  assert.equal(command, ViceMonitorCommandId.BANKS_AVAILABLE);
  assert.equal(body.length, 0);
});

test('bank discovery decodes VICE bank descriptors', () => {
  const socket = new FakeSocket();
  const connection = new ViceMonitorConnection(socket as unknown as Socket);
  const events: ViceMonitorEvent[] = [];
  connection.onEvent((event) => events.push(event));

  socket.emit('data', responseFrame(
    ViceMonitorCommandId.BANKS_AVAILABLE,
    7,
    Buffer.from([
      0x02, 0x00,
      0x06, 0x00, 0x00, 0x03, 0x72, 0x61, 0x6d,
      0x08, 0x05, 0x00, 0x05, 0x63, 0x6f, 0x6c, 0x6f, 0x72
    ])
  ));

  assert.deepEqual(events, [
    {
      type: 'banks',
      requestId: 7,
      banks: [
        { id: 0, name: 'ram' },
        { id: 5, name: 'color' }
      ]
    }
  ]);
});

test('monitor traffic events describe outbound commands and inbound responses', () => {
  const socket = new FakeSocket();
  const connection = new ViceMonitorConnection(socket as unknown as Socket);
  const traffic: ViceMonitorTrafficEvent[] = [];
  connection.onTraffic((event) => traffic.push(event));

  const [command, body] = ViceMonitorRequests.setCheckpoint({
    startAddress: 0x1000,
    endAddress: 0x1000,
    exec: true,
    enabled: true,
    stopWhenHit: true
  });
  const requestId = connection.send(command, body);

  socket.emit('data', responseFrame(
    0x11,
    requestId,
    checkpointResponseBody({
      number: 3,
      hit: false,
      startAddress: 0x1000,
      endAddress: 0x1000
    })
  ));

  assert.equal(traffic.length, 2);
  assert.deepEqual(
    pickTrafficFields(traffic[0]),
    {
      category: 'input',
      requestId,
      code: 0x12,
      name: 'CHECKPOINT_SET',
      bodyLength: 9,
      bodyPreview: '00 10 00 10 01 01 04 00 00',
      message: '#1 CHECKPOINT_SET $1000-$1000 stop=1 enabled=1 load=0 store=0 exec=1 temp=0 mem=0'
    }
  );
  assert.deepEqual(
    pickTrafficFields(traffic[1]),
    {
      category: 'output',
      requestId,
      code: 0x11,
      name: 'CHECKPOINT_INFO',
      bodyLength: 13,
      bodyPreview: '03 00 00 00 00 00 10 00 10 01 01 04 00',
      message: '#1 CHECKPOINT_INFO checkpoint 3 $1000-$1000 hit=0 stop=1 enabled=1 load=0 store=0 exec=1 temp=0'
    }
  );
});

test('monitor error messages include VICE error-code details', () => {
  const message = monitorErrorMessage({
    errorCode: 0x80,
    requestId: 7,
    responseType: 0,
    body: Buffer.alloc(0)
  });

  assert.equal(
    message,
    'VICE monitor error 128 (command length is not correct) on response 0 for request 7.'
  );
});

class FakeSocket extends EventEmitter {
  write(): boolean {
    return true;
  }

  destroy(): void {
    this.emit('close');
  }
}

function responseFrame(
  responseType: number,
  requestId: number,
  body: Buffer
): Buffer {
  const frame = Buffer.alloc(12 + body.length);
  frame.writeUInt8(0x02, 0);
  frame.writeUInt8(0x02, 1);
  frame.writeUInt32LE(body.length, 2);
  frame.writeUInt8(responseType, 6);
  frame.writeUInt8(0, 7);
  frame.writeUInt32LE(requestId, 8);
  body.copy(frame, 12);
  return frame;
}

function checkpointResponseBody(options: {
  number: number;
  hit: boolean;
  startAddress: number;
  endAddress: number;
}): Buffer {
  const body = Buffer.alloc(13);
  body.writeUInt32LE(options.number, 0);
  body.writeUInt8(options.hit ? 0x01 : 0x00, 4);
  body.writeUInt16LE(options.startAddress, 5);
  body.writeUInt16LE(options.endAddress, 7);
  body.writeUInt8(0x01, 9);
  body.writeUInt8(0x01, 10);
  body.writeUInt8(0x04, 11);
  body.writeUInt8(0x00, 12);
  return body;
}

function pickTrafficFields(event: ViceMonitorTrafficEvent): ViceMonitorTrafficEvent {
  return {
    category: event.category,
    requestId: event.requestId,
    code: event.code,
    name: event.name,
    bodyLength: event.bodyLength,
    bodyPreview: event.bodyPreview,
    message: event.message,
    ...(event.errorCode !== undefined ? { errorCode: event.errorCode } : {})
  };
}
