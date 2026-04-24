import { ConfirmDialog } from '@theia/core/lib/browser';
import {
  CommandContribution,
  CommandRegistry
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
  PreferenceScope,
  PreferenceService
} from '@theia/core/lib/common/preferences';
import URI from '@theia/core/lib/common/uri';
import { DebugConfigurationManager } from '@theia/debug/lib/browser/debug-configuration-manager';
import { DebugCommands } from '@theia/debug/lib/browser/debug-frontend-application-contribution';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import {
  DebugSessionOptions,
  type DebugConfigurationSessionOptions
} from '@theia/debug/lib/browser/debug-session-options';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  applyEdits,
  modify,
  parse,
  type ParseError
} from 'jsonc-parser';

import {
  COMMODORE_VICE_DEBUG_TYPE,
  type CommodoreViceDebugConfiguration
} from '../common/commodore-vice-debug';
import {
  KickAssemblerBuildService,
  type KickAssemblerBuildService as KickAssemblerBuildServiceProxy,
  type KickAssemblerRunProgramSummary
} from '../common/kick-assembler-build-service';
import {
  CommodoreMachineProfileSelectionService
} from './commodore-machine-profile-selection';
import { isKickAssemblerFileExtension } from './kick-assembler-file-associations';

const LAUNCH_JSON_SECTION = 'launch';
const DEFAULT_LAUNCH_VERSION = '0.2.0';

