import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IJSONSchema, IJSONSchemaSnippet } from '@theia/core/lib/common/json-schema';
import {
  PreferenceService
} from '@theia/core/lib/common/preferences';
import type { DebugConfiguration } from '@theia/debug/lib/common/debug-configuration';
import type {
  DebugAdapterContribution,
  DebugAdapterExecutable
} from '@theia/debug/lib/common/debug-model';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  KickAssemblerWorkspaceBuildPlanner,
  loadKickAssemblerBuildConfiguration,
  type KickAssemblerBuildProgram
} from '@commodore-commander/language-support';

import { getBundledKickAssemblerJarPath } from './kick-assembler-build-runner';
import {
  createViceArgs,
  resolveViceRuntime,
  resolveViceMachineProfile
} from './vice-runtime-resolver';
import {
  COMMODORE_VICE_DEBUG_TYPE,
  type CommodoreViceDebugConfiguration
} from '../common/commodore-vice-debug';
import {
  COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION,
  DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE
} from '../common/commodore-vice-embed';
import {
  getCommodoreCommanderToolPreferences
} from '../common/commodore-commander-tool-preferences';

@injectable()
export class CommodoreViceDebugAdapterContribution
  implements DebugAdapterContribution
{
  readonly type = COMMODORE_VICE_DEBUG_TYPE;
  readonly label = 'Commodore VICE';
  readonly languages = ['kickassembler'];

  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  private readonly planner = new KickAssemblerWorkspaceBuildPlanner();

  async provideDebugAdapterExecutable(
    _config: DebugConfiguration
  ): Promise<DebugAdapterExecutable> {
    return {
      modulePath: require.resolve('@commodore-commander/debug-adapter/adapter')
    };
  }

  async provideDebugConfigurations(
    workspaceFolderUri?: string
  ): Promise<DebugConfiguration[]> {
    if (!workspaceFolderUri) {
      return [this.fallbackConfiguration()];
    }

    try {
      const workspaceRootPath = fileURLToPath(workspaceFolderUri);
      await this.preferenceService.ready;
      const toolPreferences = getCommodoreCommanderToolPreferences(
        this.preferenceService,
        workspaceFolderUri
      );
      const environment = {
        ...process.env
      };
      if (toolPreferences.javaRuntime && !environment.COMMODORE_COMMANDER_JAVA_RUNTIME) {
        environment.COMMODORE_COMMANDER_JAVA_RUNTIME = toolPreferences.javaRuntime;
      }
      const configuration = await loadKickAssemblerBuildConfiguration(
        workspaceRootPath,
        {
          defaultKickAssemblerJar: getBundledKickAssemblerJarPath(),
          environment
        }
      );
      const plan = await this.planner.planWorkspaceBuild(workspaceRootPath, undefined, {
        configuration
      });
      if (plan.programs.length === 0) {
        return [this.fallbackConfiguration()];
      }
      return plan.programs.map((program) =>
        this.programConfiguration(program, workspaceRootPath)
      );
    } catch {
      return [this.fallbackConfiguration()];
    }
  }

  async resolveDebugConfiguration(
    config: CommodoreViceDebugConfiguration,
    _workspaceFolderUri?: string
  ): Promise<DebugConfiguration | undefined> {
    return config;
  }

  async resolveDebugConfigurationWithSubstitutedVariables(
    config: CommodoreViceDebugConfiguration,
    workspaceFolderUri?: string
  ): Promise<DebugConfiguration | undefined> {
    return this.resolveConfiguration(config, workspaceFolderUri);
  }

  getSchemaAttributes(): IJSONSchema[] {
    return [
      {
        type: 'object',
        required: ['type', 'request', 'name', 'program'],
        properties: {
          type: {
            enum: [COMMODORE_VICE_DEBUG_TYPE]
          },
          request: {
            enum: ['launch']
          },
          name: {
            type: 'string'
          },
          program: {
            type: 'string',
            description: 'Path to the PRG file to start in VICE.'
          },
          debugInfo: {
            type: 'string',
            description: 'Kick Assembler .dbg file used for source breakpoints.'
          },
          sourceRoot: {
            type: 'string',
            description: 'Workspace or source root used to resolve relative paths in Kick Assembler .dbg files.'
          },
          cwd: {
            type: 'string',
            description: 'Working directory for VICE.'
          },
          viceLaunchMode: {
            type: 'string',
            enum: ['patchedView', 'externalWindow'],
            default: DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE,
            description:
              `VICE launch surface. patchedView is the intended default embedded view for compatible patched VICE ${COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION} runtimes; externalWindow launches stock VICE in its own window.`
          },
          viceExecutable: {
            type: 'string',
            description: 'Advanced per-launch VICE emulator command or path. Usually leave unset so the selected machine profile chooses x64sc, x128, xvic, or another matching VICE emulator.'
          },
          viceResourcesPath: {
            type: 'string',
            description: 'Per-launch VICE runtime root containing share/vice. Overrides the Commodore Commander VICE runtime path preference.'
          },
          viceArgs: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Complete VICE command-line arguments. Overrides machine profile defaults and machine.viceArgs.'
          },
          stopOnEntry: {
            type: 'boolean',
            default: true
          },
          machine: {
            type: 'object',
            properties: {
              profile: {
                type: 'string'
              },
              model: {
                type: 'string'
              },
              viceArgs: {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    ];
  }

  getConfigurationSnippets(): IJSONSchemaSnippet[] {
    return [
      {
        label: 'Commodore VICE: Launch PRG',
        body: {
          type: COMMODORE_VICE_DEBUG_TYPE,
          request: 'launch',
          name: 'Debug PRG in VICE',
          program: '${workspaceFolder}/out/program.prg',
          debugInfo: '${workspaceFolder}/out/program.dbg',
          sourceRoot: '${workspaceFolder}',
          machine: {
            profile: 'c64'
          },
          stopOnEntry: true
        }
      }
    ];
  }

  private async resolveConfiguration(
    config: CommodoreViceDebugConfiguration,
    workspaceFolderUri?: string
  ): Promise<DebugConfiguration | undefined> {
    const workspaceRootPath = workspaceFolderUri
      ? fileURLToPath(workspaceFolderUri)
      : process.cwd();
    const program = config.program
      ? path.resolve(workspaceRootPath, config.program)
      : undefined;
    if (!program) {
      return undefined;
    }

    const { profile, launch } = resolveViceMachineProfile(config.machine);
    await this.preferenceService.ready;
    const toolPreferences = getCommodoreCommanderToolPreferences(
      this.preferenceService,
      workspaceFolderUri
    );
    const viceRuntime = await resolveViceRuntime({
      resourcesPath: config.viceResourcesPath
        ? resolveWorkspacePath(workspaceRootPath, config.viceResourcesPath)
        : toolPreferences.viceResourcesPath,
      executable: config.viceExecutable
        ? resolveToolPath(workspaceRootPath, config.viceExecutable)
        : toolPreferences.viceExecutable
    });
    const debugInfo = config.debugInfo
      ? path.resolve(workspaceRootPath, config.debugInfo)
      : replaceExtension(program, '.dbg');

    return {
      ...config,
      type: COMMODORE_VICE_DEBUG_TYPE,
      request: 'launch',
      program,
      debugInfo,
      sourceRoot: config.sourceRoot
        ? path.resolve(workspaceRootPath, config.sourceRoot)
        : workspaceRootPath,
      cwd: config.cwd
        ? path.resolve(workspaceRootPath, config.cwd)
        : path.dirname(program),
      viceResourcesPath: viceRuntime.resourcesPath,
      viceExecutable: viceRuntime.executable ?? profile.vice.executable,
      // TODO: Route patchedView through the patched VICE frame/input transport.
      viceLaunchMode: config.viceLaunchMode ?? toolPreferences.viceLaunchMode,
      viceArgs: config.viceArgs ?? createViceArgs(profile, launch),
      machineName: profile.displayName,
      stopOnEntry: config.stopOnEntry ?? true
    };
  }

  private programConfiguration(
    program: KickAssemblerBuildProgram,
    workspaceRootPath: string
  ): DebugConfiguration {
    const runProgramPath = program.runProgramPath ??
      path.join(program.outputDirectoryPath, `${program.name}.prg`);
    return {
      type: COMMODORE_VICE_DEBUG_TYPE,
      request: 'launch',
      name: `Debug ${program.name} in VICE`,
      program: relativeOrAbsolute(workspaceRootPath, runProgramPath),
      debugInfo: relativeOrAbsolute(workspaceRootPath, replaceExtension(runProgramPath, '.dbg')),
      sourceRoot: relativeOrAbsolute(workspaceRootPath, workspaceRootPath),
      ...(program.machine ? { machine: program.machine } : {}),
      stopOnEntry: true
    };
  }

  private fallbackConfiguration(): DebugConfiguration {
    return {
      type: COMMODORE_VICE_DEBUG_TYPE,
      request: 'launch',
      name: 'Debug PRG in VICE',
      program: '${workspaceFolder}/out/program.prg',
      debugInfo: '${workspaceFolder}/out/program.dbg',
      sourceRoot: '${workspaceFolder}',
      machine: {
        profile: 'c64'
      },
      stopOnEntry: true
    };
  }
}

function replaceExtension(filePath: string, extension: string): string {
  return path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}${extension}`
  );
}

function relativeOrAbsolute(rootPath: string, filePath: string): string {
  const relative = path.relative(rootPath, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : filePath;
}

function resolveWorkspacePath(rootPath: string, filePath: string): string {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(rootPath, filePath);
}

function resolveToolPath(rootPath: string, commandOrPath: string): string {
  return path.isAbsolute(commandOrPath) || /[\\/]/u.test(commandOrPath)
    ? path.resolve(rootPath, commandOrPath)
    : commandOrPath;
}
