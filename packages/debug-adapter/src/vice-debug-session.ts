import path from 'node:path';
import type { ChildProcess } from 'node:child_process';

import type { DebugProtocol } from '@vscode/debugprotocol';

import { DapConnection, type DapRequest } from './dap-connection';
import { disassemble6502 } from './disassemble6502';
import {
  findLabelByName,
  findLineMappingForAddress,
  findLineMappingForSourceLine,
  findLineMappingsForSourceRange,
  findSourceForMapping,
  loadKickAssemblerDebugInfo,
  type KickAssemblerDebugInfo,
  type KickAssemblerLineMapping
} from './kick-assembler-debug-info';
import {
  monitorErrorMessage,
  ViceMonitorConnection,
  ViceMonitorRequests,
  type ViceMonitorCheckpoint,
  type ViceMonitorEvent,
  type ViceMonitorMemoryOptions,
  type ViceMonitorRegisterDescriptor,
  type ViceMonitorRegisterValue
} from './vice-monitor';
import { launchViceProcess } from './vice-runtime';

const THREAD_ID = 1;
const STACK_FRAME_ID = 1;
const REGISTERS_REFERENCE = 1;
const LABELS_REFERENCE = 2;
const DEFAULT_MEMORY_READ_TIMEOUT_MS = 5000;

export interface ViceDebugLaunchArguments
  extends DebugProtocol.LaunchRequestArguments {
  program: string;
  debugInfo?: string;
  sourceRoot?: string;
  cwd?: string;
  viceResourcesPath: string;
  viceExecutable: string;
  viceArgs?: readonly string[];
  machineName?: string;
  stopOnEntry?: boolean;
}

interface InstalledBreakpoint {
  id: number;
  sourcePath: string;
  line: number;
  mapping?: KickAssemblerLineMapping;
  checkpointNumber?: number;
  verified: boolean;
  message?: string;
}

interface InstalledDataBreakpoint {
  id: number;
  dataId: string;
  startAddress: number;
  length: number;
  accessType: DebugProtocol.DataBreakpointAccessType;
  checkpointNumber?: number;
  verified: boolean;
  message?: string;
}

type StopReason = 'entry' | 'step' | 'pause' | 'breakpoint' | 'data breakpoint';

export class ViceDebugSession {
  private monitor: ViceMonitorConnection | undefined;
  private child: ChildProcess | undefined;
  private debugInfo: KickAssemblerDebugInfo | undefined;
  private launchArguments: ViceDebugLaunchArguments | undefined;
  private registerDescriptors = new Map<number, ViceMonitorRegisterDescriptor>();
  private registers = new Map<number, ViceMonitorRegisterValue>();
  private breakpointsBySource = new Map<string, InstalledBreakpoint[]>();
  private checkpointToBreakpoint = new Map<number, InstalledBreakpoint>();
  private dataBreakpoints: InstalledDataBreakpoint[] = [];
  private checkpointToDataBreakpoint = new Map<number, InstalledDataBreakpoint>();
  private nextBreakpointId = 1;
  private initialStopSeen = false;
  private configurationDone = false;
  private stopped = false;
  private pendingStopReason: StopReason = 'entry';
  private lastHitCheckpoint: ViceMonitorCheckpoint | undefined;
  private terminated = false;
  private clientSupportsMemoryEvent = false;
  private clientSupportsInvalidatedEvent = false;

  constructor(private readonly connection: DapConnection) {}

  async handleRequest(request: DapRequest): Promise<void> {
    try {
      switch (request.command) {
        case 'initialize':
          this.initialize(request);
          break;
        case 'launch':
          await this.launch(request);
          break;
        case 'configurationDone':
          await this.configurationDoneRequest(request);
          break;
        case 'setBreakpoints':
          await this.setBreakpoints(request);
          break;
        case 'dataBreakpointInfo':
          await this.dataBreakpointInfo(request);
          break;
        case 'setDataBreakpoints':
          await this.setDataBreakpoints(request);
          break;
        case 'breakpointLocations':
          this.breakpointLocations(request);
          break;
        case 'threads':
          this.threads(request);
          break;
        case 'stackTrace':
          await this.stackTrace(request);
          break;
        case 'scopes':
          this.scopes(request);
          break;
        case 'variables':
          this.variables(request);
          break;
        case 'setVariable':
          await this.setVariable(request);
          break;
        case 'continue':
          this.continue(request);
          break;
        case 'next':
          this.step(request, true);
          break;
        case 'stepIn':
          this.step(request, false);
          break;
        case 'stepOut':
          this.stepOut(request);
          break;
        case 'pause':
          this.pause(request);
          break;
        case 'evaluate':
          await this.evaluate(request);
          break;
        case 'readMemory':
          await this.readMemory(request);
          break;
        case 'writeMemory':
          await this.writeMemory(request);
          break;
        case 'disassemble':
          await this.disassemble(request);
          break;
        case 'loadedSources':
          this.loadedSources(request);
          break;
        case 'disconnect':
        case 'terminate':
          await this.terminate(request);
          break;
        default:
          this.connection.sendResponse(request);
          break;
      }
    } catch (error) {
      this.connection.sendErrorResponse(request, error);
    }
  }

