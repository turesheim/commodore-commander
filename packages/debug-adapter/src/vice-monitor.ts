import { EventEmitter } from 'node:events';
import net from 'node:net';

const STX = 0x02;
const API_VERSION = 0x02;
const RESPONSE_HEADER_LENGTH = 12;
const MAIN_MEMORY_SPACE = 0x00;
const DEFAULT_BANK_ID = 0x0000;

export type ViceMonitorBytes = Buffer<ArrayBufferLike>;

export enum ViceMonitorCommandId {
  MEMORY_GET = 0x01,
  MEMORY_SET = 0x02,
  CHECKPOINT_GET = 0x11,
  CHECKPOINT_SET = 0x12,
  CHECKPOINT_DELETE = 0x13,
  CHECKPOINT_LIST = 0x14,
  CHECKPOINT_TOGGLE = 0x15,
  CHECKPOINT_CONDITION_SET = 0x22,
  REGISTERS_GET = 0x31,
  REGISTERS_SET = 0x32,
  ADVANCE_INSTRUCTIONS = 0x71,
  EXECUTE_UNTIL_RETURN = 0x73,
  PING = 0x81,
  BANKS_AVAILABLE = 0x82,
  REGISTERS_AVAILABLE = 0x83,
  EXIT = 0xaa,
  QUIT = 0xbb
}

enum ViceMonitorResponseId {
  CHECKPOINT_INFO = 0x11,
  REGISTER_INFO = 0x31,
  STOPPED = 0x62,
  RESUMED = 0x63
}

export interface ViceMonitorCheckpoint {
  number: number;
  hit: boolean;
  startAddress: number;
  endAddress: number;
  stop: boolean;
  enabled: boolean;
  load: boolean;
  store: boolean;
  exec: boolean;
  temporary: boolean;
}

export interface ViceMonitorRegisterDescriptor {
  id: number;
  name: string;
  bitSize: number;
}

export interface ViceMonitorRegisterValue {
  id: number;
  value: number;
  byteLength: number;
}

export interface ViceMonitorBankDescriptor {
  id: number;
  name: string;
}

export type ViceMonitorEvent =
  | { type: 'stopped'; requestId: number }
  | { type: 'resumed'; requestId: number }
  | { type: 'terminated'; requestId: number }
  | { type: 'checkpoint'; requestId: number; checkpoint: ViceMonitorCheckpoint }
  | { type: 'banks'; requestId: number; banks: ViceMonitorBankDescriptor[] }
  | { type: 'register-descriptors'; requestId: number; registers: ViceMonitorRegisterDescriptor[] }
  | { type: 'register-values'; requestId: number; registers: ViceMonitorRegisterValue[] }
  | { type: 'memory'; requestId: number; declaredByteCount: number; bytes: ViceMonitorBytes }
  | { type: 'ack'; requestId: number; commandId: number; body: ViceMonitorBytes }
  | { type: 'error'; requestId: number; responseType: number; errorCode: number; body: ViceMonitorBytes }
  | { type: 'unhandled'; requestId: number; responseType: number; body: ViceMonitorBytes };

export interface ViceMonitorTrafficEvent {
  category: 'input' | 'output';
  requestId: number;
  code: number;
  name: string;
  bodyLength: number;
  bodyPreview: string;
  message: string;
  errorCode?: number;
}

interface Waiter {
  requestId: number;
  predicate: (event: ViceMonitorEvent) => boolean;
  resolve: (event: ViceMonitorEvent) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ViceMonitorCheckpointSpec {
  startAddress: number;
  endAddress: number;
  stopWhenHit?: boolean;
  enabled?: boolean;
  load?: boolean;
  store?: boolean;
  exec?: boolean;
  temporary?: boolean;
  memspace?: number;
}

export interface ViceMonitorMemoryOptions {
  sideEffects?: boolean;
  memspace?: number;
  bankId?: number;
}

export interface ViceMonitorRegisterSetValue {
  id: number;
  value: number;
  byteLength: number;
}

export class ViceMonitorConnection {
  private readonly emitter = new EventEmitter();
  private readonly trafficEmitter = new EventEmitter();
  private readonly waiters = new Set<Waiter>();
  private buffer = Buffer.alloc(0);
  private requestId = 0;
  private closed = false;

  constructor(private readonly socket: net.Socket) {
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.closeWaiters(new Error('VICE monitor connection closed.')));
    socket.on('error', (error) => this.closeWaiters(error));
  }

