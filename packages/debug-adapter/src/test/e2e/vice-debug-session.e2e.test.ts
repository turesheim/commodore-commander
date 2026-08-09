import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { test, type TestContext } from 'node:test';

import type { DebugProtocol } from '@vscode/debugprotocol';

import { DapClient } from './dap-client';
import {
  fixtureLine,
  prepareFixture,
  type DebugAdapterFixtureName,
  type PreparedFixture
} from './fixtures';
import { COMMODORE_VICE_MONITOR_LOG_EVENT } from '../../vice-monitor-log';
import { readC64VisualSnapshot } from './visual-snapshot';
import {
  resolveViceE2eEnvironment,
  type ViceE2eEnvironment
} from './vice-environment';

const THREAD_ID = 1;
const E2E_TIMEOUT_MS = 45_000;
const PROGRAMMED_BREAKPOINT_RAW_ID = 'commodoreViceProgrammedBreakpointId';
const PROGRAMMED_BREAKPOINT_RAW_ADDRESS =
  'commodoreViceProgrammedBreakpointAddress';

const { environment, skipReason } = resolveViceE2eEnvironment();

interface LaunchedFixtureSession {
  client: DapClient;
  fixture: PreparedFixture;
  vice: ViceE2eEnvironment;
  viceArgs?: readonly string[];
  viceFramePort?: number;
  debugInfo?: string | false;
}

interface ProgrammedBreakpointDescriptor {
  id: number;
  address: string;
  enabled: boolean;
  installed: boolean;
  canRemove: false;
  source?: DebugProtocol.Source;
  line?: number;
  checkpointNumber?: number;
}

viceTest('launches VICE and stops on entry', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  const capabilities = await initializeAndLaunch(session);

  assert.equal(capabilities.supportsReadMemoryRequest, true);
  assert.equal(capabilities.supportsWriteMemoryRequest, true);
  assert.equal(capabilities.supportsDataBreakpoints, true);
  assert.equal(capabilities.supportsLogPoints, true);
  assert.equal(capabilities.supportsConfigurationDoneRequest, true);

  const stopped = await configurationDoneAndWaitStopped(session.client);
  assert.equal(stopped.body?.reason, 'entry');

  const threads = await session.client.request<DebugProtocol.ThreadsResponse['body']>(
    'threads'
  );
  assert.deepEqual(threads.threads, [
    {
      id: THREAD_ID,
      name: 'VICE emulator'
    }
  ]);
});

