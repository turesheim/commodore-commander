import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT,
  matchesCommodoreEmulatorShortcut,
  parseCommodoreEmulatorShortcut,
  resolveCommodoreEmulatorShortcutLabel,
  type CommodoreEmulatorKeyboardEventLike
} from '../browser/commodore-emulator-shortcuts';

test('emulator shortcuts match the default virtual keyboard function key', () => {
  assert.equal(
    matchesCommodoreEmulatorShortcut(
      keyboardEvent({ code: 'F11', key: 'F11', keyCode: 122 }),
      undefined,
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    true
  );
});

test('emulator shortcuts support configurable modifier combinations', () => {
  assert.equal(
    matchesCommodoreEmulatorShortcut(
      keyboardEvent({
        code: 'KeyK',
        key: 'k',
        keyCode: 75,
        altKey: true
      }),
      'Option+K',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    true
  );
  assert.equal(
    matchesCommodoreEmulatorShortcut(
      keyboardEvent({
        code: 'KeyK',
        key: 'k',
        keyCode: 75,
        ctrlKey: true
      }),
      'Option+K',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    false
  );
});

test('emulator shortcuts support shifted function-key combinations', () => {
  assert.equal(
    matchesCommodoreEmulatorShortcut(
      keyboardEvent({
        code: 'F11',
        key: 'F11',
        keyCode: 122,
        shiftKey: true
      }),
      'Shift+F11',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    true
  );
});

test('emulator shortcuts fall back when a configured shortcut is invalid', () => {
  assert.equal(
    matchesCommodoreEmulatorShortcut(
      keyboardEvent({ code: 'F11', key: 'F11', keyCode: 122 }),
      'Ctrl+K+M',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    true
  );
});

test('emulator shortcut parser rejects empty and multi-key shortcuts', () => {
  assert.equal(parseCommodoreEmulatorShortcut(''), undefined);
  assert.equal(parseCommodoreEmulatorShortcut('Ctrl+K+M'), undefined);
});

test('emulator shortcut labels use the effective fallback for invalid settings', () => {
  assert.equal(
    resolveCommodoreEmulatorShortcutLabel(
      'Ctrl+K+M',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
  );
  assert.equal(
    resolveCommodoreEmulatorShortcutLabel(
      ' Option+K ',
      DEFAULT_COMMODORE_EMULATOR_VIRTUAL_KEYBOARD_SHORTCUT
    ),
    'Option+K'
  );
});

function keyboardEvent(
  overrides: Partial<CommodoreEmulatorKeyboardEventLike>
): CommodoreEmulatorKeyboardEventLike {
  return {
    code: 'KeyK',
    key: 'k',
    keyCode: 75,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...overrides
  };
}
