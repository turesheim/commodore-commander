import type { CommodoreMachineProfileId } from '@commodore-commander/language-support/runtime';
import type { CommodoreViceEmbedKeyEvent } from '../common/commodore-vice-embed-service';
import {
  c64PetsciiToUpperGraphicsScreenCode
} from '../common/commodore-petscii-glyphs';
import {
  createViceEmbedKeyEvent,
  type ViceEmbedKeyboardEventLike
} from './vice-keyboard-mapping';

export type CommodoreVirtualKeyboardKeyVariant =
  | 'normal'
  | 'modifier'
  | 'function'
  | 'system'
  | 'space';

export type CommodoreVirtualKeyboardModifier =
  | 'shift'
  | 'commodore'
  | 'control';

export interface CommodoreVirtualKeyboardInput {
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  readonly matrixRow?: number;
  readonly matrixCol?: number;
  readonly matrixShift?: boolean;
}

export interface CommodoreVirtualKeyboardGlyph {
  readonly screenCode: number;
  readonly petsciiCode?: number;
}

export interface CommodoreVirtualKeyboardKey {
  readonly id: string;
  readonly label: string;
  readonly shifted?: string;
  readonly commodore?: string;
  readonly control?: string;
  readonly shiftedGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly commodoreGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly controlGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly width?: number;
  readonly variant?: CommodoreVirtualKeyboardKeyVariant;
  readonly input?: CommodoreVirtualKeyboardInput;
  readonly shiftedInput?: CommodoreVirtualKeyboardInput;
  readonly commodoreInput?: CommodoreVirtualKeyboardInput;
  readonly controlInput?: CommodoreVirtualKeyboardInput;
  readonly latchShift?: boolean;
  readonly latchModifier?: CommodoreVirtualKeyboardModifier;
}

export interface CommodoreVirtualKeyboardLayout {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly (readonly CommodoreVirtualKeyboardKey[])[];
}

export interface CommodoreVirtualKeyboardResolvedKey {
  readonly key: CommodoreVirtualKeyboardKey;
  readonly shifted: boolean;
  readonly modifier?: CommodoreVirtualKeyboardModifier;
}

type NamedVirtualKeyboardInputName =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'AltLeft'
  | 'Backspace'
  | 'ControlLeft'
  | 'Enter'
  | 'Escape'
  | 'Home'
  | 'Insert'
  | 'NumpadEnter'
  | 'Space'
  | 'Tab';

interface CommodoreVirtualKeyboardKeyLayers {
  readonly shifted?: string;
  readonly commodore?: string;
  readonly control?: string;
  readonly shiftedGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly commodoreGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly controlGlyph?: CommodoreVirtualKeyboardGlyph;
  readonly shiftedInput?: CommodoreVirtualKeyboardInput;
  readonly commodoreInput?: CommodoreVirtualKeyboardInput;
  readonly controlInput?: CommodoreVirtualKeyboardInput;
}

interface C64MatrixPosition {
  readonly row: number;
  readonly col: number;
}

const C64_MATRIX_POSITIONS_BY_LABEL: Record<string, C64MatrixPosition> = {
  DEL: { row: 0, col: 0 },
  RETURN: { row: 0, col: 1 },
  '3': { row: 1, col: 0 },
  W: { row: 1, col: 1 },
  A: { row: 1, col: 2 },
  '4': { row: 1, col: 3 },
  Z: { row: 1, col: 4 },
  S: { row: 1, col: 5 },
  E: { row: 1, col: 6 },
  '5': { row: 2, col: 0 },
  R: { row: 2, col: 1 },
  D: { row: 2, col: 2 },
  '6': { row: 2, col: 3 },
  C: { row: 2, col: 4 },
  F: { row: 2, col: 5 },
  T: { row: 2, col: 6 },
  X: { row: 2, col: 7 },
  '7': { row: 3, col: 0 },
  Y: { row: 3, col: 1 },
  G: { row: 3, col: 2 },
  '8': { row: 3, col: 3 },
  B: { row: 3, col: 4 },
  H: { row: 3, col: 5 },
  U: { row: 3, col: 6 },
  V: { row: 3, col: 7 },
  '9': { row: 4, col: 0 },
  I: { row: 4, col: 1 },
  J: { row: 4, col: 2 },
  '0': { row: 4, col: 3 },
  M: { row: 4, col: 4 },
  K: { row: 4, col: 5 },
  O: { row: 4, col: 6 },
  N: { row: 4, col: 7 },
  '+': { row: 5, col: 0 },
  P: { row: 5, col: 1 },
  L: { row: 5, col: 2 },
  '-': { row: 5, col: 3 },
  '.': { row: 5, col: 4 },
  ':': { row: 5, col: 5 },
  '@': { row: 5, col: 6 },
  ',': { row: 5, col: 7 },
  '£': { row: 6, col: 0 },
  '*': { row: 6, col: 1 },
  ';': { row: 6, col: 2 },
  '=': { row: 6, col: 5 },
  '↑': { row: 6, col: 6 },
  '/': { row: 6, col: 7 },
  '1': { row: 7, col: 0 },
  '←': { row: 7, col: 1 },
  '2': { row: 7, col: 3 },
  SPACE: { row: 7, col: 4 },
  Q: { row: 7, col: 6 }
};

