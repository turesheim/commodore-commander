export const COMMODORE_SPRITE_FORMAT = 'commodore-commander.sprite';
export const COMMODORE_SPRITE_VERSION = 1;
export const COMMODORE_SPRITE_FILE_EXTENSION = '.sprite';
export const COMMODORE_RAW_SPRITE_FILE_EXTENSION = '.spr';

export type CommodoreSpriteColorMode = 'hires' | 'multicolor';
export type CommodoreSpriteAnimationPlayback = 'once' | 'loop' | 'ping-pong';
export type CommodoreSpriteMachineId = 'c64' | 'c128' | 'c64dtv' | 'generic';

export interface CommodoreSpriteColors {
  background: number;
  foreground: number;
  multicolor1: number;
  multicolor2: number;
}

export interface CommodoreSpriteGeometry {
  width: 24;
  height: 21;
  multicolorWidth: 12;
  bytesPerRow: 3;
  dataBytes: 63;
  slotBytes: 64;
  bitOrder: 'msb-left';
  byteOrder: 'row-major';
  hardware: 'vic-ii-sprite';
}

export interface CommodoreSpriteMetadata {
  name: string;
  machine: string;
  author?: string;
  description?: string;
}

export interface CommodoreSpriteFrame {
  name: string;
  durationMs: number;
  data: string;
}

export interface CommodoreSpriteAnimation {
  playback: CommodoreSpriteAnimationPlayback;
  defaultFrameDurationMs: number;
}

export interface CommodoreSpriteTarget {
  spriteDataAddress: number;
  spritePointerIndex: number;
  screenAddress: number;
  vicBank: number;
  c128VicMode: 'c64-compatible' | 'c128-40-column';
  c64dtvExtendedPalette: boolean;
}

export interface CommodoreSpriteDocument {
  format: typeof COMMODORE_SPRITE_FORMAT;
  version: typeof COMMODORE_SPRITE_VERSION;
  metadata: CommodoreSpriteMetadata;
  geometry: CommodoreSpriteGeometry;
  colorMode: CommodoreSpriteColorMode;
  colors: CommodoreSpriteColors;
  data: string;
  frames: CommodoreSpriteFrame[];
  animation: CommodoreSpriteAnimation;
  target: CommodoreSpriteTarget;
}

export interface CommodoreSpriteDocumentOptions {
  readonly colorMode?: CommodoreSpriteColorMode;
  readonly machine?: string;
  readonly colors?: Partial<CommodoreSpriteColors>;
  readonly data?: Uint8Array;
  readonly frames?: readonly CommodoreSpriteFrame[];
  readonly animation?: Partial<CommodoreSpriteAnimation>;
  readonly target?: Partial<CommodoreSpriteTarget>;
}

export type CommodoreSpriteTemplateId = 'blank-hires' | 'blank-multicolor';

export interface CommodoreSpriteTemplate {
  id: CommodoreSpriteTemplateId;
  label: string;
  description: string;
  defaultName: string;
  defaultFileName: string;
  colorMode: CommodoreSpriteColorMode;
}

export interface CommodoreSpriteMachineOption {
  id: CommodoreSpriteMachineId;
  label: string;
  description: string;
  defaultTarget: CommodoreSpriteTarget;
  notes: readonly string[];
}

export const COMMODORE_SPRITE_GEOMETRY: CommodoreSpriteGeometry = {
  width: 24,
  height: 21,
  multicolorWidth: 12,
  bytesPerRow: 3,
  dataBytes: 63,
  slotBytes: 64,
  bitOrder: 'msb-left',
  byteOrder: 'row-major',
  hardware: 'vic-ii-sprite'
};

export const DEFAULT_SPRITE_FRAME_DURATION_MS = 120;
export const MIN_SPRITE_FRAME_DURATION_MS = 16;
export const MAX_SPRITE_FRAME_DURATION_MS = 5000;

export const COMMODORE_SPRITE_TEMPLATES: readonly CommodoreSpriteTemplate[] = [
  {
    id: 'blank-hires',
    label: 'Blank single-color sprite',
    description: '24 x 21 VIC-II sprite using one sprite color',
    defaultName: 'Blank Sprite',
    defaultFileName: 'untitled-sprite',
    colorMode: 'hires'
  },
  {
    id: 'blank-multicolor',
    label: 'Blank multi-color sprite',
    description: '12 x 21 wide-pixel sprite using shared multicolor registers',
    defaultName: 'Blank Multi-color Sprite',
    defaultFileName: 'untitled-multicolor-sprite',
    colorMode: 'multicolor'
  }
];

