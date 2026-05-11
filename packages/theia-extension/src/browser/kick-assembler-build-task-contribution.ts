import {
  FrontendApplicationContribution
} from '@theia/core/lib/browser';
import {
  DisposableCollection
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
  TaskContribution,
  TaskProvider,
  TaskResolver,
  TaskProviderRegistry,
  TaskResolverRegistry
} from '@theia/task/lib/browser/task-contribution';
import { TaskDefinitionRegistry } from '@theia/task/lib/browser/task-definition-registry';
import { TaskService } from '@theia/task/lib/browser/task-service';
import {
  PanelKind,
  RevealKind,
  TaskConfiguration,
  TaskInfo,
  TaskOutputPresentation,
  TaskScope,
  TaskWatcher
} from '@theia/task/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorManager } from '@theia/editor/lib/browser';

import {
  KickAssemblerBuildService,
  type KickAssemblerBuildService as KickAssemblerBuildServiceProxy,
  type KickAssemblerProgramSummary,
  type KickAssemblerRunProgramSummary,
  type KickAssemblerWorkspaceBuildConfigurationSummary
} from '../common/kick-assembler-build-service';

export const KICK_ASSEMBLER_BUILD_TASK_TYPE =
  'commodore-kickassembler-build';
export const KICK_ASSEMBLER_BUILD_TASK_NAME = 'build';
export const KICK_ASSEMBLER_BUILD_TASK_SOURCE = 'Commodore Commander';

export interface KickAssemblerBuildTaskConfiguration
  extends TaskConfiguration {
  task: typeof KICK_ASSEMBLER_BUILD_TASK_NAME;
  workspaceRootUri?: string;
  resourceUri?: string;
  programName?: string;
  profileName?: string;
}

export function kickAssemblerBuildTaskLabel(programName: string): string {
  return `Build ${programName}`;
}

export function kickAssemblerBuildPreLaunchTaskName(programName: string): string {
  return `${KICK_ASSEMBLER_BUILD_TASK_SOURCE}: ${kickAssemblerBuildTaskLabel(programName)}`;
}

export function createKickAssemblerBuildPreLaunchTask(
  runProgram: KickAssemblerRunProgramSummary
): string {
  return kickAssemblerBuildPreLaunchTaskName(runProgram.programName);
}