viceTest('hits source breakpoints through a real VICE monitor session', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'jsr MarkStepTarget'
  );
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    breakpointLine
  );
  const checkpointSetLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_SET' &&
        body.message?.includes('CHECKPOINT_SET') === true;
    },
    E2E_TIMEOUT_MS
  );

  await configurationDoneAndWaitStopped(session.client);
  await checkpointSetLog;
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('installs source breakpoints sent before launch', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await session.client.request<DebugProtocol.Capabilities>(
    'initialize',
    {
      adapterID: 'commodore-vice',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsMemoryEvent: true,
      supportsInvalidatedEvent: true
    } satisfies DebugProtocol.InitializeRequestArguments
  );

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'jsr MarkStepTarget'
  );
  const pendingBreakpointResponse =
    await sendSetBreakpoints(session.client, session.fixture.source, [
      { line: breakpointLine }
    ]);
  const pendingBreakpoint = pendingBreakpointResponse.breakpoints[0];
  assert.ok(pendingBreakpoint, 'expected one source breakpoint response');
  assert.equal(pendingBreakpoint.verified, false);

  const changedBreakpoint = session.client.waitForEvent<DebugProtocol.BreakpointEvent>(
    'breakpoint',
    (event) => {
      const body = event.body;
      return body?.reason === 'changed' &&
        body.breakpoint.id === pendingBreakpoint.id &&
        body.breakpoint.verified === true;
    },
    E2E_TIMEOUT_MS
  );

  await launchInitializedFixture(session);
  const changed = await changedBreakpoint;
  assert.equal(changed.body?.breakpoint.line, breakpointLine);

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [pendingBreakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('installs source breakpoints added while VICE is running', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);
  await configurationDoneAndWaitStopped(session.client);

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'jmp Hold'
  );

  await session.client.request<DebugProtocol.ContinueResponse['body']>(
    'continue',
    { threadId: THREAD_ID } satisfies DebugProtocol.ContinueArguments
  );
  await delay(250);

  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    breakpointLine
  );
  const { stopped, topFrame } = await waitUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine,
    (candidate) =>
      candidate.body?.hitBreakpointIds?.includes(breakpoint.id!) === true
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  assert.deepEqual(stopped.body?.hitBreakpointIds, [breakpoint.id]);
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('removes source breakpoints cleared through setBreakpoints', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  await initializeAndLaunch(session);

  const removedLine = await fixtureLine(
    session.fixture.source,
    'lda #INNER_MAX'
  );
  const remainingLine = await fixtureLine(
    session.fixture.source,
    'bne CrazyBorderLoop'
  );
  const installedResponse = await sendSetBreakpoints(
    session.client,
    session.fixture.source,
    [
      { line: removedLine },
      { line: remainingLine }
    ]
  );
  assert.equal(installedResponse.breakpoints.length, 2);
  assert.equal(installedResponse.breakpoints[0]?.verified, true);
  assert.equal(installedResponse.breakpoints[1]?.verified, true);

  await configurationDoneAndWaitStopped(session.client);

  const checkpointDeleteLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_DELETE' &&
        body.message?.includes('CHECKPOINT_DELETE') === true;
    },
    E2E_TIMEOUT_MS
  );
  const updatedResponse = await sendSetBreakpoints(
    session.client,
    session.fixture.source,
    [{ line: remainingLine }]
  );
  await checkpointDeleteLog;
  const remainingBreakpoint = updatedResponse.breakpoints[0];
  assert.ok(remainingBreakpoint, 'expected remaining source breakpoint response');
  assert.equal(remainingBreakpoint.verified, true, remainingBreakpoint.message);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stopped = await continueAndWaitStopped(session.client);
    const topFrame = await topStackFrame(session.client);
    if (
      topFrame.source?.path === session.fixture.source &&
      topFrame.line === removedLine
    ) {
      throw new Error(`Removed breakpoint still stopped at line ${removedLine}.`);
    }
    if (
      topFrame.source?.path === session.fixture.source &&
      topFrame.line === remainingLine
    ) {
      assert.equal(stopped.body?.reason, 'breakpoint');
      if (stopped.body?.hitBreakpointIds) {
        assert.deepEqual(stopped.body.hitBreakpointIds, [remainingBreakpoint.id]);
      }
      return;
    }
  }
  throw new Error(`Did not stop at remaining breakpoint line ${remainingLine}.`);
});

viceTest('disables source breakpoints through Theia state without deleting checkpoints', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  await initializeAndLaunch(session);

  const disabledLine = await fixtureLine(
    session.fixture.source,
    'lda #INNER_MAX'
  );
  const remainingLine = await fixtureLine(
    session.fixture.source,
    'bne CrazyBorderLoop'
  );
  const breakpointStates = [
    { line: disabledLine, enabled: true, markerId: 'disabled-marker' },
    { line: remainingLine, enabled: true, markerId: 'remaining-marker' }
  ];
  await syncSourceBreakpointStates(
    session.client,
    session.fixture.source,
    breakpointStates
  );
  const installedResponse = await sendSetBreakpoints(
    session.client,
    session.fixture.source,
    [
      { line: disabledLine },
      { line: remainingLine }
    ]
  );
  assert.equal(installedResponse.breakpoints.length, 2);

  await configurationDoneAndWaitStopped(session.client);

  const checkpointToggleLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_TOGGLE' &&
        body.message?.includes('enabled=0') === true;
    },
    E2E_TIMEOUT_MS
  );
  const checkpointDeleteLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_DELETE' &&
        body.message?.includes('CHECKPOINT_DELETE') === true;
    },
    750
  ).then(() => true, () => false);

  const updatedResponse = await sendSetBreakpoints(
    session.client,
    session.fixture.source,
    [{ line: remainingLine }]
  );
  await syncSourceBreakpointStates(
    session.client,
    session.fixture.source,
    [
      { line: disabledLine, enabled: false, markerId: 'disabled-marker' },
      { line: remainingLine, enabled: true, markerId: 'remaining-marker' }
    ]
  );
  await checkpointToggleLog;
  assert.equal(await checkpointDeleteLog, false);

  const remainingBreakpoint = updatedResponse.breakpoints[0];
  assert.ok(remainingBreakpoint, 'expected remaining source breakpoint response');
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    remainingLine
  );
  assert.equal(stopped.body?.reason, 'breakpoint');
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, remainingLine);
});