export const COMMODORE_SPRITE_MACHINE_OPTIONS: readonly CommodoreSpriteMachineOption[] = [
  {
    id: 'c64',
    label: 'C64',
    description: 'Commodore 64 VIC-II sprite data',
    defaultTarget: createDefaultSpriteTarget('c64'),
    notes: [
      'Uses the standard VIC-II 64-byte sprite slot layout.',
      'Sprite pointers live at screen RAM + $03F8 through $03FF.'
    ]
  },
  {
    id: 'c128',
    label: 'C128',
    description: 'Commodore 128 VIC-IIe 40-column sprite data',
    defaultTarget: createDefaultSpriteTarget('c128'),
    notes: [
      'Targets the C128 40-column VIC-IIe path; the 80-column VDC has no hardware sprites.',
      'The byte layout and sprite pointer rules are C64-compatible in VIC-IIe mode.'
    ]
  },
  {
    id: 'c64dtv',
    label: 'C64DTV',
    description: 'C64DTV VIC-II-compatible sprite data',
    defaultTarget: createDefaultSpriteTarget('c64dtv'),
    notes: [
      'Targets C64DTV-compatible sprite memory while preserving standard 64-byte sprite slots.',
      'Extended palette intent is tracked as metadata; the bitmap bytes remain VIC-II compatible.'
    ]
  },
  {
    id: 'generic',
    label: 'Generic 24 x 21',
    description: 'Portable 64-byte sprite asset for custom pipelines',
    defaultTarget: createDefaultSpriteTarget('generic'),
    notes: [
      'Stores portable 24 by 21 row-major sprite bytes without assuming a fixed screen or VIC bank.'
    ]
  }
];

const EMPTY_SPRITE_DATA = '00'.repeat(COMMODORE_SPRITE_GEOMETRY.slotBytes);
const HEX_BYTE = /^[0-9a-f]{2}$/iu;
const ASSEMBLER_LABEL = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function createDefaultSpriteDocument(
  name = 'Untitled Sprite',
  options: CommodoreSpriteDocumentOptions = {}
): CommodoreSpriteDocument {
  const colors = options.colors ?? {};
  const machine = normalizeMachine(options.machine, 'c64');
  const frameData = options.data
    ? bytesToHex(normalizeSpriteBytes(options.data))
    : EMPTY_SPRITE_DATA;
  const frames = normalizeSpriteFrames(
    options.frames ?? [
      {
        name: 'Frame 1',
        durationMs: options.animation?.defaultFrameDurationMs ??
          DEFAULT_SPRITE_FRAME_DURATION_MS,
        data: frameData
      }
    ]
  );
  return {
    format: COMMODORE_SPRITE_FORMAT,
    version: COMMODORE_SPRITE_VERSION,
    metadata: {
      name,
      machine
    },
    geometry: COMMODORE_SPRITE_GEOMETRY,
    colorMode: options.colorMode === 'multicolor' ? 'multicolor' : 'hires',
    colors: {
      background: normalizeColorIndex(colors.background, 6),
      foreground: normalizeColorIndex(colors.foreground, 1),
      multicolor1: normalizeColorIndex(colors.multicolor1, 14),
      multicolor2: normalizeColorIndex(colors.multicolor2, 2)
    },
    data: frames[0]?.data ?? EMPTY_SPRITE_DATA,
    frames,
    animation: normalizeSpriteAnimation(options.animation),
    target: normalizeSpriteTarget(options.target, machine)
  };
}

export function createSpriteDocumentFromTemplate(
  templateId: CommodoreSpriteTemplateId,
  name?: string
): CommodoreSpriteDocument {
  const template = COMMODORE_SPRITE_TEMPLATES.find(
    (entry) => entry.id === templateId
  );
  return createDefaultSpriteDocument(name ?? template?.defaultName, {
    colorMode: template?.colorMode
  });
}

export function createSpriteFrame(
  name = 'Frame',
  data = EMPTY_SPRITE_DATA,
  durationMs = DEFAULT_SPRITE_FRAME_DURATION_MS
): CommodoreSpriteFrame {
  return normalizeSpriteFrame({ name, data, durationMs }, 0);
}

