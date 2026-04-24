import type { DebugConfiguration } from '@theia/debug/lib/common/debug-configuration';
import type { CommodoreMachineLaunchConfiguration } from '@commodore-commander/language-support/runtime';

export const COMMODORE_VICE_DEBUG_TYPE = 'commodore-vice';

export interface CommodoreViceDebugConfiguration extends DebugConfiguration {
  program?: string;
  debugInfo?: string;
  sourceRoot?: string;
  cwd?: string;
  machine?: CommodoreMachineLaunchConfiguration;
  viceResourcesPath?: string;
  viceExecutable?: string;
  viceArgs?: readonly string[];
  machineName?: string;
  stopOnEntry?: boolean;
}
