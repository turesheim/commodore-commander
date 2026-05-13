export interface TraceRegisterSnapshot {
  name: string;
  value: number;
  bitSize: number;
}

export interface TraceRegisterChange extends TraceRegisterSnapshot {
  previousValue: number;
}

export interface TraceSourceLocation {
  path: string;
  line: number;
  column?: number;
}

export interface TraceMemoryAccess {
  accessType: 'read' | 'write' | 'readWrite';
  startAddress: number;
  endAddress: number;
  valuePreview: readonly number[];
  truncated: boolean;
}

export interface TraceSnapshotInput {
  reason: string;
  pc: number;
  instruction?: string;
  instructionBytes?: string;
  symbol?: string;
  source?: TraceSourceLocation;
  registers: readonly TraceRegisterSnapshot[];
  memoryAccess?: TraceMemoryAccess;
}

export interface TraceSnapshot extends TraceSnapshotInput {
  sequence: number;
  createdAt: number;
  changedRegisters: readonly TraceRegisterChange[];
}

export interface TraceObservedWrite {
  sequence: number;
  reason: string;
  pc: number;
  address: number;
  startAddress: number;
  endAddress: number;
  value?: number;
  valuePreview: readonly number[];
  truncated: boolean;
}

export class TraceHistory {
  private readonly snapshots: TraceSnapshot[] = [];
  private readonly lastRegisterValues = new Map<string, TraceRegisterSnapshot>();
  private readonly observedWrites = new Map<number, TraceObservedWrite>();
  private nextSequence = 1;

  constructor(private readonly capacity = 200) {}

  record(input: TraceSnapshotInput): TraceSnapshot {
    const changedRegisters = this.changedRegisters(input.registers);
    const snapshot: TraceSnapshot = {
      ...input,
      sequence: this.nextSequence,
      createdAt: Date.now(),
      changedRegisters
    };
    this.nextSequence += 1;

    this.snapshots.push(snapshot);
    while (this.snapshots.length > this.capacity) {
      this.snapshots.shift();
    }

    for (const register of input.registers) {
      this.lastRegisterValues.set(registerKey(register.name), { ...register });
    }

    if (input.memoryAccess?.accessType === 'write') {
      this.recordObservedWrite(snapshot, input.memoryAccess);
    }

    return snapshot;
  }

  clear(): void {
    this.snapshots.length = 0;
    this.lastRegisterValues.clear();
    this.observedWrites.clear();
    this.nextSequence = 1;
  }

  entries(): readonly TraceSnapshot[] {
    return this.snapshots;
  }

  newest(count = this.capacity): TraceSnapshot[] {
    return this.snapshots.slice(-Math.max(0, count)).reverse();
  }

  find(sequence: number): TraceSnapshot | undefined {
    return this.snapshots.find((snapshot) => snapshot.sequence === sequence);
  }

  lastObservedWrite(address: number): TraceObservedWrite | undefined {
    return this.observedWrites.get(normalizeAddress(address));
  }

  registerChanges(registerName: string, count = this.capacity): TraceSnapshot[] {
    const key = registerKey(registerName);
    return this.newest(this.capacity)
      .filter((snapshot) =>
        snapshot.changedRegisters.some((register) => registerKey(register.name) === key)
      )
      .slice(0, Math.max(0, count));
  }

  private changedRegisters(
    registers: readonly TraceRegisterSnapshot[]
  ): TraceRegisterChange[] {
    const changes: TraceRegisterChange[] = [];
    for (const register of registers) {
      const previous = this.lastRegisterValues.get(registerKey(register.name));
      if (!previous || previous.value === register.value) {
        continue;
      }
      changes.push({
        ...register,
        previousValue: previous.value
      });
    }
    return changes;
  }

  private recordObservedWrite(
    snapshot: TraceSnapshot,
    access: TraceMemoryAccess
  ): void {
    const start = normalizeAddress(access.startAddress);
    const end = normalizeAddress(access.endAddress);
    const length = access.endAddress - access.startAddress + 1;
    for (let offset = 0; offset < length; offset += 1) {
      const address = normalizeAddress(access.startAddress + offset);
      this.observedWrites.set(address, {
        sequence: snapshot.sequence,
        reason: snapshot.reason,
        pc: snapshot.pc,
        address,
        startAddress: start,
        endAddress: end,
        value: access.valuePreview[offset],
        valuePreview: access.valuePreview,
        truncated: access.truncated
      });
    }
  }
}