export function parseSpriteDocument(content: string): CommodoreSpriteDocument {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Sprite file must contain a JSON object.');
  }
  if (parsed.format !== COMMODORE_SPRITE_FORMAT) {
    throw new Error(`Unsupported sprite format '${String(parsed.format)}'.`);
  }
  if (parsed.version !== COMMODORE_SPRITE_VERSION) {
    throw new Error(`Unsupported sprite version '${String(parsed.version)}'.`);
  }

  return normalizeSpriteDocument(parsed);
}

export function serializeSpriteDocument(
  document: CommodoreSpriteDocument
): string {
  const normalized = normalizeSpriteDocument(document);
  const { name: _name, ...metadata } = normalized.metadata;
  return `${JSON.stringify({ ...normalized, metadata }, null, 2)}\n`;
}

export function normalizeSpriteDocument(value: unknown): CommodoreSpriteDocument {
  const object = isRecord(value) ? value : {};
  const metadata = isRecord(object.metadata) ? object.metadata : {};
  const colors = isRecord(object.colors) ? object.colors : {};
  const fallback = createDefaultSpriteDocument(
    typeof metadata.name === 'string' ? metadata.name : undefined
  );
  const machine = normalizeMachine(metadata.machine, fallback.metadata.machine);
  const rawFrames = Array.isArray(object.frames) && object.frames.length > 0
    ? object.frames
    : [
        {
          name: 'Frame 1',
          durationMs: fallback.animation.defaultFrameDurationMs,
          data: object.data
        }
      ];
  const frames = normalizeSpriteFrames(rawFrames);

  return {
    format: COMMODORE_SPRITE_FORMAT,
    version: COMMODORE_SPRITE_VERSION,
    metadata: {
      name: normalizeString(metadata.name, fallback.metadata.name),
      machine,
      ...(typeof metadata.author === 'string' && metadata.author.trim()
        ? { author: metadata.author.trim() }
        : {}),
      ...(typeof metadata.description === 'string' && metadata.description.trim()
        ? { description: metadata.description.trim() }
        : {})
    },
    geometry: COMMODORE_SPRITE_GEOMETRY,
    colorMode: object.colorMode === 'multicolor' ? 'multicolor' : 'hires',
    colors: {
      background: normalizeColorIndex(colors.background, fallback.colors.background),
      foreground: normalizeColorIndex(colors.foreground, fallback.colors.foreground),
      multicolor1: normalizeColorIndex(colors.multicolor1, fallback.colors.multicolor1),
      multicolor2: normalizeColorIndex(colors.multicolor2, fallback.colors.multicolor2)
    },
    data: frames[0]?.data ?? EMPTY_SPRITE_DATA,
    frames,
    animation: normalizeSpriteAnimation(object.animation),
    target: normalizeSpriteTarget(object.target, machine)
  };
}

export function spriteToBytes(
  document: CommodoreSpriteDocument,
  frameIndex = 0
): Uint8Array {
  return bytesFromHex(getSpriteFrameData(document, frameIndex));
}

export function spriteSheetToBytes(document: CommodoreSpriteDocument): Uint8Array {
  const normalized = normalizeSpriteDocument(document);
  const bytes = new Uint8Array(
    normalized.frames.length * COMMODORE_SPRITE_GEOMETRY.slotBytes
  );
  normalized.frames.forEach((frame, index) => {
    bytes.set(bytesFromHex(frame.data), index * COMMODORE_SPRITE_GEOMETRY.slotBytes);
  });
  return bytes;
}

export function bytesToSpriteDocument(
  bytes: Uint8Array,
  name = 'Imported Sprite',
  options: CommodoreSpriteDocumentOptions = {}
): CommodoreSpriteDocument {
  return bytesToSpriteSheetDocument(bytes, name, options);
}

export function bytesToSpriteSheetDocument(
  bytes: Uint8Array,
  name = 'Imported Sprite Sheet',
  options: CommodoreSpriteDocumentOptions = {}
): CommodoreSpriteDocument {
  const body = bytes.slice(rawSpriteDataOffset(bytes));
  const chunkSize = spriteImportChunkSize(body);
  const frameCount = Math.max(1, Math.ceil(body.length / chunkSize));
  const frames = Array.from({ length: frameCount }, (_unused, index) => {
    const start = index * chunkSize;
    const chunk = body.slice(start, start + chunkSize);
    return createSpriteFrame(
      frameCount === 1 ? 'Frame 1' : `Frame ${index + 1}`,
      bytesToHex(normalizeSpriteBytes(chunk)),
      options.animation?.defaultFrameDurationMs ?? DEFAULT_SPRITE_FRAME_DURATION_MS
    );
  });

  return createDefaultSpriteDocument(name, {
    ...options,
    frames
  });
}

