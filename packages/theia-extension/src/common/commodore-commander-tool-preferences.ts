import {
  PreferenceScope,
  type PreferenceContribution,
  type PreferenceSchema,
  type PreferenceService
} from '@theia/core/lib/common/preferences';
import {
  COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION,
  DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE,
  type CommodoreCommanderViceLaunchMode
} from './commodore-vice-embed';

export const COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE =
  'commodoreCommander.tools.viceExecutable';
export const COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE =
  'commodoreCommander.tools.viceResourcesPath';
export const COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE =
  'commodoreCommander.VICE.runtimePath';
export const COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE =
  'commodoreCommander.VICE.launchMode';
export const COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE =
  'commodoreCommander.vice.runtimePath';
export const COMMODORE_COMMANDER_JAVA_RUNTIME_PREFERENCE =
  'commodoreCommander.tools.javaRuntime';

export interface CommodoreCommanderToolPreferences {
  /**
   * VICE runtime root used by the debug adapter. The Settings UI exposes this
   * as a runtime path because VICE is a suite of machine-specific emulators.
   */
  viceExecutable?: string;
  viceResourcesPath?: string;
  viceLaunchMode: CommodoreCommanderViceLaunchMode;
  javaRuntime?: string;
}

export const COMMODORE_COMMANDER_TOOL_PREFERENCE_SCHEMA: PreferenceSchema = {
  scope: PreferenceScope.Folder,
  title: 'Commodore Commander',
  properties: {
    [COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE]: {
      type: 'string',
      default: '',
      hidden: true,
      description:
        'Legacy VICE emulator command override. Use launch.json viceExecutable for a per-launch override.'
    },
    [COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE]: {
      type: 'string',
      default: '',
      hidden: true,
      description:
        `Legacy VICE resources path. Use ${COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE} instead.`
    },
    [COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE]: {
      type: 'string',
      default: '',
      hidden: true,
      description:
        `Legacy lowercase VICE runtime path. Use ${COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE} instead.`
    },
    [COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE]: {
      type: 'string',
      default: '',
      markdownDescription:
        'External VICE runtime or installation root. Leave empty to use bundled VICE when available, then standard system locations. Set this to override bundled VICE. The directory must contain `share/vice`; when it also contains `bin`, Commodore Commander selects the machine profile emulator such as `x64sc`, `x128`, or `xvic`.',
      description:
        'External VICE runtime or installation root containing share/vice. Leave empty to use bundled VICE when available, then standard system locations.'
    },
    [COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE]: {
      type: 'string',
      enum: ['patchedView', 'externalWindow'],
      default: DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE,
      markdownDescription:
        `Default VICE launch surface. \`patchedView\` uses Commodore Commander's patched VICE ${COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION} frame/input transport when available. \`externalWindow\` launches stock VICE in its own window.`,
      description:
        'Default VICE launch surface: patched embedded view or stock external VICE window.'
    },
    [COMMODORE_COMMANDER_JAVA_RUNTIME_PREFERENCE]: {
      type: 'string',
      default: '',
      description:
        'Java command or absolute path used for Kick Assembler and SIDScore. COMMODORE_COMMANDER_JAVA_RUNTIME and explicit runtime requests take precedence.'
    }
  }
};

export const COMMODORE_COMMANDER_TOOL_PREFERENCE_BINDING:
  PreferenceContribution = {
    schema: COMMODORE_COMMANDER_TOOL_PREFERENCE_SCHEMA
  };

export function getCommodoreCommanderToolPreferences(
  preferenceService: Pick<PreferenceService, 'get'>,
  resourceUri?: string
): CommodoreCommanderToolPreferences {
  const viceResourcesPath = firstConfiguredPreference(
    preferenceService.get<string>(
      COMMODORE_COMMANDER_VICE_RUNTIME_PATH_PREFERENCE,
      '',
      resourceUri
    ),
    preferenceService.get<string>(
      COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE,
      '',
      resourceUri
    ),
    preferenceService.get<string>(
      COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE,
      '',
      resourceUri
    )
  );

  return {
    viceLaunchMode: normalizeViceLaunchMode(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_LAUNCH_MODE_PREFERENCE,
        DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE,
        resourceUri
      )
    ),
    ...optionalPreference(
      'viceExecutable',
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE,
        '',
        resourceUri
      )
    ),
    ...optionalPreference(
      'viceResourcesPath',
      viceResourcesPath
    ),
    ...optionalPreference(
      'javaRuntime',
      preferenceService.get<string>(
        COMMODORE_COMMANDER_JAVA_RUNTIME_PREFERENCE,
        '',
        resourceUri
      )
    )
  };
}

function optionalPreference<K extends keyof CommodoreCommanderToolPreferences>(
  key: K,
  value: string | undefined
): Pick<CommodoreCommanderToolPreferences, K> | Record<string, never> {
  const normalized = value?.trim();
  return normalized
    ? { [key]: normalized } as Pick<CommodoreCommanderToolPreferences, K>
    : {};
}

function firstConfiguredPreference(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function normalizeViceLaunchMode(
  value: string | undefined
): CommodoreCommanderViceLaunchMode {
  const normalized = value?.trim();
  return normalized === 'externalWindow' || normalized === 'patchedView'
    ? normalized
    : DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE;
}
