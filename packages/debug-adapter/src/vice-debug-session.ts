import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { DebugProtocol } from '@vscode/debugprotocol';

import { reconstruct6502CallStack, type Reconstructed6502CallFrame } from './call-stack6502';
import { DapConnection, type DapRequest } from './dap-connection';
import { disassemble6502, type Disassembled6502Instruction } from './disassemble6502';
import {
  findLabelByAddress,
  findLabelByName,
  findLineMappingForAddress,
  findNearestLineMappingForAddress,
  findNearestLabelBeforeAddress,
  findLineMappingForSourceLine,
  findLineMappingsForSourceRange,
  findSourceForMapping,
  loadKickAssemblerDebugInfo,
  resolveSourceEntryPath,
  type KickAssemblerDebugInfo,
  type KickAssemblerDebugWatch,
  type KickAssemblerLineMapping
} from './kick-assembler-debug-info';
import {
  ViceMonitorConnection,
  ViceMonitorCommandId,
  ViceMonitorRequests,
  monitorErrorMessage,
  type ViceMonitorCheckpoint,
  type ViceMonitorBankDescriptor,
  type ViceMonitorEvent,
  type ViceMonitorMemoryOptions,
  type ViceMonitorRegisterDescriptor,
  type ViceMonitorRegisterValue
} from './vice-monitor';
import {
  createPrgDisassemblySource,
  findPrgDisassemblyLine,
  loadPrgImage,
  prgContainsAddress,
  type PrgDisassemblySource,
  type PrgImage
} from './prg-image';
import {
  findNearestRomSymbol,
  findRomSourceForAddress,
  findRomSourceLine,
  loadC64RomSources,
  type RomSource
} from './rom-source';
import {
  TraceHistory,
  formatBytePreview,
  formatObservedWrite,
  formatRegisterChangeHistory,
  formatRegisterValue,
  formatTraceEntrySummary,
  formatTraceHistory,
  type TraceMemoryAccess,
  type TraceRegisterSnapshot,
  type TraceSnapshot
} from './trace-history';
import { launchViceProcess, terminateViceProcess } from './vice-runtime';

const THREAD_ID = 1;
const STACK_FRAME_ID = 1;
const REGISTERS_REFERENCE = 1;
const LABELS_REFERENCE = 2;
const WATCHES_REFERENCE = 3;
const TRACE_HISTORY_REFERENCE = 4;
const PRG_DISASSEMBLY_SOURCE_REFERENCE = 650201;
const ROM_SOURCE_REFERENCE_BASE = 650300;
const MEMORY_DISASSEMBLY_SOURCE_REFERENCE_BASE = 650500;
const TRACE_HISTORY_ENTRY_REFERENCE_BASE = 650700;
const MEMORY_DISASSEMBLY_TARGET_LINE = 6;
const MEMORY_DISASSEMBLY_INSTRUCTION_COUNT = 32;
const DEFAULT_MEMORY_READ_TIMEOUT_MS = 5000;
const VICE_MONITOR_CONNECT_ATTEMPTS = 150;
const VICE_MONITOR_CONNECT_DELAY_MS = 100;
const WATCH_MEMORY_PREVIEW_BYTES = 64;
const TRACE_HISTORY_CAPACITY = 200;

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
  condition?: string;
  hitCondition?: HitCondition;
  logMessage?: string;
  hitCount: number;
  verified: boolean;
  message?: string;
}

interface InstalledDataBreakpoint {
  id: number;
  dataId: string;
  startAddress: number;
  length: number;
  accessType: DebugProtocol.DataBreakpointAccessType;
  checkpointNumbers: number[];
  condition?: string;
  hitCondition?: HitCondition;
  hitCount: number;
  verified: boolean;
  message?: string;
}

type StopReason = 'entry' | 'step' | 'pause' | 'breakpoint' | 'data breakpoint';

type HitConditionOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | '%';

interface HitCondition {
  operator: HitConditionOperator;
  value: number;
}

interface MemoryDisassemblySource {
  address: number;
  name: string;
  sourceReference: number;
}

export class ViceDebugSession {
  private monitor: ViceMonitorConnection | undefined;
  private child: ChildProcess | undefined;
  private debugInfo: KickAssemblerDebugInfo | undefined;
  private programImage: PrgImage | undefined;
  private programDisassembly: PrgDisassemblySource | undefined;
  private romSources: RomSource[] = [];
  private memoryDisassemblySources = new Map<number, MemoryDisassemblySource>();
  private nextSourceReference = MEMORY_DISASSEMBLY_SOURCE_REFERENCE_BASE;
  private launchArguments: ViceDebugLaunchArguments | undefined;
  private registerDescriptors = new Map<number, ViceMonitorRegisterDescriptor>();
  private registers = new Map<number, ViceMonitorRegisterValue>();
  private readonly traceHistory = new TraceHistory(TRACE_HISTORY_CAPACITY);
  private breakpointsBySource = new Map<string, InstalledBreakpoint[]>();
  private checkpointToBreakpoint = new Map<number, InstalledBreakpoint>();
  private dataBreakpoints: InstalledDataBreakpoint[] = [];
  private checkpointToDataBreakpoint = new Map<number, InstalledDataBreakpoint>();
  private checkpointToDataBreakpointAccess =
    new Map<number, DebugProtocol.DataBreakpointAccessType>();
  private nextBreakpointId = 1;
  private initialStopSeen = false;
  private configurationDone = false;
  private stopped = false;
  private pendingStopReason: StopReason = 'entry';
  private lastHitCheckpoint: ViceMonitorCheckpoint | undefined;
  private lastHitShouldResume = false;
  private lastHitShouldLog = false;
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
          await this.variables(request);
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
        case 'commodore-vice/banksAvailable':
          await this.banksAvailable(request);
          break;
        case 'disassemble':
          await this.disassemble(request);
          break;
        case 'source':
          await this.source(request);
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
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsLogPoints: true,
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
    const debugInfoPath = args.debugInfo
      ? resolveLaunchPath(args.debugInfo, cwd)
      : undefined;
    const sourceRoot = args.sourceRoot
      ? resolveLaunchPath(args.sourceRoot, cwd)
      : undefined;
    this.debugInfo = undefined;
    this.programImage = undefined;
    this.programDisassembly = undefined;
    this.romSources = [];
    this.memoryDisassemblySources.clear();
    this.nextSourceReference = MEMORY_DISASSEMBLY_SOURCE_REFERENCE_BASE;
    this.traceHistory.clear();

    if (path.extname(program).toLowerCase() === '.prg') {
      try {
        this.programImage = await loadPrgImage(program);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.connection.sendOutput(
          `Could not index PRG image ${program}: ${message}\n`
        );
      }
    }
    if (useMonitor) {
      this.romSources = await this.loadRomSources(path.resolve(args.viceResourcesPath));
      this.debugInfo = await this.loadDebugInfoForLaunch(
        debugInfoPath,
        program,
        cwd,
        sourceRoot
      );
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
      launch.monitorPort,
      {
        attempts: VICE_MONITOR_CONNECT_ATTEMPTS,
        delayMs: VICE_MONITOR_CONNECT_DELAY_MS
      }
    );
    this.monitor.onEvent((event) => {
      void this.handleMonitorEvent(event);
    });