export function formatKickAssemblerSprite(
  document: CommodoreSpriteDocument,
  label = 'SpriteData'
): string {
  const normalized = normalizeSpriteDocument(document);
  const safeLabel = toAssemblerLabel(label);
  const lines = [
    `// ${normalized.metadata.name}`,
    `// Format: ${COMMODORE_SPRITE_FORMAT} v${COMMODORE_SPRITE_VERSION}`,
    `// Layout: ${normalized.frames.length} frame(s), 24 x 21 VIC-II sprite slots`,
    `// Mode: ${normalized.colorMode === 'multicolor' ? 'multi-color' : 'single-color'}`,
    `// Target: ${normalized.metadata.machine}, data ${formatAddress(normalized.target.spriteDataAddress)}, pointer ${normalized.target.spritePointerIndex}`,
    `// Colors: background $${hexByte(normalized.colors.background)}, sprite $${hexByte(normalized.colors.foreground)}, multi 0 $${hexByte(normalized.colors.multicolor1)}, multi 1 $${hexByte(normalized.colors.multicolor2)}`,
    '',
    `${safeLabel}:`
  ];

  normalized.frames.forEach((frame, frameIndex) => {
    const bytes = bytesFromHex(frame.data);
    if (normalized.frames.length > 1) {
      lines.push(`${safeLabel}_Frame_${frameIndex.toString().padStart(2, '0')}:`);
    }
    lines.push(`    // ${frame.name}, ${frame.durationMs} ms`);
    for (let row = 0; row < COMMODORE_SPRITE_GEOMETRY.height; row += 1) {
      const start = row * COMMODORE_SPRITE_GEOMETRY.bytesPerRow;
      const rowBytes = Array.from(
        bytes.slice(start, start + COMMODORE_SPRITE_GEOMETRY.bytesPerRow),
        (byte) => `$${hexByte(byte)}`
      );
      lines.push(`    .byte ${rowBytes.join(', ')} // frame ${frameIndex}, y=${row.toString().padStart(2, '0')}`);
    }
    lines.push(`    .byte $${hexByte(bytes[63] ?? 0)} // unused sprite slot byte`);
  });

  if (normalized.frames.length > 1) {
    lines.push(`${safeLabel}_End:`);
    lines.push(`${safeLabel}_FrameCount:`);
    lines.push(`    .byte ${normalized.frames.length}`);
    lines.push(`${safeLabel}_FrameDurations:`);
    lines.push(
      `    .word ${normalized.frames.map((frame) => frame.durationMs).join(', ')}`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function parseKickAssemblerSpriteSheet(
  source: string,
  label: string,
  name = label,
  options: CommodoreSpriteDocumentOptions = {}
): CommodoreSpriteDocument {
  const safeLabel = label.trim();
  if (!ASSEMBLER_LABEL.test(safeLabel)) {
    throw new Error(`Invalid assembler label: ${label}`);
  }

  const bytes = collectAssemblerBytesForLabel(source, safeLabel);
  if (bytes.length === 0) {
    throw new Error(`No literal .byte data found for label ${safeLabel}.`);
  }

  return bytesToSpriteSheetDocument(new Uint8Array(bytes), name, options);
}

export function getSpriteFrameData(
  document: CommodoreSpriteDocument,
  frameIndex = 0
): string {
  const normalized = normalizeSpriteDocument(document);
  const frame = normalized.frames[clampFrameIndex(normalized, frameIndex)];
  return frame?.data ?? EMPTY_SPRITE_DATA;
}

export function replaceSpriteFrameData(
  document: CommodoreSpriteDocument,
  frameIndex: number,
  data: string | Uint8Array
): CommodoreSpriteDocument {
  const normalized = normalizeSpriteDocument(document);
  const index = clampFrameIndex(normalized, frameIndex);
  const frames = normalized.frames.map((frame, currentIndex) =>
    currentIndex === index
      ? {
          ...frame,
          data: typeof data === 'string'
            ? normalizeSpriteDataHex(data)
            : bytesToHex(normalizeSpriteBytes(data))
        }
      : frame
  );
  return {
    ...normalized,
    data: frames[0]?.data ?? EMPTY_SPRITE_DATA,
    frames
  };
}

export function getSpriteByte(
  document: CommodoreSpriteDocument,
  row: number,
  byteColumn: number,
  frameIndex = 0
): number {
  if (
    row < 0 ||
    row >= COMMODORE_SPRITE_GEOMETRY.height ||
    byteColumn < 0 ||
    byteColumn >= COMMODORE_SPRITE_GEOMETRY.bytesPerRow
  ) {
    return 0;
  }

  const data = getSpriteFrameData(document, frameIndex);
  const byteOffset = (row * COMMODORE_SPRITE_GEOMETRY.bytesPerRow) + byteColumn;
  return Number.parseInt(data.slice(byteOffset * 2, byteOffset * 2 + 2), 16) || 0;
}

export function setSpriteByte(
  document: CommodoreSpriteDocument,
  row: number,
  byteColumn: number,
  value: number,
  frameIndex = 0
): CommodoreSpriteDocument {
  if (
    row < 0 ||
    row >= COMMODORE_SPRITE_GEOMETRY.height ||
    byteColumn < 0 ||
    byteColumn >= COMMODORE_SPRITE_GEOMETRY.bytesPerRow
  ) {
    return document;
  }

  const data = getSpriteFrameData(document, frameIndex);
  const byteOffset = (row * COMMODORE_SPRITE_GEOMETRY.bytesPerRow) + byteColumn;
  return replaceSpriteFrameData(
    document,
    frameIndex,
    `${data.slice(0, byteOffset * 2)}${hexByte(value)}${data.slice(byteOffset * 2 + 2)}`
  );
}

export function setHiresSpritePixel(
  document: CommodoreSpriteDocument,
  x: number,
  y: number,
  enabled: boolean,
  frameIndex = 0
): CommodoreSpriteDocument {
  if (
    x < 0 ||
    x >= COMMODORE_SPRITE_GEOMETRY.width ||
    y < 0 ||
    y >= COMMODORE_SPRITE_GEOMETRY.height
  ) {
    return document;
  }

  const byteColumn = Math.floor(x / 8);
  const bit = 7 - (x % 8);
  const rowValue = getSpriteByte(document, y, byteColumn, frameIndex);
  const nextValue = enabled
    ? rowValue | (1 << bit)
    : rowValue & ~(1 << bit);
  return setSpriteByte(document, y, byteColumn, nextValue, frameIndex);
}

export function setMulticolorSpritePixel(
  document: CommodoreSpriteDocument,
  pairIndex: number,
  y: number,
  colorValue: number,
  frameIndex = 0
): CommodoreSpriteDocument {
  if (
    pairIndex < 0 ||
    pairIndex >= COMMODORE_SPRITE_GEOMETRY.multicolorWidth ||
    y < 0 ||
    y >= COMMODORE_SPRITE_GEOMETRY.height
  ) {
    return document;
  }

  const byteColumn = Math.floor(pairIndex / 4);
  const shift = (3 - (pairIndex % 4)) * 2;
  const rowValue = getSpriteByte(document, y, byteColumn, frameIndex);
  const nextValue = (rowValue & ~(0x03 << shift)) |
    ((colorValue & 0x03) << shift);
  return setSpriteByte(document, y, byteColumn, nextValue, frameIndex);
}

export function transformSprite(
  document: CommodoreSpriteDocument,
  transform: (bytes: number[]) => number[],
  frameIndex = 0
): CommodoreSpriteDocument {
  const bytes = Array.from(spriteToBytes(document, frameIndex));
  const transformed = transform(bytes);
  const next = new Uint8Array(COMMODORE_SPRITE_GEOMETRY.slotBytes);
  for (let index = 0; index < next.length; index += 1) {
    next[index] = transformed[index] ?? 0;
  }
  return replaceSpriteFrameData(document, frameIndex, next);
}

export function defaultSpriteTargetForMachine(
  machine: string
): CommodoreSpriteTarget {
  return createDefaultSpriteTarget(normalizeMachine(machine, 'c64'));
}

export function spritePointerValue(
  target: CommodoreSpriteTarget
): number | undefined {
  const bankBase = target.vicBank * 0x4000;
  const offset = target.spriteDataAddress - bankBase;
  if (offset < 0 || offset >= 0x4000 || offset % COMMODORE_SPRITE_GEOMETRY.slotBytes !== 0) {
    return undefined;
  }
  return (offset / COMMODORE_SPRITE_GEOMETRY.slotBytes) & 0xff;
}

function normalizeSpriteFrames(value: readonly unknown[]): CommodoreSpriteFrame[] {
  const frames = value.map((entry, index) => normalizeSpriteFrame(entry, index));
  return frames.length > 0 ? frames : [createSpriteFrame('Frame 1')];
}

function normalizeSpriteFrame(value: unknown, index: number): CommodoreSpriteFrame {
  const object = isRecord(value) ? value : {};
  return {
    name: normalizeString(object.name, `Frame ${index + 1}`),
    durationMs: normalizeDuration(object.durationMs, DEFAULT_SPRITE_FRAME_DURATION_MS),
    data: normalizeSpriteDataHex(object.data)
  };
}

function normalizeSpriteAnimation(value: unknown): CommodoreSpriteAnimation {
  const object = isRecord(value) ? value : {};
  return {
    playback: object.playback === 'once' || object.playback === 'ping-pong'
      ? object.playback
      : 'loop',
    defaultFrameDurationMs: normalizeDuration(
      object.defaultFrameDurationMs,
      DEFAULT_SPRITE_FRAME_DURATION_MS
    )
  };
}

function normalizeSpriteTarget(
  value: unknown,
  machine: string
): CommodoreSpriteTarget {
  const object = isRecord(value) ? value : {};
  const fallback = createDefaultSpriteTarget(machine);
  return {
    spriteDataAddress: normalizeWord(object.spriteDataAddress, fallback.spriteDataAddress),
    spritePointerIndex: normalizeInteger(object.spritePointerIndex, fallback.spritePointerIndex, 0, 7),
    screenAddress: normalizeWord(object.screenAddress, fallback.screenAddress),
    vicBank: normalizeInteger(object.vicBank, fallback.vicBank, 0, 3),
    c128VicMode: object.c128VicMode === 'c128-40-column'
      ? 'c128-40-column'
      : fallback.c128VicMode,
    c64dtvExtendedPalette: typeof object.c64dtvExtendedPalette === 'boolean'
      ? object.c64dtvExtendedPalette
      : fallback.c64dtvExtendedPalette
  };
}

function createDefaultSpriteTarget(machine: string): CommodoreSpriteTarget {
  return {
    spriteDataAddress: 0x2000,
    spritePointerIndex: 0,
    screenAddress: 0x0400,
    vicBank: 0,
    c128VicMode: machine === 'c128' ? 'c128-40-column' : 'c64-compatible',
    c64dtvExtendedPalette: machine === 'c64dtv'
  };
}

function normalizeSpriteDataHex(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9a-f]/giu, '').slice(
      0,
      COMMODORE_SPRITE_GEOMETRY.slotBytes * 2
    );
    return normalized
      .padEnd(COMMODORE_SPRITE_GEOMETRY.slotBytes * 2, '0')
      .toUpperCase();
  }
  if (Array.isArray(value)) {
    return bytesToHex(
      normalizeSpriteBytes(
        new Uint8Array(value.map((entry) => normalizeByte(entry)))
      )
    );
  }
  return EMPTY_SPRITE_DATA;
}