viceTest('resolves screencolors comment breakpoints to executable lines', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  await initializeAndLaunch(session);

  const commentLine = await fixtureLine(
    session.fixture.source,
    '// back to top of loop'
  );
  const executableLine = commentLine + 1;
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    commentLine
  );

  assert.equal(breakpoint.line, executableLine);

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('hits screencolors source breakpoints in embedded VICE mode', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors', {
    embedded: true
  });
  await initializeAndLaunch(session);

  const commentLine = await fixtureLine(
    session.fixture.source,
    '// back to top of loop'
  );
  const executableLine = commentLine + 1;
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    commentLine
  );

  assert.equal(breakpoint.line, executableLine);

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('prefers configured debug info over nearby overlapping debug dumps', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  await writeFile(
    path.join(session.fixture.directory, 'misleading.dbg'),
    createMisleadingDebugInfo(
      path.join(session.fixture.directory, 'misleading.asm')
    ),
    'utf8'
  );
  await initializeAndLaunch(session);

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('uses exact program debug info when launch omits debug info', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  session.debugInfo = false;
  await writeFile(
    path.join(session.fixture.directory, 'misleading.dbg'),
    createMisleadingDebugInfo(
      path.join(session.fixture.directory, 'misleading.asm')
    ),
    'utf8'
  );
  await initializeAndLaunch(session);

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('ignores configured debug info that does not match the launched PRG', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  const misleadingDebugInfo = path.join(session.fixture.directory, 'misleading.dbg');
  session.debugInfo = misleadingDebugInfo;
  await writeFile(
    misleadingDebugInfo,
    createMisleadingDebugInfo(
      path.join(session.fixture.directory, 'misleading.asm')
    ),
    'utf8'
  );
  await initializeAndLaunch(session);

  assert.match(
    session.client.outputText,
    /Configured Kick Assembler debug info .*misleading\.dbg does not match launched PRG .*screencolors\.prg/u
  );

  const breakpointLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    breakpointLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, breakpointLine);
});

viceTest('keeps embedded VICE stopped while Theia finishes breakpoint setup', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors', {
    embedded: true
  });
  await initializeAndLaunch(session);

  const commentLine = await fixtureLine(
    session.fixture.source,
    '// back to top of loop'
  );
  const executableLine = commentLine + 1;
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    commentLine
  );

  assert.equal(breakpoint.line, executableLine);
  await delay(1500);

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  if (stopped.body?.hitBreakpointIds) {
    assert.deepEqual(stopped.body.hitBreakpointIds, [breakpoint.id]);
  }
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('hits Kick Assembler debug-info breakpoints', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  await addDebugInfoBreakpoint(session.fixture.debugInfo, '$1009');
  await initializeAndLaunch(session);

  const executableLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  assert.equal(stopped.body?.hitBreakpointIds, undefined);
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('stops on VICE monitor command breakpoints from explicit moncommands', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  const monitorCommands = path.join(session.fixture.directory, 'screencolors.vs');
  await writeFile(monitorCommands, 'break 1009\n', 'utf8');
  await addDebugInfoBreakpoint(session.fixture.debugInfo, '$1009');
  session.viceArgs = [
    ...session.vice.viceArgs,
    '-moncommands',
    monitorCommands
  ];
  await initializeAndLaunch(session);

  const executableLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  assert.equal(stopped.body?.hitBreakpointIds, undefined);
  assert.match(
    session.client.outputText,
    /Skipped 1 Kick Assembler \.dbg breakpoint already present/u
  );
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('toggles programmed breakpoints without deleting VICE checkpoints', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  const monitorCommands = path.join(session.fixture.directory, 'screencolors.vs');
  await writeFile(monitorCommands, 'break 1009\n', 'utf8');
  await addDebugInfoBreakpoint(session.fixture.debugInfo, '$1009');
  session.viceArgs = [
    ...session.vice.viceArgs,
    '-moncommands',
    monitorCommands
  ];
  await initializeAndLaunch(session);

  const executableLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );
  const remainingLine = await fixtureLine(
    session.fixture.source,
    'bne CrazyBorderLoop'
  );
  await configurationDoneAndWaitStopped(session.client);

  const listResponse = await session.client.request<{
    breakpoints: ProgrammedBreakpointDescriptor[];
  }>('commodore-vice/listProgrammedBreakpoints');
  const programmedBreakpoint = listResponse.breakpoints[0];
  assert.ok(programmedBreakpoint, 'expected one programmed breakpoint');
  assert.equal(programmedBreakpoint.address, '$1009');
  assert.equal(programmedBreakpoint.canRemove, false);
  assert.equal(programmedBreakpoint.enabled, true);
  assert.equal(programmedBreakpoint.installed, true);
  assert.equal(programmedBreakpoint.source?.path, session.fixture.source);
  assert.equal(programmedBreakpoint.line, executableLine);
  assert.equal(typeof programmedBreakpoint.checkpointNumber, 'number');

  const installedResponse = await sendSetBreakpoints(
    session.client,
    session.fixture.source,
    [
      programmedSourceBreakpoint(programmedBreakpoint),
      { line: remainingLine }
    ]
  );
  assert.equal(installedResponse.breakpoints.length, 2);
  assert.equal(installedResponse.breakpoints[0]?.id, programmedBreakpoint.id);
  assert.equal(installedResponse.breakpoints[0]?.line, executableLine);
  assert.equal(installedResponse.breakpoints[1]?.verified, true);

  const checkpointToggleLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_TOGGLE' &&
        body.message?.includes('enabled=0') === true;
    },
    E2E_TIMEOUT_MS
  );
  const checkpointDeleteLog = session.client.waitForEvent<DebugProtocol.Event>(
    COMMODORE_VICE_MONITOR_LOG_EVENT,
    (event) => {
      const body = event.body as {
        category?: string;
        name?: string;
        message?: string;
      } | undefined;
      return body?.category === 'input' &&
        body.name === 'CHECKPOINT_DELETE' &&
        body.message?.includes('CHECKPOINT_DELETE') === true;
    },
    750
  ).then(() => true, () => false);

  await syncSourceBreakpointStates(
    session.client,
    session.fixture.source,
    [
      {
        ...programmedSourceBreakpoint(programmedBreakpoint),
        enabled: false,
        markerId: 'programmed-marker'
      },
      {
        line: remainingLine,
        enabled: true,
        markerId: 'remaining-marker'
      }
    ]
  );
  await checkpointToggleLog;
  assert.equal(await checkpointDeleteLog, false);
});