const C64_LAYOUT: CommodoreVirtualKeyboardLayout = {
  id: 'c64',
  title: 'C64 Keyboard',
  rows: [
    [
      sys('c64-run-stop', 'RUN', 'STOP', 1.25, namedInput('Escape')),
      key('c64-arrow-left', '←', { control: '^F' }),
      key('c64-1', '1', { shifted: '!', control: 'BLK', commodore: 'ORN' }),
      key('c64-2', '2', { shifted: '"', control: 'WHT', commodore: 'BRN' }),
      key('c64-3', '3', { shifted: '#', control: 'RED', commodore: 'LRED' }),
      key('c64-4', '4', { shifted: '$', control: 'CYN', commodore: 'DGRY' }),
      key('c64-5', '5', { shifted: '%', control: 'PUR', commodore: 'GRY' }),
      key('c64-6', '6', { shifted: '&', control: 'GRN', commodore: 'LGRN' }),
      key('c64-7', '7', { shifted: "'", control: 'BLU', commodore: 'LBLU' }),
      key('c64-8', '8', { shifted: '(', control: 'YEL', commodore: 'LGRY' }),
      key('c64-9', '9', { shifted: ')', control: 'RVS ON' }),
      key('c64-0', '0', { control: 'RVS OFF' }),
      key('c64-plus', '+', c64Layers(0xdb, 0xa6)),
      key('c64-minus', '-', c64Layers(0xdd, 0xdc)),
      key('c64-pound', '£', c64Layers(0xa9, 0xa8, { control: 'RED' })),
      sys('c64-home', 'HOME', 'CLR', 1.15, namedInput('Home'), namedInput('Home', true)),
      fn('c64-f1', 'F1', 'F2')
    ],
    [
      mod('c64-ctrl', 'CTRL', undefined, 1.2, namedInput('ControlLeft')),
      key('c64-q', 'Q', c64Layers(0xd1, 0xab, { control: '↓' })),
      key('c64-w', 'W', c64Layers(0xd7, 0xb3, { control: '^W' })),
      key('c64-e', 'E', c64Layers(0xc5, 0xb1, { control: 'WHT' })),
      key('c64-r', 'R', c64Layers(0xd2, 0xb2, { control: 'RVS ON' })),
      key('c64-t', 'T', c64Layers(0xd4, 0xa3, { control: 'DEL' })),
      key('c64-y', 'Y', c64Layers(0xd9, 0xb7, { control: '^Y' })),
      key('c64-u', 'U', c64Layers(0xd5, 0xb8, { control: '^U' })),
      key('c64-i', 'I', c64Layers(0xc9, 0xa2, { control: 'C= ON' })),
      key('c64-o', 'O', c64Layers(0xcf, 0xb9, { control: '^O' })),
      key('c64-p', 'P', c64Layers(0xd0, 0xaf, { control: '^P' })),
      key('c64-at', '@', c64Layers(0xba, 0xa4, { control: '^@' })),
      key('c64-asterisk', '*', c64Layers(0xc0, 0xdf)),
      key('c64-arrow-up', '↑', c64Layers(0xde, 0xde, { shifted: 'π', commodore: 'π', control: 'GRN' })),
      sys('c64-restore', 'RESTORE', undefined, 1.35),
      fn('c64-f3', 'F3', 'F4')
    ],
    [
      mod('c64-commodore', 'C=', undefined, 1.2, namedInput('AltLeft')),
      key('c64-a', 'A', c64Layers(0xc1, 0xb0, { control: '^A' })),
      key('c64-s', 'S', c64Layers(0xd3, 0xae, { control: 'HOME' })),
      key('c64-d', 'D', c64Layers(0xc4, 0xac, { control: '^D' })),
      key('c64-f', 'F', c64Layers(0xc6, 0xbb, { control: '^F' })),
      key('c64-g', 'G', c64Layers(0xc7, 0xa5, { control: '^G' })),
      key('c64-h', 'H', c64Layers(0xc8, 0xb4, { control: 'C= OFF' })),
      key('c64-j', 'J', c64Layers(0xca, 0xb5, { control: '^J' })),
      key('c64-k', 'K', c64Layers(0xcb, 0xa1, { control: '^K' })),
      key('c64-l', 'L', c64Layers(0xcc, 0xb6, { control: '^L' })),
      key('c64-colon', ':', { shifted: '[', commodore: '[', control: '^[' }),
      key('c64-semicolon', ';', { shifted: ']', commodore: ']', control: '→' }),
      key('c64-equals', '=', { control: 'BLU' }),
      sys('c64-return', 'RETURN', undefined, 1.45, namedInput('Enter')),
      fn('c64-f5', 'F5', 'F6')
    ],
    [
      shift('c64-left-shift', 'SHIFT', undefined, 1.35),
      key('c64-z', 'Z', c64Layers(0xda, 0xad, { control: '^Z' })),
      key('c64-x', 'X', c64Layers(0xd8, 0xbd, { control: '^X' })),
      key('c64-c', 'C', c64Layers(0xc3, 0xbc, { control: 'STOP' })),
      key('c64-v', 'V', c64Layers(0xd6, 0xbe, { control: '^V' })),
      key('c64-b', 'B', c64Layers(0xc2, 0xbf, { control: '^B' })),
      key('c64-n', 'N', c64Layers(0xce, 0xaa, { control: 'LOWER' })),
      key('c64-m', 'M', c64Layers(0xcd, 0xa7, { control: 'RETURN' })),
      key('c64-comma', ',', { shifted: '<' }),
      key('c64-period', '.', { shifted: '>' }),
      key('c64-slash', '/', { shifted: '?' }),
      shift('c64-right-shift', 'SHIFT', undefined, 1.35),
      sys('c64-cursor-vertical', '↓', '↑', 1.25, namedInput('ArrowDown'), namedInput('ArrowUp')),
      sys('c64-cursor-horizontal', '→', '←', 1.25, namedInput('ArrowRight'), namedInput('ArrowLeft')),
      fn('c64-f7', 'F7', 'F8')
    ],
    [
      space('c64-space', 'SPACE', 7, namedInput('Space')),
      sys('c64-delete', 'DEL', 'INST', 1.35, namedInput('Backspace'), namedInput('Insert'))
    ]
  ]
};