function normalizeSpriteBytes(bytes: Uint8Array): Uint8Array {
  const normalized = new Uint8Array(COMMODORE_SPRITE_GEOMETRY.slotBytes);
  normalized.set(bytes.slice(0, COMMODORE_SPRITE_GEOMETRY.slotBytes));
  return normalized;
}

function rawSpriteDataOffset(bytes: Uint8Array): number {
  if (bytes.length <= COMMODORE_SPRITE_GEOMETRY.slotBytes) {
    return 0;
  }
  if (
    bytes.length === COMMODORE_SPRITE_GEOMETRY.dataBytes + 2 ||
    bytes.length === COMMODORE_SPRITE_GEOMETRY.slotBytes + 2
  ) {
    return 2;
  }

  const payloadLength = bytes.length - 2;
  if (
    payloadLength >= COMMODORE_SPRITE_GEOMETRY.dataBytes &&
    (
      payloadLength % COMMODORE_SPRITE_GEOMETRY.slotBytes === 0 ||
      payloadLength % COMMODORE_SPRITE_GEOMETRY.dataBytes === 0
    )
  ) {
    return 2;
  }

  return 0;
}

function spriteImportChunkSize(bytes: Uint8Array): number {
  return bytes.length > 0 &&
    bytes.length % COMMODORE_SPRITE_GEOMETRY.slotBytes !== 0 &&
    bytes.length % COMMODORE_SPRITE_GEOMETRY.dataBytes === 0
      ? COMMODORE_SPRITE_GEOMETRY.dataBytes
      : COMMODORE_SPRITE_GEOMETRY.slotBytes;
}

