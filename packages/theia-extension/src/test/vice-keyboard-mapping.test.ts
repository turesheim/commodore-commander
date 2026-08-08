import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createViceEmbedKeyEvent,
  isViceEmbedCommodoreFunctionKeyEvent,
  type ViceEmbedKeyboardEventLike
} from '../browser/vice-keyboard-mapping';

test('VICE keyboard mapping translates double quote through the C64 shifted 2 key', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Quote',
      key: '"',
      keyCode: 222,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.key, '"');
  assert.equal(event.sdlKeyCode, 50);
  assert.equal(event.sdlShift, false);
  assert.deepEqual(matrixKey(event), { row: 7, col: 3, shift: true });
  assert.equal(event.keyCode, 222);
  assert.equal(event.shift, true);
});

test('VICE keyboard mapping maps visible digit 0 to C64 digit 0', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit0',
      key: '0',
      keyCode: 48
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 48);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping maps visible equals to C64 equals even from Shift+0', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit0',
      key: '=',
      keyCode: 48,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 61);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping falls back from shifted Digit2 to the C64 shifted 2 key', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit2',
      key: '2',
      keyCode: 50,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 50);
  assert.equal(event.sdlShift, false);
  assert.deepEqual(matrixKey(event), { row: 7, col: 3, shift: true });
});

test('VICE keyboard mapping falls back from shifted Digit0 to C64 equals', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit0',
      key: '0',
      keyCode: 48,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 61);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping falls back from shifted Digit7 to C64 slash', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit7',
      key: '7',
      keyCode: 55,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 47);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping synthesizes C64 Shift for visible shifted number-row symbols', () => {
  const cases = [
    { code: 'Digit1', key: '!', keyCode: 49, sdlKeyCode: 49, matrix: { row: 7, col: 0, shift: true } },
    { code: 'Digit2', key: '"', keyCode: 50, sdlKeyCode: 50, matrix: { row: 7, col: 3, shift: true } },
    { code: 'Digit3', key: '#', keyCode: 51, sdlKeyCode: 51, matrix: { row: 1, col: 0, shift: true } },
    { code: 'Digit4', key: '$', keyCode: 52, sdlKeyCode: 52, matrix: { row: 1, col: 3, shift: true } },
    { code: 'Digit4', key: '¤', keyCode: 52, sdlKeyCode: 52, matrix: { row: 1, col: 3, shift: true } },
    { code: 'Digit5', key: '%', keyCode: 53, sdlKeyCode: 53, matrix: { row: 2, col: 0, shift: true } },
    { code: 'Digit6', key: '&', keyCode: 54, sdlKeyCode: 54, matrix: { row: 2, col: 3, shift: true } },
    { code: 'Digit8', key: '(', keyCode: 56, sdlKeyCode: 56, matrix: { row: 3, col: 3, shift: true } },
    { code: 'Digit9', key: ')', keyCode: 57, sdlKeyCode: 57, matrix: { row: 4, col: 0, shift: true } }
  ];

  for (const item of cases) {
    const event = createViceEmbedKeyEvent(
      keyboardEvent({
        code: item.code,
        key: item.key,
        keyCode: item.keyCode,
        shiftKey: true
      }),
      true
    );

    assert.equal(event.sdlKeyCode, item.sdlKeyCode, item.key);
    assert.equal(event.sdlShift, false, item.key);
    assert.deepEqual(matrixKey(event), item.matrix, item.key);
  }
});

test('VICE keyboard mapping falls back from shifted number-row positions to intended C64 symbols', () => {
  const cases = [
    { code: 'Digit1', key: '1', keyCode: 49, sdlKeyCode: 49, matrix: { row: 7, col: 0, shift: true } },
    { code: 'Digit3', key: '3', keyCode: 51, sdlKeyCode: 51, matrix: { row: 1, col: 0, shift: true } },
    { code: 'Digit4', key: '4', keyCode: 52, sdlKeyCode: 52, matrix: { row: 1, col: 3, shift: true } },
    { code: 'Digit5', key: '5', keyCode: 53, sdlKeyCode: 53, matrix: { row: 2, col: 0, shift: true } },
    { code: 'Digit6', key: '6', keyCode: 54, sdlKeyCode: 54, matrix: { row: 2, col: 3, shift: true } },
    { code: 'Digit8', key: '8', keyCode: 56, sdlKeyCode: 56, matrix: { row: 3, col: 3, shift: true } },
    { code: 'Digit9', key: '9', keyCode: 57, sdlKeyCode: 57, matrix: { row: 4, col: 0, shift: true } }
  ];

  for (const item of cases) {
    const event = createViceEmbedKeyEvent(
      keyboardEvent({
        code: item.code,
        key: item.key,
        keyCode: item.keyCode,
        shiftKey: true
      }),
      true
    );

    assert.equal(event.sdlKeyCode, item.sdlKeyCode, item.key);
    assert.equal(event.sdlShift, false, item.key);
    assert.deepEqual(matrixKey(event), item.matrix, item.key);
  }
});

