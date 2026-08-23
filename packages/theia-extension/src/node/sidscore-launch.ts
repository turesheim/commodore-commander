export const SID_SCORE_CLI_JAR_FILENAME = 'sidscore-cli-0.7.1.jar';

const MACOS_MIDI_SYSTEM_PROPERTIES = [
  '-Dsidscore.midi.awtEventPump.disabled=true'
] as const;

export interface SidScorePlayerServerArgsOptions {
  readonly kickAssemblerJarPath: string;
  readonly sidScoreCliJarPath: string;
  readonly platform?: NodeJS.Platform;
}

export interface SidScoreLaunchDiagnosticOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly processExecPath?: string;
}

export function createSidScorePlayerServerArgs(
  options: SidScorePlayerServerArgsOptions
): string[] {
  const platform = options.platform ?? process.platform;
  return [
    // The Theia instrument panel expects live MIDI to be audible immediately
    // after settings changes. Waiting for a pre-audio note can miss input
    // during device restarts and leave the monitor armed but silent.
    '-Dsidscore.midi.monitor.startOnInput=false',
    ...(platform === 'darwin' ? MACOS_MIDI_SYSTEM_PROPERTIES : []),
    `-Dsidscore.kickass.jar=${options.kickAssemblerJarPath}`,
    '-jar',
    options.sidScoreCliJarPath,
    '--player-server',
    '--port',
    '0'
  ];
}

export function formatSidScoreLaunchDiagnostic(
  options: SidScoreLaunchDiagnosticOptions
): string {
  const env = options.env ?? process.env;
  return [
    '[Commodore Commander] launching SIDScore player server',
    `command=${formatCommandLine(options.command, options.args)}`,
    `cwd=${quoteDiagnosticValue(options.cwd)}`,
    `platform=${options.platform ?? process.platform}-${options.arch ?? process.arch}`,
    `processExecPath=${quoteDiagnosticValue(options.processExecPath ?? process.execPath)}`,
    `JAVA_HOME=${formatEnvironmentSignal(env.JAVA_HOME)}`,
    `JAVA_TOOL_OPTIONS=${formatEnvironmentSignal(env.JAVA_TOOL_OPTIONS)}`,
    `JDK_JAVA_OPTIONS=${formatEnvironmentSignal(env.JDK_JAVA_OPTIONS)}`,
    `COMMODORE_COMMANDER_JAVA_RUNTIME=${formatEnvironmentSignal(
      env.COMMODORE_COMMANDER_JAVA_RUNTIME
    )}`
  ].join(' ');
}

export function formatCommandLine(
  command: string,
  args: readonly string[]
): string {
  return [command, ...args].map(quoteDiagnosticValue).join(' ');
}

function quoteDiagnosticValue(value: string): string {
  if (value === '<unset>') {
    return value;
  }
  if (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(value)) {
    return value;
  }
  return `'${value.replace(/'/gu, `'\\''`)}'`;
}

function formatEnvironmentSignal(value: string | undefined): string {
  if (value === undefined) {
    return '<unset>';
  }
  return `<set:length=${value.length}>`;
}