function collectAssemblerBytesForLabel(source: string, label: string): number[] {
  const lines = source.split(/\r?\n/u);
  const bytes: number[] = [];
  let inSymbol = false;

  for (const line of lines) {
    const labelMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/u.exec(line);
    if (labelMatch) {
      const currentLabel = labelMatch[1] ?? '';
      if (currentLabel === label) {
        inSymbol = true;
      } else if (
        inSymbol &&
        currentLabel !== `${label}_End` &&
        !currentLabel.startsWith(`${label}_Frame_`)
      ) {
        break;
      } else if (inSymbol && currentLabel === `${label}_End`) {
        break;
      }
    }

    if (!inSymbol) {
      continue;
    }

    const directiveMatch = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*:)?\s*\.(?:byte|by|bytes)\b(.+)$/iu.exec(
      stripAssemblerComment(line)
    );
    if (!directiveMatch) {
      continue;
    }

    bytes.push(...parseAssemblerByteValues(directiveMatch[1] ?? ''));
  }

  return bytes;
}

function parseAssemblerByteValues(value: string): number[] {
  const bytes: number[] = [];
  for (const token of value.split(/[\s,]+/u).map((entry) => entry.trim()).filter(Boolean)) {
    const byte = parseAssemblerByteValue(token);
    if (byte !== undefined) {
      bytes.push(byte);
    }
  }
  return bytes;
}

