import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ViceDebugSession } from '../vice-debug-session';
import {
  ViceMonitorCommandId,
  type ViceMonitorBytes,
  type ViceMonitorCheckpoint,
  type ViceMonitorEvent
} from '../vice-monitor';

interface TestInstalledDebugInfoBreakpoint {
  id: number;
  debugBreakpoint: {
    segment: string;
    address: number;
  };
  monitorCommandOwned: true;
  dapVisible: false;
  address: number;
  checkpointNumber?: number;
  checkpointEnabled?: boolean;
  enabled: boolean;
  hitCount: number;
  verified: boolean;
}

interface TestableViceDebugSession {
  monitor?: FakeViceMonitor;
  debugInfoBreakpoints: TestInstalledDebugInfoBreakpoint[];
  checkpointToBreakpoint: Map<number, TestInstalledDebugInfoBreakpoint>;
  associateProgrammedBreakpointCheckpoint(checkpoint: ViceMonitorCheckpoint): void;
  synchronizeProgrammedBreakpointCheckpoint(
    breakpoint: TestInstalledDebugInfoBreakpoint
  ): Promise<void>;
}

class FakeDapConnection {
  readonly events: Array<{ event: string; body: unknown }> = [];
  readonly outputs: Array<{ output: string; category?: string }> = [];

  sendEvent(event: string, body?: unknown): void {
    this.events.push({ event, body });
  }

  sendOutput(output: string, category?: string): void {
    this.outputs.push({ output, category });
  }
}

class FakeViceMonitor {
  readonly toggledCheckpointNumbers: number[] = [];
  private listIndex = 0;

  constructor(
    private readonly session: TestableViceDebugSession,
    private readonly listedCheckpointNumbers: readonly number[],
    private readonly validCheckpointNumber: number
  ) {}

  send(commandId: ViceMonitorCommandId, body: ViceMonitorBytes = Buffer.alloc(0)): number {
    assert.equal(commandId, ViceMonitorCommandId.CHECKPOINT_LIST);
    assert.equal(body.length, 0);
    const checkpointNumber = this.listedCheckpointNumbers[
      Math.min(this.listIndex, this.listedCheckpointNumbers.length - 1)
    ];
    this.listIndex += 1;
    queueMicrotask(() => {
      this.session.associateProgrammedBreakpointCheckpoint(
        programmedCheckpoint(checkpointNumber, true)
      );
    });
    return this.listIndex;
  }

  async sendAndWait(
    commandId: ViceMonitorCommandId,
    body: ViceMonitorBytes,
    predicate: (event: ViceMonitorEvent) => boolean
  ): Promise<ViceMonitorEvent> {
    assert.equal(commandId, ViceMonitorCommandId.CHECKPOINT_TOGGLE);
    const checkpointNumber = body.readUInt32LE(0);
    this.toggledCheckpointNumbers.push(checkpointNumber);
    if (checkpointNumber !== this.validCheckpointNumber) {
      throw new Error(
        `VICE monitor error 1 (object does not exist) on response 0 for request ${checkpointNumber}.`
      );
    }
    const event: ViceMonitorEvent = {
      type: 'ack',
      requestId: this.toggledCheckpointNumbers.length,
      commandId: ViceMonitorCommandId.CHECKPOINT_TOGGLE,
      body: Buffer.alloc(0)
    };
    assert.equal(predicate(event), true);
    return event;
  }
}

test('programmed breakpoint toggle refreshes a stale checkpoint number before toggling', async () => {
  const { session, connection, monitor, breakpoint } = createProgrammedBreakpointSession(
    [3],
    3
  );

  await session.synchronizeProgrammedBreakpointCheckpoint(breakpoint);

  assert.deepEqual(monitor.toggledCheckpointNumbers, [3]);
  assert.equal(breakpoint.checkpointNumber, 3);
  assert.equal(breakpoint.checkpointEnabled, false);
  assert.equal(breakpoint.enabled, false);
  assert.equal(connection.outputs.length, 0);
});

test('programmed breakpoint toggle retries when VICE rejects a replaced checkpoint number', async () => {
  const { session, connection, monitor, breakpoint } = createProgrammedBreakpointSession(
    [2, 3],
    3
  );

  await session.synchronizeProgrammedBreakpointCheckpoint(breakpoint);

  assert.deepEqual(monitor.toggledCheckpointNumbers, [2, 3]);
  assert.equal(breakpoint.checkpointNumber, 3);
  assert.equal(breakpoint.checkpointEnabled, false);
  assert.equal(breakpoint.enabled, false);
  assert.equal(connection.outputs.length, 0);
  assert.ok(connection.events.some((event) =>
    JSON.stringify(event.body).includes('no longer exists; refreshing checkpoint list')
  ));
});

function createProgrammedBreakpointSession(
  listedCheckpointNumbers: readonly number[],
  validCheckpointNumber: number
): {
  session: TestableViceDebugSession;
  connection: FakeDapConnection;
  monitor: FakeViceMonitor;
  breakpoint: TestInstalledDebugInfoBreakpoint;
} {
  const connection = new FakeDapConnection();
  const session = new ViceDebugSession(
    connection as never
  ) as unknown as TestableViceDebugSession;
  const breakpoint = programmedBreakpoint();
  const monitor = new FakeViceMonitor(
    session,
    listedCheckpointNumbers,
    validCheckpointNumber
  );

  session.monitor = monitor;
  session.debugInfoBreakpoints = [breakpoint];
  session.checkpointToBreakpoint = new Map([[2, breakpoint]]);
  return { session, connection, monitor, breakpoint };
}

function programmedBreakpoint(): TestInstalledDebugInfoBreakpoint {
  return {
    id: 1,
    debugBreakpoint: {
      segment: 'Default',
      address: 0x1009
    },
    monitorCommandOwned: true,
    dapVisible: false,
    address: 0x1009,
    checkpointNumber: 2,
    checkpointEnabled: true,
    enabled: false,
    hitCount: 0,
    verified: true
  };
}

function programmedCheckpoint(
  number: number,
  enabled: boolean
): ViceMonitorCheckpoint {
  return {
    number,
    hit: false,
    startAddress: 0x1009,
    endAddress: 0x1009,
    stop: true,
    enabled,
    load: false,
    store: false,
    exec: true,
    temporary: false
  };
}
