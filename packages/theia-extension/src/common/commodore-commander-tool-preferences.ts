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
export const COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_1_DEVICE_PREFERENCE =
  'commodoreCommander.VICE.embedded.controlPort1Device';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_2_DEVICE_PREFERENCE =
  'commodoreCommander.VICE.embedded.controlPort2Device';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_1_DEVICE_PREFERENCE =
  'commodoreCommander.VICE.embedded.joystick1Device';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_2_DEVICE_PREFERENCE =
  'commodoreCommander.VICE.embedded.joystick2Device';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_PADDLE_PORT_PREFERENCE =
  'commodoreCommander.VICE.embedded.mousePaddlePort';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_GRAB_PREFERENCE =
  'commodoreCommander.VICE.embedded.mouseGrab';
export const COMMODORE_COMMANDER_VICE_EMBEDDED_KEYBOARD_MAPPING_PREFERENCE =
  'commodoreCommander.VICE.embedded.keyboardMapping';
export const COMMODORE_COMMANDER_LEGACY_VICE_RUNTIME_PATH_PREFERENCE =
  'commodoreCommander.vice.runtimePath';
export const COMMODORE_COMMANDER_JAVA_RUNTIME_PREFERENCE =
  'commodoreCommander.tools.javaRuntime';

export type CommodoreViceControlPortDevice =
  | 'default'
  | 'none'
  | 'joystick'
  | 'paddles'
  | 'mouse1351';
export type CommodoreViceJoystickDevice =
  | 'default'
  | 'none'
  | 'numpad'
  | 'keyset1'
  | 'keyset2'
  | 'analog0'
  | 'analog1'
  | 'analog2'
  | 'analog3'
  | 'analog4'
  | 'analog5';
export type CommodoreViceMousePaddlePort = 'off' | '1' | '2';
export type CommodoreViceKeyboardMapping =
  | 'default'
  | 'symbolic'
  | 'positional';

export interface CommodoreViceEmbeddedInputPreferences {
  controlPort1Device: CommodoreViceControlPortDevice;
  controlPort2Device: CommodoreViceControlPortDevice;
  joystick1Device: CommodoreViceJoystickDevice;
  joystick2Device: CommodoreViceJoystickDevice;
  mousePaddlePort: CommodoreViceMousePaddlePort;
  mouseGrab: boolean;
  keyboardMapping: CommodoreViceKeyboardMapping;
}

export interface CommodoreCommanderToolPreferences {
  /**
   * VICE runtime root used by the debug adapter. The Settings UI exposes this
   * as a runtime path because VICE is a suite of machine-specific emulators.
   */
  viceExecutable?: string;
  viceResourcesPath?: string;
  viceLaunchMode: CommodoreCommanderViceLaunchMode;
  viceEmbeddedInput: CommodoreViceEmbeddedInputPreferences;
  javaRuntime?: string;
}

export const COMMODORE_VICE_CONTROL_PORT_DEVICE_VALUES =
  ['default', 'none', 'joystick', 'paddles', 'mouse1351'] as const;
export const COMMODORE_VICE_JOYSTICK_DEVICE_VALUES = [
  'default',
  'none',
  'numpad',
  'keyset1',
  'keyset2',
  'analog0',
  'analog1',
  'analog2',
  'analog3',
  'analog4',
  'analog5'
] as const;
export const COMMODORE_VICE_MOUSE_PADDLE_PORT_VALUES =
  ['off', '1', '2'] as const;
export const COMMODORE_VICE_KEYBOARD_MAPPING_VALUES =
  ['default', 'symbolic', 'positional'] as const;

const VICE_CONTROL_PORT_DEVICE_ARGS:
  Record<Exclude<CommodoreViceControlPortDevice, 'default'>, string> = {
    none: '0',
    joystick: '1',
    paddles: '2',
    mouse1351: '3'
  };

const VICE_JOYSTICK_DEVICE_ARGS:
  Record<Exclude<CommodoreViceJoystickDevice, 'default'>, string> = {
    none: '0',
    numpad: '1',
    keyset1: '2',
    keyset2: '3',
    analog0: '4',
    analog1: '5',
    analog2: '6',
    analog3: '7',
    analog4: '8',
    analog5: '9'
  };

const VICE_KEYBOARD_MAPPING_ARGS:
  Record<Exclude<CommodoreViceKeyboardMapping, 'default'>, string> = {
    symbolic: '0',
    positional: '1'
  };