const C64DTV_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...C64_LAYOUT,
  id: 'c64dtv',
  title: 'C64DTV Keyboard'
};

const C128_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...C64_LAYOUT,
  id: 'c128',
  title: 'C128 Keyboard',
  rows: [
    [
      ...C64_LAYOUT.rows[0],
      sys('c128-help', 'HELP')
    ],
    ...C64_LAYOUT.rows.slice(1),
    [
      sys('c128-esc', 'ESC', undefined, 1, namedInput('Escape')),
      sys('c128-tab', 'TAB', undefined, 1, namedInput('Tab')),
      sys('c128-alt', 'ALT'),
      sys('c128-40-80', '40/80'),
      sys('c128-line-feed', 'LINE FEED')
    ]
  ]
};

const VIC20_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...C64_LAYOUT,
  id: 'vic20',
  title: 'VIC-20 Keyboard'
};

const TED_LAYOUT: CommodoreVirtualKeyboardLayout = {
  id: 'ted',
  title: 'TED Keyboard',
  rows: [
    [
      fn('ted-f1', 'F1', 'F4'),
      fn('ted-f2', 'F2', 'F5'),
      fn('ted-f3', 'F3', 'F6'),
      fn('ted-help', 'HELP', 'F7')
    ],
    [
      sys('ted-esc', 'ESC', undefined, 1, namedInput('Escape')),
      key('ted-1', '1', '!'),
      key('ted-2', '2', '"'),
      key('ted-3', '3', '#'),
      key('ted-4', '4', '$'),
      key('ted-5', '5', '%'),
      key('ted-6', '6', '&'),
      key('ted-7', '7', "'"),
      key('ted-8', '8', '('),
      key('ted-9', '9', ')'),
      key('ted-0', '0'),
      key('ted-plus', '+'),
      key('ted-minus', '-', '_'),
      key('ted-pound', '£'),
      sys('ted-home', 'HOME', 'CLR', 1.15, namedInput('Home'), namedInput('Home', true))
    ],
    [
      sys('ted-ctrl', 'CTRL', undefined, 1.2, namedInput('ControlLeft')),
      key('ted-q', 'Q'),
      key('ted-w', 'W'),
      key('ted-e', 'E'),
      key('ted-r', 'R'),
      key('ted-t', 'T'),
      key('ted-y', 'Y'),
      key('ted-u', 'U'),
      key('ted-i', 'I'),
      key('ted-o', 'O'),
      key('ted-p', 'P', 'π'),
      key('ted-at', '@'),
      key('ted-asterisk', '*'),
      key('ted-arrow-up', '↑')
    ],
    [
      mod('ted-run-stop', 'RUN', 'STOP', 1.4, namedInput('Escape')),
      key('ted-a', 'A'),
      key('ted-s', 'S'),
      key('ted-d', 'D'),
      key('ted-f', 'F'),
      key('ted-g', 'G'),
      key('ted-h', 'H'),
      key('ted-j', 'J'),
      key('ted-k', 'K'),
      key('ted-l', 'L'),
      key('ted-colon', ':', '['),
      key('ted-semicolon', ';', ']'),
      key('ted-equals', '='),
      sys('ted-return', 'RETURN', undefined, 1.45, namedInput('Enter'))
    ],
    [
      shift('ted-left-shift', 'SHIFT', undefined, 1.35),
      key('ted-z', 'Z'),
      key('ted-x', 'X'),
      key('ted-c', 'C'),
      key('ted-v', 'V'),
      key('ted-b', 'B'),
      key('ted-n', 'N'),
      key('ted-m', 'M'),
      key('ted-comma', ',', '<'),
      key('ted-period', '.', '>'),
      key('ted-slash', '/', '?'),
      shift('ted-right-shift', 'SHIFT', undefined, 1.35),
      sys('ted-cursor-vertical', '↓', '↑', 1.25, namedInput('ArrowDown'), namedInput('ArrowUp')),
      sys('ted-cursor-horizontal', '→', '←', 1.25, namedInput('ArrowRight'), namedInput('ArrowLeft'))
    ],
    [
      mod('ted-commodore', 'C=', undefined, 1.1),
      space('ted-space', 'SPACE', 6, namedInput('Space')),
      sys('ted-delete', 'DEL', 'INST', 1.35, namedInput('Backspace'), namedInput('Insert'))
    ]
  ]
};