test('VICE keyboard mapping does not send printable characters as PETSCII bytes', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Quote',
      key: '"',
      keyCode: 222,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 50);
  assert.notEqual(event.sdlKeyCode, '"'.charCodeAt(0));
});

test('VICE keyboard mapping distinguishes single quote from double quote', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Quote',
      key: "'",
      keyCode: 222
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 39);
  assert.equal(event.sdlShift, false);
  assert.equal(event.keyCode, 222);
  assert.equal(event.shift, false);
});

test('VICE keyboard mapping uses produced printable character for layout symbols', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit2',
      key: '@',
      keyCode: 50,
      altKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 50);
  assert.equal(event.sdlShift, true);
  assert.equal(event.sdlAlt, false);
  assert.equal(event.keyCode, 50);
  assert.equal(event.alt, true);
});

test('VICE keyboard mapping translates punctuation that DOM keyCode cannot represent directly', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Minus',
      key: '_',
      keyCode: 189,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 45);
  assert.equal(event.sdlShift, true);
  assert.equal(event.keyCode, 189);
});

test('VICE keyboard mapping maps visible slash to C64 slash even from Shift+7', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit7',
      key: '/',
      keyCode: 55,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 47);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping maps visible semicolon from Shift+Comma without C64 shift', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Comma',
      key: ';',
      keyCode: 188,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 59);
  assert.equal(event.sdlShift, false);
  assert.equal(event.shift, true);
});

test('VICE keyboard mapping keeps host Shift and right Option from latching C64 keys', () => {
  const shift = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'ShiftLeft',
      key: 'Shift',
      keyCode: 16,
      shiftKey: true
    }),
    true
  );
  const option = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'AltRight',
      key: 'Alt',
      keyCode: 18,
      altKey: true
    }),
    true
  );

  assert.equal(shift.sdlKeyCode, 0);
  assert.equal(shift.sdlShift, false);
  assert.equal(option.sdlKeyCode, 0);
  assert.equal(option.sdlAlt, false);
});

test('VICE keyboard mapping maps left Option to the C64 Commodore key', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'AltLeft',
      key: 'Alt',
      keyCode: 18,
      altKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 9);
  assert.equal(event.sdlAlt, false);
  assert.deepEqual(matrixKey(event), { row: 7, col: 5, shift: false });
});

test('VICE keyboard mapping keeps legacy DOM keyCode for letters', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'KeyA',
      key: 'a',
      keyCode: 65
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 97);
  assert.equal(event.sdlShift, false);
  assert.equal(event.keyCode, 65);
});

test('VICE keyboard mapping normalizes shifted letters to typed Commodore letters', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'KeyA',
      key: 'A',
      keyCode: 65,
      shiftKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 97);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping suppresses unsupported printable host characters', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Semicolon',
      key: 'ø',
      keyCode: 186
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 0);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping suppresses dead keys instead of falling back to keyCode', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'BracketRight',
      key: 'Dead',
      keyCode: 221
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 0);
  assert.equal(event.sdlShift, false);
});

test('VICE keyboard mapping translates visible pound sign to C64 pound', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Digit3',
      key: '£',
      keyCode: 51,
      altKey: true
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 92);
  assert.equal(event.sdlAlt, false);
});

test('VICE keyboard mapping translates visible C64 up-arrow and pi characters', () => {
  const arrowUpFromCaret = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'BracketRight',
      key: '^',
      keyCode: 221,
      shiftKey: true
    }),
    true
  );
  const arrowUp = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'PageDown',
      key: '↑',
      keyCode: 281
    }),
    true
  );
  const pi = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'KeyP',
      key: 'π',
      keyCode: 80,
      altKey: true
    }),
    true
  );

  assert.equal(arrowUpFromCaret.sdlKeyCode, 281);
  assert.equal(arrowUp.sdlKeyCode, 281);
  assert.equal(pi.sdlKeyCode, 281);
  assert.equal(pi.sdlAlt, false);
  assert.deepEqual(matrixKey(arrowUpFromCaret), { row: 6, col: 6, shift: false });
  assert.deepEqual(matrixKey(arrowUp), { row: 6, col: 6, shift: false });
  assert.deepEqual(matrixKey(pi), { row: 6, col: 6, shift: true });
});

test('VICE keyboard mapping sends C64 matrix fallback metadata for delete controls', () => {
  const backspace = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Backspace',
      key: 'Backspace',
      keyCode: 8
    }),
    true
  );
  const del = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Delete',
      key: 'Delete',
      keyCode: 46
    }),
    true
  );
  const insert = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'Insert',
      key: 'Insert',
      keyCode: 45
    }),
    true
  );

  assert.deepEqual(matrixKey(backspace), { row: 0, col: 0, shift: false });
  assert.deepEqual(matrixKey(del), { row: 0, col: 0, shift: false });
  assert.deepEqual(matrixKey(insert), { row: 0, col: 0, shift: true });
});

