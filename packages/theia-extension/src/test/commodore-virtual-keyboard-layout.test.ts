import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMMODORE_MACHINE_PROFILE_IDS
} from '@commodore-commander/language-support/runtime';

import {
  createCommodoreVirtualKeyboardKeyEvent,
  createCommodoreVirtualKeyboardModifierKeyEvent,
  getCommodoreVirtualKeyboardLayout,
  resolveCommodoreVirtualKeyboardKey,
  type CommodoreVirtualKeyboardLayout
} from '../browser/commodore-virtual-keyboard-layout';
import {
  c64UpperGraphicsGlyphFromPetscii
} from '../common/commodore-petscii-glyphs';
import {
  createViceEmbedKeyEvent
} from '../browser/vice-keyboard-mapping';

test('virtual keyboard layouts are available for every Commodore machine profile', () => {
  for (const profileId of COMMODORE_MACHINE_PROFILE_IDS) {
    const layout = getCommodoreVirtualKeyboardLayout(profileId);

    assert.ok(layout.title.length > 0, profileId);
    assert.ok(layout.rows.length > 0, profileId);
    assert.ok(layout.rows.every((row) => row.length > 0), profileId);
  }
});

test('C64 virtual keyboard layout includes function pairs and special symbols', () => {
  const labels = layoutLabels(getCommodoreVirtualKeyboardLayout('c64'));

  assert.ok(labels.includes('F1'));
  assert.ok(labels.includes('F2'));
  assert.ok(labels.includes('F7'));
  assert.ok(labels.includes('F8'));
  assert.ok(labels.includes('↑'));
  assert.ok(labels.includes('π'));
  assert.ok(labels.includes('BLK'));
  assert.ok(labels.includes('ORN'));
  assert.ok(labels.includes('SPACE'));
  assert.ok(!labels.includes('LOCK'));

  const a = getCommodoreVirtualKeyboardLayout('c64')
    .rows.flat()
    .find((key) => key.id === 'c64-a');
  assert.equal(a?.shiftedGlyph?.petsciiCode, 0xc1);
  assert.equal(a?.shiftedGlyph?.screenCode, 0x41);
  assert.equal(a?.commodoreGlyph?.petsciiCode, 0xb0);
  assert.equal(a?.commodoreGlyph?.screenCode, 0x70);
});

test('virtual keyboard cursor keys use compact arrow labels', () => {
  for (const profileId of COMMODORE_MACHINE_PROFILE_IDS) {
    const labels = layoutLabels(getCommodoreVirtualKeyboardLayout(profileId));

    assert.ok(!labels.some((label) => label.includes('CRSR')), profileId);
  }
});