viceTest('passes adjacent Kick Assembler VICE symbol files to VICE', async (t, vice) => {
  const session = await launchFixture(t, vice, 'screencolors');
  const monitorCommands = path.join(session.fixture.directory, 'screencolors.vs');
  await writeFile(
    monitorCommands,
    '; Kick Assembler VICE symbols\nbreak 1009\n',
    'utf8'
  );
  await addDebugInfoBreakpoint(session.fixture.debugInfo, '$1009');
  await initializeAndLaunch(session);

  assert.ok(
    session.client.outputText.includes(monitorCommands),
    'expected launch output to include adjacent .vs monitor command file'
  );
  assert.match(
    session.client.outputText,
    /Skipped 1 Kick Assembler \.dbg breakpoint already present/u
  );

  const executableLine = await fixtureLine(
    session.fixture.source,
    'inc inner_counter'
  );

  await configurationDoneAndWaitStopped(session.client);
  const { stopped, topFrame } = await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    executableLine
  );

  assert.equal(stopped.body?.reason, 'breakpoint');
  assert.equal(stopped.body?.hitBreakpointIds, undefined);
  assert.equal(topFrame.source?.path, session.fixture.source);
  assert.equal(topFrame.line, executableLine);
});

viceTest('steps into, steps out of, and steps over source calls', async (t, vice) => {
  const stepInSession = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(stepInSession);
  const callLine = await fixtureLine(stepInSession.fixture.source, 'jsr MarkStepTarget');
  await setSourceBreakpoint(stepInSession.client, stepInSession.fixture.source, callLine);
  await configurationDoneAndWaitStopped(stepInSession.client);
  await continueUntilTopFrame(stepInSession.client, stepInSession.fixture.source, callLine);

  await stepAndWaitStopped(stepInSession.client, 'stepIn');
  let topFrame = await topStackFrame(stepInSession.client);
  assert.match(topFrame.name, /MarkStepTarget/u);

  await stepAndWaitStopped(stepInSession.client, 'stepOut');
  topFrame = await topStackFrame(stepInSession.client);
  assert.equal(topFrame.instructionPointerReference, '0x1004');

  const stepOverSession = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(stepOverSession);
  await setSourceBreakpoint(stepOverSession.client, stepOverSession.fixture.source, callLine);
  await configurationDoneAndWaitStopped(stepOverSession.client);
  await continueUntilTopFrame(stepOverSession.client, stepOverSession.fixture.source, callLine);

  await stepAndWaitStopped(stepOverSession.client, 'next');
  topFrame = await topStackFrame(stepOverSession.client);
  assert.equal(topFrame.instructionPointerReference, '0x1004');
});