export function formatTraceEntrySummary(snapshot: TraceSnapshot): string {
  const details = [
    `$${hexWord(snapshot.pc)}`,
    snapshot.instruction ?? 'instruction unavailable',
    `[${snapshot.reason}]`
  ];
  if (snapshot.changedRegisters.length > 0) {
    details.push(`changed ${formatRegisterChangesInline(snapshot.changedRegisters)}`);
  }
  if (snapshot.memoryAccess) {
    details.push(formatMemoryAccessInline(snapshot.memoryAccess));
  }
  return details.join(' ');
}

export function formatTraceHistory(
  entries: readonly TraceSnapshot[],
  limit: number
): string {
  const selected = entries.slice(0, Math.max(0, limit));
  if (selected.length === 0) {
    return 'Trace history is empty.';
  }
  return selected
    .map((entry) => `#${entry.sequence} ${formatTraceEntrySummary(entry)}`)
    .join('\n');
}

export function formatObservedWrite(write: TraceObservedWrite | undefined): string {
  if (!write) {
    return 'No observed write for that address. Add a write watchpoint or write through the Memory view first.';
  }
  const range = write.startAddress === write.endAddress
    ? `$${hexWord(write.startAddress)}`
    : `$${hexWord(write.startAddress)}-$${hexWord(write.endAddress)}`;
  const value = write.value === undefined ? 'value unavailable' : `value $${hexByte(write.value)}`;
  return [
    `Last observed write for $${hexWord(write.address)}:`,
    `#${write.sequence}`,
    `[${write.reason}]`,
    `PC $${hexWord(write.pc)}`,
    range,
    value,
    formatBytePreview(write.valuePreview, write.truncated)
  ].filter(Boolean).join(' ');
}

export function formatRegisterChangeHistory(
  registerName: string,
  entries: readonly TraceSnapshot[],
  limit: number
): string {
  const selected = entries.slice(0, Math.max(0, limit));
  if (selected.length === 0) {
    return `No observed changes for register ${registerName}.`;
  }
  return selected
    .map((entry) => {
      const change = entry.changedRegisters.find((register) =>
        registerKey(register.name) === registerKey(registerName)
      );
      if (!change) {
        return undefined;
      }
      return [
        `#${entry.sequence}`,
        `PC $${hexWord(entry.pc)}`,
        `${change.name} ${formatRegisterValue(change.previousValue, change.bitSize)} -> ${formatRegisterValue(change.value, change.bitSize)}`,
        entry.instruction ? `after ${entry.instruction}` : undefined
      ].filter(Boolean).join(' ');
    })
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

export function formatRegisterValue(value: number, bitSize: number): string {
  return `$${hex(value, Math.max(2, Math.ceil(bitSize / 4)))}`;
}

export function formatBytePreview(
  bytes: readonly number[],
  truncated: boolean
): string | undefined {
  if (bytes.length === 0) {
    return undefined;
  }
  return `bytes ${bytes.map((byte) => `$${hexByte(byte)}`).join(' ')}${truncated ? ' ...' : ''}`;
}

function formatRegisterChangesInline(
  changes: readonly TraceRegisterChange[]
): string {
  return changes.map((change) =>
    `${change.name}:${formatRegisterValue(change.previousValue, change.bitSize)}->${formatRegisterValue(change.value, change.bitSize)}`
  ).join(', ');
}

function formatMemoryAccessInline(access: TraceMemoryAccess): string {
  const range = access.startAddress === access.endAddress
    ? `$${hexWord(access.startAddress)}`
    : `$${hexWord(access.startAddress)}-$${hexWord(access.endAddress)}`;
  return [
    `${access.accessType} ${range}`,
    formatBytePreview(access.valuePreview, access.truncated)
  ].filter(Boolean).join(' ');
}

function registerKey(name: string): string {
  return name.toLowerCase();
}

function normalizeAddress(address: number): number {
  return ((address % 0x10000) + 0x10000) % 0x10000;
}

function hexByte(value: number): string {
  return hex(value, 2);
}

function hexWord(value: number): string {
  return hex(value, 4);
}

function hex(value: number, width: number): string {
  return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}