@injectable()
export class CommodoreViceLaunchConfigurationContribution
  implements CommandContribution
{
  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(DebugConfigurationManager)
  protected readonly debugConfigurations!: DebugConfigurationManager;

  @inject(DebugSessionManager)
  protected readonly debugSessionManager!: DebugSessionManager;

  @inject(FileService)
  protected readonly fileService!: FileService;

  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(KickAssemblerBuildService)
  protected readonly buildService!: KickAssemblerBuildServiceProxy;

  @inject(CommodoreMachineProfileSelectionService)
  protected readonly machineProfileSelection!: CommodoreMachineProfileSelectionService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerHandler(DebugCommands.START.id, {
      execute: () => this.startFromActiveAssembler(false),
      isEnabled: (config?: unknown) =>
        !DebugSessionOptions.is(config) &&
        Boolean(this.getActiveAssemblerContext())
    });
    commands.registerHandler(DebugCommands.START_NO_DEBUG.id, {
      execute: () => this.startFromActiveAssembler(true),
      isEnabled: (config?: unknown) =>
        !DebugSessionOptions.is(config) &&
        Boolean(this.getActiveAssemblerContext())
    });
  }

  protected async startFromActiveAssembler(noDebug: boolean): Promise<void> {
    const context = this.getActiveAssemblerContext();
    if (!context) {
      return;
    }

    try {
      const runProgram = await this.buildService.getRunProgram({
        workspaceRootUri: context.workspaceRootUri.toString(),
        resourceUri: context.resourceUri.toString()
      });
      const existing = await this.findExistingLaunchConfiguration(
        runProgram,
        context.workspaceRootUri
      );
      const options = existing ??
        await this.offerToCreateLaunchConfiguration(
          runProgram,
          context.workspaceRootUri,
          context.resourceUri
        );

      if (!options) {
        return;
      }

      await this.debugSessionManager.start(
        this.withNoDebug(options, noDebug)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.messageService.error(`Could not start VICE debug session: ${message}`);
    }
  }

  async startProgram(programUri: URI, noDebug: boolean): Promise<void> {
    if (programUri.scheme !== 'file') {
      throw new Error('VICE can only launch local PRG files.');
    }

    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(programUri);
    const configuration = this.createDirectProgramLaunchConfiguration(
      programUri,
      noDebug
    );
    await this.debugSessionManager.start({
      name: configuration.name,
      configuration,
      ...(workspaceRootUri
        ? { workspaceFolderUri: workspaceRootUri.toString() }
        : {})
    });
  }

  protected getActiveAssemblerContext():
    | { resourceUri: URI; workspaceRootUri: URI }
    | undefined {
    const resourceUri = this.editorManager.currentEditor?.editor.uri;
    if (!resourceUri || resourceUri.scheme !== 'file') {
      return undefined;
    }
    if (!isKickAssemblerFileExtension(resourceUri.path.ext)) {
      return undefined;
    }
    const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
    if (!workspaceRootUri) {
      return undefined;
    }
    return { resourceUri, workspaceRootUri };
  }

  protected async findExistingLaunchConfiguration(
    runProgram: KickAssemblerRunProgramSummary,
    workspaceRootUri: URI
  ): Promise<DebugConfigurationSessionOptions | undefined> {
    const expectedProgramPath = this.toComparableProgramPath(
      new URI(runProgram.runProgramUri).toString(),
      workspaceRootUri
    );
    if (!expectedProgramPath) {
      return undefined;
    }

    const options = Array.from(await this.debugConfigurations.supported);
    return options.find((candidate): candidate is DebugConfigurationSessionOptions => {
      if (!DebugSessionOptions.isConfiguration(candidate)) {
        return false;
      }
      const configuration = candidate.configuration as CommodoreViceDebugConfiguration;
      return configuration.type === COMMODORE_VICE_DEBUG_TYPE &&
        configuration.request === 'launch' &&
        this.toComparableProgramPath(configuration.program, workspaceRootUri) ===
          expectedProgramPath;
    });
  }

  protected async offerToCreateLaunchConfiguration(
    runProgram: KickAssemblerRunProgramSummary,
    workspaceRootUri: URI,
    resourceUri: URI
  ): Promise<DebugConfigurationSessionOptions | undefined> {
    const launchUri = this.getLaunchJsonUri(workspaceRootUri);
    const launchExists = await this.fileService.exists(launchUri);
    const action = launchExists ? 'add a VICE launch configuration to' : 'create';
    const confirmed = await new ConfirmDialog({
      title: 'Commodore VICE Launch Configuration',
      msg: `No VICE launch configuration exists for ${resourceUri.path.base}. ` +
        `Do you want to ${action} ${launchUri.path.toString()} and start this program?`,
      ok: 'Create and Start',
      cancel: 'Cancel'
    }).open();
    if (!confirmed) {
      return undefined;
    }

    const existingNames = new Set(
      Array.from(await this.debugConfigurations.supported)
        .filter(DebugSessionOptions.isConfiguration)
        .map((option) => option.configuration.name)
    );
    const configuration = this.createLaunchConfiguration(
      runProgram,
      workspaceRootUri,
      existingNames
    );
    await this.writeLaunchConfiguration(launchUri, configuration);

    return {
      name: configuration.name,
      configuration,
      workspaceFolderUri: workspaceRootUri.toString()
    };
  }

  protected createLaunchConfiguration(
    runProgram: KickAssemblerRunProgramSummary,
    workspaceRootUri: URI,
    existingNames: ReadonlySet<string>
  ): CommodoreViceDebugConfiguration {
    const program = this.toWorkspaceLaunchPath(
      new URI(runProgram.runProgramUri),
      workspaceRootUri
    );
    return {
      type: COMMODORE_VICE_DEBUG_TYPE,
      request: 'launch',
      name: this.uniqueConfigurationName(
        `Debug ${runProgram.programName} in VICE`,
        existingNames
      ),
      program,
      debugInfo: replaceExtension(program, '.dbg'),
      sourceRoot: '${workspaceFolder}',
      ...(runProgram.machineConfiguration
        ? { machine: runProgram.machineConfiguration }
        : {}),
      stopOnEntry: true
    };
  }

  protected createDirectProgramLaunchConfiguration(
    programUri: URI,
    noDebug: boolean
  ): CommodoreViceDebugConfiguration {
    const programPath = programUri.path.toString();
    const programName = programUri.path.base;
    return {
      type: COMMODORE_VICE_DEBUG_TYPE,
      request: 'launch',
      name: `${noDebug ? 'Run' : 'Debug'} ${programName} in VICE`,
      program: programPath,
      debugInfo: replaceExtension(programPath, '.dbg'),
      sourceRoot: this.workspaceService.getWorkspaceRootUri(programUri)
        ?.path.toString() ?? programUri.parent.path.toString(),
      machine: this.machineProfileSelection.getActiveMachineConfiguration(
        programUri
      ),
      stopOnEntry: !noDebug
    };
  }

  protected async writeLaunchConfiguration(
    launchUri: URI,
    configuration: CommodoreViceDebugConfiguration
  ): Promise<void> {
    const exists = await this.fileService.exists(launchUri);
    const currentContent = exists
      ? (await this.fileService.read(launchUri, { acceptTextOnly: true })).value
      : '';
    const nextContent = this.withLaunchConfiguration(
      currentContent,
      configuration
    );

    await this.fileService.createFolder(launchUri.parent);
    await this.fileService.write(launchUri, nextContent);
  }

  protected withLaunchConfiguration(
    content: string,
    configuration: CommodoreViceDebugConfiguration
  ): string {
    if (!content.trim()) {
      return `${JSON.stringify({
        version: DEFAULT_LAUNCH_VERSION,
        configurations: [configuration]
      }, null, 2)}\n`;
    }

    const errors: ParseError[] = [];
    const parsed = parse(content, errors, { allowTrailingComma: true });
    if (errors.length > 0 || !isRecord(parsed)) {
      throw new Error('launch.json is not a valid JSON object.');
    }

    const targetPath = Array.isArray(parsed.configurations)
      ? ['configurations', -1]
      : ['configurations'];
    const value = Array.isArray(parsed.configurations)
      ? configuration
      : [configuration];
    const edits = modify(content, targetPath, value, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: '\n'
      },
      isArrayInsertion: Array.isArray(parsed.configurations)
    });
    const updated = applyEdits(content, edits);
    return updated.endsWith('\n') ? updated : `${updated}\n`;
  }

  protected getLaunchJsonUri(workspaceRootUri: URI): URI {
    return this.preferenceService.getConfigUri(
      PreferenceScope.Folder,
      workspaceRootUri.toString(),
      LAUNCH_JSON_SECTION
    ) ?? workspaceRootUri.resolve('.theia').resolve('launch.json');
  }

  protected toWorkspaceLaunchPath(resourceUri: URI, workspaceRootUri: URI): string {
    const relativePath = workspaceRootUri.path.relative(resourceUri.path);
    if (relativePath) {
      return `\${workspaceFolder}/${relativePath.toString()}`;
    }
    return resourceUri.toString();
  }

  protected toComparableProgramPath(
    program: string | undefined,
    workspaceRootUri: URI
  ): string | undefined {
    if (!program) {
      return undefined;
    }

    const normalizedProgram = program.trim().replace(/\\/gu, '/');
    const workspaceVariableMatch = /^\$\{workspaceFolder(?::[^}]*)?\}(?:\/(.*))?$/u
      .exec(normalizedProgram);
    if (workspaceVariableMatch) {
      const relativePath = workspaceVariableMatch[1] ?? '';
      return normalizeComparablePath(
        workspaceRootUri.resolve(relativePath).path.toString()
      );
    }

    const uri = new URI(normalizedProgram);
    if (uri.scheme === 'file') {
      return normalizeComparablePath(uri.path.toString());
    }

    if (normalizedProgram.startsWith('/')) {
      return normalizeComparablePath(normalizedProgram);
    }

    return normalizeComparablePath(
      workspaceRootUri.resolve(normalizedProgram).path.toString()
    );
  }

  protected uniqueConfigurationName(
    baseName: string,
    existingNames: ReadonlySet<string>
  ): string {
    if (!existingNames.has(baseName)) {
      return baseName;
    }
    for (let index = 2; ; index += 1) {
      const candidate = `${baseName} ${index}`;
      if (!existingNames.has(candidate)) {
        return candidate;
      }
    }
  }

  protected withNoDebug(
    options: DebugConfigurationSessionOptions,
    noDebug: boolean
  ): DebugConfigurationSessionOptions {
    return {
      ...options,
      configuration: {
        ...options.configuration,
        noDebug
      }
    };
  }
}

function replaceExtension(filePath: string, extension: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  const lastDot = filePath.lastIndexOf('.');
  const extensionStart = lastDot > lastSlash ? lastDot : filePath.length;
  return `${filePath.slice(0, extensionStart)}${extension}`;
}

function normalizeComparablePath(filePath: string): string {
  return filePath.replace(/\/+/gu, '/').replace(/\/$/u, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