  static async connect(
    host: string,
    port: number,
    options: { attempts?: number; delayMs?: number } = {}
  ): Promise<ViceMonitorConnection> {
    const attempts = options.attempts ?? 50;
    const delayMs = options.delayMs ?? 100;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const socket = await connectSocket(host, port);
        return new ViceMonitorConnection(socket);
      } catch (error) {
        lastError = error;
        await delay(delayMs);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Could not connect to VICE binary monitor at ${host}:${port}: ${message}`);
  }

  onEvent(listener: (event: ViceMonitorEvent) => void): void {
    this.emitter.on('event', listener);
  }

  onTraffic(listener: (event: ViceMonitorTrafficEvent) => void): void {
    this.trafficEmitter.on('traffic', listener);
  }

  send(commandId: ViceMonitorCommandId, body: ViceMonitorBytes = Buffer.alloc(0)): number {
    if (this.closed) {
      throw new Error('VICE monitor connection is closed.');
    }
    this.requestId += 1;
    const requestId = this.requestId;
    this.writeFrame(requestId, commandId, body);
    return requestId;
  }

  private writeFrame(
    requestId: number,
    commandId: ViceMonitorCommandId,
    body: ViceMonitorBytes
  ): void {
    const frame = Buffer.alloc(6 + 4 + 1 + body.length);
    frame.writeUInt8(STX, 0);
    frame.writeUInt8(API_VERSION, 1);
    frame.writeUInt32LE(body.length, 2);
    frame.writeUInt32LE(requestId, 6);
    frame.writeUInt8(commandId, 10);
    body.copy(frame, 11);
    this.emitTraffic(createCommandTrafficEvent(requestId, commandId, body));
    this.socket.write(frame);
  }

  waitFor(
    requestId: number,
    predicate: (event: ViceMonitorEvent) => boolean,
    timeoutMs = 3000
  ): Promise<ViceMonitorEvent> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        requestId,
        predicate,
        resolve: (event) => {
          clearTimeout(waiter.timeout);
          this.waiters.delete(waiter);
          resolve(event);
        },
        reject: (error) => {
          clearTimeout(waiter.timeout);
          this.waiters.delete(waiter);
          reject(error);
        },
        timeout: setTimeout(() => {
          waiter.reject(new Error(`Timed out waiting for VICE monitor response ${requestId}.`));
        }, timeoutMs)
      };
      this.waiters.add(waiter);
    });
  }

  async sendAndWait(
    commandId: ViceMonitorCommandId,
    body: ViceMonitorBytes,
    predicate: (event: ViceMonitorEvent) => boolean,
    timeoutMs?: number
  ): Promise<ViceMonitorEvent> {
    if (this.closed) {
      throw new Error('VICE monitor connection is closed.');
    }
    this.requestId += 1;
    const requestId = this.requestId;
    const response = this.waitFor(requestId, predicate, timeoutMs);
    this.writeFrame(requestId, commandId, body);
    return response;
  }

  dispose(): void {
    this.closed = true;
    this.socket.destroy();
    this.closeWaiters(new Error('VICE monitor connection disposed.'));
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.drain();
  }

  private drain(): void {
    while (this.buffer.length >= RESPONSE_HEADER_LENGTH) {
      if (this.buffer.readUInt8(0) !== STX) {
        const event: ViceMonitorEvent = {
          type: 'error',
          requestId: 0,
          responseType: 0,
          errorCode: 0xff,
          body: Buffer.from(`Unexpected VICE monitor STX byte: ${this.buffer.readUInt8(0)}`)
        };
        this.emitTraffic(createResponseTrafficEvent(
          { responseType: 0, errorCode: 0xff, requestId: 0, body: event.body },
          event
        ));
        this.emit(event);
        this.buffer = Buffer.alloc(0);
        return;
      }
      if (this.buffer.readUInt8(1) !== API_VERSION) {
        const event: ViceMonitorEvent = {
          type: 'error',
          requestId: 0,
          responseType: 0,
          errorCode: 0xfe,
          body: Buffer.from(`Unsupported VICE monitor API version: ${this.buffer.readUInt8(1)}`)
        };
        this.emitTraffic(createResponseTrafficEvent(
          { responseType: 0, errorCode: 0xfe, requestId: 0, body: event.body },
          event
        ));
        this.emit(event);
        this.buffer = Buffer.alloc(0);
        return;
      }

      const bodyLength = this.buffer.readUInt32LE(2);
      const frameLength = RESPONSE_HEADER_LENGTH + bodyLength;
      if (this.buffer.length < frameLength) {
        return;
      }

      const responseType = this.buffer.readUInt8(6);
      const errorCode = this.buffer.readUInt8(7);
      const requestId = this.buffer.readUInt32LE(8);
      const body = this.buffer.subarray(RESPONSE_HEADER_LENGTH, frameLength);
      this.buffer = this.buffer.subarray(frameLength);
      const frame = { responseType, errorCode, requestId, body };
      const event = mapFrame(frame);
      this.emitTraffic(createResponseTrafficEvent(frame, event));
      this.emit(event);
    }
  }

  private emitTraffic(event: ViceMonitorTrafficEvent): void {
    this.trafficEmitter.emit('traffic', event);
  }

  private emit(event: ViceMonitorEvent): void {
    this.emitter.emit('event', event);
    for (const waiter of [...this.waiters]) {
      if (waiter.requestId !== event.requestId) {
        continue;
      }
      if (event.type === 'error') {
        waiter.reject(new Error(monitorErrorMessage(event)));
      } else if (waiter.predicate(event)) {
        waiter.resolve(event);
      }
    }
  }

  private closeWaiters(error: Error): void {
    this.closed = true;
    for (const waiter of [...this.waiters]) {
      waiter.reject(error);
    }
  }
}

export const ViceMonitorRequests = {
  resume: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.EXIT,
    Buffer.alloc(0)
  ],
  suspend: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.PING,
    Buffer.alloc(0)
  ],
  banksAvailable: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.BANKS_AVAILABLE,
    Buffer.alloc(0)
  ],
  quit: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.QUIT,
    Buffer.alloc(0)
  ],
  registersAvailable: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.REGISTERS_AVAILABLE,
    Buffer.from([MAIN_MEMORY_SPACE])
  ],
  registersGet: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.REGISTERS_GET,
    Buffer.from([MAIN_MEMORY_SPACE])
  ],
  listCheckpoints: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.CHECKPOINT_LIST,
    Buffer.alloc(0)
  ],
  memoryGet: (
    startAddress: number,
    endAddress: number,
    options: ViceMonitorMemoryOptions = {}
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const body = Buffer.alloc(8);
    body.writeUInt8(options.sideEffects ? 0x01 : 0x00, 0);
    body.writeUInt16LE(clampWord(startAddress), 1);
    body.writeUInt16LE(clampWord(endAddress), 3);
    body.writeUInt8(clampByte(options.memspace ?? MAIN_MEMORY_SPACE), 5);
    body.writeUInt16LE(clampWord(options.bankId ?? DEFAULT_BANK_ID), 6);
    return [ViceMonitorCommandId.MEMORY_GET, body];
  },
  memorySet: (
    startAddress: number,
    values: ViceMonitorBytes,
    options: ViceMonitorMemoryOptions = {}
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    if (values.length === 0) {
      throw new Error('Memory write requires at least one byte.');
    }
    const endAddress = startAddress + values.length - 1;
    const body = Buffer.alloc(8 + values.length);
    body.writeUInt8(options.sideEffects === false ? 0x00 : 0x01, 0);
    body.writeUInt16LE(clampWord(startAddress), 1);
    body.writeUInt16LE(clampWord(endAddress), 3);
    body.writeUInt8(clampByte(options.memspace ?? MAIN_MEMORY_SPACE), 5);
    body.writeUInt16LE(clampWord(options.bankId ?? DEFAULT_BANK_ID), 6);
    values.copy(body, 8);
    return [ViceMonitorCommandId.MEMORY_SET, body];
  },
  registersSet: (
    values: readonly ViceMonitorRegisterSetValue[],
    memspace = MAIN_MEMORY_SPACE
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const bodyLength = 3 + values.reduce(
      (length, register) => length + 2 + register.byteLength,
      0
    );
    const body = Buffer.alloc(bodyLength);
    let offset = 0;
    body.writeUInt8(clampByte(memspace), offset);
    offset += 1;
    body.writeUInt16LE(values.length, offset);
    offset += 2;
    for (const register of values) {
      body.writeUInt8(1 + register.byteLength, offset);
      offset += 1;
      body.writeUInt8(clampByte(register.id), offset);
      offset += 1;
      writeLittleEndian(body, offset, register.value, register.byteLength);
      offset += register.byteLength;
    }
    return [ViceMonitorCommandId.REGISTERS_SET, body];
  },
  advanceInstructions: (
    instructionCount: number,
    stepOverSubroutines: boolean
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const body = Buffer.alloc(3);
    body.writeUInt8(stepOverSubroutines ? 0x01 : 0x00, 0);
    body.writeUInt16LE(instructionCount, 1);
    return [ViceMonitorCommandId.ADVANCE_INSTRUCTIONS, body];
  },
  executeUntilReturn: (): [ViceMonitorCommandId, ViceMonitorBytes] => [
    ViceMonitorCommandId.EXECUTE_UNTIL_RETURN,
    Buffer.alloc(0)
  ],
  setCheckpoint: (spec: ViceMonitorCheckpointSpec): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const body = Buffer.alloc(9);
    body.writeUInt16LE(clampWord(spec.startAddress), 0);
    body.writeUInt16LE(clampWord(spec.endAddress), 2);
    body.writeUInt8(spec.stopWhenHit === false ? 0x00 : 0x01, 4);
    body.writeUInt8(spec.enabled === false ? 0x00 : 0x01, 5);
    let bitmask = 0;
    if (spec.load) {
      bitmask |= 1 << 0;
    }
    if (spec.store) {
      bitmask |= 1 << 1;
    }
    if (spec.exec !== false) {
      bitmask |= 1 << 2;
    }
    body.writeUInt8(bitmask, 6);
    body.writeUInt8(spec.temporary ? 0x01 : 0x00, 7);
    body.writeUInt8(clampByte(spec.memspace ?? MAIN_MEMORY_SPACE), 8);
    return [ViceMonitorCommandId.CHECKPOINT_SET, body];
  },
  deleteCheckpoint: (checkpointNumber: number): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const body = Buffer.alloc(4);
    body.writeUInt32LE(checkpointNumber, 0);
    return [ViceMonitorCommandId.CHECKPOINT_DELETE, body];
  },
  toggleCheckpoint: (
    checkpointNumber: number,
    enabled: boolean
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const body = Buffer.alloc(5);
    body.writeUInt32LE(checkpointNumber, 0);
    body.writeUInt8(enabled ? 0x01 : 0x00, 4);
    return [ViceMonitorCommandId.CHECKPOINT_TOGGLE, body];
  },
  setCheckpointCondition: (
    checkpointNumber: number,
    expression: string
  ): [ViceMonitorCommandId, ViceMonitorBytes] => {
    const condition = Buffer.from(expression, 'utf8');
    if (condition.length > 0xff) {
      throw new Error('VICE checkpoint conditions must be 255 bytes or shorter.');
    }
    const body = Buffer.alloc(5 + condition.length);
    body.writeUInt32LE(checkpointNumber, 0);
    body.writeUInt8(condition.length, 4);
    condition.copy(body, 5);
    return [ViceMonitorCommandId.CHECKPOINT_CONDITION_SET, body];
  }
};

export function monitorErrorMessage(event: {
  errorCode: number;
  requestId: number;
  responseType: number;
  body: ViceMonitorBytes;
}): string {
  const reason = monitorErrorReason(event.errorCode);
  const body = event.body.length > 0 ? ` ${event.body.toString()}` : '';
  return `VICE monitor error ${event.errorCode} (${reason}) on response ${event.responseType} for request ${event.requestId}.${body}`;
}

function monitorErrorReason(errorCode: number): string {
  switch (errorCode) {
    case 0x00:
      return 'OK';
    case 0x01:
      return 'object does not exist';
    case 0x02:
      return 'invalid memspace';
    case 0x80:
      return 'command length is not correct';
    case 0x81:
      return 'invalid parameter value';
    case 0x82:
      return 'API version is not understood';
    case 0x83:
      return 'command type is not understood';
    case 0x8f:
      return 'command failed';
    default:
      return 'unknown error';
  }
}

function mapFrame(frame: {
  responseType: number;
  errorCode: number;
  requestId: number;
  body: ViceMonitorBytes;
}): ViceMonitorEvent {
  if (frame.errorCode !== 0) {
    return {
      type: 'error',
      requestId: frame.requestId,
      responseType: frame.responseType,
      errorCode: frame.errorCode,
      body: Buffer.from(frame.body)
    };
  }

  switch (frame.responseType) {
    case ViceMonitorResponseId.STOPPED:
      return { type: 'stopped', requestId: frame.requestId };
    case ViceMonitorResponseId.RESUMED:
      return { type: 'resumed', requestId: frame.requestId };
    case ViceMonitorResponseId.CHECKPOINT_INFO:
      return {
        type: 'checkpoint',
        requestId: frame.requestId,
        checkpoint: parseCheckpoint(frame.body)
      };
    case ViceMonitorResponseId.REGISTER_INFO:
      return {
        type: 'register-values',
        requestId: frame.requestId,
        registers: parseRegisterValues(frame.body)
      };
    case ViceMonitorCommandId.REGISTERS_AVAILABLE:
      return {
        type: 'register-descriptors',
        requestId: frame.requestId,
        registers: parseRegisterDescriptors(frame.body)
      };
    case ViceMonitorCommandId.BANKS_AVAILABLE:
      return {
        type: 'banks',
        requestId: frame.requestId,
        banks: parseBankDescriptors(frame.body)
      };
    case ViceMonitorCommandId.MEMORY_GET:
      return parseMemory(frame.requestId, frame.body);
    case ViceMonitorCommandId.QUIT:
      return { type: 'terminated', requestId: frame.requestId };
    default:
      if (isKnownCommandId(frame.responseType)) {
        return {
          type: 'ack',
          requestId: frame.requestId,
          commandId: frame.responseType,
          body: Buffer.from(frame.body)
        };
      }
      return {
        type: 'unhandled',
        requestId: frame.requestId,
        responseType: frame.responseType,
        body: Buffer.from(frame.body)
      };
  }
}

function parseCheckpoint(body: ViceMonitorBytes): ViceMonitorCheckpoint {
  const bitmask = body.readUInt8(11);
  return {
    number: body.readUInt32LE(0),
    hit: body.readUInt8(4) === 0x01,
    startAddress: body.readUInt16LE(5),
    endAddress: body.readUInt16LE(7),
    stop: body.readUInt8(9) === 0x01,
    enabled: body.readUInt8(10) === 0x01,
    load: (bitmask & (1 << 0)) !== 0,
    store: (bitmask & (1 << 1)) !== 0,
    exec: (bitmask & (1 << 2)) !== 0,
    temporary: body.readUInt8(12) === 0x01
  };
}

function parseRegisterDescriptors(body: ViceMonitorBytes): ViceMonitorRegisterDescriptor[] {
  const registers: ViceMonitorRegisterDescriptor[] = [];
  let offset = 2;
  const count = body.length >= 2 ? body.readUInt16LE(0) : 0;
  for (let index = 0; index < count && offset < body.length; index += 1) {
    const itemSize = body.readUInt8(offset);
    const id = body.readUInt8(offset + 1);
    const bitSize = body.readUInt8(offset + 2);
    const nameLength = body.readUInt8(offset + 3);
    const nameStart = offset + 4;
    const nameEnd = Math.min(nameStart + nameLength, body.length);
    registers.push({
      id,
      bitSize,
      name: body.subarray(nameStart, nameEnd).toString('ascii')
    });
    offset += 1 + itemSize;
  }
  return registers;
}

function parseBankDescriptors(body: ViceMonitorBytes): ViceMonitorBankDescriptor[] {
  const banks: ViceMonitorBankDescriptor[] = [];
  let offset = 2;
  const count = body.length >= 2 ? body.readUInt16LE(0) : 0;
  for (let index = 0; index < count && offset < body.length; index += 1) {
    const itemSize = body.readUInt8(offset);
    const id = body.readUInt16LE(offset + 1);
    const nameLength = body.readUInt8(offset + 3);
    const nameStart = offset + 4;
    const nameEnd = Math.min(nameStart + nameLength, body.length);
    banks.push({
      id,
      name: body.subarray(nameStart, nameEnd).toString('ascii')
    });
    offset += 1 + itemSize;
  }
  return banks;
}

function parseRegisterValues(body: ViceMonitorBytes): ViceMonitorRegisterValue[] {
  const registers: ViceMonitorRegisterValue[] = [];
  let offset = 2;
  const count = body.length >= 2 ? body.readUInt16LE(0) : 0;
  for (let index = 0; index < count && offset < body.length; index += 1) {
    const itemSize = body.readUInt8(offset);
    const id = body.readUInt8(offset + 1);
    const raw = body.subarray(offset + 2, offset + 1 + itemSize);
    registers.push({
      id,
      value: readLittleEndian(raw),
      byteLength: raw.length
    });
    offset += 1 + itemSize;
  }
  return registers;
}

function parseMemory(requestId: number, body: ViceMonitorBytes): ViceMonitorEvent {
  const declaredByteCount = body.length >= 2 ? body.readUInt16LE(0) : 0;
  return {
    type: 'memory',
    requestId,
    declaredByteCount,
    bytes: Buffer.from(body.subarray(2))
  };
}

function isKnownCommandId(value: number): boolean {
  return Object.values(ViceMonitorCommandId).includes(value as ViceMonitorCommandId);
}

function createCommandTrafficEvent(
  requestId: number,
  commandId: ViceMonitorCommandId,
  body: ViceMonitorBytes
): ViceMonitorTrafficEvent {
  const name = monitorCommandName(commandId);
  return {
    category: 'input',
    requestId,
    code: commandId,
    name,
    bodyLength: body.length,
    bodyPreview: formatMonitorBodyPreview(body),
    message: describeMonitorCommand(requestId, commandId, name, body)
  };
}

function createResponseTrafficEvent(
  frame: {
    responseType: number;
    errorCode: number;
    requestId: number;
    body: ViceMonitorBytes;
  },
  event: ViceMonitorEvent
): ViceMonitorTrafficEvent {
  const name = monitorResponseName(frame.responseType);
  return {
    category: 'output',
    requestId: frame.requestId,
    code: frame.responseType,
    name,
    bodyLength: frame.body.length,
    bodyPreview: formatMonitorBodyPreview(frame.body),
    message: describeMonitorResponse(frame.requestId, name, event),
    ...(frame.errorCode !== 0 ? { errorCode: frame.errorCode } : {})
  };
}

function describeMonitorCommand(
  requestId: number,
  commandId: ViceMonitorCommandId,
  name: string,
  body: ViceMonitorBytes
): string {
  const prefix = `#${requestId} ${name}`;
  switch (commandId) {
    case ViceMonitorCommandId.CHECKPOINT_SET:
      return `${prefix} ${describeCheckpointSetBody(body)}`;
    case ViceMonitorCommandId.CHECKPOINT_DELETE:
      return body.length >= 4
        ? `${prefix} checkpoint ${body.readUInt32LE(0)}`
        : prefix;
    case ViceMonitorCommandId.CHECKPOINT_TOGGLE:
      return body.length >= 5
        ? `${prefix} checkpoint ${body.readUInt32LE(0)} enabled=${body.readUInt8(4)}`
        : prefix;
    case ViceMonitorCommandId.CHECKPOINT_CONDITION_SET:
      return body.length >= 5
        ? `${prefix} checkpoint ${body.readUInt32LE(0)} ${describeConditionBody(body)}`
        : prefix;
    case ViceMonitorCommandId.MEMORY_GET:
      return `${prefix} ${describeMemoryGetBody(body)}`;
    case ViceMonitorCommandId.MEMORY_SET:
      return `${prefix} ${describeMemorySetBody(body)}`;
    case ViceMonitorCommandId.ADVANCE_INSTRUCTIONS:
      return body.length >= 3
        ? `${prefix} count=${body.readUInt16LE(1)} stepOver=${body.readUInt8(0)}`
        : prefix;
    default:
      return prefix;
  }
}

function describeMonitorResponse(
  requestId: number,
  name: string,
  event: ViceMonitorEvent
): string {
  const prefix = `#${requestId} ${name}`;
  switch (event.type) {
    case 'checkpoint':
      return `${prefix} ${describeCheckpoint(event.checkpoint)}`;
    case 'memory':
      return `${prefix} ${event.bytes.length}/${event.declaredByteCount} bytes`;
    case 'register-descriptors':
      return `${prefix} ${event.registers.length} register descriptors`;
    case 'register-values':
      return `${prefix} ${event.registers.length} register values`;
    case 'banks':
      return `${prefix} ${event.banks.length} banks`;
    case 'ack':
      return `${prefix} ack ${monitorCommandName(event.commandId)}`;
    case 'error':
      return `${prefix} error ${event.errorCode} (${monitorErrorReason(event.errorCode)})`;
    case 'unhandled':
      return `${prefix} unhandled`;
    default:
      return prefix;
  }
}

function monitorCommandName(code: number): string {
  return ViceMonitorCommandId[code as ViceMonitorCommandId] ?? formatByteCode(code);
}

function monitorResponseName(code: number): string {
  return ViceMonitorResponseId[code as ViceMonitorResponseId] ??
    monitorCommandName(code);
}

function formatMonitorBodyPreview(body: ViceMonitorBytes, maxBytes = 64): string {
  if (body.length === 0) {
    return '';
  }
  const bytes = [...body.subarray(0, maxBytes)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(' ');
  return body.length > maxBytes ? `${bytes} ...` : bytes;
}

function describeCheckpointSetBody(body: ViceMonitorBytes): string {
  if (body.length < 9) {
    return '';
  }
  const access = body.readUInt8(6);
  return [
    `${formatWord(body.readUInt16LE(0))}-${formatWord(body.readUInt16LE(2))}`,
    `stop=${body.readUInt8(4)}`,
    `enabled=${body.readUInt8(5)}`,
    `load=${access & 0x01 ? 1 : 0}`,
    `store=${access & 0x02 ? 1 : 0}`,
    `exec=${access & 0x04 ? 1 : 0}`,
    `temp=${body.readUInt8(7)}`,
    `mem=${body.readUInt8(8)}`
  ].join(' ');
}

function describeConditionBody(body: ViceMonitorBytes): string {
  const conditionLength = body.readUInt8(4);
  if (conditionLength === 0 || body.length < 5 + conditionLength) {
    return '';
  }
  return body.subarray(5, 5 + conditionLength).toString('utf8');
}

function describeMemoryGetBody(body: ViceMonitorBytes): string {
  if (body.length < 8) {
    return '';
  }
  return [
    `${formatWord(body.readUInt16LE(1))}-${formatWord(body.readUInt16LE(3))}`,
    `sideEffects=${body.readUInt8(0)}`,
    `mem=${body.readUInt8(5)}`,
    `bank=${body.readUInt16LE(6)}`
  ].join(' ');
}

function describeMemorySetBody(body: ViceMonitorBytes): string {
  if (body.length < 8) {
    return '';
  }
  return [
    `${formatWord(body.readUInt16LE(1))}-${formatWord(body.readUInt16LE(3))}`,
    `${Math.max(0, body.length - 8)} bytes`,
    `sideEffects=${body.readUInt8(0)}`,
    `mem=${body.readUInt8(5)}`,
    `bank=${body.readUInt16LE(6)}`
  ].join(' ');
}

function describeCheckpoint(checkpoint: ViceMonitorCheckpoint): string {
  return [
    `checkpoint ${checkpoint.number}`,
    `${formatWord(checkpoint.startAddress)}-${formatWord(checkpoint.endAddress)}`,
    `hit=${checkpoint.hit ? 1 : 0}`,
    `stop=${checkpoint.stop ? 1 : 0}`,
    `enabled=${checkpoint.enabled ? 1 : 0}`,
    `load=${checkpoint.load ? 1 : 0}`,
    `store=${checkpoint.store ? 1 : 0}`,
    `exec=${checkpoint.exec ? 1 : 0}`,
    `temp=${checkpoint.temporary ? 1 : 0}`
  ].join(' ');
}

function formatByteCode(code: number): string {
  return `0x${(code & 0xff).toString(16).padStart(2, '0')}`;
}

function formatWord(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, '0')}`;
}

function readLittleEndian(bytes: Buffer): number {
  let value = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    value += bytes[index] << (index * 8);
  }
  return value >>> 0;
}

function writeLittleEndian(
  buffer: Buffer,
  offset: number,
  value: number,
  byteLength: number
): void {
  if (byteLength < 1 || byteLength > 4) {
    throw new Error(`Register values must be 1-4 bytes, got ${byteLength}.`);
  }
  const maxValue = byteLength === 4
    ? 0xffffffff
    : (1 << (byteLength * 8)) - 1;
  if (!Number.isInteger(value) || value < 0 || value > maxValue) {
    throw new Error(`Register value ${value} does not fit in ${byteLength} byte(s).`);
  }
  for (let index = 0; index < byteLength; index += 1) {
    buffer.writeUInt8(Math.floor(value / 2 ** (index * 8)) & 0xff, offset + index);
  }
}

function clampByte(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`Value must be between $00 and $FF: ${value}`);
  }
  return value;
}

function clampWord(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`Address must be between $0000 and $FFFF: ${value}`);
  }
  return value;
}

function connectSocket(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