  private initialize(request: DapRequest): void {
    const args = request.arguments as DebugProtocol.InitializeRequestArguments | undefined;
    this.clientSupportsMemoryEvent = args?.supportsMemoryEvent === true;
    this.clientSupportsInvalidatedEvent = args?.supportsInvalidatedEvent === true;
    this.connection.sendResponse(request, {
      supportsConfigurationDoneRequest: true,
      supportsEvaluateForHovers: true,
      supportsLoadedSourcesRequest: true,
      supportsReadMemoryRequest: true,
      supportsWriteMemoryRequest: true,
      supportsDisassembleRequest: true,
      supportsBreakpointLocationsRequest: true,
      supportsSetVariable: true,
      supportsDataBreakpoints: true,
      supportsDataBreakpointBytes: true,
      supportsSteppingGranularity: true,
      supportsTerminateRequest: true,
      supportTerminateDebuggee: true
    } satisfies DebugProtocol.Capabilities);
  }

  private async launch(request: DapRequest): Promise<void> {
    const args = request.arguments as ViceDebugLaunchArguments;
    this.launchArguments = args;
    if (!args.program) {
      throw new Error('VICE debug launch requires a program path.');
    }
    if (!args.viceResourcesPath) {
      throw new Error('VICE debug launch requires viceResourcesPath.');
    }
    if (!args.viceExecutable) {
      throw new Error('VICE debug launch requires viceExecutable.');
    }

    const useMonitor = !args.noDebug;
    const program = path.resolve(args.program);
    const cwd = path.resolve(args.cwd ?? path.dirname(program));
    const debugInfoPath = args.debugInfo ? path.resolve(args.debugInfo) : undefined;
    const sourceRoot = args.sourceRoot
      ? path.resolve(args.sourceRoot)
      : undefined;

    if (useMonitor && debugInfoPath) {
      try {
        this.debugInfo = await loadKickAssemblerDebugInfo(debugInfoPath, {
          sourceRoots: [
            ...(sourceRoot ? [sourceRoot] : []),
            cwd,
            path.dirname(program)
          ]
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.connection.sendOutput(
          `Could not read Kick Assembler debug info ${debugInfoPath}: ${message}\n`
        );
      }
    }

    const launch = await launchViceProcess({
      program,
      cwd,
      viceResourcesPath: path.resolve(args.viceResourcesPath),
      viceExecutable: args.viceExecutable,
      viceArgs: args.viceArgs ?? [],
      enableMonitor: useMonitor
    });
    this.child = launch.child;
    this.child.stdout?.on('data', (chunk) => this.connection.sendOutput(chunk.toString(), 'stdout'));
    this.child.stderr?.on('data', (chunk) => this.connection.sendOutput(chunk.toString(), 'stderr'));
    this.child.once('close', () => this.endSession());

    this.connection.sendOutput(
      `Started ${args.machineName ?? args.viceExecutable} through ${launch.command} ${launch.args.join(' ')}\n`
    );
    if (!useMonitor) {
      this.connection.sendEvent('initialized');
      this.connection.sendResponse(request);
      return;
    }
    if (!launch.monitorHost || launch.monitorPort === undefined) {
      throw new Error('VICE binary monitor was not configured for debug launch.');
    }
    this.monitor = await ViceMonitorConnection.connect(
      launch.monitorHost,
      launch.monitorPort
    );
    this.monitor.onEvent((event) => {
      void this.handleMonitorEvent(event);
    });

    this.connection.sendEvent('initialized');
    this.connection.sendResponse(request);
  }

  private async configurationDoneRequest(request: DapRequest): Promise<void> {
    this.configurationDone = true;
    this.connection.sendResponse(request);
    if (this.launchArguments?.noDebug) {
      this.resumeMonitor();
      return;
    }
    if (this.initialStopSeen) {
      await this.refreshStoppedState();
      if (this.launchArguments?.stopOnEntry === false) {
        this.resumeMonitor();
      } else {
        this.emitStopped('entry');
      }
    }
  }

  private async setBreakpoints(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.SetBreakpointsArguments;
    const sourcePath = args.source.path;
    if (!sourcePath) {
      this.connection.sendResponse(request, { breakpoints: [] });
      return;
    }

    await this.clearBreakpointsForSource(sourcePath);
    const installed: InstalledBreakpoint[] = [];
    for (const sourceBreakpoint of args.breakpoints ?? []) {
      const breakpoint = await this.installSourceBreakpoint(
        sourcePath,
        sourceBreakpoint
      );
      installed.push(breakpoint);
    }
    this.breakpointsBySource.set(normalizeSourceKey(sourcePath), installed);
    this.connection.sendResponse(request, {
      breakpoints: installed.map((breakpoint) => this.toDapBreakpoint(breakpoint))
    } satisfies DebugProtocol.SetBreakpointsResponse['body']);
  }

  private breakpointLocations(request: DapRequest): void {
    const args = request.arguments as DebugProtocol.BreakpointLocationsArguments;
    const sourcePath = args.source.path;
    const startLine = args.line;
    const endLine = args.endLine ?? startLine;
    const locations = findLineMappingsForSourceRange(
      this.debugInfo,
      sourcePath,
      startLine,
      endLine
    ).map((mapping): DebugProtocol.BreakpointLocation => ({
      line: mapping.startLine,
      column: Math.max(1, mapping.startColumn),
      endLine: mapping.endLine,
      endColumn: Math.max(1, mapping.endColumn)
    }));

    this.connection.sendResponse(request, {
      breakpoints: distinctBreakpointLocations(locations)
    } satisfies DebugProtocol.BreakpointLocationsResponse['body']);
  }

  private async dataBreakpointInfo(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.DataBreakpointInfoArguments;
    const requestedByteCount = Math.max(1, Math.min(args.bytes ?? 1, 0x10000));
    const resolved = await this.resolveDataBreakpointAddress(args);
    if (!resolved) {
      this.connection.sendResponse(request, {
        dataId: null,
        description: `No C64 memory address found for ${args.name}.`
      } satisfies DebugProtocol.DataBreakpointInfoResponse['body']);
      return;
    }
    const byteCount = Math.min(requestedByteCount, 0x10000 - resolved.address);
    if (byteCount <= 0) {
      this.connection.sendResponse(request, {
        dataId: null,
        description: `No readable C64 memory range starts at $${hexWord(resolved.address)}.`
      } satisfies DebugProtocol.DataBreakpointInfoResponse['body']);
      return;
    }

    this.connection.sendResponse(request, {
      dataId: encodeDataBreakpointId(resolved.address, byteCount),
      description: `${resolved.description} (${byteCount} byte${byteCount === 1 ? '' : 's'})`,
      accessTypes: ['read', 'write', 'readWrite'],
      canPersist: true
    } satisfies DebugProtocol.DataBreakpointInfoResponse['body']);
  }

  private async setDataBreakpoints(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.SetDataBreakpointsArguments;
    await this.clearDataBreakpoints();
    const installed: InstalledDataBreakpoint[] = [];
    for (const dataBreakpoint of args.breakpoints) {
      const breakpoint = await this.installDataBreakpoint(dataBreakpoint);
      installed.push(breakpoint);
    }
    this.dataBreakpoints = installed;
    this.connection.sendResponse(request, {
      breakpoints: installed.map((breakpoint) => ({
        id: breakpoint.id,
        verified: breakpoint.verified,
        ...(breakpoint.message ? { message: breakpoint.message } : {})
      }))
    } satisfies DebugProtocol.SetDataBreakpointsResponse['body']);
  }

  private threads(request: DapRequest): void {
    this.connection.sendResponse(request, {
      threads: [
        {
          id: THREAD_ID,
          name: 'VICE emulator'
        }
      ]
    } satisfies DebugProtocol.ThreadsResponse['body']);
  }

  private async stackTrace(request: DapRequest): Promise<void> {
    await this.refreshRegisterDescriptors();
    await this.refreshRegisters();
    const pc = this.programCounter();
    const mapping = findLineMappingForAddress(this.debugInfo, pc);
    const source = findSourceForMapping(this.debugInfo, mapping);
    const sourceObject = source ? sourceForPath(source.path) : undefined;
    const frame: DebugProtocol.StackFrame = {
      id: STACK_FRAME_ID,
      name: source && mapping
        ? `${path.basename(source.path)}:${mapping.startLine} $${hexWord(pc)}`
        : `PC $${hexWord(pc)}`,
      ...(sourceObject ? { source: sourceObject } : {}),
      line: mapping?.startLine ?? 0,
      column: mapping?.startColumn ?? 0,
      ...(mapping ? { endLine: mapping.endLine, endColumn: mapping.endColumn } : {}),
      instructionPointerReference: memoryReference(pc)
    };
    this.connection.sendResponse(request, {
      stackFrames: [frame],
      totalFrames: 1
    } satisfies DebugProtocol.StackTraceResponse['body']);
  }

  private scopes(request: DapRequest): void {
    this.connection.sendResponse(request, {
      scopes: [
        {
          name: '6510 Registers',
          presentationHint: 'registers',
          variablesReference: REGISTERS_REFERENCE,
          namedVariables: this.registerDescriptors.size,
          expensive: false
        },
        {
          name: 'Kick Assembler Labels',
          variablesReference: LABELS_REFERENCE,
          namedVariables: this.debugInfo?.labels.length ?? 0,
          expensive: false
        }
      ]
    } satisfies DebugProtocol.ScopesResponse['body']);
  }

  private variables(request: DapRequest): void {
    const args = request.arguments as DebugProtocol.VariablesArguments;
    if (args.variablesReference === REGISTERS_REFERENCE) {
      this.connection.sendResponse(request, {
        variables: [...this.registerDescriptors.values()].map((descriptor) => {
          const value = this.registers.get(descriptor.id);
          return {
            name: descriptor.name,
            value: value ? `$${hex(value.value, Math.max(2, descriptor.bitSize / 4))}` : 'unavailable',
            type: `${descriptor.bitSize}-bit register`,
            evaluateName: descriptor.name,
            variablesReference: 0
          };
        })
      } satisfies DebugProtocol.VariablesResponse['body']);
      return;
    }

    if (args.variablesReference === LABELS_REFERENCE) {
      this.connection.sendResponse(request, {
        variables: (this.debugInfo?.labels ?? []).map((label) => ({
          name: label.name,
          value: `$${hexWord(label.address)}`,
          type: 'address',
          evaluateName: label.name,
          memoryReference: memoryReference(label.address),
          variablesReference: 0
        }))
      } satisfies DebugProtocol.VariablesResponse['body']);
      return;
    }

    this.connection.sendResponse(request, { variables: [] });
  }

  private async setVariable(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.SetVariableArguments;
    if (args.variablesReference !== REGISTERS_REFERENCE) {
      throw new Error('Only CPU register variables can be edited.');
    }
    await this.refreshRegisterDescriptors();
    const descriptor = this.findRegisterDescriptor(args.name);
    if (!descriptor) {
      throw new Error(`Unknown register: ${args.name}`);
    }
    const value = parseRequiredNumber(args.value);
    await this.writeRegister(descriptor, value);
    this.connection.sendResponse(request, {
      value: `$${hex(value, Math.max(2, descriptor.bitSize / 4))}`,
      type: `${descriptor.bitSize}-bit register`,
      variablesReference: 0
    } satisfies DebugProtocol.SetVariableResponse['body']);
  }

  private continue(request: DapRequest): void {
    this.pendingStopReason = 'breakpoint';
    this.lastHitCheckpoint = undefined;
    this.resumeMonitor();
    this.connection.sendResponse(request, {
      allThreadsContinued: true
    } satisfies DebugProtocol.ContinueResponse['body']);
  }

  private step(request: DapRequest, stepOverSubroutines: boolean): void {
    this.pendingStopReason = 'step';
    this.lastHitCheckpoint = undefined;
    const [command, body] = ViceMonitorRequests.advanceInstructions(1, stepOverSubroutines);
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private stepOut(request: DapRequest): void {
    this.pendingStopReason = 'step';
    this.lastHitCheckpoint = undefined;
    const [command, body] = ViceMonitorRequests.executeUntilReturn();
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private pause(request: DapRequest): void {
    this.pendingStopReason = 'pause';
    this.lastHitCheckpoint = undefined;
    const [command, body] = ViceMonitorRequests.suspend();
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private async evaluate(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.EvaluateArguments;
    const result = await this.evaluateExpression(args.expression);
    this.connection.sendResponse(request, {
      result: result.value,
      type: result.type,
      variablesReference: 0,
      ...(result.memoryReference ? { memoryReference: result.memoryReference } : {})
    } satisfies DebugProtocol.EvaluateResponse['body']);
  }

  private async readMemory(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.ReadMemoryArguments & ViceMonitorMemoryOptions;
    const startAddress = parseMemoryReference(args.memoryReference) + (args.offset ?? 0);
    const count = Math.max(0, Math.min(args.count, 0x10000));
    const bytes = await this.readMemoryBytes(startAddress, count, {
      sideEffects: args.sideEffects,
      memspace: args.memspace,
      bankId: args.bankId
    });
    this.connection.sendResponse(request, {
      address: memoryReference(startAddress),
      data: bytes.toString('base64'),
      unreadableBytes: 0
    } satisfies DebugProtocol.ReadMemoryResponse['body']);
  }

  private async writeMemory(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.WriteMemoryArguments & ViceMonitorMemoryOptions;
    const startAddress = parseMemoryReference(args.memoryReference) + (args.offset ?? 0);
    const bytes = Buffer.from(args.data, 'base64');
    await this.writeMemoryBytes(startAddress, bytes, {
      sideEffects: args.sideEffects,
      memspace: args.memspace,
      bankId: args.bankId
    });
    this.connection.sendResponse(request, {
      offset: args.offset ?? 0,
      bytesWritten: bytes.length
    } satisfies DebugProtocol.WriteMemoryResponse['body']);
  }

  private async disassemble(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.DisassembleArguments;
    const instructionStart = parseMemoryReference(args.memoryReference) +
      (args.offset ?? 0) +
      (args.instructionOffset ?? 0);
    const byteCount = Math.max(1, args.instructionCount * 3);
    const bytes = await this.readMemoryBytes(instructionStart, byteCount);
    const labels = new Map(
      (this.debugInfo?.labels ?? []).map((label) => [label.address, label.name])
    );
    const instructions = disassemble6502(
      bytes,
      instructionStart,
      args.instructionCount,
      labels
    ).map((instruction) => {
      const mapping = findLineMappingForAddress(this.debugInfo, instruction.address);
      const source = findSourceForMapping(this.debugInfo, mapping);
      return {
        address: memoryReference(instruction.address),
        instructionBytes: instruction.instructionBytes,
        instruction: instruction.instruction,
        ...(instruction.symbol ? { symbol: instruction.symbol } : {}),
        ...(source ? { location: sourceForPath(source.path) } : {}),
        ...(mapping ? {
          line: mapping.startLine,
          column: mapping.startColumn,
          endLine: mapping.endLine,
          endColumn: mapping.endColumn
        } : {})
      };
    });
    this.connection.sendResponse(request, {
      instructions
    } satisfies DebugProtocol.DisassembleResponse['body']);
  }

  private loadedSources(request: DapRequest): void {
    this.connection.sendResponse(request, {
      sources: (this.debugInfo?.sources ?? [])
        .filter((source) => !/^[A-Za-z0-9+.-]+:/u.test(source.path))
        .map((source) => sourceForPath(source.path))
    } satisfies DebugProtocol.LoadedSourcesResponse['body']);
  }

  private async terminate(request: DapRequest): Promise<void> {
    const monitor = this.monitor;
    if (monitor) {
      try {
        const [command, body] = ViceMonitorRequests.quit();
        monitor.send(command, body);
      } catch {
        // The process close handler will finish cleanup.
      }
    }
    this.child?.kill();
    this.endSession();
    this.connection.sendResponse(request);
  }

  private async installSourceBreakpoint(
    sourcePath: string,
    breakpointSpec: DebugProtocol.SourceBreakpoint
  ): Promise<InstalledBreakpoint> {
    const line = breakpointSpec.line;
    const mapping = findLineMappingForSourceLine(this.debugInfo, sourcePath, line);
    const unsupportedMessage = unsupportedBreakpointMessage(breakpointSpec);
    const breakpoint: InstalledBreakpoint = {
      id: this.nextBreakpointId,
      sourcePath,
      line,
      ...(mapping ? { mapping } : {}),
      verified: Boolean(mapping) && !unsupportedMessage,
      ...(unsupportedMessage
        ? { message: unsupportedMessage }
        : mapping
          ? {}
          : { message: 'No Kick Assembler debug mapping for this line.' })
    };
    this.nextBreakpointId += 1;

    if (mapping && this.monitor && !unsupportedMessage) {
      try {
        const [command, body] = ViceMonitorRequests.setCheckpoint({
          startAddress: mapping.startAddress,
          endAddress: mapping.endAddress,
          exec: true,
          enabled: true,
          stopWhenHit: true
        });
        const response = await this.monitor.sendAndWait(
          command,
          body,
          (event) => event.type === 'checkpoint',
          3000
        );
        if (response.type === 'checkpoint') {
          breakpoint.checkpointNumber = response.checkpoint.number;
          this.checkpointToBreakpoint.set(response.checkpoint.number, breakpoint);
        }
      } catch (error) {
        breakpoint.verified = false;
        breakpoint.message = error instanceof Error ? error.message : String(error);
      }
    }

    return breakpoint;
  }

  private async installDataBreakpoint(
    dataBreakpoint: DebugProtocol.DataBreakpoint
  ): Promise<InstalledDataBreakpoint> {
    const range = decodeDataBreakpointId(dataBreakpoint.dataId);
    const accessType = dataBreakpoint.accessType ?? 'write';
    const breakpoint: InstalledDataBreakpoint = {
      id: this.nextBreakpointId,
      dataId: dataBreakpoint.dataId,
      startAddress: range.startAddress,
      length: range.length,
      accessType,
      verified: !dataBreakpoint.condition && !dataBreakpoint.hitCondition
    };
    this.nextBreakpointId += 1;

    if (dataBreakpoint.condition) {
      breakpoint.message = 'Conditional data breakpoints are not supported yet.';
      return breakpoint;
    }
    if (dataBreakpoint.hitCondition) {
      breakpoint.message = 'Hit-count data breakpoints are not supported yet.';
      return breakpoint;
    }
    if (!this.monitor) {
      breakpoint.verified = false;
      breakpoint.message = 'VICE monitor is not connected.';
      return breakpoint;
    }

    try {
      const [command, body] = ViceMonitorRequests.setCheckpoint({
        startAddress: range.startAddress,
        endAddress: range.startAddress + range.length - 1,
        load: accessType === 'read' || accessType === 'readWrite',
        store: accessType === 'write' || accessType === 'readWrite',
        exec: false,
        enabled: true,
        stopWhenHit: true
      });
      const response = await this.monitor.sendAndWait(
        command,
        body,
        (event) => event.type === 'checkpoint',
        3000
      );
      if (response.type === 'checkpoint') {
        breakpoint.checkpointNumber = response.checkpoint.number;
        this.checkpointToDataBreakpoint.set(response.checkpoint.number, breakpoint);
      }
    } catch (error) {
      breakpoint.verified = false;
      breakpoint.message = error instanceof Error ? error.message : String(error);
    }

    return breakpoint;
  }

  private async resolveDataBreakpointAddress(
    args: DebugProtocol.DataBreakpointInfoArguments
  ): Promise<{ address: number; description: string } | undefined> {
    if (args.variablesReference === LABELS_REFERENCE) {
      const label = findLabelByName(this.debugInfo, args.name);
      return label
        ? { address: label.address, description: `${label.name} at $${hexWord(label.address)}` }
        : undefined;
    }
    if (args.variablesReference === REGISTERS_REFERENCE) {
      await this.refreshRegisterDescriptors();
      await this.refreshRegisters();
      const descriptor = this.findRegisterDescriptor(args.name);
      const value = descriptor ? this.registers.get(descriptor.id)?.value : undefined;
      return value === undefined
        ? undefined
        : { address: value, description: `${args.name} register target $${hexWord(value)}` };
    }

    const evaluated = await this.evaluateAddressExpression(args.name);
    return evaluated === undefined
      ? undefined
      : { address: evaluated.address, description: evaluated.description };
  }

  private async clearBreakpointsForSource(sourcePath: string): Promise<void> {
    const key = normalizeSourceKey(sourcePath);
    const existing = this.breakpointsBySource.get(key) ?? [];
    this.breakpointsBySource.delete(key);
    for (const breakpoint of existing) {
      if (!breakpoint.checkpointNumber || !this.monitor) {
        continue;
      }
      const [command, body] = ViceMonitorRequests.deleteCheckpoint(
        breakpoint.checkpointNumber
      );
      this.monitor.send(command, body);
      this.checkpointToBreakpoint.delete(breakpoint.checkpointNumber);
    }
  }

  private async clearDataBreakpoints(): Promise<void> {
    const existing = this.dataBreakpoints;
    this.dataBreakpoints = [];
    for (const breakpoint of existing) {
      if (!breakpoint.checkpointNumber || !this.monitor) {
        continue;
      }
      const [command, body] = ViceMonitorRequests.deleteCheckpoint(
        breakpoint.checkpointNumber
      );
      this.monitor.send(command, body);
      this.checkpointToDataBreakpoint.delete(breakpoint.checkpointNumber);
    }
  }

  private toDapBreakpoint(
    breakpoint: InstalledBreakpoint
  ): DebugProtocol.Breakpoint {
    return {
      id: breakpoint.id,
      verified: breakpoint.verified,
      line: breakpoint.mapping?.startLine ?? breakpoint.line,
      column: breakpoint.mapping?.startColumn,
      endLine: breakpoint.mapping?.endLine,
      endColumn: breakpoint.mapping?.endColumn,
      source: sourceForPath(breakpoint.sourcePath),
      ...(breakpoint.message ? { message: breakpoint.message } : {})
    };
  }

  private async handleMonitorEvent(event: ViceMonitorEvent): Promise<void> {
    switch (event.type) {
      case 'stopped':
        const firstStop = !this.initialStopSeen;
        this.initialStopSeen = true;
        this.stopped = true;
        if (this.configurationDone) {
          await this.refreshStoppedState();
          if (firstStop && this.launchArguments?.stopOnEntry === false) {
            this.resumeMonitor();
          } else {
            this.emitStopped(this.stopReason());
          }
        }
        break;
      case 'resumed':
        this.stopped = false;
        this.connection.sendEvent('continued', {
          threadId: THREAD_ID,
          allThreadsContinued: true
        } satisfies DebugProtocol.ContinuedEvent['body']);
        break;
      case 'checkpoint':
        if (event.checkpoint.hit) {
          this.lastHitCheckpoint = event.checkpoint;
        }
        if (event.checkpoint.number) {
          const dataBreakpoint = this.dataBreakpoints.find((candidate) =>
            candidate.startAddress === event.checkpoint.startAddress &&
            candidate.length === event.checkpoint.endAddress - event.checkpoint.startAddress + 1
          );
          if (dataBreakpoint) {
            dataBreakpoint.checkpointNumber = event.checkpoint.number;
            this.checkpointToDataBreakpoint.set(event.checkpoint.number, dataBreakpoint);
          }
          const breakpoint = [...this.breakpointsBySource.values()]
            .flat()
            .find((candidate) =>
              candidate.mapping?.startAddress === event.checkpoint.startAddress
            );
          if (breakpoint) {
            breakpoint.checkpointNumber = event.checkpoint.number;
            this.checkpointToBreakpoint.set(event.checkpoint.number, breakpoint);
          }
        }
        break;
      case 'register-descriptors':
        this.registerDescriptors = new Map(
          event.registers.map((register) => [register.id, register])
        );
        break;
      case 'register-values':
        for (const register of event.registers) {
          this.registers.set(register.id, register);
        }
        break;
      case 'terminated':
        this.endSession();
        break;
      case 'error':
        this.connection.sendOutput(
          `${monitorErrorMessage(event)}\n`,
          'stderr'
        );
        break;
    }
  }

  private async refreshStoppedState(): Promise<void> {
    await this.refreshRegisterDescriptors();
    await this.refreshRegisters();
  }

  private async refreshRegisterDescriptors(): Promise<void> {
    if (this.registerDescriptors.size > 0 || !this.monitor) {
      return;
    }
    const [command, body] = ViceMonitorRequests.registersAvailable();
    await this.monitor.sendAndWait(
      command,
      body,
      (event) => event.type === 'register-descriptors',
      3000
    );
  }

  private async refreshRegisters(): Promise<void> {
    if (!this.monitor) {
      return;
    }
    const [command, body] = ViceMonitorRequests.registersGet();
    try {
      await this.monitor.sendAndWait(
        command,
        body,
        (event) => event.type === 'register-values',
        3000
      );
    } catch {
      // VICE also emits register values around stop events. Keep the last known cache.
    }
  }

  private resumeMonitor(): void {
    const [command, body] = ViceMonitorRequests.resume();
    this.monitor?.send(command, body);
  }

  private emitStopped(reason: StopReason): void {
    this.connection.sendEvent('stopped', {
      reason,
      threadId: THREAD_ID,
      allThreadsStopped: true,
      ...(this.breakpointIdsForLastStop().length > 0
        ? { hitBreakpointIds: this.breakpointIdsForLastStop() }
        : {})
    } satisfies DebugProtocol.StoppedEvent['body']);
  }

  private stopReason(): StopReason {
    if (this.lastHitCheckpoint) {
      if (this.checkpointToDataBreakpoint.has(this.lastHitCheckpoint.number)) {
        return 'data breakpoint';
      }
      return 'breakpoint';
    }
    return this.pendingStopReason;
  }

  private breakpointIdsForLastStop(): number[] {
    const checkpointNumber = this.lastHitCheckpoint?.number;
    if (!checkpointNumber) {
      return [];
    }
    const sourceBreakpoint = this.checkpointToBreakpoint.get(checkpointNumber);
    const dataBreakpoint = this.checkpointToDataBreakpoint.get(checkpointNumber);
    return [sourceBreakpoint?.id, dataBreakpoint?.id]
      .filter((id): id is number => id !== undefined);
  }

  private programCounter(): number {
    for (const descriptor of this.registerDescriptors.values()) {
      if (descriptor.name.toUpperCase() === 'PC') {
        return this.registers.get(descriptor.id)?.value ?? 0;
      }
    }
    return 0;
  }

  private async evaluateExpression(expression: string): Promise<{
    value: string;
    type?: string;
    memoryReference?: string;
  }> {
    await this.refreshRegisters();
    const trimmed = expression.trim();
    for (const descriptor of this.registerDescriptors.values()) {
      if (descriptor.name.toLowerCase() === trimmed.toLowerCase()) {
        const value = this.registers.get(descriptor.id)?.value ?? 0;
        return {
          value: `$${hex(value, Math.max(2, descriptor.bitSize / 4))}`,
          type: `${descriptor.bitSize}-bit register`
        };
      }
    }

    const label = findLabelByName(this.debugInfo, trimmed);
    if (label) {
      return {
        value: `$${hexWord(label.address)}`,
        type: 'address',
        memoryReference: memoryReference(label.address)
      };
    }

    const address = parseOptionalAddress(trimmed);
    if (address !== undefined) {
      const bytes = await this.readMemoryBytes(address, 1);
      return {
        value: `$${hexByte(bytes[0] ?? 0)}`,
        type: 'byte',
        memoryReference: memoryReference(address)
      };
    }

    return {
      value: 'unavailable'
    };
  }

  private async evaluateAddressExpression(
    expression: string
  ): Promise<{ address: number; description: string } | undefined> {
    await this.refreshRegisterDescriptors();
    await this.refreshRegisters();
    const trimmed = expression.trim();
    const label = findLabelByName(this.debugInfo, trimmed);
    if (label) {
      return {
        address: label.address,
        description: `${label.name} at $${hexWord(label.address)}`
      };
    }
    const address = parseOptionalAddress(trimmed);
    if (address !== undefined) {
      return {
        address,
        description: `$${hexWord(address)}`
      };
    }
    const descriptor = this.findRegisterDescriptor(trimmed);
    if (descriptor) {
      const value = this.registers.get(descriptor.id)?.value;
      return value === undefined
        ? undefined
        : {
            address: value,
            description: `${descriptor.name} register target $${hexWord(value)}`
          };
    }
    return undefined;
  }

  private async readMemoryBytes(
    startAddress: number,
    count: number,
    options: ViceMonitorMemoryOptions = {}
  ): Promise<Buffer> {
    if (!this.monitor || count <= 0) {
      return Buffer.alloc(0);
    }
    const start = normalizeAddress(startAddress);
    const end = start + count - 1;
    if (end > 0xffff) {
      throw new Error('Memory reads must stay within $0000-$FFFF.');
    }
    const [command, body] = ViceMonitorRequests.memoryGet(start, end, options);
    const event = await this.monitor.sendAndWait(
      command,
      body,
      (candidate) => candidate.type === 'memory',
      DEFAULT_MEMORY_READ_TIMEOUT_MS
    );
    return event.type === 'memory' ? event.bytes.subarray(0, count) : Buffer.alloc(0);
  }

  private async writeMemoryBytes(
    startAddress: number,
    bytes: Buffer,
    options: ViceMonitorMemoryOptions = {}
  ): Promise<void> {
    if (!this.monitor) {
      throw new Error('VICE monitor is not connected.');
    }
    if (bytes.length <= 0) {
      return;
    }
    const start = normalizeAddress(startAddress);
    const end = start + bytes.length - 1;
    if (end > 0xffff) {
      throw new Error('Memory writes must stay within $0000-$FFFF.');
    }
    const [command, body] = ViceMonitorRequests.memorySet(start, bytes, options);
    await this.monitor.sendAndWait(
      command,
      body,
      (candidate) =>
        candidate.type === 'ack' &&
        candidate.commandId === 0x02,
      DEFAULT_MEMORY_READ_TIMEOUT_MS
    );
    this.emitMemoryChanged(start, bytes.length);
  }

  private async writeRegister(
    descriptor: ViceMonitorRegisterDescriptor,
    value: number
  ): Promise<void> {
    if (!this.monitor) {
      throw new Error('VICE monitor is not connected.');
    }
    const byteLength = Math.max(1, Math.ceil(descriptor.bitSize / 8));
    const maxValue = byteLength >= 4
      ? 0xffffffff
      : (1 << (byteLength * 8)) - 1;
    if (value < 0 || value > maxValue) {
      throw new Error(`${descriptor.name} must be between $0 and $${hex(maxValue, byteLength * 2)}.`);
    }
    const [command, body] = ViceMonitorRequests.registersSet([
      { id: descriptor.id, value, byteLength }
    ]);
    await this.monitor.sendAndWait(
      command,
      body,
      (candidate) => candidate.type === 'register-values' || candidate.type === 'ack',
      3000
    );
    this.registers.set(descriptor.id, {
      id: descriptor.id,
      value,
      byteLength
    });
    await this.refreshRegisters();
    if (this.clientSupportsInvalidatedEvent) {
      this.connection.sendEvent('invalidated', {
        areas: ['variables'],
        threadId: THREAD_ID,
        stackFrameId: STACK_FRAME_ID
      } satisfies DebugProtocol.InvalidatedEvent['body']);
    }
  }

  private emitMemoryChanged(startAddress: number, count: number): void {
    if (!this.clientSupportsMemoryEvent) {
      return;
    }
    this.connection.sendEvent('memory', {
      memoryReference: memoryReference(startAddress),
      offset: 0,
      count
    } satisfies DebugProtocol.MemoryEvent['body']);
  }

  private findRegisterDescriptor(name: string): ViceMonitorRegisterDescriptor | undefined {
    return [...this.registerDescriptors.values()].find((descriptor) =>
      descriptor.name.toLowerCase() === name.toLowerCase()
    );
  }

  private endSession(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.monitor?.dispose();
    this.monitor = undefined;
    this.connection.sendEvent('terminated');
  }
}

function sourceForPath(sourcePath: string): DebugProtocol.Source {
  return {
    name: path.basename(sourcePath),
    path: sourcePath
  };
}

function normalizeSourceKey(sourcePath: string): string {
  const normalized = path.normalize(sourcePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function distinctBreakpointLocations(
  locations: readonly DebugProtocol.BreakpointLocation[]
): DebugProtocol.BreakpointLocation[] {
  const result: DebugProtocol.BreakpointLocation[] = [];
  const seen = new Set<string>();
  for (const location of locations) {
    const key = [
      location.line,
      location.column ?? '',
      location.endLine ?? '',
      location.endColumn ?? ''
    ].join(':');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(location);
  }
  return result;
}

function unsupportedBreakpointMessage(
  breakpoint: DebugProtocol.SourceBreakpoint
): string | undefined {
  if (breakpoint.logMessage) {
    return 'Logpoints are not supported by the VICE debugger yet.';
  }
  if (breakpoint.condition) {
    return 'Conditional breakpoints are not supported by the VICE debugger yet.';
  }
  if (breakpoint.hitCondition) {
    return 'Hit-count breakpoints are not supported by the VICE debugger yet.';
  }
  return undefined;
}

function memoryReference(address: number): string {
  return `0x${hexWord(address)}`;
}

function parseMemoryReference(reference: string): number {
  const parsed = parseOptionalAddress(reference);
  if (parsed === undefined) {
    throw new Error(`Invalid memory reference: ${reference}`);
  }
  return parsed;
}

function parseOptionalAddress(value: string): number | undefined {
  if (/^\$[0-9a-f]+$/iu.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^0x[0-9a-f]+$/iu.test(value)) {
    return Number.parseInt(value.slice(2), 16);
  }
  if (/^[0-9]+$/u.test(value)) {
    return Number.parseInt(value, 10);
  }
  return undefined;
}

function parseRequiredNumber(value: string): number {
  const parsed = parseOptionalAddress(value.trim());
  if (parsed === undefined) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return parsed;
}

function encodeDataBreakpointId(startAddress: number, length: number): string {
  return `memory:${hexWord(startAddress)}:${length}`;
}

function decodeDataBreakpointId(dataId: string): {
  startAddress: number;
  length: number;
} {
  const match = /^memory:([0-9a-f]{1,4}):([0-9]+)$/iu.exec(dataId);
  if (!match) {
    throw new Error(`Unsupported data breakpoint id: ${dataId}`);
  }
  const startAddress = Number.parseInt(match[1], 16);
  const length = Number.parseInt(match[2], 10);
  if (!Number.isInteger(length) || length <= 0 || startAddress + length > 0x10000) {
    throw new Error(`Invalid data breakpoint range: ${dataId}`);
  }
  return { startAddress, length };
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
