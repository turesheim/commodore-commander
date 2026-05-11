import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import type { CommodoreMachineLaunchConfiguration } from '@commodore-commander/language-support/runtime';

export const KickAssemblerBuildServicePath =
  '/services/commodore-commander/kick-assembler-build';

export const KickAssemblerBuildService = Symbol('KickAssemblerBuildService');

export type KickAssemblerRunBuildPolicy = 'always' | 'ifStale' | 'never';

export interface KickAssemblerBuildRequest {
  workspaceRootUri: string;
  resourceUri?: string;
  profileName?: string;
  programNames?: readonly string[];
}

export interface KickAssemblerBuildConfigurationRequest {
  workspaceRootUri: string;
  resourceUri?: string;
}

export interface KickAssemblerRunProgramRequest
  extends KickAssemblerBuildConfigurationRequest {
  profileName?: string;
  programName?: string;
  runName?: string;
}

export interface KickAssemblerSetActiveProfileRequest
  extends KickAssemblerBuildConfigurationRequest {
  profileName: string;
}

export interface KickAssemblerBuildProfileSummary {
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface KickAssemblerProgramSummary {
  name: string;
  entryUri: string;
  outputDirectoryUri: string;
  runProgramUri: string;
  isConfigured: boolean;
  machine: string;
  machineConfiguration?: CommodoreMachineLaunchConfiguration;
  profileName?: string;
}

export interface KickAssemblerRunSummary {
  name: string;
  programName: string;
  build: KickAssemblerRunBuildPolicy;
  machine: string;
  machineConfiguration?: CommodoreMachineLaunchConfiguration;
  runProgramUri?: string;
  profileName?: string;
}

export interface KickAssemblerRunProgramSummary {
  name: string;
  programName: string;
  runName?: string;
  entryUri: string;
  outputDirectoryUri: string;
  runProgramUri: string;
  buildRequired: boolean;
  buildReason?: string;
  buildPolicy: KickAssemblerRunBuildPolicy;
  machine: string;
  machineConfiguration?: CommodoreMachineLaunchConfiguration;
  profileName?: string;
}

export interface KickAssemblerWorkspaceBuildConfigurationSummary {
  workspaceRootUri: string;
  configUri: string;
  activeProfileName: string;
  profiles: readonly KickAssemblerBuildProfileSummary[];
  programs: readonly KickAssemblerProgramSummary[];
  runs: readonly KickAssemblerRunSummary[];
  created: boolean;
}

export interface KickAssemblerBuildRequestResult {
  queued: boolean;
}

export interface KickAssemblerBuildExecutionResult
  extends KickAssemblerBuildRequestResult {
  succeeded: boolean;
  builtProgramUris: readonly string[];
}

export interface KickAssemblerBuildStartedEvent {
  type: 'build-started';
  buildId: string;
  workspaceRootUri: string;
  resourceUri?: string;
  programCount: number;
  startedAt: string;
}

export interface KickAssemblerBuildQueuedEvent {
  type: 'build-queued';
  workspaceRootUri: string;
  resourceUri?: string;
}

export interface KickAssemblerProgramStartedEvent {
  type: 'program-started';
  buildId: string;
  programName: string;
  profileName?: string;
  entryUri: string;
  command: string;
  args: readonly string[];
  cwd: string;
  outputDirectoryUri: string;
}

export interface KickAssemblerBuildOutputEvent {
  type: 'output';
  buildId: string;
  stream: 'stdout' | 'stderr' | 'system';
  chunk: string;
}

export interface KickAssemblerProgramFinishedEvent {
  type: 'program-finished';
  buildId: string;
  programName: string;
  profileName?: string;
  entryUri: string;
  succeeded: boolean;
  exitCode?: number;
  durationMs: number;
}

export interface KickAssemblerBuildFinishedEvent {
  type: 'build-finished';
  buildId: string;
  succeeded: boolean;
  durationMs: number;
  programCount: number;
  builtProgramUris: readonly string[];
}

export type KickAssemblerBuildEvent =
  | KickAssemblerBuildStartedEvent
  | KickAssemblerBuildQueuedEvent
  | KickAssemblerProgramStartedEvent
  | KickAssemblerBuildOutputEvent
  | KickAssemblerProgramFinishedEvent
  | KickAssemblerBuildFinishedEvent;

export interface KickAssemblerBuildClient {
  onBuildEvent(event: KickAssemblerBuildEvent): void;
}

export interface KickAssemblerBuildService
  extends RpcServer<KickAssemblerBuildClient> {
  build(
    request: KickAssemblerBuildRequest
  ): Promise<KickAssemblerBuildRequestResult>;
  buildAndWait(
    request: KickAssemblerBuildRequest
  ): Promise<KickAssemblerBuildExecutionResult>;
  getWorkspaceBuildConfiguration(
    request: KickAssemblerBuildConfigurationRequest
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary>;
  getRunProgram(
    request: KickAssemblerRunProgramRequest
  ): Promise<KickAssemblerRunProgramSummary>;
  setActiveBuildProfile(
    request: KickAssemblerSetActiveProfileRequest
  ): Promise<KickAssemblerWorkspaceBuildConfigurationSummary>;
}