const COMMODORE_VICE_EMBEDDED_INPUT_PREFERENCES = new Set<string>([
  COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_1_DEVICE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_2_DEVICE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_1_DEVICE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_2_DEVICE_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_PADDLE_PORT_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_GRAB_PREFERENCE,
  COMMODORE_COMMANDER_VICE_EMBEDDED_KEYBOARD_MAPPING_PREFERENCE
]);

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
      enum: ['embedded', 'external'],
      default: DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE,
      markdownDescription:
        `Default VICE launch surface. \`embedded\` uses Commodore Commander's embedded VICE ${COMMODORE_COMMANDER_PATCHED_VICE_BASE_VERSION} frame/input transport when available. \`external\` launches stock VICE in its own window.`,
      description:
        'Default VICE launch surface: embedded VICE view or external VICE window.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_1_DEVICE_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_CONTROL_PORT_DEVICE_VALUES],
      default: 'default',
      description: 'Control port 1 device for the embedded VICE view.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_2_DEVICE_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_CONTROL_PORT_DEVICE_VALUES],
      default: 'default',
      description: 'Control port 2 device for the embedded VICE view.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_1_DEVICE_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_JOYSTICK_DEVICE_VALUES],
      default: 'default',
      description: 'Native joystick source for VICE joystick port 1.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_2_DEVICE_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_JOYSTICK_DEVICE_VALUES],
      default: 'default',
      description: 'Native joystick source for VICE joystick port 2.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_PADDLE_PORT_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_MOUSE_PADDLE_PORT_VALUES],
      default: 'off',
      description: 'Use host mouse input as paddles on a VICE control port.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_GRAB_PREFERENCE]: {
      type: 'boolean',
      default: false,
      hidden: true,
      description:
        'Legacy embedded mouse capture flag. The embedded view captures mouse and keyboard on click.'
    },
    [COMMODORE_COMMANDER_VICE_EMBEDDED_KEYBOARD_MAPPING_PREFERENCE]: {
      type: 'string',
      enum: [...COMMODORE_VICE_KEYBOARD_MAPPING_VALUES],
      default: 'default',
      description:
        'Keyboard mapping mode for embedded VICE: VICE default, symbolic, or positional.'
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
    viceEmbeddedInput: getCommodoreViceEmbeddedInputPreferences(
      preferenceService,
      resourceUri
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

export function getCommodoreViceEmbeddedInputPreferences(
  preferenceService: Pick<PreferenceService, 'get'>,
  resourceUri?: string
): CommodoreViceEmbeddedInputPreferences {
  return {
    controlPort1Device: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_1_DEVICE_PREFERENCE,
        'default',
        resourceUri
      ),
      COMMODORE_VICE_CONTROL_PORT_DEVICE_VALUES,
      'default'
    ),
    controlPort2Device: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_CONTROL_PORT_2_DEVICE_PREFERENCE,
        'default',
        resourceUri
      ),
      COMMODORE_VICE_CONTROL_PORT_DEVICE_VALUES,
      'default'
    ),
    joystick1Device: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_1_DEVICE_PREFERENCE,
        'default',
        resourceUri
      ),
      COMMODORE_VICE_JOYSTICK_DEVICE_VALUES,
      'default'
    ),
    joystick2Device: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_JOYSTICK_2_DEVICE_PREFERENCE,
        'default',
        resourceUri
      ),
      COMMODORE_VICE_JOYSTICK_DEVICE_VALUES,
      'default'
    ),
    mousePaddlePort: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_PADDLE_PORT_PREFERENCE,
        'off',
        resourceUri
      ),
      COMMODORE_VICE_MOUSE_PADDLE_PORT_VALUES,
      'off'
    ),
    mouseGrab: preferenceService.get<boolean>(
      COMMODORE_COMMANDER_VICE_EMBEDDED_MOUSE_GRAB_PREFERENCE,
      false,
      resourceUri
    ) === true,
    keyboardMapping: normalizePreferenceValue(
      preferenceService.get<string>(
        COMMODORE_COMMANDER_VICE_EMBEDDED_KEYBOARD_MAPPING_PREFERENCE,
        'default',
        resourceUri
      ),
      COMMODORE_VICE_KEYBOARD_MAPPING_VALUES,
      'default'
    )
  };
}

export function isCommodoreViceEmbeddedInputPreference(
  preferenceName: string
): boolean {
  return COMMODORE_VICE_EMBEDDED_INPUT_PREFERENCES.has(preferenceName);
}

export function createCommodoreViceEmbeddedInputArgs(
  preferences: CommodoreViceEmbeddedInputPreferences
): string[] {
  const args: string[] = [];
  const controlPort1Device = preferences.mousePaddlePort === '1'
    ? 'paddles'
    : preferences.controlPort1Device;
  const controlPort2Device = preferences.mousePaddlePort === '2'
    ? 'paddles'
    : preferences.controlPort2Device;

  pushControlPortDeviceArgs(args, 1, controlPort1Device);
  pushControlPortDeviceArgs(args, 2, controlPort2Device);
  if (preferences.mousePaddlePort === '1') {
    args.push('-paddles1inputmouse');
  } else if (preferences.mousePaddlePort === '2') {
    args.push('-paddles2inputmouse');
  }
  args.push('-mouse');
  pushJoystickDeviceArgs(args, 1, preferences.joystick1Device);
  pushJoystickDeviceArgs(args, 2, preferences.joystick2Device);
  if (preferences.keyboardMapping !== 'default') {
    args.push('-keymap', VICE_KEYBOARD_MAPPING_ARGS[preferences.keyboardMapping]);
  }
  return args;
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

export function normalizeViceLaunchMode(
  value: string | undefined
): CommodoreCommanderViceLaunchMode {
  const normalized = value?.trim();
  switch (normalized) {
    case 'embedded':
    case 'external':
      return normalized;
    case 'patchedView':
      return 'embedded';
    case 'externalWindow':
      return 'external';
    default:
      return DEFAULT_COMMODORE_COMMANDER_VICE_LAUNCH_MODE;
  }
}

function normalizePreferenceValue<const T extends readonly string[]>(
  value: string | undefined,
  allowedValues: T,
  fallback: T[number]
): T[number] {
  const normalized = value?.trim();
  return allowedValues.some((candidate) => candidate === normalized)
    ? normalized as T[number]
    : fallback;
}

function pushControlPortDeviceArgs(
  args: string[],
  port: 1 | 2,
  device: CommodoreViceControlPortDevice
): void {
  if (device === 'default') {
    return;
  }
  args.push(`-controlport${port}device`, VICE_CONTROL_PORT_DEVICE_ARGS[device]);
}

function pushJoystickDeviceArgs(
  args: string[],
  port: 1 | 2,
  device: CommodoreViceJoystickDevice
): void {
  if (device === 'default') {
    return;
  }
  args.push(`-joydev${port}`, VICE_JOYSTICK_DEVICE_ARGS[device]);
}