    this.connection.sendEvent('initialized');
    this.connection.sendResponse(request);
  }

  private async loadDebugInfoForLaunch(
    configuredDebugInfoPath: string | undefined,
    program: string,
    cwd: string,
    sourceRoot: string | undefined
  ): Promise<KickAssemblerDebugInfo | undefined> {
    const sourceRoots = [
      ...(sourceRoot ? [sourceRoot] : []),
      cwd,
      path.dirname(program)
    ];
    const candidates = await discoverDebugInfoCandidates(
      configuredDebugInfoPath,
      program,
      cwd,
      sourceRoot
    );
    let best: {
      path: string;
      info: KickAssemblerDebugInfo;
      overlap: number;
      configured: boolean;
    } | undefined;
    const failures: string[] = [];

    for (const candidate of candidates) {
      try {
        const info = await loadKickAssemblerDebugInfo(candidate, { sourceRoots });
        const overlap = debugInfoProgramOverlap(info, this.programImage);
        const configured = configuredDebugInfoPath !== undefined &&
          samePath(candidate, configuredDebugInfoPath);
        if (
          !best ||
          overlap > best.overlap ||
          (overlap === best.overlap && configured && !best.configured)
        ) {
          best = { path: candidate, info, overlap, configured };
        }
      } catch (error) {
        if (
          configuredDebugInfoPath !== undefined &&
          samePath(candidate, configuredDebugInfoPath)
        ) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${candidate}: ${message}`);
        }
      }
    }

    if (best) {
      if (!configuredDebugInfoPath || !samePath(best.path, configuredDebugInfoPath)) {
        this.connection.sendOutput(
          `Using Kick Assembler debug info ${best.path}\n`
        );
      }
      if (this.programImage && best.overlap === 0) {
        this.connection.sendOutput(
          `Kick Assembler debug info ${best.path} has no address ranges overlapping ` +
            `${path.basename(program)} ($${hexWord(this.programImage.loadAddress)}-$${hexWord(this.programImage.endAddress)}); ` +
            'stack frames will use disassembly where source cannot be mapped.\n',
          'stderr'
        );
      }
      return best.info;
    }

    if (failures.length > 0) {
      this.connection.sendOutput(
        `Could not read Kick Assembler debug info: ${failures.join('; ')}\n`,
        'stderr'
      );
    } else if (configuredDebugInfoPath) {
      this.connection.sendOutput(
        `Could not find Kick Assembler debug info near ${configuredDebugInfoPath}; ` +
          'stack frames will use disassembly where source cannot be mapped.\n',
        'stderr'
      );
    }
    return undefined;
  }

  private async loadRomSources(viceResourcesPath: string): Promise<RomSource[]> {
    try {
      return await loadC64RomSources(viceResourcesPath, ROM_SOURCE_REFERENCE_BASE);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.connection.sendOutput(
        `Could not load C64 ROM symbols/disassembly from ${viceResourcesPath}: ${message}\n`,
        'stderr'
      );
      return [];
    }
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
        await this.emitStopped('entry');
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
    const args = request.arguments as DebugProtocol.StackTraceArguments | undefined;
    await this.refreshRegisterDescriptors();
    await this.refreshRegisters();
    const pc = this.programCounter();
    const reconstructedFrames = await this.reconstructCallFrames();
    const frames = [
      this.toDapStackFrame(pc, STACK_FRAME_ID, `PC $${hexWord(pc)}`),
      ...reconstructedFrames.map((frame, index) =>
        this.toDapStackFrame(
          frame.callSiteAddress,
          STACK_FRAME_ID + index + 1,
          `JSR $${hexWord(frame.callSiteAddress)} -> ${this.addressName(frame.targetAddress)}`,
          ` -> ${this.addressName(frame.targetAddress)}`
        )
      )
    ];
    const startFrame = Math.max(0, args?.startFrame ?? 0);
    const levels = args?.levels === undefined
      ? frames.length
      : Math.max(0, args.levels);
    this.connection.sendResponse(request, {
      stackFrames: frames.slice(startFrame, startFrame + levels),
      totalFrames: frames.length
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
        },
        {
          name: 'Kick Assembler Watches',
          variablesReference: WATCHES_REFERENCE,
          namedVariables: this.debugInfo?.watches.length ?? 0,
          expensive: true
        },
        {
          name: 'Trace History',
          variablesReference: TRACE_HISTORY_REFERENCE,
          namedVariables: this.traceHistory.entries().length,
          expensive: false
        }
      ]
    } satisfies DebugProtocol.ScopesResponse['body']);
  }

  private async variables(request: DapRequest): Promise<void> {
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

    if (args.variablesReference === WATCHES_REFERENCE) {
      this.connection.sendResponse(request, {
        variables: await Promise.all(
          (this.debugInfo?.watches ?? []).map((watch) =>
            this.toDapWatchVariable(watch)
          )
        )
      } satisfies DebugProtocol.VariablesResponse['body']);
      return;
    }

    if (args.variablesReference === TRACE_HISTORY_REFERENCE) {
      this.connection.sendResponse(request, {
        variables: this.toDapTraceHistoryVariables(args)
      } satisfies DebugProtocol.VariablesResponse['body']);
      return;
    }

    const traceSnapshot = this.traceSnapshotForVariablesReference(args.variablesReference);
    if (traceSnapshot) {
      this.connection.sendResponse(request, {
        variables: this.toDapTraceSnapshotVariables(traceSnapshot)
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
    this.lastHitShouldResume = false;
    this.lastHitShouldLog = false;
    this.resumeMonitor();
    this.connection.sendResponse(request, {
      allThreadsContinued: true
    } satisfies DebugProtocol.ContinueResponse['body']);
  }

  private step(request: DapRequest, stepOverSubroutines: boolean): void {
    this.pendingStopReason = 'step';
    this.lastHitCheckpoint = undefined;
    this.lastHitShouldResume = false;
    this.lastHitShouldLog = false;
    const [command, body] = ViceMonitorRequests.advanceInstructions(1, stepOverSubroutines);
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private stepOut(request: DapRequest): void {
    this.pendingStopReason = 'step';
    this.lastHitCheckpoint = undefined;
    this.lastHitShouldResume = false;
    this.lastHitShouldLog = false;
    const [command, body] = ViceMonitorRequests.executeUntilReturn();
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private pause(request: DapRequest): void {
    this.pendingStopReason = 'pause';
    this.lastHitCheckpoint = undefined;
    this.lastHitShouldResume = false;
    this.lastHitShouldLog = false;
    const [command, body] = ViceMonitorRequests.suspend();
    this.monitor?.send(command, body);
    this.connection.sendResponse(request);
  }

  private async evaluate(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.EvaluateArguments;
    const traceCommand = await this.evaluateTraceCommand(args.expression, args.context);
    if (traceCommand) {
      this.connection.sendResponse(request, {
        result: traceCommand.value,
        type: traceCommand.type,
        variablesReference: 0
      } satisfies DebugProtocol.EvaluateResponse['body']);
      return;
    }
    const result = await this.evaluateExpression(args.expression, args.context);
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
    if (bytes.length > 0) {
      await this.recordStoppedTrace('memory write', {
        accessType: 'write',
        startAddress: normalizeAddress(startAddress),
        endAddress: normalizeAddress(startAddress + bytes.length - 1),
        valuePreview: [...bytes.subarray(0, WATCH_MEMORY_PREVIEW_BYTES)],
        truncated: bytes.length > WATCH_MEMORY_PREVIEW_BYTES
      });
    }
    this.connection.sendResponse(request, {
      offset: args.offset ?? 0,
      bytesWritten: bytes.length
    } satisfies DebugProtocol.WriteMemoryResponse['body']);
  }

  private async banksAvailable(request: DapRequest): Promise<void> {
    this.connection.sendResponse(request, {
      banks: await this.readBanksAvailable()
    });
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

  private async source(request: DapRequest): Promise<void> {
    const args = request.arguments as DebugProtocol.SourceArguments;
    if (args.sourceReference === PRG_DISASSEMBLY_SOURCE_REFERENCE) {
      const disassembly = this.getPrgDisassemblySource();
      if (!disassembly) {
        throw new Error('No PRG disassembly source is available.');
      }

      this.connection.sendResponse(request, {
        content: disassembly.content,
        mimeType: 'text/x-asm'
      } satisfies DebugProtocol.SourceResponse['body']);
      return;
    }

    const romSource = this.romSources.find((source) =>
      source.sourceReference === args.sourceReference
    );
    if (romSource) {
      this.connection.sendResponse(request, {
        content: romSource.content,
        mimeType: 'text/x-asm'
      } satisfies DebugProtocol.SourceResponse['body']);
      return;
    }

    const memoryDisassembly = this.memoryDisassemblySources.get(args.sourceReference);
    if (!memoryDisassembly) {
      throw new Error(`Unknown source reference: ${args.sourceReference}`);
    }
    this.connection.sendResponse(request, {
      content: await this.createMemoryDisassemblyContent(memoryDisassembly),
      mimeType: 'text/x-asm'
    } satisfies DebugProtocol.SourceResponse['body']);
  }

  private loadedSources(request: DapRequest): void {
    const sources = this.debugInfo
      ? loadedDebugInfoSources(this.debugInfo)
      : [];
    const disassembly = this.getPrgDisassemblySource();
    if (disassembly) {
      sources.push(sourceForPrgDisassembly(disassembly));
    }
    sources.push(...this.romSources.map(sourceForRomDisassembly));
    sources.push(...[...this.memoryDisassemblySources.values()].map(sourceForMemoryDisassembly));
    this.connection.sendResponse(request, {
      sources
    } satisfies DebugProtocol.LoadedSourcesResponse['body']);
  }

  private async terminate(request: DapRequest): Promise<void> {
    const child = this.child;
    const monitor = this.monitor;
    const terminateDebuggee = this.shouldTerminateDebuggee(request);
    this.monitor = undefined;

    if (terminateDebuggee && child) {
      // Avoid VICE's graceful shutdown paths here; macOS x64sc can crash during exit cleanup.
      const terminated = await terminateViceProcess(child, {
        signal: 'SIGKILL'
      });
      if (!terminated) {
        this.connection.sendOutput(
          'Timed out waiting for VICE to exit after SIGKILL.\n',
          'stderr'
        );
      }
    }

    monitor?.dispose();
    this.endSession();
    this.connection.sendResponse(request);
  }

  private shouldTerminateDebuggee(request: DapRequest): boolean {
    if (request.command === 'terminate') {
      return true;
    }
    const args = request.arguments as DebugProtocol.DisconnectArguments | undefined;
    return args?.terminateDebuggee !== false;
  }

  private async installSourceBreakpoint(
    sourcePath: string,
    breakpointSpec: DebugProtocol.SourceBreakpoint
  ): Promise<InstalledBreakpoint> {
    const line = breakpointSpec.line;
    const mapping = findLineMappingForSourceLine(this.debugInfo, sourcePath, line);
    const condition = normalizeViceCondition(breakpointSpec.condition);
    const hitCondition = parseHitCondition(breakpointSpec.hitCondition);
    const unsupportedMessage = unsupportedBreakpointMessage(
      breakpointSpec,
      condition,
      hitCondition
    );
    const breakpoint: InstalledBreakpoint = {
      id: this.nextBreakpointId,
      sourcePath,
      line,
      ...(mapping ? { mapping } : {}),
      ...(condition ? { condition } : {}),
      ...(hitCondition ? { hitCondition } : {}),
      ...(breakpointSpec.logMessage ? { logMessage: breakpointSpec.logMessage } : {}),
      hitCount: 0,
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
        const stopWhenHit = !breakpointSpec.logMessage ||
          this.logpointNeedsStoppedState(breakpointSpec.logMessage);
        const [command, body] = ViceMonitorRequests.setCheckpoint({
          startAddress: mapping.startAddress,
          endAddress: mapping.endAddress,
          exec: true,
          enabled: true,
          stopWhenHit
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
          if (condition) {
            await this.setCheckpointCondition(response.checkpoint.number, condition);
          }
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
    const condition = normalizeViceCondition(dataBreakpoint.condition);
    const hitCondition = parseHitCondition(dataBreakpoint.hitCondition);
    const breakpoint: InstalledDataBreakpoint = {
      id: this.nextBreakpointId,
      dataId: dataBreakpoint.dataId,
      startAddress: range.startAddress,
      length: range.length,
      accessType,
      checkpointNumbers: [],
      ...(condition ? { condition } : {}),
      ...(hitCondition ? { hitCondition } : {}),
      hitCount: 0,
      verified: Boolean(hitCondition || !dataBreakpoint.hitCondition) &&
        Boolean(condition || !dataBreakpoint.condition)
    };
    this.nextBreakpointId += 1;

    if (dataBreakpoint.condition && !condition) {
      breakpoint.message = 'Data breakpoint conditions must be 255 bytes or shorter.';
      return breakpoint;
    }
    if (dataBreakpoint.hitCondition && !hitCondition) {
      breakpoint.message = `Unsupported hit condition: ${dataBreakpoint.hitCondition}`;
      return breakpoint;
    }
    if (!this.monitor) {
      breakpoint.verified = false;
      breakpoint.message = 'VICE monitor is not connected.';
      return breakpoint;
    }

    try {
      for (const breakpointAccessType of dataBreakpointCheckpointAccessTypes(accessType)) {
        const [command, body] = ViceMonitorRequests.setCheckpoint({
          startAddress: range.startAddress,
          endAddress: range.startAddress + range.length - 1,
          load: breakpointAccessType === 'read',
          store: breakpointAccessType === 'write',
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
          breakpoint.checkpointNumbers.push(response.checkpoint.number);
          this.checkpointToDataBreakpoint.set(response.checkpoint.number, breakpoint);
          this.checkpointToDataBreakpointAccess.set(
            response.checkpoint.number,
            breakpointAccessType
          );
          if (condition) {
            await this.setCheckpointCondition(response.checkpoint.number, condition);
          }
        }
      }
    } catch (error) {
      await this.deleteDataBreakpointCheckpoints(breakpoint);
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
      await this.deleteDataBreakpointCheckpoints(breakpoint);
    }
  }

  private async deleteDataBreakpointCheckpoints(
    breakpoint: InstalledDataBreakpoint
  ): Promise<void> {
    for (const checkpointNumber of breakpoint.checkpointNumbers) {
      this.checkpointToDataBreakpoint.delete(checkpointNumber);
      this.checkpointToDataBreakpointAccess.delete(checkpointNumber);
      if (!this.monitor) {
        continue;
      }
      const [command, body] = ViceMonitorRequests.deleteCheckpoint(
        checkpointNumber
      );
      this.monitor.send(command, body);
    }
    breakpoint.checkpointNumbers = [];
  }

  private async setCheckpointCondition(
    checkpointNumber: number,
    condition: string
  ): Promise<void> {
    if (!this.monitor) {
      throw new Error('VICE monitor is not connected.');
    }
    const [command, body] = ViceMonitorRequests.setCheckpointCondition(
      checkpointNumber,
      condition
    );
    await this.monitor.sendAndWait(
      command,
      body,
      (event) =>
        event.type === 'ack' &&
        event.commandId === ViceMonitorCommandId.CHECKPOINT_CONDITION_SET,
      3000
    );
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

  private async toDapWatchVariable(
    watch: KickAssemblerDebugWatch
  ): Promise<DebugProtocol.Variable> {
    const startAddress = normalizeAddress(watch.startAddress);
    const length = watchByteLength(watch);
    const readableLength = Math.min(
      length,
      WATCH_MEMORY_PREVIEW_BYTES,
      0x10000 - startAddress
    );
    const bytes = await this.readMemoryBytes(startAddress, readableLength, {
      sideEffects: false
    });
    const truncated = length > bytes.length;
    const label = findLabelByAddress(this.debugInfo, startAddress);
    return {
      name: watchDisplayName(watch, label?.name),
      value: bytes.length > 0
        ? `${formatWatchValue(bytes, watch.argument)}${truncated ? ' ...' : ''}`
        : 'unavailable',
      type: `${length} byte${length === 1 ? '' : 's'} watch`,
      evaluateName: label?.name ?? memoryReference(startAddress),
      memoryReference: memoryReference(startAddress),
      variablesReference: 0
    };
  }

  private toDapTraceHistoryVariables(
    args: DebugProtocol.VariablesArguments
  ): DebugProtocol.Variable[] {
    const start = Math.max(0, args.start ?? 0);
    const count = args.count === undefined
      ? TRACE_HISTORY_CAPACITY
      : Math.max(0, args.count);
    return this.traceHistory.newest()
      .slice(start, start + count)
      .map((snapshot) => ({
        name: `#${snapshot.sequence}`,
        value: formatTraceEntrySummary(snapshot),
        type: 'trace sample',
        memoryReference: memoryReference(snapshot.pc),
        variablesReference: encodeTraceHistoryEntryReference(snapshot.sequence)
      }));
  }

  private traceSnapshotForVariablesReference(
    variablesReference: number
  ): TraceSnapshot | undefined {
    const sequence = decodeTraceHistoryEntryReference(variablesReference);
    return sequence === undefined ? undefined : this.traceHistory.find(sequence);
  }

  private toDapTraceSnapshotVariables(
    snapshot: TraceSnapshot
  ): DebugProtocol.Variable[] {
    const source = snapshot.source
      ? `${snapshot.source.path}:${snapshot.source.line}`
      : undefined;
    const variables: DebugProtocol.Variable[] = [
      {
        name: 'Reason',
        value: snapshot.reason,
        variablesReference: 0
      },
      {
        name: 'PC',
        value: `$${hexWord(snapshot.pc)}`,
        type: 'address',
        memoryReference: memoryReference(snapshot.pc),
        variablesReference: 0
      },
      {
        name: 'Instruction',
        value: snapshot.instruction ?? 'unavailable',
        variablesReference: 0
      }
    ];
    if (snapshot.instructionBytes) {
      variables.push({
        name: 'Instruction Bytes',
        value: snapshot.instructionBytes,
        variablesReference: 0
      });
    }
    if (source) {
      variables.push({
        name: 'Source',
        value: source,
        variablesReference: 0
      });
    }
    if (snapshot.changedRegisters.length > 0) {
      variables.push({
        name: 'Changed Registers',
        value: snapshot.changedRegisters
          .map((register) =>
            `${register.name} ${formatRegisterValue(register.previousValue, register.bitSize)} -> ${formatRegisterValue(register.value, register.bitSize)}`
          )
          .join(', '),
        variablesReference: 0
      });
    }
    if (snapshot.memoryAccess) {
      variables.push({
        name: 'Memory Access',
        value: [
          snapshot.memoryAccess.accessType,
          snapshot.memoryAccess.startAddress === snapshot.memoryAccess.endAddress
            ? `$${hexWord(snapshot.memoryAccess.startAddress)}`
            : `$${hexWord(snapshot.memoryAccess.startAddress)}-$${hexWord(snapshot.memoryAccess.endAddress)}`,
          formatBytePreview(
            snapshot.memoryAccess.valuePreview,
            snapshot.memoryAccess.truncated
          )
        ].filter(Boolean).join(' '),
        variablesReference: 0
      });
    }
    variables.push(
      ...snapshot.registers.map((register) => ({
        name: register.name,
        value: formatRegisterValue(register.value, register.bitSize),
        type: `${register.bitSize}-bit register`,
        evaluateName: register.name,
        variablesReference: 0
      }))
    );
    return variables;
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
          } else if (this.lastHitShouldResume) {
            if (this.lastHitShouldLog) {
              await this.recordStoppedTrace('logpoint');
              this.logLastSourceBreakpointHit();
            }
            this.lastHitShouldResume = false;
            this.lastHitShouldLog = false;
            this.lastHitCheckpoint = undefined;
            this.resumeMonitor();
          } else {
            await this.emitStopped(this.stopReason());
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
          this.lastHitShouldResume = this.handleCheckpointHit(event.checkpoint);
          if (!event.checkpoint.stop) {
            if (this.lastHitShouldLog) {
              this.logLastSourceBreakpointHit();
            }
            this.lastHitShouldResume = false;
            this.lastHitShouldLog = false;
            this.lastHitCheckpoint = undefined;
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

  private async recordStoppedTrace(
    reason: string,
    memoryAccess?: TraceMemoryAccess
  ): Promise<void> {
    await this.refreshRegisterDescriptors();
    const pc = this.programCounter();
    const instruction = await this.readInstructionAt(pc).catch(() => undefined);
    const mapping = findLineMappingForAddress(this.debugInfo, pc);
    const source = findSourceForMapping(this.debugInfo, mapping);
    const checkpointAccess = memoryAccess ??
      (await this.traceMemoryAccessForLastStop().catch(() => undefined));
    this.traceHistory.record({
      reason,
      pc,
      ...(instruction?.instruction ? { instruction: instruction.instruction } : {}),
      ...(instruction?.instructionBytes ? { instructionBytes: instruction.instructionBytes } : {}),
      ...(instruction?.symbol ? { symbol: instruction.symbol } : {}),
      ...(source && mapping
        ? {
            source: {
              path: source.path,
              line: mapping.startLine,
              column: mapping.startColumn
            }
          }
        : {}),
      registers: this.currentTraceRegisters(),
      ...(checkpointAccess ? { memoryAccess: checkpointAccess } : {})
    });
  }

  private async readInstructionAt(
    address: number
  ): Promise<Disassembled6502Instruction | undefined> {
    if (!this.monitor) {
      return undefined;
    }
    const normalized = normalizeAddress(address);
    const byteCount = Math.min(3, 0x10000 - normalized);
    if (byteCount <= 0) {
      return undefined;
    }
    const bytes = await this.readMemoryBytes(normalized, byteCount, {
      sideEffects: false
    });
    const labels = new Map(
      (this.debugInfo?.labels ?? []).map((label) => [label.address, label.name])
    );
    return disassemble6502(bytes, normalized, 1, labels)[0];
  }

  private currentTraceRegisters(): TraceRegisterSnapshot[] {
    return [...this.registerDescriptors.values()].map((descriptor) => ({
      name: descriptor.name,
      value: this.registers.get(descriptor.id)?.value ?? 0,
      bitSize: descriptor.bitSize
    }));
  }

  private async traceMemoryAccessForLastStop(): Promise<TraceMemoryAccess | undefined> {
    const checkpointNumber = this.lastHitCheckpoint?.number;
    if (checkpointNumber === undefined) {
      return undefined;
    }
    const dataBreakpoint = this.checkpointToDataBreakpoint.get(checkpointNumber);
    if (!dataBreakpoint) {
      return undefined;
    }
    const count = Math.min(dataBreakpoint.length, WATCH_MEMORY_PREVIEW_BYTES);
    const bytes = await this.readMemoryBytes(dataBreakpoint.startAddress, count, {
      sideEffects: false
    });
    return {
      accessType: this.checkpointToDataBreakpointAccess.get(checkpointNumber) ??
        dataBreakpoint.accessType,
      startAddress: dataBreakpoint.startAddress,
      endAddress: dataBreakpoint.startAddress + dataBreakpoint.length - 1,
      valuePreview: [...bytes],
      truncated: dataBreakpoint.length > bytes.length
    };
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

  private handleCheckpointHit(checkpoint: ViceMonitorCheckpoint): boolean {
    const sourceBreakpoint = this.checkpointToBreakpoint.get(checkpoint.number);
    const dataBreakpoint = this.checkpointToDataBreakpoint.get(checkpoint.number);
    let shouldResume = false;
    this.lastHitShouldLog = false;

    if (sourceBreakpoint) {
      sourceBreakpoint.hitCount += 1;
      const hitSatisfied = hitConditionSatisfied(
        sourceBreakpoint.hitCondition,
        sourceBreakpoint.hitCount
      );
      if (sourceBreakpoint.logMessage) {
        this.lastHitShouldLog = hitSatisfied;
        shouldResume = true;
      } else if (!hitSatisfied) {
        shouldResume = true;
      }
    }

    if (dataBreakpoint) {
      dataBreakpoint.hitCount += 1;
      if (!hitConditionSatisfied(dataBreakpoint.hitCondition, dataBreakpoint.hitCount)) {
        shouldResume = true;
      }
    }

    return shouldResume;
  }

  private async emitStopped(reason: StopReason): Promise<void> {
    await this.recordStoppedTrace(reason);
    const description = await this.stopDescription(reason);
    if (description) {
      this.connection.sendOutput(`${description}\n`);
    }
    this.connection.sendEvent('stopped', {
      reason,
      ...(description ? { description, text: description } : {}),
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

  private async stopDescription(reason: StopReason): Promise<string | undefined> {
    if (reason !== 'data breakpoint' || !this.lastHitCheckpoint) {
      return undefined;
    }
    const dataBreakpoint = this.checkpointToDataBreakpoint.get(
      this.lastHitCheckpoint.number
    );
    if (!dataBreakpoint) {
      return undefined;
    }
    const pc = this.programCounter();
    const value = await this.describeWatchpointValue(dataBreakpoint);
    const accessType = this.checkpointToDataBreakpointAccess.get(
      this.lastHitCheckpoint.number
    ) ?? dataBreakpoint.accessType;
    return [
      `VICE ${watchpointAccessLabel(accessType)} watchpoint`,
      watchpointRangeLabel(dataBreakpoint),
      `PC $${hexWord(pc)}`,
      value
    ].filter(Boolean).join(', ');
  }

  private async describeWatchpointValue(
    breakpoint: InstalledDataBreakpoint
  ): Promise<string | undefined> {
    const count = Math.min(breakpoint.length, WATCH_MEMORY_PREVIEW_BYTES);
    const bytes = await this.readMemoryBytes(breakpoint.startAddress, count, {
      sideEffects: false
    });
    if (bytes.length === 0) {
      return undefined;
    }
    const prefix = breakpoint.length === 1 ? 'value' : 'bytes';
    const suffix = breakpoint.length > bytes.length ? ' ...' : '';
    return `${prefix} ${[...bytes].map((byte) => `$${hexByte(byte)}`).join(' ')}${suffix}`;
  }

  private logLastSourceBreakpointHit(): void {
    const checkpointNumber = this.lastHitCheckpoint?.number;
    if (checkpointNumber === undefined) {
      return;
    }
    const sourceBreakpoint = this.checkpointToBreakpoint.get(checkpointNumber);
    if (!sourceBreakpoint?.logMessage) {
      return;
    }
    this.connection.sendOutput(
      `${this.formatLogpointMessage(sourceBreakpoint)}\n`
    );
  }

  private breakpointIdsForLastStop(): number[] {
    const checkpointNumber = this.lastHitCheckpoint?.number;
    if (checkpointNumber === undefined) {
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

  private stackPointer(): number | undefined {
    for (const descriptor of this.registerDescriptors.values()) {
      const name = descriptor.name.toUpperCase();
      if (name === 'SP' || name === 'S') {
        const value = this.registers.get(descriptor.id)?.value;
        return value === undefined ? undefined : value & 0xff;
      }
    }
    return undefined;
  }

  private async reconstructCallFrames(): Promise<Reconstructed6502CallFrame[]> {
    const stackPointer = this.stackPointer();
    if (stackPointer === undefined || !this.monitor) {
      return [];
    }
    try {
      const stackPage = await this.readMemoryBytes(0x0100, 0x0100, {
        sideEffects: false
      });
      return await reconstruct6502CallStack({
        stackPointer,
        stackPage,
        readMemory: (startAddress, byteCount) =>
          this.readMemoryBytes(startAddress, byteCount, { sideEffects: false })
      });
    } catch {
      return [];
    }
  }

  private toDapStackFrame(
    address: number,
    id: number,
    fallbackName: string,
    mappedNameSuffix = ''
  ): DebugProtocol.StackFrame {
    const mapping = findNearestLineMappingForAddress(this.debugInfo, address);
    const source = findSourceForMapping(this.debugInfo, mapping);
    const sourceObject = source ? sourceForPath(source.path) : undefined;
    const disassemblyLine = sourceObject ? undefined : this.prgDisassemblyLine(address);
    const disassemblySource = disassemblyLine
      ? this.getPrgDisassemblySource()
      : undefined;
    const romSource = sourceObject || disassemblySource
      ? undefined
      : findRomSourceForAddress(this.romSources, address);
    const romLine = romSource ? findRomSourceLine(romSource, address) : undefined;
    const memoryDisassemblySource = sourceObject || disassemblySource || romSource
      ? undefined
      : this.getMemoryDisassemblySource(address);
    const frameName = this.stackFrameDisplayName(address, fallbackName, mappedNameSuffix);
    return {
      id,
      name: frameName,
      ...(sourceObject
        ? { source: sourceObject }
        : disassemblySource
          ? { source: sourceForPrgDisassembly(disassemblySource) }
          : romSource
            ? { source: sourceForRomDisassembly(romSource) }
            : memoryDisassemblySource
              ? { source: sourceForMemoryDisassembly(memoryDisassemblySource) }
              : {}),
      line: mapping?.startLine ??
        disassemblyLine ??
        romLine ??
        (memoryDisassemblySource ? MEMORY_DISASSEMBLY_TARGET_LINE : 0),
      column: mapping?.startColumn ??
        (disassemblyLine || romLine || memoryDisassemblySource ? 1 : 0),
      ...(mapping ? { endLine: mapping.endLine, endColumn: mapping.endColumn } : {}),
      instructionPointerReference: memoryReference(address)
    };
  }

  private prgDisassemblyLine(address: number): number | undefined {
    if (!prgContainsAddress(this.programImage, address)) {
      return undefined;
    }
    return findPrgDisassemblyLine(this.getPrgDisassemblySource(), address);
  }

  private getPrgDisassemblySource(): PrgDisassemblySource | undefined {
    if (!this.programDisassembly && this.programImage) {
      this.programDisassembly = createPrgDisassemblySource(
        this.programImage,
        PRG_DISASSEMBLY_SOURCE_REFERENCE,
        this.debugInfo
      );
    }
    return this.programDisassembly;
  }

  private getMemoryDisassemblySource(address: number): MemoryDisassemblySource | undefined {
    if (!this.monitor) {
      return undefined;
    }
    const normalized = normalizeAddress(address);
    for (const source of this.memoryDisassemblySources.values()) {
      if (source.address === normalized) {
        return source;
      }
    }
    const source: MemoryDisassemblySource = {
      address: normalized,
      name: `$${hexWord(normalized)}.memory-disassembly.asm`,
      sourceReference: this.nextSourceReference
    };
    this.nextSourceReference += 1;
    this.memoryDisassemblySources.set(source.sourceReference, source);
    return source;
  }

  private async createMemoryDisassemblyContent(
    source: MemoryDisassemblySource
  ): Promise<string> {
    const byteCount = Math.min(
      0x10000 - source.address,
      MEMORY_DISASSEMBLY_INSTRUCTION_COUNT * 3
    );
    const bytes = await this.readMemoryBytes(source.address, byteCount, {
      sideEffects: false
    });
    const labels = new Map(
      (this.debugInfo?.labels ?? []).map((label) => [label.address, label.name])
    );
    const instructions = disassemble6502(
      bytes,
      source.address,
      MEMORY_DISASSEMBLY_INSTRUCTION_COUNT,
      labels
    );
    const lines = [
      `// Live memory disassembly at $${hexWord(source.address)}`,
      '// Generated from VICE monitor memory because no source mapping was available.',
      '',
      `* = $${hexWord(source.address)}`,
      ''
    ];
    for (const instruction of instructions) {
      if (instruction.symbol) {
        lines.push(`${instruction.symbol}:`);
      }
      lines.push(
        `    ${instruction.instruction.padEnd(18)} // ` +
          `$${hexWord(instruction.address)}  ${instruction.instructionBytes}` +
          `${instruction.undocumented ? '  undocumented' : ''}`
      );
    }
    return `${lines.join('\n')}\n`;
  }

  private addressName(address: number): string {
    const normalized = normalizeAddress(address);
    const debugLabel = findLabelByAddress(this.debugInfo, normalized);
    if (debugLabel) {
      return debugLabel.name;
    }
    const romSymbol = findNearestRomSymbol(this.romSources, normalized);
    if (romSymbol?.address === normalized) {
      return romSymbol.name;
    }
    return `$${hexWord(normalized)}`;
  }

  private formatLogpointMessage(breakpoint: InstalledBreakpoint): string {
    const message = breakpoint.logMessage ?? '';
    const address = breakpoint.mapping?.startAddress;
    return message.replace(/\{([^}]+)\}/gu, (_match, expression: string) => {
      const trimmed = String(expression).trim();
      if (trimmed.toLowerCase() === 'address' && address !== undefined) {
        return `$${hexWord(address)}`;
      }
      if (trimmed.toLowerCase() === 'hitcount') {
        return String(breakpoint.hitCount);
      }
      const register = this.findRegisterDescriptor(trimmed);
      const value = register ? this.registers.get(register.id)?.value : undefined;
      if (register && value !== undefined) {
        return `$${hex(value, Math.max(2, register.bitSize / 4))}`;
      }
      const label = findLabelByName(this.debugInfo, trimmed);
      if (label) {
        return `$${hexWord(label.address)}`;
      }
      return 'unavailable';
    });
  }

  private logpointNeedsStoppedState(message: string): boolean {
    const expressions = message.matchAll(/\{([^}]+)\}/gu);
    for (const match of expressions) {
      const expression = String(match[1]).trim();
      const lowerCase = expression.toLowerCase();
      if (lowerCase === 'address' || lowerCase === 'hitcount') {
        continue;
      }
      if (findLabelByName(this.debugInfo, expression)) {
        continue;
      }
      return true;
    }
    return false;
  }

  private stackFrameDisplayName(
    address: number,
    fallbackName: string,
    mappedNameSuffix: string
  ): string {
    const normalized = normalizeAddress(address);
    const contextName = this.addressContextName(address);
    return contextName
      ? `${contextName} $${hexWord(normalized)}${mappedNameSuffix}`
      : fallbackName;
  }

  private addressContextName(address: number): string | undefined {
    const normalized = normalizeAddress(address);
    const label = findNearestLabelBeforeAddress(this.debugInfo, normalized);
    if (label) {
      const offset = normalized - label.address;
      return offset === 0
        ? label.name
        : `${label.name}+$${hexOffset(offset)}`;
    }
    const romSymbol = findNearestRomSymbol(this.romSources, normalized);
    if (!romSymbol) {
      return undefined;
    }
    const offset = normalized - romSymbol.address;
    return offset === 0
      ? romSymbol.name
      : `${romSymbol.name}+$${hexOffset(offset)}`;
  }

  private async evaluateExpression(expression: string, context?: string): Promise<{
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
      if (context === 'watch') {
        const bytes = await this.readMemoryBytes(label.address, 1, {
          sideEffects: false
        });
        return {
          value: `$${hexByte(bytes[0] ?? 0)}`,
          type: 'byte',
          memoryReference: memoryReference(label.address)
        };
      }
      return {
        value: `$${hexWord(label.address)}`,
        type: 'address',
        memoryReference: memoryReference(label.address)
      };
    }

    const resolvedAddress = resolveDebugAddressExpression(this.debugInfo, trimmed);
    if (resolvedAddress !== undefined) {
      const address = normalizeAddress(resolvedAddress);
      const bytes = await this.readMemoryBytes(address, 1, {
        sideEffects: context === 'watch' ? false : undefined
      });
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

  private async evaluateTraceCommand(
    expression: string,
    context?: string
  ): Promise<{ value: string; type: string } | undefined> {
    if (context && context !== 'repl') {
      return undefined;
    }
    const trimmed = expression.trim();
    if (!trimmed.startsWith('.')) {
      return undefined;
    }
    const [command, ...rest] = trimmed.split(/\s+/u);
    const argument = rest.join(' ').trim();
    switch (command.toLowerCase()) {
      case '.trace':
      case '.history':
        return {
          value: this.evaluateTraceHistoryCommand(argument),
          type: 'trace history'
        };
      case '.lastwrite':
        return {
          value: await this.evaluateLastWriteCommand(argument),
          type: 'trace history'
        };
      case '.regchanges':
        return {
          value: this.evaluateRegisterChangesCommand(argument),
          type: 'trace history'
        };
      default:
        return undefined;
    }
  }

  private evaluateTraceHistoryCommand(argument: string): string {
    if (!argument || /^\d+$/u.test(argument)) {
      return formatTraceHistory(
        this.traceHistory.newest(),
        argument ? Number.parseInt(argument, 10) : TRACE_HISTORY_CAPACITY
      );
    }
    const lowerCase = argument.toLowerCase();
    if (lowerCase === 'clear') {
      this.traceHistory.clear();
      return 'Trace history cleared.';
    }
    if (lowerCase === 'help') {
      return [
        '.trace [count]       show recent stopped PC samples',
        '.history [count]     alias for .trace',
        '.trace clear         clear trace history and observed writes',
        '.lastwrite <address> show last observed write to a watched/written byte',
        '.regchanges <name>   show observed changes for a CPU register'
      ].join('\n');
    }
    return 'Usage: .trace [count], .trace clear, or .trace help.';
  }

  private async evaluateLastWriteCommand(argument: string): Promise<string> {
    if (!argument) {
      return 'Usage: .lastwrite <address-or-label>';
    }
    const resolved = await this.evaluateAddressExpression(argument);
    if (!resolved) {
      return `Could not resolve address: ${argument}`;
    }
    return formatObservedWrite(
      this.traceHistory.lastObservedWrite(resolved.address)
    );
  }

  private evaluateRegisterChangesCommand(argument: string): string {
    const tokens = argument.split(/\s+/u).filter(Boolean);
    const registerName = tokens[0];
    if (!registerName) {
      return 'Usage: .regchanges <register> [count]';
    }
    const count = tokens[1] && /^\d+$/u.test(tokens[1])
      ? Number.parseInt(tokens[1], 10)
      : TRACE_HISTORY_CAPACITY;
    return formatRegisterChangeHistory(
      registerName,
      this.traceHistory.registerChanges(registerName, count),
      count
    );
  }

  private async evaluateAddressExpression(
    expression: string
  ): Promise<{ address: number; description: string } | undefined> {
    const trimmed = expression.trim();
    const label = findLabelByName(this.debugInfo, trimmed);
    if (label) {
      return {
        address: label.address,
        description: `${label.name} at $${hexWord(label.address)}`
      };
    }
    const address = resolveDebugAddressExpression(this.debugInfo, trimmed);
    if (address !== undefined) {
      return {
        address: normalizeAddress(address),
        description: trimmed === `$${hexWord(address)}`
          ? `$${hexWord(address)}`
          : `${trimmed} -> $${hexWord(normalizeAddress(address))}`
      };
    }
    await this.refreshRegisterDescriptors();
    await this.refreshRegisters();
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

  private async readBanksAvailable(): Promise<ViceMonitorBankDescriptor[]> {
    if (!this.monitor) {
      throw new Error('VICE monitor is not connected.');
    }
    const [command, body] = ViceMonitorRequests.banksAvailable();
    const event = await this.monitor.sendAndWait(
      command,
      body,
      (candidate) => candidate.type === 'banks',
      DEFAULT_MEMORY_READ_TIMEOUT_MS
    );
    return event.type === 'banks' ? event.banks : [];
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
    await this.recordStoppedTrace('register write');
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
  const uri = sourceUriForPath(sourcePath);
  return {
    name: sourceNameForPath(sourcePath),
    path: uri ?? sourcePath
  };
}

function loadedDebugInfoSources(
  debugInfo: KickAssemblerDebugInfo
): DebugProtocol.Source[] {
  return debugInfo.sources
    .filter((source) => shouldPublishLoadedSource(source.path))
    .map((source) => sourceForPath(resolveSourceEntryPath(debugInfo, source)));
}

function shouldPublishLoadedSource(sourcePath: string): boolean {
  return !hasUriScheme(sourcePath) || /^file:/u.test(sourcePath);
}

function sourceUriForPath(sourcePath: string): string | undefined {
  if (hasUriScheme(sourcePath)) {
    return sourcePath;
  }
  return path.isAbsolute(sourcePath)
    ? pathToFileURL(path.normalize(sourcePath)).toString()
    : undefined;
}

function sourceNameForPath(sourcePath: string): string {
  if (/^file:/u.test(sourcePath)) {
    return path.basename(fileURLToPath(sourcePath));
  }
  return path.basename(sourcePath);
}

function hasUriScheme(sourcePath: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(sourcePath) &&
    !/^[A-Za-z]:[\\/]/u.test(sourcePath);
}

function sourceForPrgDisassembly(
  disassembly: PrgDisassemblySource
): DebugProtocol.Source {
  return {
    name: disassembly.name,
    sourceReference: disassembly.sourceReference,
    origin: 'PRG disassembly'
  };
}

function sourceForRomDisassembly(disassembly: RomSource): DebugProtocol.Source {
  return {
    name: disassembly.name,
    sourceReference: disassembly.sourceReference,
    origin: 'VICE C64 ROM disassembly'
  };
}

function sourceForMemoryDisassembly(
  disassembly: MemoryDisassemblySource
): DebugProtocol.Source {
  return {
    name: disassembly.name,
    sourceReference: disassembly.sourceReference,
    origin: 'VICE memory disassembly'
  };
}

async function discoverDebugInfoCandidates(
  configuredDebugInfoPath: string | undefined,
  program: string,
  cwd: string,
  sourceRoot: string | undefined
): Promise<string[]> {
  const programDirectory = path.dirname(program);
  const programDebugInfoPath = replaceExtension(program, '.dbg');
  const staticCandidates = uniquePathList([
    configuredDebugInfoPath,
    programDebugInfoPath,
    path.join(programDirectory, `${path.basename(program, path.extname(program))}.dbg`),
    path.join(cwd, `${path.basename(program, path.extname(program))}.dbg`),
    path.join(cwd, 'out', `${path.basename(program, path.extname(program))}.dbg`),
    sourceRoot
      ? path.join(sourceRoot, 'out', `${path.basename(program, path.extname(program))}.dbg`)
      : undefined
  ]);
  const searchDirectories = uniquePathList([
    programDirectory,
    cwd,
    path.join(cwd, 'out'),
    sourceRoot,
    sourceRoot ? path.join(sourceRoot, 'out') : undefined
  ]);
  const discovered = (
    await Promise.all(searchDirectories.map((directory) => listDebugInfoFiles(directory)))
  ).flat();
  return uniquePathList([...staticCandidates, ...discovered]);
}

async function listDebugInfoFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.dbg')
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

function debugInfoProgramOverlap(
  debugInfo: KickAssemblerDebugInfo,
  image: PrgImage | undefined
): number {
  if (!image || image.bytes.length === 0) {
    return debugInfo.lineMappings.length;
  }
  return debugInfo.lineMappings.filter((mapping) =>
    mapping.endAddress >= image.loadAddress &&
    mapping.startAddress <= image.endAddress
  ).length;
}

function replaceExtension(filePath: string, extension: string): string {
  return path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}${extension}`
  );
}

function resolveLaunchPath(filePath: string, cwd: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function uniquePathList(paths: readonly (string | undefined)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of paths) {
    if (!candidate) {
      continue;
    }
    const normalized = process.platform === 'win32'
      ? path.normalize(candidate).toLowerCase()
      : path.normalize(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(candidate);
  }
  return result;
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
  breakpoint: DebugProtocol.SourceBreakpoint,
  condition: string | undefined,
  hitCondition: HitCondition | undefined
): string | undefined {
  if (breakpoint.condition?.trim() && !condition) {
    return 'Breakpoint conditions must be 255 bytes or shorter.';
  }
  if (breakpoint.hitCondition?.trim() && !hitCondition) {
    return `Unsupported hit condition: ${breakpoint.hitCondition}`;
  }
  return undefined;
}

function normalizeViceCondition(condition: string | undefined): string | undefined {
  const trimmed = condition?.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed.replace(/^if\b\s*/iu, '').trim();
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > 0xff) {
    return undefined;
  }
  return normalized;
}

function parseHitCondition(input: string | undefined): HitCondition | undefined {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  let operator: HitConditionOperator = '==';
  let valueText = trimmed;
  const prefixMatch = /^(==|=|!=|<=|>=|<|>|%)\s*(.+)$/u.exec(trimmed);
  if (prefixMatch) {
    operator = prefixMatch[1] === '='
      ? '=='
      : prefixMatch[1] as HitConditionOperator;
    valueText = prefixMatch[2].trim();
  } else {
    const moduloSuffixMatch = /^(.+?)\s*%$/u.exec(trimmed);
    if (moduloSuffixMatch) {
      operator = '%';
      valueText = moduloSuffixMatch[1].trim();
    }
  }

  const value = parseOptionalAddress(valueText);
  if (value === undefined || (operator === '%' && value <= 0)) {
    return undefined;
  }
  return { operator, value };
}

function hitConditionSatisfied(
  condition: HitCondition | undefined,
  hitCount: number
): boolean {
  if (!condition) {
    return true;
  }
  switch (condition.operator) {
    case '==':
      return hitCount === condition.value;
    case '!=':
      return hitCount !== condition.value;
    case '<':
      return hitCount < condition.value;
    case '<=':
      return hitCount <= condition.value;
    case '>':
      return hitCount > condition.value;
    case '>=':
      return hitCount >= condition.value;
    case '%':
      return hitCount % condition.value === 0;
  }
}

function dataBreakpointCheckpointAccessTypes(
  accessType: DebugProtocol.DataBreakpointAccessType
): DebugProtocol.DataBreakpointAccessType[] {
  return accessType === 'readWrite' ? ['read', 'write'] : [accessType];
}

function watchpointAccessLabel(
  accessType: DebugProtocol.DataBreakpointAccessType
): string {
  switch (accessType) {
    case 'read':
      return 'read';
    case 'write':
      return 'write';
    case 'readWrite':
      return 'read/write';
  }
}

function watchpointRangeLabel(breakpoint: InstalledDataBreakpoint): string {
  const endAddress = breakpoint.startAddress + breakpoint.length - 1;
  return breakpoint.length === 1
    ? `$${hexWord(breakpoint.startAddress)}`
    : `$${hexWord(breakpoint.startAddress)}-$${hexWord(endAddress)}`;
}

function memoryReference(address: number): string {
  return `0x${hexWord(address)}`;
}

function encodeTraceHistoryEntryReference(sequence: number): number {
  return TRACE_HISTORY_ENTRY_REFERENCE_BASE + sequence;
}

function decodeTraceHistoryEntryReference(reference: number): number | undefined {
  return reference > TRACE_HISTORY_ENTRY_REFERENCE_BASE
    ? reference - TRACE_HISTORY_ENTRY_REFERENCE_BASE
    : undefined;
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

function resolveDebugAddressExpression(
  debugInfo: KickAssemblerDebugInfo | undefined,
  expression: string
): number | undefined {
  const compact = expression.replace(/\s+/gu, '');
  if (!compact) {
    return undefined;
  }
  const tokens = compact.match(/[+-]?[^+-]+/gu);
  if (!tokens || tokens.join('') !== compact) {
    return undefined;
  }

  let value = 0;
  let seenTerm = false;
  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const term = token.startsWith('-') || token.startsWith('+')
      ? token.slice(1)
      : token;
    if (!term) {
      return undefined;
    }
    const termValue =
      parseOptionalAddress(term) ??
      findLabelByName(debugInfo, term)?.address;
    if (termValue === undefined) {
      return undefined;
    }
    value += sign * termValue;
    seenTerm = true;
  }
  return seenTerm ? value : undefined;
}

function watchByteLength(watch: KickAssemblerDebugWatch): number {
  if (watch.endAddress === undefined) {
    return 1;
  }
  return Math.max(1, watch.endAddress - watch.startAddress + 1);
}

function watchDisplayName(
  watch: KickAssemblerDebugWatch,
  labelName: string | undefined
): string {
  const range = watch.endAddress === undefined || watch.endAddress === watch.startAddress
    ? `$${hexWord(watch.startAddress)}`
    : `$${hexWord(watch.startAddress)}-$${hexWord(watch.endAddress)}`;
  const name = labelName
    ? watch.endAddress === undefined || watch.endAddress === watch.startAddress
      ? labelName
      : `${labelName} (${range})`
    : range;
  return watch.argument ? `${name} [${watch.argument}]` : name;
}

function formatWatchValue(bytes: Buffer, argument: string | undefined): string {
  const presentation = watchPresentation(argument);
  if (presentation.kind === 'text') {
    return `"${[...bytes].map(printableCharacter).join('')}"`;
  }

  const values: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += presentation.byteLength) {
    const chunk = bytes.subarray(offset, offset + presentation.byteLength);
    if (chunk.length < presentation.byteLength) {
      values.push(...[...chunk].map((byte) => `$${hexByte(byte)}`));
      break;
    }
    const value = readLittleEndianBuffer(chunk);
    switch (presentation.kind) {
      case 'signed':
        values.push(String(toSignedInteger(value, presentation.byteLength)));
        break;
      case 'unsigned':
        values.push(String(value));
        break;
      case 'hex':
        values.push(`$${hex(value, presentation.byteLength * 2)}`);
        break;
    }
  }
  return values.join(' ');
}

function watchPresentation(argument: string | undefined): {
  kind: 'hex' | 'signed' | 'unsigned' | 'text';
  byteLength: 1 | 2 | 4;
} {
  const tokens = (argument ?? '')
    .toLowerCase()
    .split(/[,\s]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  for (const token of tokens) {
    if (token === 'text') {
      return { kind: 'text', byteLength: 1 };
    }
    const match = /^(hex|h|signed|s|unsigned|u)(8|16|32)?$/u.exec(token);
    if (!match) {
      continue;
    }
    const byteLength = match[2] === '32'
      ? 4
      : match[2] === '16'
        ? 2
        : 1;
    if (match[1] === 'signed' || match[1] === 's') {
      return { kind: 'signed', byteLength };
    }
    if (match[1] === 'unsigned' || match[1] === 'u') {
      return { kind: 'unsigned', byteLength };
    }
    return { kind: 'hex', byteLength };
  }
  return { kind: 'hex', byteLength: 1 };
}

function readLittleEndianBuffer(bytes: Buffer): number {
  let value = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    value += bytes[index] << (index * 8);
  }
  return value >>> 0;
}

function toSignedInteger(value: number, byteLength: number): number {
  const bits = byteLength * 8;
  const signBit = 2 ** (bits - 1);
  const mask = 2 ** bits;
  return value >= signBit ? value - mask : value;
}

function printableCharacter(value: number): string {
  return value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.';
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

function hexOffset(value: number): string {
  return hex(value, value <= 0xff ? 2 : 4);
}

function hex(value: number, width: number): string {
  return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}