test('virtual keyboard layout titles follow the active machine profile', () => {
  assert.equal(getCommodoreVirtualKeyboardLayout('c64').title, 'C64 Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('c64dtv').title, 'C64DTV Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('c128').title, 'C128 Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('vic20').title, 'VIC-20 Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('plus4').title, 'Plus/4 Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('c16').title, 'C16 Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('pet').title, 'PET Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('cbm2').title, 'CBM-II Keyboard');
  assert.equal(getCommodoreVirtualKeyboardLayout('cbm5x0').title, 'CBM 5x0 Keyboard');
});

test('C64 virtual keyboard control layer follows PETSCII control codes', () => {
  const layout = getCommodoreVirtualKeyboardLayout('c64');

  // Reference: https://github.com/mist64/c64ref/blob/main/src/charset/keyboard_c64.txt
  // and https://github.com/mist64/c64ref/blob/main/src/charset/control_codes_c64.txt
  assert.equal(findLayoutKey(layout, 'c64-w')?.control, '^W');
  assert.equal(findLayoutKey(layout, 'c64-e')?.control, 'WHT');
  assert.equal(findLayoutKey(layout, 'c64-s')?.control, 'HOME');
  assert.equal(findLayoutKey(layout, 'c64-h')?.control, 'C= OFF');
  assert.equal(findLayoutKey(layout, 'c64-i')?.control, 'C= ON');
  assert.equal(findLayoutKey(layout, 'c64-n')?.control, 'LOWER');
  assert.equal(findLayoutKey(layout, 'c64-semicolon')?.control, '→');
  assert.equal(findLayoutKey(layout, 'c64-arrow-left')?.control, '^F');
  assert.equal(findLayoutKey(layout, 'c64-pound')?.control, 'RED');
  assert.equal(findLayoutKey(layout, 'c64-at')?.control, '^@');
  assert.equal(findLayoutKey(layout, 'c64-arrow-up')?.control, 'GRN');
});

test('Plus/4 virtual keyboard layout includes TED function labels', () => {
  const labels = layoutLabels(getCommodoreVirtualKeyboardLayout('plus4'));

  assert.ok(labels.includes('HELP'));
  assert.ok(labels.includes('F1'));
  assert.ok(labels.includes('F4'));
  assert.ok(labels.includes('F7'));
});

test('PET virtual keyboard layout uses the business keyboard family', () => {
  const layout = getCommodoreVirtualKeyboardLayout('pet');
  const labels = layoutLabels(layout);

  assert.equal(layout.title, 'PET Keyboard');
  assert.ok(labels.includes('KEYPAD 0'));
  assert.ok(labels.includes('KEYPAD ENTER'));
});

test('C64 virtual keyboard resolves visible quote to the shifted 2 key', () => {
  const layout = getCommodoreVirtualKeyboardLayout('c64');
  const keyEvent = createViceEmbedKeyEvent({
    code: 'Quote',
    key: '"',
    keyCode: 222,
    repeat: false,
    shiftKey: true,
    ctrlKey: false,
    altKey: false,
    metaKey: false
  }, true);
  const resolved = resolveCommodoreVirtualKeyboardKey(layout, keyEvent);

  assert.equal(resolved?.key.id, 'c64-2');
  assert.equal(resolved?.shifted, true);
});

test('C64 virtual keyboard mouse input emits shifted key events', () => {
  const layout = getCommodoreVirtualKeyboardLayout('c64');
  const two = layout.rows.flat().find((key) => key.id === 'c64-2');

  assert.ok(two);
  const keyEvent = createCommodoreVirtualKeyboardKeyEvent(two, true, true);

  assert.equal(keyEvent?.sdlKeyCode, 50);
  assert.equal(keyEvent?.matrixRow, 7);
  assert.equal(keyEvent?.matrixCol, 3);
  assert.equal(keyEvent?.matrixShift, true);
});

test('C64 virtual keyboard emits the Commodore modifier key', () => {
  const keyEvent = createCommodoreVirtualKeyboardModifierKeyEvent(
    'commodore',
    true
  );

  assert.equal(keyEvent.sdlKeyCode, 9);
  assert.equal(keyEvent.sdlAlt, false);
  assert.equal(keyEvent.matrixRow, 7);
  assert.equal(keyEvent.matrixCol, 5);
});

test('C64 virtual keyboard mouse input emits matrix-shifted graphics keys', () => {
  const layout = getCommodoreVirtualKeyboardLayout('c64');
  const q = layout.rows.flat().find((key) => key.id === 'c64-q');

  assert.ok(q);
  const keyEvent = createCommodoreVirtualKeyboardKeyEvent(q, 'shift', true);

  assert.equal(keyEvent?.matrixRow, 7);
  assert.equal(keyEvent?.matrixCol, 6);
  assert.equal(keyEvent?.matrixShift, true);
});

test('C64 PETSCII glyph helper renders reusable SVG paths from the ROM charset', () => {
  const shiftA = c64UpperGraphicsGlyphFromPetscii(0xc1);
  const commodoreA = c64UpperGraphicsGlyphFromPetscii(0xb0);

  assert.equal(shiftA?.screenCode, 0x41);
  assert.equal(commodoreA?.screenCode, 0x70);
  assert.ok(shiftA?.svgPath.includes('M'));
  assert.ok(commodoreA?.svgPath.includes('M'));
});

function layoutLabels(layout: CommodoreVirtualKeyboardLayout): string[] {
  return layout.rows.flatMap((row) =>
    row.flatMap((key) =>
      [key.label, key.shifted, key.commodore, key.control].filter(isString)
    )
  );
}

function findLayoutKey(
  layout: CommodoreVirtualKeyboardLayout,
  id: string
) {
  return layout.rows.flat().find((key) => key.id === id);
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}
