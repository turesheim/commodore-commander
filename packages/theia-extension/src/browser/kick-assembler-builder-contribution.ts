import { EditorManager } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import type { FileChangesEvent } from '@theia/filesystem/lib/common/files';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
  Command,
  CommandRegistry,
  DisposableCollection,
  type QuickPickValue
} from '@theia/core/lib/common';
import {
  FrontendApplication,
  FrontendApplicationContribution,
  QuickInputService
} from '@theia/core/lib/browser';
import {
  StatusBar,
  StatusBarAlignment
} from '@theia/core/lib/browser/status-bar/status-bar';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import URI from '@theia/core/lib/common/uri';
import {
  DiagnosticSeverity,
  type Diagnostic
} from '@theia/core/shared/vscode-languageserver-protocol';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ProblemManager } from '@theia/markers/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

import {
  expandKickAssemblerDiagnosticRange,
  parseKickAssemblerCompilerDiagnostics
} from '@commodore-commander/language-support/runtime';
import {
  KickAssemblerBuildService,
  type KickAssemblerBuildClient,
  type KickAssemblerBuildProfileSummary,
  type KickAssemblerBuildEvent,
  type KickAssemblerBuildService as KickAssemblerBuildServiceProxy,
  type KickAssemblerWorkspaceBuildConfigurationSummary
} from '../common/kick-assembler-build-service';
import type {
  KickAssemblerCompilerDiagnostic
} from '@commodore-commander/language-support/runtime';
import {
  KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID,
  KickAssemblerBuildConsoleWidget
} from './kick-assembler-build-console-widget';

const AUTO_BUILD_DEBOUNCE_MS = 300;
const KICK_ASSEMBLER_BUILD_MARKER_OWNER_PREFIX =
  'commodoreCommander.kickAssembler.build';
const KICK_ASSEMBLER_PROFILE_STATUS_BAR_ID =
  'commodoreCommander.kickAssembler.profileStatus';
const CREATE_PROFILE_PICK_VALUE = '__createProfile';
const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.metadata',
  '.theia',
  'dist',
  'node_modules',
  'out',
  'src-gen',
  'target'
]);

interface ActiveProgramBuildState {
  cwd: string;
  output: string;
}

interface ActiveBuildState {
  activeProgram?: ActiveProgramBuildState;
}

export namespace KickAssemblerBuilderCommands {
  export const SELECT_PROFILE: Command = {
    id: 'commodoreCommander.kickAssembler.selectBuildProfile',
    category: 'Commodore Commander',
    label: 'Select Kick Assembler Build Profile',
    iconClass: 'codicon codicon-settings-gear'
  };
}

