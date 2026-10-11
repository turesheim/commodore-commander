import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import { inject, injectable } from '@theia/core/shared/inversify';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { assertReadable, probeViceRuntime, resolveViceCommand } from '@commodore-commander/vice-runtime';
import { resolveCommodoreMachineProfileId } from '@commodore-commander/language-support';
import type { RuntimeSetupCheck, RuntimeSetupReport, RuntimeSetupService } from '../common/runtime-setup-service';
import { getCommodoreCommanderToolPreferences } from '../common/commodore-commander-tool-preferences';
import { resolveViceMachineProfile, resolveViceRuntime } from './vice-runtime-resolver';
import { getBundledKickAssemblerJarPath, getBundledSidScoreCliJarPathForBuild } from './kick-assembler-build-runner';
import { formatJavaRuntimeTooOldMessage, parseJavaRuntimeVersionOutput, SID_SCORE_REQUIRED_JAVA_RELEASE } from './sidscore-launch';

const execute = promisify(execFile);

@injectable()
export class RuntimeSetupServiceImpl implements RuntimeSetupService {
  @inject(PreferenceService)
  protected readonly preferenceService!: PreferenceService;

  async check(resourceUri?: string): Promise<RuntimeSetupReport> {
    await this.preferenceService.ready;
    const preferences = getCommodoreCommanderToolPreferences(this.preferenceService, resourceUri);
    const machineId = this.preferenceService.get<string>('commodoreCommander.activeMachine', 'c64', resourceUri);
    const checks = await Promise.all([
      this.checkJava(preferences.javaRuntime),
      this.checkAssets(),
      this.checkVice(machineId, preferences.viceResourcesPath, preferences.viceExecutable, preferences.viceLaunchMode === 'embedded')
    ]);
    return {
      platform: `${process.platform}-${process.arch}`,
      machine: machineId ?? 'c64',
      launchMode: preferences.viceLaunchMode,
      checks
    };
  }

  protected async checkJava(configuredCommand?: string): Promise<RuntimeSetupCheck> {
    // Match the SIDScore player's current preference/JAVA_HOME/PATH policy.
    const command = configuredCommand ?? (process.env.JAVA_HOME
      ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
      : 'java');
    try {
      const runtime = await this.probeJava(command);
      if (runtime.major < SID_SCORE_REQUIRED_JAVA_RELEASE) {
        throw new Error(formatJavaRuntimeTooOldMessage(runtime));
      }
      return { name: 'Java', state: 'ready', detail: `${command}\nJava ${runtime.version}` };
    } catch (error) {
      return {
        name: 'Java', state: 'error',
        detail: `${command}\n${errorMessage(error)}\nInstall Java 21+ and set commodoreCommander.tools.javaRuntime to its executable.`
      };
    }
  }

  protected async probeJava(command: string): Promise<ReturnType<typeof parseJavaRuntimeVersionOutput>> {
    const { stdout, stderr } = await execute(command, ['-version'], {
      timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024, windowsHide: true
    });
    return parseJavaRuntimeVersionOutput(`${stdout}\n${stderr}`);
  }

  protected async checkAssets(): Promise<RuntimeSetupCheck> {
    try {
      await Promise.all([
        assertReadable(getBundledKickAssemblerJarPath(), 'Kick Assembler JAR'),
        assertReadable(getBundledSidScoreCliJarPathForBuild(), 'SIDScore JAR')
      ]);
      return { name: 'Bundled tools', state: 'ready', detail: 'Kick Assembler and SIDScore 0.8.0 JARs are readable.' };
    } catch (error) {
      return { name: 'Bundled tools', state: 'error', detail: `${errorMessage(error)}\nReinstall the product if bundled files are missing.` };
    }
  }

  protected async checkVice(machineId: string | undefined, resourcesPath: string | undefined, executable: string | undefined, embedded: boolean): Promise<RuntimeSetupCheck> {
    try {
      const id = resolveCommodoreMachineProfileId(machineId ?? 'c64');
      if (!id) {
        throw new Error(`Unsupported Commodore machine profile: ${machineId}.`);
      }
      const { profile } = resolveViceMachineProfile({ profile: id });
      const runtime = await resolveViceRuntime({ resourcesPath, executable });
      const dataDirectory = await stat(path.join(runtime.resourcesPath, 'share', 'vice')).then(() =>
        path.join(runtime.resourcesPath, 'share', 'vice')
      ).catch(() => runtime.resourcesPath);
      const machineDirectory = path.join(dataDirectory, profile.vice.resourceDirectory);
      if (!(await stat(machineDirectory)).isDirectory()) {
        throw new Error(`VICE machine resources are not a directory: ${machineDirectory}.`);
      }
      const command = await resolveViceCommand(runtime.resourcesPath, runtime.executable ?? profile.vice.executable);
      const result = await this.probeVice(command, embedded);
      return {
        name: 'VICE', state: 'ready',
        detail: `${command}\nResources: ${runtime.resourcesPath}\nVICE ${result.version}; ${embedded ? 'embedded protocol detected' : 'external window selected'}.`
      };
    } catch (error) {
      return {
        name: 'VICE', state: 'error',
        detail: `${errorMessage(error)}\nSet commodoreCommander.VICE.runtimePath to a matching VICE installation. Stock VICE needs commodoreCommander.VICE.launchMode = external.`
      };
    }
  }

  protected probeVice(command: string, embedded: boolean): ReturnType<typeof probeViceRuntime> {
    return probeViceRuntime(command, embedded);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