viceTest('stops on data breakpoints and records watched writes', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);

  const firstUserCodeLine = await fixtureLine(
    session.fixture.source,
    'jsr MarkStepTarget'
  );
  await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    firstUserCodeLine
  );
  await configurationDoneAndWaitStopped(session.client);
  await continueUntilTopFrame(
    session.client,
    session.fixture.source,
    firstUserCodeLine
  );

  const breakpointInfo = await session.client.request<DebugProtocol.DataBreakpointInfoResponse['body']>(
    'dataBreakpointInfo',
    {
      name: 'demo_state',
      variablesReference: 0,
      bytes: 1
    } satisfies DebugProtocol.DataBreakpointInfoArguments
  );
  assert.equal(breakpointInfo.dataId, 'memory:0813:1');

  const dataBreakpoints = await session.client.request<DebugProtocol.SetDataBreakpointsResponse['body']>(
    'setDataBreakpoints',
    {
      breakpoints: [
        {
          dataId: breakpointInfo.dataId!,
          accessType: 'write'
        }
      ]
    } satisfies DebugProtocol.SetDataBreakpointsArguments
  );
  assert.equal(dataBreakpoints.breakpoints[0]?.verified, true);

  const stopped = await continueAndWaitStopped(session.client);

  assert.equal(stopped.body?.reason, 'data breakpoint');
  assert.match(stopped.body?.description ?? '', /VICE write watchpoint, \$0813, PC \$1013/u);

  const trace = await session.client.request<DebugProtocol.EvaluateResponse['body']>(
    'evaluate',
    {
      expression: '.trace 1',
      context: 'repl'
    } satisfies DebugProtocol.EvaluateArguments
  );
  assert.match(trace.result, /write \$0813/u);
});

viceTest('round-trips DAP memory writes and exposes last-write provenance', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);
  await configurationDoneAndWaitStopped(session.client);

  const bytes = Buffer.from([0x43, 0x36, 0x34]);
  const write = await session.client.request<DebugProtocol.WriteMemoryResponse['body']>(
    'writeMemory',
    {
      memoryReference: '0x0400',
      data: bytes.toString('base64')
    } satisfies DebugProtocol.WriteMemoryArguments
  );
  assert.ok(write, 'expected writeMemory response body');
  assert.equal(write.bytesWritten, bytes.length);

  const read = await session.client.request<DebugProtocol.ReadMemoryResponse['body']>(
    'readMemory',
    {
      memoryReference: '0x0400',
      count: bytes.length,
      sideEffects: false
    } as DebugProtocol.ReadMemoryArguments
  );
  assert.ok(read, 'expected readMemory response body');
  assert.deepEqual(Buffer.from(read.data ?? '', 'base64'), bytes);

  const lastWrite = await session.client.request<DebugProtocol.EvaluateResponse['body']>(
    'evaluate',
    {
      expression: '.lastwrite $0400',
      context: 'repl'
    } satisfies DebugProtocol.EvaluateArguments
  );
  assert.match(lastWrite.result, /Last observed write for \$0400/u);
  assert.match(lastWrite.result, /value \$43/u);
});

viceTest('maps stepped ROM frames to generated C64 ROM sources', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);

  const callLine = await fixtureLine(session.fixture.source, 'jsr ClearScreen');
  await setSourceBreakpoint(session.client, session.fixture.source, callLine);
  await configurationDoneAndWaitStopped(session.client);
  await continueUntilTopFrame(session.client, session.fixture.source, callLine);

  await stepAndWaitStopped(session.client, 'stepIn');
  let topFrame = await topStackFrame(session.client);
  assert.match(topFrame.name, /ClearScreen/u);

  await stepAndWaitStopped(session.client, 'stepIn');
  topFrame = await topStackFrame(session.client);
  assert.equal(topFrame.source?.origin, 'VICE C64 ROM disassembly');
  assert.match(topFrame.source?.name ?? '', /KERNAL ROM/u);
  assert.equal(typeof topFrame.source?.sourceReference, 'number');

  const source = await session.client.request<DebugProtocol.SourceResponse['body']>(
    'source',
    {
      source: topFrame.source,
      sourceReference: topFrame.source!.sourceReference!
    } satisfies DebugProtocol.SourceArguments
  );
  assert.match(source.content, /C64 KERNAL ROM/u);
  assert.match(source.content, /KERNAL_CLEAR_SCREEN/u);
});

