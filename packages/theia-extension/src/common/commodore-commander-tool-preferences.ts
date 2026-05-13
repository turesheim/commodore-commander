import {
  PreferenceScope,
  type PreferenceContribution,
  type PreferenceSchema,
  type PreferenceService
} from '@theia/core/lib/common/preferences';

export const COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE =
  'commodoreCommander.tools.viceExecutable';
export const COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE =
  'commodoreCommander.tools.viceResourcesPath';
export const COMMODORE_COMMANDER_JAVA_RUNTIME_PREFERENCE =
  'commodoreCommander.tools.javaRuntime';

export interface CommodoreCommanderToolPreferences {
  viceExecutable?: string;
  viceResourcesPath?: string;
  javaRuntime?: string;
}

export const COMMODORE_COMMANDER_TOOL_PREFERENCE_SCHEMA: PreferenceSchema = {
  scope: PreferenceScope.Folder,
  title: 'Commodore Commander Tools',
  properties: {
    [COMMODORE_COMMANDER_VICE_EXECUTABLE_PREFERENCE]: {
      type: 'string',
      default: '',
      description:
        'VICE executable command or absolute path. Leave empty to use the bundled emulator when available, otherwise the machine profile executable name.'
    },
    [COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE]: {
      type: 'string',
      default: '',
      description:
        'VICE runtime resources root containing share/vice and, for bundled archives, bin. Leave empty to use the bundled platform runtime when available.'
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
  return {
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
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_RESOURCES_PATH_PREFERENCE,
        '',
        resourceUri
      )
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