const PLUS4_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...TED_LAYOUT,
  id: 'plus4',
  title: 'Plus/4 Keyboard'
};

const C16_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...TED_LAYOUT,
  id: 'c16',
  title: 'C16 Keyboard'
};

const BUSINESS_LAYOUT: CommodoreVirtualKeyboardLayout = {
  id: 'business',
  title: 'Business Keyboard',
  rows: [
    [
      fn('business-f1', 'F1'),
      fn('business-f2', 'F2'),
      fn('business-f3', 'F3'),
      fn('business-f4', 'F4'),
      fn('business-f5', 'F5'),
      fn('business-f6', 'F6'),
      fn('business-f7', 'F7'),
      fn('business-f8', 'F8'),
      sys('business-stop', 'STOP', undefined, 1.1, namedInput('Escape')),
      sys('business-rvs', 'RVS')
    ],
    [
      key('business-1', '1', '!'),
      key('business-2', '2', '"'),
      key('business-3', '3', '#'),
      key('business-4', '4', '$'),
      key('business-5', '5', '%'),
      key('business-6', '6', '&'),
      key('business-7', '7', "'"),
      key('business-8', '8', '('),
      key('business-9', '9', ')'),
      key('business-0', '0'),
      key('business-colon', ':', '*'),
      key('business-minus', '-', '='),
      sys('business-home', 'HOME', undefined, 1, namedInput('Home')),
      sys('business-del', 'DEL', undefined, 1, namedInput('Backspace'))
    ],
    [
      sys('business-tab', 'TAB', undefined, 1, namedInput('Tab')),
      key('business-q', 'Q'),
      key('business-w', 'W'),
      key('business-e', 'E'),
      key('business-r', 'R'),
      key('business-t', 'T'),
      key('business-y', 'Y'),
      key('business-u', 'U'),
      key('business-i', 'I'),
      key('business-o', 'O'),
      key('business-p', 'P'),
      key('business-pi', 'π'),
      sys('business-return', 'RETURN', undefined, 1.4, namedInput('Enter'))
    ],
    [
      sys('business-ctrl', 'CTRL', undefined, 1.2, namedInput('ControlLeft')),
      key('business-a', 'A'),
      key('business-s', 'S'),
      key('business-d', 'D'),
      key('business-f', 'F'),
      key('business-g', 'G'),
      key('business-h', 'H'),
      key('business-j', 'J'),
      key('business-k', 'K'),
      key('business-l', 'L'),
      key('business-semicolon', ';'),
      key('business-at', '@'),
      key('business-arrow-up', '↑')
    ],
    [
      shift('business-left-shift', 'SHIFT', undefined, 1.35),
      key('business-z', 'Z'),
      key('business-x', 'X'),
      key('business-c', 'C'),
      key('business-v', 'V'),
      key('business-b', 'B'),
      key('business-n', 'N'),
      key('business-m', 'M'),
      key('business-comma', ',', '<'),
      key('business-period', '.', '>'),
      key('business-slash', '/', '?'),
      shift('business-right-shift', 'SHIFT', undefined, 1.35)
    ],
    [
      sys('business-esc', 'ESC', undefined, 1, namedInput('Escape')),
      space('business-space', 'SPACE', 5, namedInput('Space')),
      sys('business-cursor-vertical', '↓', '↑', 1.25, namedInput('ArrowDown'), namedInput('ArrowUp')),
      sys('business-cursor-horizontal', '→', '←', 1.25, namedInput('ArrowRight'), namedInput('ArrowLeft')),
      sys('business-keypad-0', 'KEYPAD 0'),
      sys('business-keypad-dot', 'KEYPAD .'),
      sys('business-keypad-enter', 'KEYPAD ENTER', undefined, 1.5, namedInput('NumpadEnter'))
    ],
    [
      sys('business-keypad-7', 'KEYPAD 7'),
      sys('business-keypad-8', 'KEYPAD 8'),
      sys('business-keypad-9', 'KEYPAD 9'),
      sys('business-keypad-4', 'KEYPAD 4'),
      sys('business-keypad-5', 'KEYPAD 5'),
      sys('business-keypad-6', 'KEYPAD 6'),
      sys('business-keypad-1', 'KEYPAD 1'),
      sys('business-keypad-2', 'KEYPAD 2'),
      sys('business-keypad-3', 'KEYPAD 3')
    ]
  ]
};