function parseAssemblerByteValue(value: string): number | undefined {
  const token = value.replace(/[()]/gu, '').trim();
  if (/^\$[0-9a-f]{1,2}$/iu.test(token)) {
    return Number.parseInt(token.slice(1), 16) & 0xff;
  }
  if (/^0x[0-9a-f]{1,2}$/iu.test(token)) {
    return Number.parseInt(token.slice(2), 16) & 0xff;
  }
  if (/^%[01]{1,8}$/u.test(token)) {
    return Number.parseInt(token.slice(1), 2) & 0xff;
  }
  if (/^\d{1,3}$/u.test(token)) {
    const parsed = Number.parseInt(token, 10);
    return parsed >= 0 && parsed <= 255 ? parsed : undefined;
  }
  return undefined;
}

function stripAssemblerComment(value: string): string {
  return value.replace(/\/\/.*$/u, '').replace(/;.*$/u, '');
}

function clampFrameIndex(
  document: CommodoreSpriteDocument,
  frameIndex: number
): number {
  const max = Math.max(0, document.frames.length - 1);
  return Math.max(0, Math.min(max, Math.trunc(frameIndex)));
}

function normalizeByte(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value & 0xff;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^\$/u, '');
    if (HEX_BYTE.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }
  }
  return 0;
}

function normalizeColorIndex(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(15, Math.trunc(value)))
    : fallback;
}

function normalizeDuration(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return normalizeInteger(
    value,
    fallback,
    MIN_SPRITE_FRAME_DURATION_MS,
    MAX_SPRITE_FRAME_DURATION_MS
  );
}

function normalizeWord(value: unknown, fallback: number): number {
  return normalizeInteger(value, fallback, 0, 0xffff);
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeMachine(value: unknown, fallback: string): CommodoreSpriteMachineId {
  if (typeof value !== 'string' || !value.trim()) {
    return fallbackMachine(fallback);
  }
  const normalized = value.trim().toLowerCase();
  return isKnownMachine(normalized) ? normalized : fallbackMachine(fallback);
}

function fallbackMachine(value: string): CommodoreSpriteMachineId {
  return isKnownMachine(value) ? value : 'c64';
}

function isKnownMachine(value: string): value is CommodoreSpriteMachineId {
  return value === 'c64' ||
    value === 'c128' ||
    value === 'c64dtv' ||
    value === 'generic';
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, hexByte).join('');
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function formatAddress(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
}

function toAssemblerLabel(value: string): string {
  const label = value
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (!label) {
    return 'SpriteData';
  }
  return /^[A-Za-z_]/u.test(label) ? label : `SpriteData_${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
