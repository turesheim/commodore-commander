import type { DebugConfiguration } from '@theia/debug/lib/common/debug-configuration';
import type { CommodoreMachineLaunchConfiguration } from '@commodore-commander/language-support/runtime';
import type { CommodoreCommanderViceLaunchMode } from './commodore-vice-embed';

export const COMMODORE_VICE_DEBUG_TYPE = 'commodore-vice';

export interface CommodoreViceDebugConfiguration extends DebugConfiguration {
  program?: string;
  debugInfo?: string;
  sourceRoot?: string;
  cwd?: string;
  machine?: CommodoreMachineLaunchConfiguration;
  viceLaunchMode?: CommodoreCommanderViceLaunchMode;
  viceResourcesPath?: string;
  viceExecutable?: string;
  viceArgs?: readonly string[];
  machineName?: string;
  stopOnEntry?: boolean;
}
