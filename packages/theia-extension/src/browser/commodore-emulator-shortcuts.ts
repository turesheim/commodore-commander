import {
  PreferenceScope,
  type PreferenceContribution,
  type PreferenceSchema
} from '@theia/core/lib/common/preferences';

export const COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT_PREFERENCE =
  'commodoreCommander.emulator.virtualKeyboardShortcut';
export const COMMODORE_EMULATOR_VICE_MENU_SHORTCUT_PREFERENCE =
  'commodoreCommander.emulator.viceMenuShortcut';

export const DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT = 'F11';
export const DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT = 'F12';

export const COMMODORE_EMULATOR_SHORTCUT_PREFERENCE_SCHEMA: PreferenceSchema = {
  scope: PreferenceScope.User,
  title: 'Commodore Commander',
  properties: {
    [COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT_PREFERENCE]: {
      type: 'string',
      default: DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT,
      description:
        'Shortcut that toggles the embedded emulator virtual keyboard when an emulator is running. Examples: F11, Ctrl+K, Option+K.'
    },
    [COMMODORE_EMULATOR_VICE_MENU_SHORTCUT_PREFERENCE]: {
      type: 'string',
      default: DEFAULT_COMMODORE_EMULATOR_VICE_MENU_SHORTCUT,
      description:
        'Shortcut that opens the embedded VICE menu when the emulator has focus. Examples: F12, Ctrl+M, Option+M.'
    }
  }
};

export const COMMODORE_EMULATOR_SHORTCUT_PREFERENCE_BINDING:
  PreferenceContribution = {
    schema: COMMODORE_EMULATOR_SHORTCUT_PREFERENCE_SCHEMA
  };

export interface CommodoreEmulatorKeyboardEventLike {
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface ParsedEmulatorShortcut {
  readonly key: string;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
}

const FUNCTION_KEY_CODES = new Map<string, number>(
  Array.from({ length: 24 }, (_unused, index) => {
    const number = index + 1;
    return [`F${number}`, 111 + number] as const;
  })
);

const NAMED_KEY_CODES: Record<string, readonly string[]> = {
  backspace: ['Backspace'],
  delete: ['Delete'],
  down: ['ArrowDown'],
  end: ['End'],
  enter: ['Enter', 'NumpadEnter'],
  escape: ['Escape'],
  esc: ['Escape'],
  home: ['Home'],
  insert: ['Insert'],
  left: ['ArrowLeft'],
  pagedown: ['PageDown'],
  pageup: ['PageUp'],
  return: ['Enter', 'NumpadEnter'],
  right: ['ArrowRight'],
  space: ['Space'],
  tab: ['Tab'],
  up: ['ArrowUp']
};

const MODIFIER_ALIASES: Record<string, keyof Omit<ParsedEmulatorShortcut, 'key'>> = {
  alt: 'alt',
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  ctrl: 'ctrl',
  meta: 'meta',
  option: 'alt',
  shift: 'shift'
};

export function matchesCommodoreEmulatorShortcut(
  event: CommodoreEmulatorKeyboardEventLike,
  configuredShortcut: unknown,
  fallbackShortcut: string
): boolean {
  const shortcut =
    parseCommodoreEmulatorShortcut(configuredShortcut) ??
    parseCommodoreEmulatorShortcut(fallbackShortcut);
  if (!shortcut) {
    return false;
  }

  return event.shiftKey === shortcut.shift &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta &&
    matchesShortcutKey(event, shortcut.key);
}

export function resolveCommodoreEmulatorShortcutLabel(
  configuredShortcut: unknown,
  fallbackShortcut: string
): string {
  return parseCommodoreEmulatorShortcut(configuredShortcut) &&
    typeof configuredShortcut === 'string'
    ? configuredShortcut.trim()
    : fallbackShortcut;
}

export function parseCommodoreEmulatorShortcut(
  value: unknown
): ParsedEmulatorShortcut | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const tokens = value.split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return undefined;
  }

  let key: string | undefined;
  const modifiers = {
    shift: false,
    ctrl: false,
    alt: false,
    meta: false
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier) {
      modifiers[modifier] = true;
      continue;
    }
    if (key) {
      return undefined;
    }
    key = normalizeShortcutKey(token);
  }

  return key
    ? { key, ...modifiers }
    : undefined;
}

function normalizeShortcutKey(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return /^F\d{1,2}$/u.test(upper)
    ? upper
    : trimmed;
}

function matchesShortcutKey(
  event: CommodoreEmulatorKeyboardEventLike,
  shortcutKey: string
): boolean {
  const functionKeyCode = FUNCTION_KEY_CODES.get(shortcutKey);
  if (functionKeyCode !== undefined) {
    return event.code === shortcutKey ||
      event.key === shortcutKey ||
      event.keyCode === functionKeyCode;
  }

  const lower = shortcutKey.toLowerCase();
  const namedCodes = NAMED_KEY_CODES[lower];
  if (namedCodes) {
    return namedCodes.includes(event.code) ||
      namedCodes.some((code) => code.toLowerCase() === event.key.toLowerCase());
  }

  if (/^[a-z]$/u.test(lower)) {
    return event.code.toLowerCase() === `key${lower}` ||
      event.key.toLowerCase() === lower;
  }

  return event.key.toLowerCase() === lower ||
    event.code.toLowerCase() === lower;
}