const PET_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...BUSINESS_LAYOUT,
  id: 'pet',
  title: 'PET Keyboard'
};

const CBM2_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...BUSINESS_LAYOUT,
  id: 'cbm2',
  title: 'CBM-II Keyboard'
};

const CBM5X0_LAYOUT: CommodoreVirtualKeyboardLayout = {
  ...BUSINESS_LAYOUT,
  id: 'cbm5x0',
  title: 'CBM 5x0 Keyboard'
};

export function getCommodoreVirtualKeyboardLayout(
  profileId: CommodoreMachineProfileId
): CommodoreVirtualKeyboardLayout {
  switch (profileId) {
    case 'c64':
      return C64_LAYOUT;
    case 'c64dtv':
      return C64DTV_LAYOUT;
    case 'c128':
      return C128_LAYOUT;
    case 'vic20':
      return VIC20_LAYOUT;
    case 'plus4':
      return PLUS4_LAYOUT;
    case 'c16':
      return C16_LAYOUT;
    case 'pet':
      return PET_LAYOUT;
    case 'cbm2':
      return CBM2_LAYOUT;
    case 'cbm5x0':
      return CBM5X0_LAYOUT;
  }
}

export function createCommodoreVirtualKeyboardKeyEvent(
  key: CommodoreVirtualKeyboardKey,
  modifier: boolean | CommodoreVirtualKeyboardModifier | undefined,
  pressed: boolean
): CommodoreViceEmbedKeyEvent | undefined {
  const input = inputForModifier(key, normalizeModifier(modifier));
  if (!input) {
    return undefined;
  }
  const event = createViceEmbedKeyEvent(toKeyboardEventLike(input), pressed);
  return input.matrixRow !== undefined && input.matrixCol !== undefined
    ? {
      ...event,
      matrixRow: input.matrixRow,
      matrixCol: input.matrixCol,
      matrixShift: input.matrixShift ?? false,
      sdlShift: false
    }
    : event;
}

export function createCommodoreVirtualKeyboardModifierKeyEvent(
  modifier: CommodoreVirtualKeyboardModifier,
  pressed: boolean
): CommodoreViceEmbedKeyEvent {
  return createViceEmbedKeyEvent(toKeyboardEventLike(inputForLatchModifier(modifier)), pressed);
}

export function resolveCommodoreVirtualKeyboardKey(
  layout: CommodoreVirtualKeyboardLayout,
  event: CommodoreViceEmbedKeyEvent
): CommodoreVirtualKeyboardResolvedKey | undefined {
  for (const key of flattenLayoutKeys(layout)) {
    const primaryEvent = createCommodoreVirtualKeyboardKeyEvent(key, false, event.pressed);
    if (primaryEvent && isSameEmulatedKey(primaryEvent, event)) {
      return { key, shifted: false };
    }
    for (const modifier of ['shift', 'commodore', 'control'] as const) {
      const modifiedEvent = createCommodoreVirtualKeyboardKeyEvent(
        key,
        modifier,
        event.pressed
      );
      if (modifiedEvent && isSameEmulatedKey(modifiedEvent, event)) {
        return { key, shifted: modifier === 'shift', modifier };
      }
    }
  }
  return undefined;
}

