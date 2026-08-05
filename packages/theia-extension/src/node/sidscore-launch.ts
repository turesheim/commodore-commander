export const SID_SCORE_CLI_JAR_FILENAME = 'sidscore-cli-0.6.0.jar';

const MACOS_MIDI_SYSTEM_PROPERTIES = [
  '-Djava.awt.headless=false',
  '-Dapple.awt.UIElement=true',
  '-Dsidscore.midi.awtEventPump=true'
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
    `JAVA_HOME=${quoteDiagnosticValue(env.JAVA_HOME ?? '<unset>')}`,
    `JAVA_TOOL_OPTIONS=${quoteDiagnosticValue(env.JAVA_TOOL_OPTIONS ?? '<unset>')}`,
    `JDK_JAVA_OPTIONS=${quoteDiagnosticValue(env.JDK_JAVA_OPTIONS ?? '<unset>')}`,
    `COMMODORE_COMMANDER_JAVA_RUNTIME=${quoteDiagnosticValue(
      env.COMMODORE_COMMANDER_JAVA_RUNTIME ?? '<unset>'
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