@injectable()
export class KickAssemblerBuildTaskContribution
  implements
    FrontendApplicationContribution,
    TaskContribution,
    TaskProvider,
    TaskResolver
{
  @inject(KickAssemblerBuildService)
  protected readonly buildService!: KickAssemblerBuildServiceProxy;

  @inject(WorkspaceService)
  protected readonly workspaceService!: WorkspaceService;

  @inject(EditorManager)
  protected readonly editorManager!: EditorManager;

  @inject(TaskWatcher)
  protected readonly taskWatcher!: TaskWatcher;

  @inject(TaskService)
  protected readonly taskService!: TaskService;

  @inject(TaskDefinitionRegistry)
  protected readonly taskDefinitionRegistry!: TaskDefinitionRegistry;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  protected readonly toDispose = new DisposableCollection();
  protected readonly runningTaskIds = new Set<number>();

  onStart(): void {
    this.toDispose.push(this.taskDefinitionRegistry.register({
      taskType: KICK_ASSEMBLER_BUILD_TASK_TYPE,
      source: KICK_ASSEMBLER_BUILD_TASK_SOURCE,
      properties: {
        required: ['task'],
        all: ['type', 'task', 'programName', 'profileName'],
        schema: {
          type: 'object',
          required: ['type', 'task'],
          properties: {
            type: {
              type: 'string',
              enum: [KICK_ASSEMBLER_BUILD_TASK_TYPE]
            },
            task: {
              type: 'string',
              enum: [KICK_ASSEMBLER_BUILD_TASK_NAME]
            },
            programName: {
              type: 'string'
            },
            profileName: {
              type: 'string'
            }
          }
        }
      }
    }));
    this.toDispose.push(
      this.taskWatcher.onTaskCreated((taskInfo) =>
        this.handleTaskCreated(taskInfo)
      )
    );
  }

  onStop(): void {
    this.toDispose.dispose();
    this.runningTaskIds.clear();
  }

  registerProviders(providers: TaskProviderRegistry): void {
    this.toDispose.push(
      providers.register(KICK_ASSEMBLER_BUILD_TASK_TYPE, this)
    );
  }

  registerResolvers(resolvers: TaskResolverRegistry): void {
    this.toDispose.push(
      resolvers.registerTaskResolver(KICK_ASSEMBLER_BUILD_TASK_TYPE, this)
    );
  }

  async provideTasks(): Promise<TaskConfiguration[]> {
    await this.workspaceService.ready;
    const roots = this.getCandidateWorkspaceRoots();
    const tasks = await Promise.all(
      roots.map((root) => this.provideWorkspaceTasks(root))
    );
    return tasks.flat();
  }

  protected getCandidateWorkspaceRoots(): URI[] {
    const candidates = this.workspaceService.tryGetRoots()
      .map((root) => root.resource);
    const workspace = this.workspaceService.workspace;
    if (candidates.length === 0 && workspace?.isDirectory) {
      candidates.push(workspace.resource);
    }

    // Debug startup can request tasks before Theia exposes workspace roots.
    const editorUri = this.editorManager.currentEditor?.editor.uri;
    if (candidates.length === 0 && editorUri?.scheme === 'file') {
      candidates.push(editorUri.parent);
    }

    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = candidate.toString();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async resolveTask(taskConfig: TaskConfiguration): Promise<TaskConfiguration> {
    const workspaceRootUri = taskConfig.workspaceRootUri ??
      (typeof taskConfig._scope === 'string' ? taskConfig._scope : undefined);
    return {
      ...this.withTaskDefaults(taskConfig),
      ...(workspaceRootUri ? { workspaceRootUri } : {})
    };
  }

  protected async provideWorkspaceTasks(
    workspaceRootUri: URI
  ): Promise<TaskConfiguration[]> {
    try {
      const configuration = await this.buildService.getWorkspaceBuildConfiguration({
        workspaceRootUri: workspaceRootUri.toString()
      });
      return [
        this.createWorkspaceBuildTask(workspaceRootUri, configuration),
        ...configuration.programs.map((program) =>
          this.createProgramBuildTask(
            workspaceRootUri,
            configuration,
            program
          )
        )
      ];
    } catch (error) {
      console.warn(
        `Unable to provide Kick Assembler build tasks for ${workspaceRootUri.toString()}.`,
        error
      );
      return [];
    }
  }

  protected createWorkspaceBuildTask(
    workspaceRootUri: URI,
    configuration: KickAssemblerWorkspaceBuildConfigurationSummary
  ): TaskConfiguration {
    return this.withTaskDefaults({
      label: 'Build Kick Assembler workspace',
      _scope: workspaceRootUri.toString(),
      workspaceRootUri: workspaceRootUri.toString(),
      profileName: configuration.activeProfileName
    });
  }

  protected createProgramBuildTask(
    workspaceRootUri: URI,
    configuration: KickAssemblerWorkspaceBuildConfigurationSummary,
    program: KickAssemblerProgramSummary
  ): TaskConfiguration {
    return this.withTaskDefaults({
      label: kickAssemblerBuildTaskLabel(program.name),
      _scope: workspaceRootUri.toString(),
      workspaceRootUri: workspaceRootUri.toString(),
      resourceUri: program.entryUri,
      programName: program.name,
      profileName: program.profileName ?? configuration.activeProfileName
    });
  }

  protected withTaskDefaults(
    task: Partial<KickAssemblerBuildTaskConfiguration> & Pick<TaskConfiguration, 'label'>
  ): KickAssemblerBuildTaskConfiguration {
    const originalPresentation = task.presentation ?? {};
    return {
      ...task,
      type: KICK_ASSEMBLER_BUILD_TASK_TYPE,
      task: KICK_ASSEMBLER_BUILD_TASK_NAME,
      _source: KICK_ASSEMBLER_BUILD_TASK_SOURCE,
      source: KICK_ASSEMBLER_BUILD_TASK_SOURCE,
      executionType: 'customExecution',
      group: task.group ?? 'build',
      problemMatcher: task.problemMatcher ?? [],
      presentation: {
        ...TaskOutputPresentation.getDefault(),
        reveal: RevealKind.Silent,
        panel: PanelKind.Dedicated,
        showReuseMessage: false,
        ...originalPresentation
      },
      _scope: task._scope ?? TaskScope.Workspace
    };
  }

  protected handleTaskCreated(taskInfo: TaskInfo): void {
    if (
      this.runningTaskIds.has(taskInfo.taskId) ||
      !isKickAssemblerBuildTaskConfiguration(taskInfo.config)
    ) {
      return;
    }

    this.runningTaskIds.add(taskInfo.taskId);
    void this.executeBuildTask(taskInfo)
      .catch((error) => {
        console.error('Kick Assembler build task failed.', error);
      })
      .finally(() => this.runningTaskIds.delete(taskInfo.taskId));
  }

  protected async executeBuildTask(taskInfo: TaskInfo): Promise<void> {
    const task = taskInfo.config as KickAssemblerBuildTaskConfiguration;
    const workspaceRootUri = this.workspaceRootUri(task);
    if (!workspaceRootUri) {
      await this.completeTask(taskInfo, 1);
      this.messageService.error(
        `Kick Assembler build task '${task.label}' has no workspace root.`
      );
      return;
    }

    try {
      const result = await this.buildService.buildAndWait({
        workspaceRootUri,
        ...(nonEmptyString(task.resourceUri)
          ? { resourceUri: task.resourceUri }
          : {}),
        ...(nonEmptyString(task.profileName)
          ? { profileName: task.profileName }
          : {}),
        ...(nonEmptyString(task.programName)
          ? { programNames: [task.programName] }
          : {})
      });
      await this.completeTask(taskInfo, result.succeeded ? 0 : 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.messageService.error(
        `Kick Assembler build task '${task.label}' failed: ${message}`
      );
      await this.completeTask(taskInfo, 1);
    }
  }

  protected async completeTask(
    taskInfo: TaskInfo,
    exitCode: number
  ): Promise<void> {
    await this.taskService.customExecutionComplete(taskInfo.taskId, exitCode);
  }

  protected workspaceRootUri(
    task: KickAssemblerBuildTaskConfiguration
  ): string | undefined {
    if (nonEmptyString(task.workspaceRootUri)) {
      return task.workspaceRootUri;
    }
    if (typeof task._scope === 'string') {
      return task._scope;
    }
    return undefined;
  }
}

function isKickAssemblerBuildTaskConfiguration(
  task: TaskConfiguration
): task is KickAssemblerBuildTaskConfiguration {
  return task.type === KICK_ASSEMBLER_BUILD_TASK_TYPE &&
    task.task === KICK_ASSEMBLER_BUILD_TASK_NAME;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