export function isCommodoreVirtualKeyboardShiftKey(
  key: CommodoreVirtualKeyboardKey
): boolean {
  return key.latchShift === true || key.latchModifier === 'shift';
}

export function isCommodoreVirtualKeyboardModifierKey(
  key: CommodoreVirtualKeyboardKey,
  modifier?: CommodoreVirtualKeyboardModifier
): boolean {
  return modifier
    ? key.latchModifier === modifier || (modifier === 'shift' && key.latchShift === true)
    : key.latchModifier !== undefined || key.latchShift === true;
}

function key(
  id: string,
  label: string,
  shifted?: string | CommodoreVirtualKeyboardKeyLayers,
  width?: number
): CommodoreVirtualKeyboardKey {
  const layers = toKeyLayers(shifted);
  const input = printableInput(label);
  const matrixPosition = c64MatrixPositionForKey(id, label);
  return {
    id,
    label,
    shifted: layers.shifted,
    commodore: layers.commodore,
    control: layers.control,
    shiftedGlyph: layers.shiftedGlyph,
    commodoreGlyph: layers.commodoreGlyph,
    controlGlyph: layers.controlGlyph,
    width,
    input,
    shiftedInput: layers.shiftedInput ??
      defaultShiftedInput(layers, input, matrixPosition),
    commodoreInput: layers.commodoreInput,
    controlInput: layers.controlInput
  };
}

function mod(
  id: string,
  label: string,
  shifted?: string,
  width?: number,
  input?: CommodoreVirtualKeyboardInput,
  shiftedInput?: CommodoreVirtualKeyboardInput
): CommodoreVirtualKeyboardKey {
  return {
    id,
    label,
    shifted,
    width,
    input,
    shiftedInput,
    variant: 'modifier',
    latchModifier: label === 'C=' ? 'commodore' : label === 'CTRL' ? 'control' : undefined
  };
}

function shift(
  id: string,
  label: string,
  shifted?: string,
  width?: number
): CommodoreVirtualKeyboardKey {
  return {
    id,
    label,
    shifted,
    width,
    variant: 'modifier',
    latchShift: true,
    latchModifier: 'shift'
  };
}

function fn(
  id: string,
  label: string,
  shifted?: string,
  width?: number
): CommodoreVirtualKeyboardKey {
  return {
    id,
    label,
    shifted,
    width,
    variant: 'function',
    input: functionInput(label),
    shiftedInput: shifted ? functionInput(shifted) : undefined
  };
}

function sys(
  id: string,
  label: string,
  shifted?: string,
  width?: number,
  input?: CommodoreVirtualKeyboardInput,
  shiftedInput?: CommodoreVirtualKeyboardInput
): CommodoreVirtualKeyboardKey {
  return { id, label, shifted, width, input, shiftedInput, variant: 'system' };
}

function space(
  id: string,
  label: string,
  width: number,
  input: CommodoreVirtualKeyboardInput
): CommodoreVirtualKeyboardKey {
  return { id, label, width, input, variant: 'space' };
}

function toKeyLayers(
  value: string | CommodoreVirtualKeyboardKeyLayers | undefined
): CommodoreVirtualKeyboardKeyLayers {
  return typeof value === 'string'
    ? { shifted: value }
    : value ?? {};
}

function c64Layers(
  shiftedPetsciiCode: number | undefined,
  commodorePetsciiCode: number | undefined,
  overrides: Partial<CommodoreVirtualKeyboardKeyLayers> = {}
): CommodoreVirtualKeyboardKeyLayers {
  const shifted = shiftedPetsciiCode === undefined
    ? undefined
    : c64PetsciiGlyph(shiftedPetsciiCode);
  const commodore = commodorePetsciiCode === undefined
    ? undefined
    : c64PetsciiGlyph(commodorePetsciiCode);
  return {
    ...overrides,
    shifted: overrides.shifted ?? (shifted ? c64PetsciiLayerLabel(shifted) : undefined),
    commodore: overrides.commodore ??
      (commodore ? c64PetsciiLayerLabel(commodore) : undefined),
    shiftedGlyph: overrides.shiftedGlyph ?? shifted,
    commodoreGlyph: overrides.commodoreGlyph ?? commodore
  };
}

function c64PetsciiGlyph(
  petsciiCode: number
): CommodoreVirtualKeyboardGlyph | undefined {
  const screenCode = c64PetsciiToUpperGraphicsScreenCode(petsciiCode);
  return screenCode === undefined
    ? undefined
    : { petsciiCode: petsciiCode & 0xff, screenCode };
}

function c64PetsciiLayerLabel(glyph: CommodoreVirtualKeyboardGlyph): string {
  return glyph.petsciiCode === undefined
    ? `SCR $${hexByte(glyph.screenCode)}`
    : `PET $${hexByte(glyph.petsciiCode)}`;
}