@injectable()
export class KickAssemblerBuilderContribution
  extends AbstractViewContribution<KickAssemblerBuildConsoleWidget>
  implements FrontendApplicationContribution, KickAssemblerBuildClient
{
  @inject(KickAssemblerBuildService)
  protected readonly buildService!: KickAssemblerBuildServiceProxy;

  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(ProblemManager)
  protected readonly problemManager!: ProblemManager;

  @inject(StatusBar)
  protected readonly statusBar!: StatusBar;

  @inject(QuickInputService)
  protected readonly quickInputService!: QuickInputService;

  protected readonly autoBuildTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  protected readonly pendingAutoBuilds = new Map<string, URI>();
  protected readonly activeBuilds = new Map<string, ActiveBuildState>();
  protected readonly diagnosticUrisByOwner = new Map<string, Set<string>>();
  protected readonly diagnosticOwnerVersions = new Map<string, number>();
  protected readonly buildConfigurationsByWorkspace = new Map<
    string,
    KickAssemblerWorkspaceBuildConfigurationSummary
  >();
  protected readonly toDispose = new DisposableCollection();
  protected consoleAppendQueue = Promise.resolve();

  constructor() {
    super({
      widgetId: KICK_ASSEMBLER_BUILD_CONSOLE_WIDGET_ID,
      widgetName: 'Kick Assembler',
      defaultWidgetOptions: {
        area: 'bottom'
      },
      toggleCommandId: 'commodoreCommander.kickAssembler.toggleConsole'
    });
  }

  onStart(): void {
    this.buildService.setClient(this);
    this.toDispose.push(
      this.fileService.onDidFilesChange((event) => this.handleFilesChanged(event))
    );
    this.toDispose.push(
      this.editorManager.onCurrentEditorChanged(() => {
        void this.updateStatusBar();
      })
    );
    void this.updateStatusBar();
  }

  async initializeLayout(_app: FrontendApplication): Promise<void> {
    await this.openView();
  }

  onStop(): void {
    this.toDispose.dispose();
    for (const timer of this.autoBuildTimers.values()) {
      clearTimeout(timer);
    }
    this.autoBuildTimers.clear();
    this.pendingAutoBuilds.clear();
    this.activeBuilds.clear();
    this.buildConfigurationsByWorkspace.clear();
    void this.statusBar.removeElement(KICK_ASSEMBLER_PROFILE_STATUS_BAR_ID);

    for (const owner of [...this.diagnosticUrisByOwner.keys()]) {
      this.clearProblemMarkers(owner);
    }
    this.diagnosticOwnerVersions.clear();
  }

  override registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
    commands.registerCommand(KickAssemblerBuilderCommands.SELECT_PROFILE, {
      execute: () => this.selectActiveBuildProfile(),
      isEnabled: () => Boolean(this.getCurrentKickAssemblerResource()),
      isVisible: () => true
    });
  }

  onBuildEvent(event: KickAssemblerBuildEvent): void {
    this.handleDiagnosticEvent(event);

    const text = formatBuildEvent(event);
    if (!text) {
      return;
    }

    const reveal = event.type === 'build-started';
    this.appendConsoleOutput(text, reveal);
  }

  protected async selectActiveBuildProfile(): Promise<void> {
    const resourceUri = this.getCurrentKickAssemblerResource();
    if (!resourceUri) {
      this.messageService.warn(
        'Open a Kick Assembler source file before selecting a build profile.'
      );
      return;
    }

    const configuration = await this.getBuildConfiguration(resourceUri);
    if (!configuration) {
      return;
    }

    const picks: QuickPickValue<string>[] = [
      ...configuration.profiles.map((profile) =>
        this.toProfilePick(profile)
      ),
      {
        label: '$(plus) Create new profile...',
        description: 'Add profile to workspace build config',
        value: CREATE_PROFILE_PICK_VALUE,
        alwaysShow: true
      }
    ];
    const activeItem = picks.find(
      (pick) => pick.value === configuration.activeProfileName
    );
    const selected = await this.quickInputService.pick(picks, {
      placeHolder: 'Select active Kick Assembler build profile',
      activeItem
    });

    if (!selected) {
      return;
    }

    const profileName =
      selected.value === CREATE_PROFILE_PICK_VALUE
        ? await this.promptForProfileName(configuration)
        : selected.value;
    if (!profileName) {
      return;
    }

    await this.setActiveBuildProfile(resourceUri, profileName);
  }

  protected toProfilePick(
    profile: KickAssemblerBuildProfileSummary
  ): QuickPickValue<string> {
    return {
      label: `${profile.isActive ? '$(check) ' : ''}${profile.name}`,
      description: profile.isDefault ? 'default profile' : undefined,
      value: profile.name
    };
  }

  protected async promptForProfileName(
    configuration: KickAssemblerWorkspaceBuildConfigurationSummary
  ): Promise<string | undefined> {
    const existingProfiles = new Set(
      configuration.profiles.map((profile) => profile.name)
    );
    const profileName = await this.quickInputService.input({
      placeHolder: 'Profile name',
      prompt: 'Create a Kick Assembler build profile',
      validateInput: async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          return 'Enter a profile name.';
        }
        if (existingProfiles.has(trimmed)) {
          return 'That profile already exists.';
        }
        return undefined;
      }
    });

    return profileName?.trim();
  }

  protected async setActiveBuildProfile(
    resourceUri: URI,
    profileName: string
  ): Promise<void> {
    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    if (!workspaceRootUri) {
      return;
    }

    const configuration = await this.buildService.setActiveBuildProfile({
      workspaceRootUri: workspaceRootUri.toString(),
      resourceUri: resourceUri.toString(),
      profileName
    });
    this.buildConfigurationsByWorkspace.set(
      workspaceRootUri.toString(),
      configuration
    );
    await this.updateStatusBar(configuration);
    this.messageService.info(
      `Active Kick Assembler build profile: ${configuration.activeProfileName}.`
    );
  }

  protected handleFilesChanged(event: FileChangesEvent): void {
    for (const change of event.changes) {
      if (!this.shouldTriggerAutoBuild(change.resource)) {
        continue;
      }

      this.scheduleAutoBuild(change.resource);
    }
  }

  protected scheduleAutoBuild(resourceUri: URI): void {
    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    if (!workspaceRootUri) {
      return;
    }

    const workspaceKey = workspaceRootUri.toString();
    this.pendingAutoBuilds.set(workspaceKey, resourceUri);

    const existingTimer = this.autoBuildTimers.get(workspaceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.autoBuildTimers.set(
      workspaceKey,
      setTimeout(() => {
        this.autoBuildTimers.delete(workspaceKey);
        const pendingResource = this.pendingAutoBuilds.get(workspaceKey);
        this.pendingAutoBuilds.delete(workspaceKey);
        if (!pendingResource) {
          return;
        }

        void this.requestBuild(pendingResource);
      }, AUTO_BUILD_DEBOUNCE_MS)
    );
  }

  protected async requestBuild(resourceUri: URI): Promise<void> {
    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    if (!workspaceRootUri) {
      this.messageService.warn(
        `The file ${resourceUri.path.base} is not inside the current workspace.`
      );
      return;
    }

    try {
      const configuration = await this.getBuildConfiguration(resourceUri);
      await this.buildService.build({
        workspaceRootUri: workspaceRootUri.toString(),
        resourceUri: resourceUri.toString(),
        profileName: configuration?.activeProfileName
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown build failure.';
      this.messageService.error(`Kick Assembler build request failed: ${message}`);
    }
  }

  protected async getBuildConfiguration(
    resourceUri: URI
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary | undefined> {
    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    if (!workspaceRootUri) {
      return undefined;
    }

    const configuration = await this.buildService.getWorkspaceBuildConfiguration({
      workspaceRootUri: workspaceRootUri.toString(),
      resourceUri: resourceUri.toString()
    });
    this.buildConfigurationsByWorkspace.set(
      workspaceRootUri.toString(),
      configuration
    );
    await this.updateStatusBar(configuration);
    return configuration;
  }

  protected async updateStatusBar(
    configuration?: KickAssemblerWorkspaceBuildConfigurationSummary
  ): Promise<void> {
    const resourceUri = this.getCurrentKickAssemblerResource();
    if (!resourceUri) {
      await this.statusBar.removeElement(KICK_ASSEMBLER_PROFILE_STATUS_BAR_ID);
      return;
    }

    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    const currentConfiguration =
      configuration ??
      (workspaceRootUri
        ? this.buildConfigurationsByWorkspace.get(workspaceRootUri.toString())
        : undefined);

    if (!currentConfiguration) {
      await this.statusBar.setElement(KICK_ASSEMBLER_PROFILE_STATUS_BAR_ID, {
        text: '$(settings-gear) Profile: debug',
        alignment: StatusBarAlignment.LEFT,
        priority: 91,
        command: KickAssemblerBuilderCommands.SELECT_PROFILE.id,
        tooltip: 'Select Kick Assembler build profile'
      });
    } else {
      await this.statusBar.setElement(KICK_ASSEMBLER_PROFILE_STATUS_BAR_ID, {
        text: `$(settings-gear) Profile: ${currentConfiguration.activeProfileName}`,
        alignment: StatusBarAlignment.LEFT,
        priority: 91,
        command: KickAssemblerBuilderCommands.SELECT_PROFILE.id,
        tooltip: `Kick Assembler profile from ${labelForUri(currentConfiguration.configUri)}`
      });
    }
  }

  protected getCurrentKickAssemblerResource(): URI | undefined {
    const editor = this.editorManager.currentEditor;
    const resourceUri = editor?.editor.uri;
    if (!resourceUri || !this.shouldTriggerAutoBuild(resourceUri)) {
      return undefined;
    }

    return resourceUri;
  }

  protected shouldTriggerAutoBuild(resourceUri: URI): boolean {
    if (resourceUri.scheme !== 'file') {
      return false;
    }

    if (resourceUri.path.ext.toLowerCase() !== '.asm') {
      return false;
    }

    return !resourceUri.path
      .toString()
      .split('/')
      .filter((segment) => segment.length > 0)
      .some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
  }

  protected appendConsoleOutput(text: string, reveal: boolean): void {
    this.consoleAppendQueue = this.consoleAppendQueue
      .then(async () => {
        const widget = await this.getConsoleWidget(reveal);
        widget.appendOutput(text);
      })
      .catch((error) => {
        console.error('Unable to append Kick Assembler build output.', error);
      });
  }

  protected async getConsoleWidget(
    reveal: boolean
  ): Promise<KickAssemblerBuildConsoleWidget> {
    if (reveal || !this.tryGetWidget()) {
      return this.openView({ activate: false, reveal: true });
    }

    return this.tryGetWidget() as KickAssemblerBuildConsoleWidget;
  }

  protected handleDiagnosticEvent(event: KickAssemblerBuildEvent): void {
    switch (event.type) {
      case 'build-started':
        this.activeBuilds.set(event.buildId, {});
        return;
      case 'program-started': {
        const buildState = this.activeBuilds.get(event.buildId);
        if (!buildState) {
          return;
        }

        const owner = ownerForBuildProgram(event.entryUri);
        this.clearProblemMarkers(owner);
        buildState.activeProgram = {
          cwd: event.cwd,
          output: ''
        };
        return;
      }
      case 'output': {
        const activeProgram = this.activeBuilds.get(event.buildId)?.activeProgram;
        if (activeProgram) {
          activeProgram.output = `${activeProgram.output}${event.chunk}`;
        }
        return;
      }
      case 'program-finished': {
        const buildState = this.activeBuilds.get(event.buildId);
        const activeProgram = buildState?.activeProgram;
        if (!buildState || !activeProgram) {
          return;
        }

        const owner = ownerForBuildProgram(event.entryUri);
        const diagnostics = parseKickAssemblerCompilerDiagnostics(
          activeProgram.output
        );

        const version = this.bumpDiagnosticOwnerVersion(owner);
        this.applyProblemDiagnostics(
          owner,
          diagnostics,
          activeProgram.cwd,
          version
        );
        buildState.activeProgram = undefined;
        return;
      }
      case 'build-finished':
        this.activeBuilds.delete(event.buildId);
        return;
      case 'build-queued':
        return;
    }
  }

  protected applyProblemDiagnostics(
    owner: string,
    diagnostics: readonly KickAssemblerCompilerDiagnostic[],
    basePath: string,
    ownerVersion: number
  ): void {
    void this.doApplyProblemDiagnostics(
      owner,
      diagnostics,
      basePath,
      ownerVersion
    ).catch((error) => {
      console.error('Unable to apply Kick Assembler problem markers.', error);
    });
  }

  protected async doApplyProblemDiagnostics(
    owner: string,
    diagnostics: readonly KickAssemblerCompilerDiagnostic[],
    basePath: string,
    ownerVersion: number
  ): Promise<void> {
    const diagnosticsByUri = new Map<string, KickAssemblerCompilerDiagnostic[]>();

    for (const diagnostic of diagnostics) {
      const resourceUri = filePathToDocumentUri(
        diagnostic.sourcePath,
        basePath
      );
      const bucket = diagnosticsByUri.get(resourceUri) ?? [];
      bucket.push(diagnostic);
      diagnosticsByUri.set(resourceUri, bucket);
    }

    const problemDiagnosticsByUri = new Map<string, Diagnostic[]>();
    for (const [resourceUri, compilerDiagnostics] of diagnosticsByUri) {
      const sourceText = await this.readSourceText(new URI(resourceUri));
      const sourceLines = sourceText?.split(/\r?\n/u);
      const problemDiagnostics = compilerDiagnostics.map((diagnostic) =>
        toProblemDiagnostic(
          diagnostic,
          sourceLines?.[diagnostic.range.start.line]
        )
      );
      problemDiagnosticsByUri.set(resourceUri, problemDiagnostics);
    }

    if (!this.isCurrentDiagnosticOwnerVersion(owner, ownerVersion)) {
      return;
    }

    for (const [resourceUri, problemDiagnostics] of problemDiagnosticsByUri) {
      this.problemManager.setMarkers(
        new URI(resourceUri),
        owner,
        problemDiagnostics
      );
    }

    if (problemDiagnosticsByUri.size > 0) {
      this.diagnosticUrisByOwner.set(
        owner,
        new Set(problemDiagnosticsByUri.keys())
      );
    } else {
      this.diagnosticUrisByOwner.delete(owner);
    }
  }

  protected clearProblemMarkers(owner: string): void {
    this.bumpDiagnosticOwnerVersion(owner);
    const uris = this.diagnosticUrisByOwner.get(owner);
    if (!uris) {
      return;
    }

    for (const resourceUri of uris) {
      this.problemManager.setMarkers(new URI(resourceUri), owner, []);
    }

    this.diagnosticUrisByOwner.delete(owner);
  }

  protected async readSourceText(resourceUri: URI): Promise<string | undefined> {
    try {
      return (await this.fileService.read(resourceUri)).value;
    } catch (error) {
      console.warn(
        `Unable to read ${resourceUri.toString()} for Kick Assembler marker range expansion.`,
        error
      );
      return undefined;
    }
  }

  protected bumpDiagnosticOwnerVersion(owner: string): number {
    const version = (this.diagnosticOwnerVersions.get(owner) ?? 0) + 1;
    this.diagnosticOwnerVersions.set(owner, version);
    return version;
  }

  protected isCurrentDiagnosticOwnerVersion(
    owner: string,
    version: number
  ): boolean {
    return this.diagnosticOwnerVersions.get(owner) === version;
  }
}

function formatBuildEvent(event: KickAssemblerBuildEvent): string {
  switch (event.type) {
    case 'build-started':
      return `\n[${formatTimestamp(event.startedAt)}] Building ${event.programCount} program(s)\n`;
    case 'build-queued':
      return `[${formatTimestamp()}] Build queued for ${labelForUri(event.resourceUri ?? event.workspaceRootUri)}\n`;
    case 'program-started':
      return `[${formatTimestamp()}] Assembling ${formatProgramLabel(event.programName, event.entryUri, event.profileName)}\n`;
    case 'output':
      return event.chunk;
    case 'program-finished':
      return `\n[${formatTimestamp()}] ${formatProgramLabel(event.programName, event.entryUri, event.profileName)} ${event.succeeded ? 'finished' : 'failed'} in ${formatDuration(event.durationMs)}${formatExitCode(event.exitCode)}\n`;
    case 'build-finished':
      return `[${formatTimestamp()}] Build ${event.succeeded ? 'succeeded' : 'failed'} in ${formatDuration(event.durationMs)}\n`;
    default:
      return '';
  }
}

function formatProgramLabel(
  programName: string,
  entryUri: string,
  profileName: string | undefined
): string {
  const profile = profileName ? ` [${profileName}]` : '';
  return `${programName}${profile} (${labelForUri(entryUri)})`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatExitCode(exitCode: number | undefined): string {
  if (typeof exitCode !== 'number') {
    return '';
  }

  return ` (exit ${exitCode})`;
}

function formatTimestamp(isoDate = new Date().toISOString()): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function labelForUri(uri: string): string {
  try {
    return new URI(uri).path.base;
  } catch {
    return uri;
  }
}

function ownerForBuildProgram(entryUri: string): string {
  return `${KICK_ASSEMBLER_BUILD_MARKER_OWNER_PREFIX}:${entryUri}`;
}

function toProblemDiagnostic(
  diagnostic: KickAssemblerCompilerDiagnostic,
  lineText?: string
): Diagnostic {
  const range =
    lineText === undefined
      ? diagnostic.range
      : expandKickAssemblerDiagnosticRange(lineText, diagnostic.range);

  return {
    code: 'kickassembler-build',
    message: diagnostic.message,
    range: {
      start: {
        line: range.start.line,
        character: range.start.character
      },
      end: {
        line: range.end.line,
        character: range.end.character
      }
    },
    severity: toProblemSeverity(diagnostic.severity),
    source: 'Kick Assembler'
  };
}

function toProblemSeverity(
  severity: KickAssemblerCompilerDiagnostic['severity']
): DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
  }

  return DiagnosticSeverity.Information;
}

function filePathToDocumentUri(filePath: string, basePath: string): string {
  if (filePath.includes('://')) {
    return filePath;
  }

  const normalizedPath = resolveFilePath(filePath, basePath);
  if (/^[A-Za-z]:\//u.test(normalizedPath)) {
    return encodeURI(`file:///${normalizedPath}`);
  }

  if (normalizedPath.startsWith('//')) {
    return encodeURI(`file:${normalizedPath}`);
  }

  if (normalizedPath.startsWith('/')) {
    return encodeURI(`file://${normalizedPath}`);
  }

  return encodeURI(`file:///${normalizedPath}`);
}

function resolveFilePath(filePath: string, basePath: string): string {
  const normalizedPath = normalizeFilePath(filePath);
  if (isAbsoluteFilePath(normalizedPath)) {
    return normalizePathSegments(normalizedPath);
  }

  return normalizePathSegments(
    `${normalizeFilePath(basePath).replace(/\/$/u, '')}/${normalizedPath}`
  );
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/');
}

function isAbsoluteFilePath(filePath: string): boolean {
  return (
    filePath.startsWith('/') ||
    filePath.startsWith('//') ||
    /^[A-Za-z]:\//u.test(filePath)
  );
}

function normalizePathSegments(filePath: string): string {
  let prefix = '';
  let pathWithoutPrefix = filePath;

  const windowsDrivePrefix = /^[A-Za-z]:\//u.exec(filePath)?.[0];
  if (windowsDrivePrefix) {
    prefix = windowsDrivePrefix;
    pathWithoutPrefix = filePath.slice(prefix.length);
  } else if (filePath.startsWith('//')) {
    prefix = '//';
    pathWithoutPrefix = filePath.slice(2);
  } else if (filePath.startsWith('/')) {
    prefix = '/';
    pathWithoutPrefix = filePath.slice(1);
  }

  const segments: string[] = [];
  for (const segment of pathWithoutPrefix.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!prefix) {
        segments.push(segment);
      }
      continue;
    }

    segments.push(segment);
  }

  return `${prefix}${segments.join('/')}`;
}