test('VICE keyboard mapping sends C64 matrix fallback metadata for cursor controls', () => {
  const left = createViceEmbedKeyEvent(
    keyboardEvent({ code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 }),
    true
  );
  const right = createViceEmbedKeyEvent(
    keyboardEvent({ code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 }),
    true
  );
  const up = createViceEmbedKeyEvent(
    keyboardEvent({ code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 }),
    true
  );
  const down = createViceEmbedKeyEvent(
    keyboardEvent({ code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 }),
    true
  );

  assert.deepEqual(matrixKey(left), { row: 0, col: 2, shift: true });
  assert.deepEqual(matrixKey(right), { row: 0, col: 2, shift: false });
  assert.deepEqual(matrixKey(up), { row: 0, col: 7, shift: true });
  assert.deepEqual(matrixKey(down), { row: 0, col: 7, shift: false });
});

test('VICE keyboard mapping sends Mac F1-F8 as Commodore function keys', () => {
  const cases = [
    { code: 'F1', keyCode: 112, sdlKeyCode: 282, matrix: { row: 0, col: 4, shift: false } },
    { code: 'F2', keyCode: 113, sdlKeyCode: 282, matrix: { row: 0, col: 4, shift: true } },
    { code: 'F3', keyCode: 114, sdlKeyCode: 284, matrix: { row: 0, col: 5, shift: false } },
    { code: 'F4', keyCode: 115, sdlKeyCode: 284, matrix: { row: 0, col: 5, shift: true } },
    { code: 'F5', keyCode: 116, sdlKeyCode: 286, matrix: { row: 0, col: 6, shift: false } },
    { code: 'F6', keyCode: 117, sdlKeyCode: 286, matrix: { row: 0, col: 6, shift: true } },
    { code: 'F7', keyCode: 118, sdlKeyCode: 288, matrix: { row: 0, col: 3, shift: false } },
    { code: 'F8', keyCode: 119, sdlKeyCode: 288, matrix: { row: 0, col: 3, shift: true } }
  ];

  for (const item of cases) {
    const event = createViceEmbedKeyEvent(
      keyboardEvent({
        code: item.code,
        key: item.code,
        keyCode: item.keyCode,
        shiftKey: item.code === 'F2'
      }),
      true
    );

    assert.equal(event.sdlKeyCode, item.sdlKeyCode, item.code);
    assert.equal(event.sdlShift, false, item.code);
    assert.deepEqual(matrixKey(event), item.matrix, item.code);
  }
});

test('VICE keyboard mapping identifies unmodified F1-F8 for capture before Theia keybindings', () => {
  assert.equal(isViceEmbedCommodoreFunctionKeyEvent(keyboardEvent({
    code: 'F1',
    key: 'F1',
    keyCode: 112
  })), true);
  assert.equal(isViceEmbedCommodoreFunctionKeyEvent(keyboardEvent({
    code: 'F8',
    key: 'F8',
    keyCode: 119
  })), true);
  assert.equal(isViceEmbedCommodoreFunctionKeyEvent(keyboardEvent({
    code: 'F9',
    key: 'F9',
    keyCode: 120
  })), false);
  assert.equal(isViceEmbedCommodoreFunctionKeyEvent(keyboardEvent({
    code: 'F1',
    key: 'F1',
    keyCode: 112,
    metaKey: true
  })), false);
});

test('VICE keyboard mapping does not expose host F9-F12 as Commodore function keys', () => {
  const event = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'F9',
      key: 'F9',
      keyCode: 120
    }),
    true
  );

  assert.equal(event.sdlKeyCode, 0);
  assert.equal(event.sdlShift, false);
  assert.equal(event.matrixRow, undefined);
  assert.equal(event.matrixCol, undefined);
  assert.equal(event.matrixShift, undefined);
});

test('VICE keyboard mapping sends C64 matrix fallback metadata for angle brackets', () => {
  const lessThan = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'IntlBackslash',
      key: '<',
      keyCode: 60
    }),
    true
  );
  const greaterThan = createViceEmbedKeyEvent(
    keyboardEvent({
      code: 'IntlBackslash',
      key: '>',
      keyCode: 62,
      shiftKey: true
    }),
    true
  );

  assert.deepEqual(matrixKey(lessThan), { row: 5, col: 7, shift: true });
  assert.deepEqual(matrixKey(greaterThan), { row: 5, col: 4, shift: true });
  assert.equal(lessThan.sdlKeyCode, 44);
  assert.equal(greaterThan.sdlKeyCode, 46);
  assert.equal(lessThan.sdlShift, false);
  assert.equal(greaterThan.sdlShift, false);
});

function keyboardEvent(
  overrides: Partial<ViceEmbedKeyboardEventLike>
): ViceEmbedKeyboardEventLike {
  return {
    code: 'KeyA',
    key: 'a',
    keyCode: 65,
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...overrides
  };
}

function matrixKey(event: ReturnType<typeof createViceEmbedKeyEvent>): {
  row: number | undefined;
  col: number | undefined;
  shift: boolean | undefined;
} {
  return {
    row: event.matrixRow,
    col: event.matrixCol,
    shift: event.matrixShift
  };
}