function defaultShiftedInput(
  layers: CommodoreVirtualKeyboardKeyLayers,
  input: CommodoreVirtualKeyboardInput | undefined,
  matrixPosition: C64MatrixPosition | undefined
): CommodoreVirtualKeyboardInput | undefined {
  if (layers.shiftedGlyph && input && matrixPosition) {
    return {
      ...input,
      shiftKey: true,
      matrixRow: matrixPosition.row,
      matrixCol: matrixPosition.col,
      matrixShift: true
    };
  }
  return layers.shifted ? printableInput(layers.shifted) : undefined;
}

function c64MatrixPositionForKey(
  id: string,
  label: string
): C64MatrixPosition | undefined {
  if (!id.startsWith('c64-')) {
    return undefined;
  }
  return C64_MATRIX_POSITIONS_BY_LABEL[label];
}

function normalizeModifier(
  modifier: boolean | CommodoreVirtualKeyboardModifier | undefined
): CommodoreVirtualKeyboardModifier | undefined {
  if (modifier === true) {
    return 'shift';
  }
  if (modifier === false) {
    return undefined;
  }
  return modifier;
}

function inputForModifier(
  key: CommodoreVirtualKeyboardKey,
  modifier: CommodoreVirtualKeyboardModifier | undefined
): CommodoreVirtualKeyboardInput | undefined {
  switch (modifier) {
    case 'shift':
      return key.shiftedInput;
    case 'commodore':
      return key.commodoreInput ??
        ((key.commodore || key.commodoreGlyph) ? key.input : undefined);
    case 'control':
      return key.controlInput ??
        ((key.control || key.controlGlyph) ? key.input : undefined);
    case undefined:
      return key.input;
  }
}

function inputForLatchModifier(
  modifier: CommodoreVirtualKeyboardModifier
): CommodoreVirtualKeyboardInput {
  switch (modifier) {
    case 'shift':
      return { code: 'ShiftLeft', key: 'Shift', keyCode: 16, shiftKey: true };
    case 'commodore':
      return namedInput('AltLeft');
    case 'control':
      return namedInput('ControlLeft');
  }
}

function printableInput(value: string): CommodoreVirtualKeyboardInput | undefined {
  if (value === 'SPACE') {
    return namedInput('Space');
  }
  if (/^[A-Z]$/u.test(value)) {
    return {
      code: `Key${value}`,
      key: value.toLowerCase(),
      keyCode: value.charCodeAt(0)
    };
  }
  if (/^\d$/u.test(value)) {
    return {
      code: `Digit${value}`,
      key: value,
      keyCode: value.charCodeAt(0)
    };
  }
  switch (value) {
    case ' ':
      return namedInput('Space');
    case '!':
      return { code: 'Digit1', key: '!', keyCode: 49, shiftKey: true };
    case '"':
      return { code: 'Digit2', key: '"', keyCode: 50, shiftKey: true };
    case '#':
      return { code: 'Digit3', key: '#', keyCode: 51, shiftKey: true };
    case '$':
      return { code: 'Digit4', key: '$', keyCode: 52, shiftKey: true };
    case '%':
      return { code: 'Digit5', key: '%', keyCode: 53, shiftKey: true };
    case '&':
      return { code: 'Digit6', key: '&', keyCode: 54, shiftKey: true };
    case "'":
      return { code: 'Quote', key: "'", keyCode: 222 };
    case '(':
      return { code: 'Digit8', key: '(', keyCode: 56, shiftKey: true };
    case ')':
      return { code: 'Digit9', key: ')', keyCode: 57, shiftKey: true };
    case '*':
      return { code: 'Digit8', key: '*', keyCode: 56, shiftKey: true };
    case '+':
      return { code: 'Equal', key: '+', keyCode: 187, shiftKey: true };
    case ',':
      return { code: 'Comma', key: ',', keyCode: 188 };
    case '-':
      return { code: 'Minus', key: '-', keyCode: 189 };
    case '.':
      return { code: 'Period', key: '.', keyCode: 190 };
    case '/':
      return { code: 'Slash', key: '/', keyCode: 191 };
    case ':':
      return { code: 'Semicolon', key: ':', keyCode: 186, shiftKey: true };
    case ';':
      return { code: 'Semicolon', key: ';', keyCode: 186 };
    case '<':
      return { code: 'Comma', key: '<', keyCode: 188, shiftKey: true };
    case '=':
      return { code: 'Equal', key: '=', keyCode: 187 };
    case '>':
      return { code: 'Period', key: '>', keyCode: 190, shiftKey: true };
    case '?':
      return { code: 'Slash', key: '?', keyCode: 191, shiftKey: true };
    case '@':
      return { code: 'Digit2', key: '@', keyCode: 50, altKey: true };
    case '[':
      return { code: 'BracketLeft', key: '[', keyCode: 219 };
    case ']':
      return { code: 'BracketRight', key: ']', keyCode: 221 };
    case '^':
      return { code: 'BracketRight', key: '^', keyCode: 221, shiftKey: true };
    case '_':
      return { code: 'Minus', key: '_', keyCode: 189, shiftKey: true };
    case '£':
      return { code: 'Digit3', key: '£', keyCode: 51, altKey: true };
    case '↑':
      return { code: 'PageDown', key: '↑', keyCode: 281 };
    case 'π':
      return { code: 'KeyP', key: 'π', keyCode: 80, altKey: true };
    default:
      return undefined;
  }
}