viceTest('emits source logpoint output while VICE keeps running', async (t, vice) => {
  const session = await launchFixture(t, vice, 'debug-demo');
  await initializeAndLaunch(session);

  const logpointLine = await fixtureLine(session.fixture.source, 'stx frame_counter');
  const breakpoint = await setSourceBreakpoint(
    session.client,
    session.fixture.source,
    logpointLine,
    {
      logMessage: 'pulse {hitcount} X={X} at {address}'
    }
  );
  assert.equal(breakpoint.verified, true);

  await configurationDoneAndWaitStopped(session.client);
  const event = await continueUntilOutput(session.client, (event) => {
      const body = event.body as DebugProtocol.OutputEvent['body'] | undefined;
      return body?.category === 'console' &&
        /pulse 1 X=\$00 at \$1055/u.test(body.output);
  });
  assert.match(event.body?.output ?? '', /pulse 1/u);
});

viceTest('reads a visual-debugger snapshot from real C64 memory banks', async (t, vice) => {
  const session = await launchFixture(t, vice, 'visual-debugger-demo');
  await initializeAndLaunch(session);

  const snapshotLine = await fixtureLine(session.fixture.source, '        cli');
  await setSourceBreakpoint(session.client, session.fixture.source, snapshotLine);
  await configurationDoneAndWaitStopped(session.client);
  await continueUntilTopFrame(session.client, session.fixture.source, snapshotLine);

  const snapshot = await readC64VisualSnapshot(session.client);
  assert.equal(snapshot.video.bankBase, 0x0000);
  assert.equal(snapshot.video.screenBase, 0x0400);
  assert.equal(snapshot.video.characterBase, 0x1000);
  assert.equal(snapshot.video.memoryControl & 0xfe, 0x14);

  assert.equal(snapshot.sprite0.enabled, true);
  assert.equal(snapshot.sprite0.pointer, 0x80);
  assert.equal(snapshot.sprite0.dataAddress, 0x2000);
  assert.equal(snapshot.sprite0.x, 48);
  assert.equal(snapshot.sprite0.y, 90);
  assert.equal(snapshot.sprite0.color & 0x0f, 2);

  assert.deepEqual(
    [...snapshot.screenBytes.subarray(40 * 2, 40 * 2 + 6)],
    [22, 9, 19, 21, 1, 12]
  );
  assert.deepEqual(
    [...snapshot.colorBytes.subarray(40 * 2, 40 * 2 + 6)].map((value) => value & 0x0f),
    [7, 7, 7, 7, 7, 7]
  );
});

function viceTest(
  name: string,
  fn: (t: TestContext, vice: ViceE2eEnvironment) => Promise<void>
): void {
  test(
    name,
    {
      skip: skipReason,
      timeout: E2E_TIMEOUT_MS + 15_000
    },
    async (t) => {
      assert.ok(environment, 'VICE e2e environment should be resolved for non-skipped tests.');
      await fn(t, environment);
    }
  );
}

async function launchFixture(
  t: TestContext,
  vice: ViceE2eEnvironment,
  fixtureName: DebugAdapterFixtureName,
  options: { embedded?: boolean; viceArgs?: readonly string[] } = {}
): Promise<LaunchedFixtureSession> {
  const fixture = await prepareFixture(vice.packageRoot, fixtureName);
  const artifactDirectory = path.join(
    vice.repoRoot,
    'test-results',
    'vice-e2e',
    sanitizeArtifactName(t.name)
  );
  await mkdir(artifactDirectory, { recursive: true });
  const client = DapClient.start({
    adapterPath: path.join(vice.packageRoot, 'lib', 'vice-debug-adapter.js'),
    artifactDirectory,
    requestTimeoutMs: E2E_TIMEOUT_MS
  });
  const embeddedFrameServer = options.embedded ? net.createServer((socket) => {
    socket.on('data', () => undefined);
  }) : undefined;
  const viceFramePort = embeddedFrameServer
    ? await listenOnLoopback(embeddedFrameServer)
    : undefined;
  t.after(async () => {
    await client.stop();
    embeddedFrameServer?.close();
  });
  return {
    client,
    fixture,
    vice,
    ...(options.viceArgs ? { viceArgs: options.viceArgs } : {}),
    ...(viceFramePort !== undefined ? { viceFramePort } : {})
  };
}

async function initializeAndLaunch(
  session: LaunchedFixtureSession
): Promise<DebugProtocol.Capabilities> {
  const capabilities = await session.client.request<DebugProtocol.Capabilities>(
    'initialize',
    {
      adapterID: 'commodore-vice',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsMemoryEvent: true,
      supportsInvalidatedEvent: true
    } satisfies DebugProtocol.InitializeRequestArguments
  );

  await launchInitializedFixture(session);
  return capabilities;
}

async function launchInitializedFixture(
  session: LaunchedFixtureSession
): Promise<void> {
  const initialized = session.client.waitForEvent('initialized');
  await Promise.all([
    initialized,
    session.client.request(
      'launch',
      {
        program: session.fixture.program,
        ...(session.debugInfo === false
          ? {}
          : { debugInfo: session.debugInfo ?? session.fixture.debugInfo }),
        sourceRoot: session.fixture.directory,
        cwd: session.fixture.directory,
        stopOnEntry: true,
        viceResourcesPath: session.vice.viceResourcesPath,
        viceExecutable: session.vice.viceExecutable,
        viceArgs: session.viceArgs ?? session.vice.viceArgs,
        ...(session.viceFramePort !== undefined
          ? {
              viceLaunchMode: 'embedded',
              viceFramePort: session.viceFramePort
            }
          : {}),
        machineName: 'VICE e2e C64'
      },
      E2E_TIMEOUT_MS
    )
  ]);
}

async function addDebugInfoBreakpoint(
  debugInfoPath: string,
  address: string
): Promise<void> {
  const debugInfo = await readFile(debugInfoPath, 'utf8');
  const updated = debugInfo.replace(
    /(<Breakpoints\b[^>]*>\s*)/u,
    (_match, prefix: string) => `${prefix}\n      Default,${address},`
  );
  if (updated === debugInfo) {
    throw new Error(`Could not add debug-info breakpoint to ${debugInfoPath}.`);
  }
  await writeFile(debugInfoPath, updated, 'utf8');
}

async function listenOnLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Embedded frame server did not bind to a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function configurationDoneAndWaitStopped(
  client: DapClient
): Promise<DebugProtocol.StoppedEvent> {
  const stopped = client.waitForEvent<DebugProtocol.StoppedEvent>('stopped');
  await client.request(
    'configurationDone',
    {} satisfies DebugProtocol.ConfigurationDoneArguments
  );
  return stopped;
}

async function setSourceBreakpoint(
  client: DapClient,
  sourcePath: string,
  line: number,
  options: Pick<DebugProtocol.SourceBreakpoint, 'condition' | 'hitCondition' | 'logMessage'> = {}
): Promise<DebugProtocol.Breakpoint> {
  const response = await sendSetBreakpoints(client, sourcePath, [
    {
      line,
      ...options
    }
  ]);
  const breakpoint = response.breakpoints[0];
  assert.ok(breakpoint, 'expected one source breakpoint response');
  assert.equal(breakpoint.verified, true, breakpoint.message);
  return breakpoint;
}

async function sendSetBreakpoints(
  client: DapClient,
  sourcePath: string,
  breakpoints: DebugProtocol.SourceBreakpoint[]
): Promise<DebugProtocol.SetBreakpointsResponse['body']> {
  return client.request<DebugProtocol.SetBreakpointsResponse['body']>(
    'setBreakpoints',
    {
      source: {
        name: path.basename(sourcePath),
        path: sourcePath
      },
      breakpoints,
      lines: breakpoints.map((breakpoint) => breakpoint.line),
      sourceModified: false
    } satisfies DebugProtocol.SetBreakpointsArguments
  );
}

async function syncSourceBreakpointStates(
  client: DapClient,
  sourcePath: string,
  breakpoints: Array<DebugProtocol.SourceBreakpoint & {
    enabled: boolean;
    markerId: string;
  }>
): Promise<DebugProtocol.SetBreakpointsResponse['body']> {
  return client.request<DebugProtocol.SetBreakpointsResponse['body']>(
    'commodore-vice/syncSourceBreakpoints',
    {
      source: {
        name: path.basename(sourcePath),
        path: sourcePath
      },
      breakpoints,
      sourceModified: false
    }
  );
}

function programmedSourceBreakpoint(
  breakpoint: ProgrammedBreakpointDescriptor
): DebugProtocol.SourceBreakpoint {
  return {
    line: breakpoint.line!,
    [PROGRAMMED_BREAKPOINT_RAW_ID]: breakpoint.id,
    [PROGRAMMED_BREAKPOINT_RAW_ADDRESS]: breakpoint.address
  } as DebugProtocol.SourceBreakpoint;
}

async function continueAndWaitStopped(
  client: DapClient
): Promise<DebugProtocol.StoppedEvent> {
  const stopped = client.waitForEvent<DebugProtocol.StoppedEvent>(
    'stopped',
    undefined,
    E2E_TIMEOUT_MS
  );
  await client.request<DebugProtocol.ContinueResponse['body']>(
    'continue',
    { threadId: THREAD_ID } satisfies DebugProtocol.ContinueArguments
  );
  return stopped;
}