function functionInput(value: string): CommodoreVirtualKeyboardInput | undefined {
  const match = /^F(\d)$/u.exec(value);
  if (!match) {
    return undefined;
  }
  const number = Number(match[1]);
  return {
    code: value,
    key: value,
    keyCode: 111 + number
  };
}

function namedInput(
  name: NamedVirtualKeyboardInputName,
  shiftKey = false
): CommodoreVirtualKeyboardInput {
  const input = namedInputBase(name);
  return shiftKey ? { ...input, shiftKey } : input;
}

function toKeyboardEventLike(
  input: CommodoreVirtualKeyboardInput
): ViceEmbedKeyboardEventLike {
  return {
    code: input.code,
    key: input.key,
    keyCode: input.keyCode,
    repeat: false,
    shiftKey: input.shiftKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    altKey: input.altKey ?? false,
    metaKey: input.metaKey ?? false
  };
}

function flattenLayoutKeys(
  layout: CommodoreVirtualKeyboardLayout
): CommodoreVirtualKeyboardKey[] {
  return layout.rows.flatMap((row) => [...row]);
}

function isSameEmulatedKey(
  expected: CommodoreViceEmbedKeyEvent,
  actual: CommodoreViceEmbedKeyEvent
): boolean {
  const expectedHasMatrix = hasMatrixKey(expected);
  const actualHasMatrix = hasMatrixKey(actual);
  if (expectedHasMatrix || actualHasMatrix) {
    return expectedHasMatrix &&
      actualHasMatrix &&
      expected.matrixRow === actual.matrixRow &&
      expected.matrixCol === actual.matrixCol &&
      (expected.matrixShift ?? false) === (actual.matrixShift ?? false);
  }
  if (expected.sdlKeyCode !== undefined && actual.sdlKeyCode !== undefined) {
    return expected.sdlKeyCode !== 0 &&
      expected.sdlKeyCode === actual.sdlKeyCode &&
      (expected.sdlShift ?? expected.shift ?? false) ===
        (actual.sdlShift ?? actual.shift ?? false) &&
      (expected.sdlCtrl ?? expected.ctrl ?? false) ===
        (actual.sdlCtrl ?? actual.ctrl ?? false) &&
      (expected.sdlAlt ?? expected.alt ?? false) ===
        (actual.sdlAlt ?? actual.alt ?? false);
  }
  return false;
}

function namedInputBase(
  name: NamedVirtualKeyboardInputName
): CommodoreVirtualKeyboardInput {
  switch (name) {
    case 'AltLeft':
      return { code: 'AltLeft', key: 'Alt', keyCode: 18, altKey: true };
    case 'ArrowDown':
      return { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 };
    case 'ArrowLeft':
      return { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 };
    case 'ArrowRight':
      return { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 };
    case 'ArrowUp':
      return { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 };
    case 'Backspace':
      return { code: 'Backspace', key: 'Backspace', keyCode: 8 };
    case 'ControlLeft':
      return { code: 'ControlLeft', key: 'Control', keyCode: 17, ctrlKey: true };
    case 'Enter':
      return { code: 'Enter', key: 'Enter', keyCode: 13 };
    case 'Escape':
      return { code: 'Escape', key: 'Escape', keyCode: 27 };
    case 'Home':
      return { code: 'Home', key: 'Home', keyCode: 36 };
    case 'Insert':
      return { code: 'Insert', key: 'Insert', keyCode: 45 };
    case 'NumpadEnter':
      return { code: 'NumpadEnter', key: 'Enter', keyCode: 13 };
    case 'Space':
      return { code: 'Space', key: ' ', keyCode: 32 };
    case 'Tab':
      return { code: 'Tab', key: 'Tab', keyCode: 9 };
  }
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function hasMatrixKey(event: CommodoreViceEmbedKeyEvent): boolean {
  return event.matrixRow !== undefined && event.matrixCol !== undefined;
}