async function continueUntilTopFrame(
  client: DapClient,
  sourcePath: string,
  line: number
): Promise<{
  stopped: DebugProtocol.StoppedEvent;
  topFrame: DebugProtocol.StackFrame;
}> {
  // VICE's `-initbreak ready` can surface an additional monitor stop while the
  // autostart machinery is still in KERNAL code. Treat that as synchronization
  // noise and continue until the adapter reports the expected source frame.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stopped = await continueAndWaitStopped(client);
    const topFrame = await topStackFrame(client);
    if (topFrame.source?.path === sourcePath && topFrame.line === line) {
      return { stopped, topFrame };
    }
  }
  throw new Error(`Did not stop at ${sourcePath}:${line}.`);
}

async function waitUntilTopFrame(
  client: DapClient,
  sourcePath: string,
  line: number,
  predicate: (stopped: DebugProtocol.StoppedEvent) => boolean = () => true
): Promise<{
  stopped: DebugProtocol.StoppedEvent;
  topFrame: DebugProtocol.StackFrame;
}> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const stopped = await client.waitForEvent<DebugProtocol.StoppedEvent>(
      'stopped',
      undefined,
      E2E_TIMEOUT_MS
    );
    const topFrame = await topStackFrame(client);
    if (
      topFrame.source?.path === sourcePath &&
      topFrame.line === line &&
      predicate(stopped)
    ) {
      return { stopped, topFrame };
    }
    await client.request<DebugProtocol.ContinueResponse['body']>(
      'continue',
      { threadId: THREAD_ID } satisfies DebugProtocol.ContinueArguments
    );
  }
  throw new Error(`Did not stop at ${sourcePath}:${line}.`);
}

async function continueUntilOutput(
  client: DapClient,
  predicate: (event: DebugProtocol.OutputEvent) => boolean
): Promise<DebugProtocol.OutputEvent> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const event = client.waitForAnyEvent<DebugProtocol.Event>(
      [
        {
          event: 'output',
          predicate: (candidate) =>
            predicate(candidate as DebugProtocol.OutputEvent)
        },
        {
          event: 'stopped'
        }
      ],
      E2E_TIMEOUT_MS
    );
    await client.request<DebugProtocol.ContinueResponse['body']>(
      'continue',
      { threadId: THREAD_ID } satisfies DebugProtocol.ContinueArguments
    );
    const result = await event;
    if (result.event === 'output') {
      return result as DebugProtocol.OutputEvent;
    }
  }
  throw new Error('Did not observe expected logpoint output.');
}

async function stepAndWaitStopped(
  client: DapClient,
  command: 'next' | 'stepIn' | 'stepOut'
): Promise<DebugProtocol.StoppedEvent> {
  const stopped = client.waitForEvent<DebugProtocol.StoppedEvent>(
    'stopped',
    undefined,
    E2E_TIMEOUT_MS
  );
  await client.request(command, {
    threadId: THREAD_ID
  } satisfies DebugProtocol.NextArguments);
  return stopped;
}

async function topStackFrame(
  client: DapClient
): Promise<DebugProtocol.StackFrame> {
  const stack = await client.request<DebugProtocol.StackTraceResponse['body']>(
    'stackTrace',
    {
      threadId: THREAD_ID,
      startFrame: 0,
      levels: 1
    } satisfies DebugProtocol.StackTraceArguments
  );
  const frame = stack.stackFrames[0];
  assert.ok(frame, 'expected a top stack frame');
  return frame;
}

function sanitizeArtifactName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 120);
}

function createMisleadingDebugInfo(sourcePath: string): string {
  const rows: string[] = [];
  for (let address = 0x0800, line = 1; address <= 0x1025; address += 1, line += 1) {
    rows.push(
      `         ${formatDebugAddress(address)},${formatDebugAddress(address)},1,${line},1,${line},3`
    );
  }
  return `<C64debugger version="1.0">
   <Sources values="INDEX,FILE">
      1,${sourcePath}
   </Sources>

   <Segment name="Default" dest="" values="START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
      <Block name="Misleading">
${rows.join('\n')}
      </Block>
   </Segment>

   <Labels values="SEGMENT,ADDRESS,NAME,START,END,FILE_IDX,LINE1,COL1,LINE2,COL2">
   </Labels>

   <Breakpoints values="SEGMENT,ADDRESS,ARGUMENT">
   </Breakpoints>

   <Watchpoints values="SEGMENT,ADDRESS1,ADDRESS2,ARGUMENT">
   </Watchpoints>

</C64debugger>
`;
}

function formatDebugAddress(address: number): string {
  return `$${address.toString(16).padStart(4, '0')}`;
}
