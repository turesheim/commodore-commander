export const COMMODORE_CHARACTER_SET_FORMAT = 'commodore-commander.charset';
export const COMMODORE_CHARACTER_SET_VERSION = 1;
export const COMMODORE_CHARACTER_SET_FILE_EXTENSION = '.charset';
export const COMMODORE_LEGACY_CHARACTER_SET_FILE_EXTENSION = '.cccharset';
export const COMMODORE_RAW_CHARACTER_SET_FILE_EXTENSION = '.64c';

export type CommodoreCharacterColorMode = 'hires' | 'multicolor';

export interface CommodoreCharacterSetColors {
  background: number;
  foreground: number;
  multicolor1: number;
  multicolor2: number;
}

export interface CommodoreCharacterSetGeometry {
  glyphWidth: 8;
  glyphHeight: 8;
  glyphCount: 256;
  bytesPerGlyph: 8;
  bitOrder: 'msb-left';
  byteOrder: 'row-major';
  characterOrder: 'screen-code';
}

export interface CommodoreCharacterSetMetadata {
  name: string;
  machine: string;
  author?: string;
  description?: string;
}

export interface CommodoreCharacterSetTarget {
  characterDataAddress: number;
}

export interface CommodoreCharacterSetDocument {
  format: typeof COMMODORE_CHARACTER_SET_FORMAT;
  version: typeof COMMODORE_CHARACTER_SET_VERSION;
  metadata: CommodoreCharacterSetMetadata;
  geometry: CommodoreCharacterSetGeometry;
  colorMode: CommodoreCharacterColorMode;
  colors: CommodoreCharacterSetColors;
  target: CommodoreCharacterSetTarget;
  glyphs: string[];
}

export type CommodoreCharacterSetTemplateId =
  | 'blank'
  | 'c64-upper-graphics'
  | 'c64-lower-upper'
  | 'pet-lower-upper';

export interface CommodoreCharacterSetTemplate {
  id: CommodoreCharacterSetTemplateId;
  label: string;
  description: string;
  defaultName: string;
  defaultFileName: string;
}

export const COMMODORE_CHARACTER_SET_GEOMETRY: CommodoreCharacterSetGeometry = {
  glyphWidth: 8,
  glyphHeight: 8,
  glyphCount: 256,
  bytesPerGlyph: 8,
  bitOrder: 'msb-left',
  byteOrder: 'row-major',
  characterOrder: 'screen-code'
};

export const C64_COLOR_PALETTE = Object.freeze([
  { index: 0, name: 'Black', hex: '#000000', text: '#f2f2f2' },
  { index: 1, name: 'White', hex: '#ffffff', text: '#111111' },
  { index: 2, name: 'Red', hex: '#813338', text: '#ffffff' },
  { index: 3, name: 'Cyan', hex: '#75cec8', text: '#111111' },
  { index: 4, name: 'Purple', hex: '#8e3c97', text: '#ffffff' },
  { index: 5, name: 'Green', hex: '#56ac4d', text: '#111111' },
  { index: 6, name: 'Blue', hex: '#2e2c9b', text: '#ffffff' },
  { index: 7, name: 'Yellow', hex: '#edf171', text: '#111111' },
  { index: 8, name: 'Orange', hex: '#8e5029', text: '#ffffff' },
  { index: 9, name: 'Brown', hex: '#553800', text: '#ffffff' },
  { index: 10, name: 'Light Red', hex: '#c46c71', text: '#111111' },
  { index: 11, name: 'Dark Grey', hex: '#4a4a4a', text: '#ffffff' },
  { index: 12, name: 'Grey', hex: '#7b7b7b', text: '#111111' },
  { index: 13, name: 'Light Green', hex: '#a9ff9f', text: '#111111' },
  { index: 14, name: 'Light Blue', hex: '#706deb', text: '#ffffff' },
  { index: 15, name: 'Light Grey', hex: '#b2b2b2', text: '#111111' }
]);

export const COMMODORE_CHARACTER_SET_TEMPLATES: readonly CommodoreCharacterSetTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Empty 256-character set',
    defaultName: 'Blank Character Set',
    defaultFileName: 'blank-charset'
  },
  {
    id: 'c64-upper-graphics',
    label: 'C64 uppercase/graphics',
    description: 'Bundled C64 upper/graphics character ROM',
    defaultName: 'C64 Uppercase Graphics',
    defaultFileName: 'c64-upper-graphics'
  },
  {
    id: 'c64-lower-upper',
    label: 'C64 lowercase/uppercase',
    description: 'Bundled C64 lower/upper character ROM',
    defaultName: 'C64 Lowercase Uppercase',
    defaultFileName: 'c64-lower-upper'
  },
  {
    id: 'pet-lower-upper',
    label: 'PET lowercase/uppercase',
    description: 'Bundled PET lower/upper character ROM',
    defaultName: 'PET Lowercase Uppercase',
    defaultFileName: 'pet-lower-upper'
  }
];

const EMPTY_GLYPH = '0000000000000000';
const HEX_BYTE = /^[0-9a-f]{2}$/iu;
const HEX_GLYPH = /^[0-9a-f]{16}$/iu;
const CHARACTER_SET_LOAD_ADDRESS_ALIGNMENT = 0x0800;

export function createDefaultCharacterSetDocument(
  name = 'Untitled Character Set'
): CommodoreCharacterSetDocument {
  return {
    format: COMMODORE_CHARACTER_SET_FORMAT,
    version: COMMODORE_CHARACTER_SET_VERSION,
    metadata: {
      name,
      machine: 'c64'
    },
    geometry: COMMODORE_CHARACTER_SET_GEOMETRY,
    colorMode: 'hires',
    colors: {
      background: 6,
      foreground: 1,
      multicolor1: 14,
      multicolor2: 2
    },
    target: createDefaultCharacterSetTarget(),
    glyphs: Array.from(
      { length: COMMODORE_CHARACTER_SET_GEOMETRY.glyphCount },
      () => EMPTY_GLYPH
    )
  };
}

export function createCharacterSetDocumentFromTemplate(
  templateId: CommodoreCharacterSetTemplateId,
  name?: string
): CommodoreCharacterSetDocument {
  const template = COMMODORE_CHARACTER_SET_TEMPLATES.find(
    (entry) => entry.id === templateId
  );
  if (!template) {
    return createDefaultCharacterSetDocument(name);
  }

  if (template.id === 'blank') {
    return createDefaultCharacterSetDocument(name ?? template.defaultName);
  }

  const bytes = bytesFromHex(characterSetTemplateHex(template.id));
  const document = bytesToCharacterSetDocument(bytes, name ?? template.defaultName);
  return {
    ...document,
    metadata: {
      ...document.metadata,
      machine: template.id.startsWith('c64-') ? 'c64' : 'pet',
      description: template.description
    }
  };
}

export function parseCharacterSetDocument(
  content: string
): CommodoreCharacterSetDocument {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Character set file must contain a JSON object.');
  }
  if (parsed.format !== COMMODORE_CHARACTER_SET_FORMAT) {
    throw new Error(
      `Unsupported character set format '${String(parsed.format)}'.`
    );
  }
  if (parsed.version !== COMMODORE_CHARACTER_SET_VERSION) {
    throw new Error(
      `Unsupported character set version '${String(parsed.version)}'.`
    );
  }

  return normalizeCharacterSetDocument(parsed);
}

export function serializeCharacterSetDocument(
  document: CommodoreCharacterSetDocument
): string {
  const normalized = normalizeCharacterSetDocument(document);
  const { name: _name, ...metadata } = normalized.metadata;
  return `${JSON.stringify({ ...normalized, metadata }, null, 2)}\n`;
}

export function normalizeCharacterSetDocument(
  value: unknown
): CommodoreCharacterSetDocument {
  const object = isRecord(value) ? value : {};
  const metadata = isRecord(object.metadata) ? object.metadata : {};
  const colors = isRecord(object.colors) ? object.colors : {};
  const fallback = createDefaultCharacterSetDocument(
    typeof metadata.name === 'string' ? metadata.name : undefined
  );
  const glyphs = Array.isArray(object.glyphs)
    ? object.glyphs.map(normalizeGlyphHex)
    : [];

  return {
    format: COMMODORE_CHARACTER_SET_FORMAT,
    version: COMMODORE_CHARACTER_SET_VERSION,
    metadata: {
      name: normalizeString(metadata.name, fallback.metadata.name),
      machine: normalizeString(metadata.machine, fallback.metadata.machine),
      ...(typeof metadata.author === 'string' && metadata.author.trim()
        ? { author: metadata.author.trim() }
        : {}),
      ...(typeof metadata.description === 'string' && metadata.description.trim()
        ? { description: metadata.description.trim() }
        : {})
    },
    geometry: COMMODORE_CHARACTER_SET_GEOMETRY,
    colorMode: object.colorMode === 'multicolor' ? 'multicolor' : 'hires',
    colors: {
      background: normalizeColorIndex(colors.background, fallback.colors.background),
      foreground: normalizeColorIndex(colors.foreground, fallback.colors.foreground),
      multicolor1: normalizeColorIndex(colors.multicolor1, fallback.colors.multicolor1),
      multicolor2: normalizeColorIndex(colors.multicolor2, fallback.colors.multicolor2)
    },
    target: normalizeCharacterSetTarget(object.target),
    glyphs: Array.from(
      { length: COMMODORE_CHARACTER_SET_GEOMETRY.glyphCount },
      (_, index) => glyphs[index] ?? EMPTY_GLYPH
    )
  };
}

export function characterSetToBytes(
  document: CommodoreCharacterSetDocument
): Uint8Array {
  const normalized = normalizeCharacterSetDocument(document);
  const bytes = new Uint8Array(
    normalized.geometry.glyphCount * normalized.geometry.bytesPerGlyph
  );
  normalized.glyphs.forEach((glyph, glyphIndex) => {
    for (let row = 0; row < normalized.geometry.bytesPerGlyph; row += 1) {
      bytes[glyphIndex * normalized.geometry.bytesPerGlyph + row] =
        Number.parseInt(glyph.slice(row * 2, row * 2 + 2), 16);
    }
  });
  return bytes;
}

export function bytesToCharacterSetDocument(
  bytes: Uint8Array,
  name = 'Imported Character Set'
): CommodoreCharacterSetDocument {
  const document = createDefaultCharacterSetDocument(name);
  const byteLength =
    document.geometry.glyphCount * document.geometry.bytesPerGlyph;
  const offset = hasRawCharacterSetLoadAddress(bytes, byteLength) ? 2 : 0;
  const body = bytes.slice(
    offset,
    offset + byteLength
  );
  for (let glyphIndex = 0; glyphIndex < document.geometry.glyphCount; glyphIndex += 1) {
    const start = glyphIndex * document.geometry.bytesPerGlyph;
    const glyphBytes = body.slice(start, start + document.geometry.bytesPerGlyph);
    if (glyphBytes.length === document.geometry.bytesPerGlyph) {
      document.glyphs[glyphIndex] = Array.from(glyphBytes, hexByte).join('');
    }
  }
  return document;
}

function hasRawCharacterSetLoadAddress(
  bytes: Uint8Array,
  byteLength: number
): boolean {
  if (bytes.length <= 2 || bytes.length === byteLength) {
    return false;
  }
  if (bytes.length === byteLength + 2) {
    return true;
  }

  const loadAddress = bytes[0] | (bytes[1] << 8);
  if (
    loadAddress < CHARACTER_SET_LOAD_ADDRESS_ALIGNMENT ||
    loadAddress % CHARACTER_SET_LOAD_ADDRESS_ALIGNMENT !== 0
  ) {
    return false;
  }

  return bytes.length % COMMODORE_CHARACTER_SET_GEOMETRY.bytesPerGlyph !== 0 ||
    (bytes.length - 2) % byteLength === 0;
}

export function formatKickAssemblerCharacterSet(
  document: CommodoreCharacterSetDocument,
  label = 'CharacterSet'
): string {
  const normalized = normalizeCharacterSetDocument(document);
  const safeLabel = toAssemblerLabel(label);
  const lines = [
    `// ${normalized.metadata.name}`,
    `// Format: ${COMMODORE_CHARACTER_SET_FORMAT} v${COMMODORE_CHARACTER_SET_VERSION}`,
    `// Layout: 256 characters, 8 bytes per character, screen-code order, MSB-left rows`,
    '',
    `${safeLabel}:`
  ];

  normalized.glyphs.forEach((glyph, index) => {
    const bytes = glyph.match(/../gu) ?? [];
    lines.push(
      `    .byte ${bytes.map((byte) => `$${byte.toUpperCase()}`).join(', ')} ` +
        `// char $${hexByte(index)}`
    );
  });

  return `${lines.join('\n')}\n`;
}

export function getGlyphByte(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  row: number
): number {
  const glyph = document.glyphs[glyphIndex] ?? EMPTY_GLYPH;
  return Number.parseInt(glyph.slice(row * 2, row * 2 + 2), 16) || 0;
}

export function setGlyphByte(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  row: number,
  value: number
): CommodoreCharacterSetDocument {
  const glyphs = [...document.glyphs];
  const glyph = glyphs[glyphIndex] ?? EMPTY_GLYPH;
  glyphs[glyphIndex] =
    `${glyph.slice(0, row * 2)}${hexByte(value)}${glyph.slice(row * 2 + 2)}`;
  return {
    ...document,
    glyphs
  };
}

export function setHiresPixel(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  x: number,
  y: number,
  enabled: boolean
): CommodoreCharacterSetDocument {
  const bit = 7 - x;
  const rowValue = getGlyphByte(document, glyphIndex, y);
  const nextValue = enabled
    ? rowValue | (1 << bit)
    : rowValue & ~(1 << bit);
  return setGlyphByte(document, glyphIndex, y, nextValue);
}

export function setMulticolorPixel(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  pairIndex: number,
  y: number,
  colorValue: number
): CommodoreCharacterSetDocument {
  const shift = (3 - pairIndex) * 2;
  const rowValue = getGlyphByte(document, glyphIndex, y);
  const nextValue = (rowValue & ~(0x03 << shift)) |
    ((colorValue & 0x03) << shift);
  return setGlyphByte(document, glyphIndex, y, nextValue);
}

export function transformGlyph(
  document: CommodoreCharacterSetDocument,
  glyphIndex: number,
  transform: (bytes: number[]) => number[]
): CommodoreCharacterSetDocument {
  const bytes = Array.from(
    { length: document.geometry.bytesPerGlyph },
    (_, row) => getGlyphByte(document, glyphIndex, row)
  );
  const transformed = transform(bytes).slice(0, document.geometry.bytesPerGlyph);
  let next = document;
  transformed.forEach((byte, row) => {
    next = setGlyphByte(next, glyphIndex, row, byte);
  });
  return next;
}

function normalizeCharacterSetTarget(value: unknown): CommodoreCharacterSetTarget {
  const object = isRecord(value) ? value : {};
  const fallback = createDefaultCharacterSetTarget();
  return {
    characterDataAddress: normalizeWord(
      object.characterDataAddress,
      fallback.characterDataAddress
    )
  };
}

function createDefaultCharacterSetTarget(): CommodoreCharacterSetTarget {
  return {
    characterDataAddress: 0x2000
  };
}

function normalizeGlyphHex(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9a-f]/giu, '').slice(0, 16);
    if (HEX_GLYPH.test(normalized)) {
      return normalized.toUpperCase();
    }
    if (normalized.length > 0) {
      return normalized.padEnd(16, '0').toUpperCase();
    }
  }
  if (Array.isArray(value)) {
    const bytes = value
      .slice(0, 8)
      .map((entry) => normalizeByte(entry))
      .map(hexByte);
    return bytes.length > 0
      ? bytes.join('').padEnd(16, '0').toUpperCase()
      : EMPTY_GLYPH;
  }
  return EMPTY_GLYPH;
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

function normalizeWord(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(0xffff, Math.trunc(value)));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^\$/u, '');
    const parsed = Number.parseInt(trimmed, 16);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(0xffff, parsed));
    }
  }
  return fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function bytesFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function characterSetTemplateHex(
  templateId: CommodoreCharacterSetTemplateId
): string {
  switch (templateId) {
    case 'c64-upper-graphics':
      return C64_UPPER_GRAPHICS_CHARACTER_SET_HEX;
    case 'c64-lower-upper':
      return C64_LOWER_UPPER_CHARACTER_SET_HEX;
    case 'pet-lower-upper':
      return PET_LOWER_UPPER_CHARACTER_SET_HEX;
    case 'blank':
      return '';
  }
}

function toAssemblerLabel(value: string): string {
  const label = value
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (!label) {
    return 'CharacterSet';
  }
  return /^[A-Za-z_]/u.test(label) ? label : `CharacterSet_${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const C64_UPPER_GRAPHICS_CHARACTER_SET_HEX = [
  '3C666E6E60623C00183C667E666666007C66667C66667C003C66606060663C00786C6666666C78007E60607860607E007E606078606060003C66606E66663C00',
  '6666667E666666003C18181818183C001E0C0C0C0C6C3800666C7870786C66006060606060607E0063777F6B6363630066767E7E6E6666003C66666666663C00',
  '7C66667C606060003C666666663C0E007C66667C786C66003C66603C06663C007E181818181818006666666666663C0066666666663C18006363636B7F776300',
  '66663C183C6666006666663C181818007E060C1830607E003C30303030303C000C12307C3062FC003C0C0C0C0C0C3C0000183C7E181818180010307F7F301000',
  '0000000000000000181818180000180066666600000000006666FF66FF666600183E603C067C180062660C18306646003C663C3867663F00060C180000000000',
  '0C18303030180C0030180C0C0C18300000663CFF3C6600000018187E1818000000000000001818300000007E0000000000000000001818000003060C18306000',
  '3C666E7666663C001818381818187E003C66060C30607E003C66061C06663C00060E1E667F0606007E607C0606663C003C66607C66663C007E660C1818181800',
  '3C66663C66663C003C66663E06663C00000018000018000000001800001818300E18306030180E0000007E007E00000070180C060C1870003C66060C18001800',
  '000000FFFF000000081C3E7F7F1C3E001818181818181818000000FFFF0000000000FFFF0000000000FFFF000000000000000000FFFF00003030303030303030',
  '0C0C0C0C0C0C0C0C000000E0F038181818181C0F07000000181838F0E0000000C0C0C0C0C0C0FFFFC0E070381C0E070303070E1C3870E0C0FFFFC0C0C0C0C0C0',
  'FFFF030303030303003C7E7E7E7E3C000000000000FFFF00367F7F7F3E1C08006060606060606060000000070F1C1818C3E77E3C3C7EE7C3003C7E66667E3C00',
  '1818666618183C000606060606060606081C3E7F3E1C0800181818FFFF181818C0C03030C0C0303018181818181818180000033E76363600FF7F3F1F0F070301',
  '0000000000000000F0F0F0F0F0F0F0F000000000FFFFFFFFFF0000000000000000000000000000FFC0C0C0C0C0C0C0C0CCCC3333CCCC33330303030303030303',
  '00000000CCCC3333FFFEFCF8F0E0C08003030303030303031818181F1F181818000000000F0F0F0F1818181F1F000000000000F8F8181818000000000000FFFF',
  '0000001F1F181818181818FFFF000000000000FFFF181818181818F8F8181818C0C0C0C0C0C0C0C0E0E0E0E0E0E0E0E00707070707070707FFFF000000000000',
  'FFFFFF00000000000000000000FFFFFF030303030303FFFF00000000F0F0F0F00F0F0F0F00000000181818F8F8000000F0F0F0F000000000F0F0F0F00F0F0F0F',
  'C39991919F99C3FFE7C39981999999FF83999983999983FFC3999F9F9F99C3FF87939999999387FF819F9F879F9F81FF819F9F879F9F9FFFC3999F919999C3FF',
  '99999981999999FFC3E7E7E7E7E7C3FFE1F3F3F3F393C7FF9993878F879399FF9F9F9F9F9F9F81FF9C8880949C9C9CFF99898181919999FFC39999999999C3FF',
  '839999839F9F9FFFC399999999C3F1FF83999983879399FFC3999FC3F999C3FF81E7E7E7E7E7E7FF999999999999C3FF9999999999C3E7FF9C9C9C9480889CFF',
  '9999C3E7C39999FF999999C3E7E7E7FF81F9F3E7CF9F81FFC3CFCFCFCFCFC3FFF3EDCF83CF9D03FFC3F3F3F3F3F3C3FFFFE7C381E7E7E7E7FFEFCF8080CFEFFF',
  'FFFFFFFFFFFFFFFFE7E7E7E7FFFFE7FF999999FFFFFFFFFF99990099009999FFE7C19FC3F983E7FF9D99F3E7CF99B9FFC399C3C79899C0FFF9F3E7FFFFFFFFFF',
  'F3E7CFCFCFE7F3FFCFE7F3F3F3E7CFFFFF99C300C399FFFFFFE7E781E7E7FFFFFFFFFFFFFFE7E7CFFFFFFF81FFFFFFFFFFFFFFFFFFE7E7FFFFFCF9F3E7CF9FFF',
  'C39991899999C3FFE7E7C7E7E7E781FFC399F9F3CF9F81FFC399F9E3F999C3FFF9F1E19980F9F9FF819F83F9F999C3FFC3999F839999C3FF8199F3E7E7E7E7FF',
  'C39999C39999C3FFC39999C1F999C3FFFFFFE7FFFFE7FFFFFFFFE7FFFFE7E7CFF1E7CF9FCFE7F1FFFFFF81FF81FFFFFF8FE7F3F9F3E78FFFC399F9F3E7FFE7FF',
  'FFFFFF0000FFFFFFF7E3C18080E3C1FFE7E7E7E7E7E7E7E7FFFFFF0000FFFFFFFFFF0000FFFFFFFFFF0000FFFFFFFFFFFFFFFFFF0000FFFFCFCFCFCFCFCFCFCF',
  'F3F3F3F3F3F3F3F3FFFFFF1F0FC7E7E7E7E7E3F0F8FFFFFFE7E7C70F1FFFFFFF3F3F3F3F3F3F00003F1F8FC7E3F1F8FCFCF8F1E3C78F1F3F00003F3F3F3F3F3F',
  '0000FCFCFCFCFCFCFFC381818181C3FFFFFFFFFFFF0000FFC9808080C1E3F7FF9F9F9F9F9F9F9F9FFFFFFFF8F0E3E7E73C1881C3C381183CFFC381999981C3FF',
  'E7E79999E7E7C3FFF9F9F9F9F9F9F9F9F7E3C180C1E3F7FFE7E7E70000E7E7E73F3FCFCF3F3FCFCFE7E7E7E7E7E7E7E7FFFFFCC189C9C9FF0080C0E0F0F8FCFE',
  'FFFFFFFFFFFFFFFF0F0F0F0F0F0F0F0FFFFFFFFF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFF003F3F3F3F3F3F3F3F3333CCCC3333CCCCFCFCFCFCFCFCFCFC',
  'FFFFFFFF3333CCCC000103070F1F3F7FFCFCFCFCFCFCFCFCE7E7E7E0E0E7E7E7FFFFFFFFF0F0F0F0E7E7E7E0E0FFFFFFFFFFFF0707E7E7E7FFFFFFFFFFFF0000',
  'FFFFFFE0E0E7E7E7E7E7E70000FFFFFFFFFFFF0000E7E7E7E7E7E70707E7E7E73F3F3F3F3F3F3F3F1F1F1F1F1F1F1F1FF8F8F8F8F8F8F8F80000FFFFFFFFFFFF',
  '000000FFFFFFFFFFFFFFFFFFFF000000FCFCFCFCFCFC0000FFFFFFFF0F0F0F0FF0F0F0F0FFFFFFFFE7E7E70707FFFFFF0F0F0F0FFFFFFFFF0F0F0F0FF0F0F0F0',
].join('');

const C64_LOWER_UPPER_CHARACTER_SET_HEX = [
  '3C666E6E60623C0000003C063E663E000060607C66667C0000003C6060603C000006063E66663E0000003C667E603C00000E183E1818180000003E66663E067C',
  '0060607C666666000018003818183C00000600060606063C0060606C786C66000038181818183C000000667F7F6B630000007C666666660000003C6666663C00',
  '00007C66667C606000003E66663E060600007C666060600000003E603C067C0000187E1818180E000000666666663E0000006666663C18000000636B7F3E3600',
  '0000663C183C660000006666663E0C7800007E0C18307E003C30303030303C000C12307C3062FC003C0C0C0C0C0C3C0000183C7E181818180010307F7F301000',
  '0000000000000000181818180000180066666600000000006666FF66FF666600183E603C067C180062660C18306646003C663C3867663F00060C180000000000',
  '0C18303030180C0030180C0C0C18300000663CFF3C6600000018187E1818000000000000001818300000007E0000000000000000001818000003060C18306000',
  '3C666E7666663C001818381818187E003C66060C30607E003C66061C06663C00060E1E667F0606007E607C0606663C003C66607C66663C007E660C1818181800',
  '3C66663C66663C003C66663E06663C00000018000018000000001800001818300E18306030180E0000007E007E00000070180C060C1870003C66060C18001800',
  '000000FFFF000000183C667E666666007C66667C66667C003C66606060663C00786C6666666C78007E60607860607E007E606078606060003C66606E66663C00',
  '6666667E666666003C18181818183C001E0C0C0C0C6C3800666C7870786C66006060606060607E0063777F6B6363630066767E7E6E6666003C66666666663C00',
  '7C66667C606060003C666666663C0E007C66667C786C66003C66603C06663C007E181818181818006666666666663C0066666666663C18006363636B7F776300',
  '66663C183C6666006666663C181818007E060C1830607E00181818FFFF181818C0C03030C0C0303018181818181818183333CCCC3333CCCC3399CC663399CC66',
  '0000000000000000F0F0F0F0F0F0F0F000000000FFFFFFFFFF0000000000000000000000000000FFC0C0C0C0C0C0C0C0CCCC3333CCCC33330303030303030303',
  '00000000CCCC3333CC993366CC99336603030303030303031818181F1F181818000000000F0F0F0F1818181F1F000000000000F8F8181818000000000000FFFF',
  '0000001F1F181818181818FFFF000000000000FFFF181818181818F8F8181818C0C0C0C0C0C0C0C0E0E0E0E0E0E0E0E00707070707070707FFFF000000000000',
  'FFFFFF00000000000000000000FFFFFF0103066C7870600000000000F0F0F0F00F0F0F0F00000000181818F8F8000000F0F0F0F000000000F0F0F0F00F0F0F0F',
  'C39991919F99C3FFFFFFC3F9C199C1FFFF9F9F83999983FFFFFFC39F9F9FC3FFFFF9F9C19999C1FFFFFFC399819FC3FFFFF1E7C1E7E7E7FFFFFFC19999C1F983',
  'FF9F9F83999999FFFFE7FFC7E7E7C3FFFFF9FFF9F9F9F9C3FF9F9F93879399FFFFC7E7E7E7E7C3FFFFFF998080949CFFFFFF8399999999FFFFFFC3999999C3FF',
  'FFFF839999839F9FFFFFC19999C1F9F9FFFF83999F9F9FFFFFFFC19FC3F983FFFFE781E7E7E7F1FFFFFF99999999C1FFFFFF999999C3E7FFFFFF9C9480C1C9FF',
  'FFFF99C3E7C399FFFFFF999999C1F387FFFF81F3E7CF81FFC3CFCFCFCFCFC3FFF3EDCF83CF9D03FFC3F3F3F3F3F3C3FFFFE7C381E7E7E7E7FFEFCF8080CFEFFF',
  'FFFFFFFFFFFFFFFFE7E7E7E7FFFFE7FF999999FFFFFFFFFF99990099009999FFE7C19FC3F983E7FF9D99F3E7CF99B9FFC399C3C79899C0FFF9F3E7FFFFFFFFFF',
  'F3E7CFCFCFE7F3FFCFE7F3F3F3E7CFFFFF99C300C399FFFFFFE7E781E7E7FFFFFFFFFFFFFFE7E7CFFFFFFF81FFFFFFFFFFFFFFFFFFE7E7FFFFFCF9F3E7CF9FFF',
  'C39991899999C3FFE7E7C7E7E7E781FFC399F9F3CF9F81FFC399F9E3F999C3FFF9F1E19980F9F9FF819F83F9F999C3FFC3999F839999C3FF8199F3E7E7E7E7FF',
  'C39999C39999C3FFC39999C1F999C3FFFFFFE7FFFFE7FFFFFFFFE7FFFFE7E7CFF1E7CF9FCFE7F1FFFFFF81FF81FFFFFF8FE7F3F9F3E78FFFC399F9F3E7FFE7FF',
  'FFFFFF0000FFFFFFE7C39981999999FF83999983999983FFC3999F9F9F99C3FF87939999999387FF819F9F879F9F81FF819F9F879F9F9FFFC3999F919999C3FF',
  '99999981999999FFC3E7E7E7E7E7C3FFE1F3F3F3F393C7FF9993878F879399FF9F9F9F9F9F9F81FF9C8880949C9C9CFF99898181919999FFC39999999999C3FF',
  '839999839F9F9FFFC399999999C3F1FF83999983879399FFC3999FC3F999C3FF81E7E7E7E7E7E7FF999999999999C3FF9999999999C3E7FF9C9C9C9480889CFF',
  '9999C3E7C39999FF999999C3E7E7E7FF81F9F3E7CF9F81FFE7E7E70000E7E7E73F3FCFCF3F3FCFCFE7E7E7E7E7E7E7E7CCCC3333CCCC3333CC663399CC663399',
  'FFFFFFFFFFFFFFFF0F0F0F0F0F0F0F0FFFFFFFFF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFF003F3F3F3F3F3F3F3F3333CCCC3333CCCCFCFCFCFCFCFCFCFC',
  'FFFFFFFF3333CCCC3366CC993366CC99FCFCFCFCFCFCFCFCE7E7E7E0E0E7E7E7FFFFFFFFF0F0F0F0E7E7E7E0E0FFFFFFFFFFFF0707E7E7E7FFFFFFFFFFFF0000',
  'FFFFFFE0E0E7E7E7E7E7E70000FFFFFFFFFFFF0000E7E7E7E7E7E70707E7E7E73F3F3F3F3F3F3F3F1F1F1F1F1F1F1F1FF8F8F8F8F8F8F8F80000FFFFFFFFFFFF',
  '000000FFFFFFFFFFFFFFFFFFFF000000FEFCF993878F9FFFFFFFFFFF0F0F0F0FF0F0F0F0FFFFFFFFE7E7E70707FFFFFF0F0F0F0FFFFFFFFF0F0F0F0FF0F0F0F0',
].join('');

const PET_LOWER_UPPER_CHARACTER_SET_HEX = [
  '1C224A564C201E00000038043C443A0040405C6242625C0000003C4240423C0002023A4642463A0000003C427E403C000C12107C1010100000003A46463A023C',
  '40405C62424242000800180808081C0004000C040404443840404448506844001808080808081C00000076494949490000005C624242420000003C4242423C00',
  '00005C62625C404000003A46463A020200005C624040400000003E403C027C0010107C1010120C000000424242463A0000004242422418000000414949493600',
  '000042241824420000004242463A023C00007E0418207E003C20202020203C0000402010080402003C04040404043C0000081C2A08080808000010207F201000',
  '00000000000000000808080800000800242424000000000024247E247E242400081E281C0A3C08000062640810264600304848304A443A000408100000000000',
  '04081010100804002010080808102000082A1C3E1C2A08000008083E0808000000000000000808100000007E0000000000000000001818000002040810204000',
  '3C42465A62423C000818280808083E003C42020C30407E003C42021C02423C00040C14247E0404007E407804024438001C20407C42423C007E42040810101000',
  '3C42423C42423C003C42423E02043800000008000008000000000800000808100E18306030180E0000007E007E00000070180C060C1870003C42020C10001000',
  '00000000FF0000001824427E424242007C22223C22227C001C22404040221C0078242222222478007E40407840407E007E404078404040001C22404E42221C00',
  '4242427E424242001C08080808081C000E0404040444380042444870484442004040404040407E0042665A5A424242004262524A464242001824424242241800',
  '7C42427C40404000182442424A241A007C42427C484442003C42403C02423C003E080808080808004242424242423C0042424224241818004242425A5A664200',
  '42422418244242002222221C080808007E02041820407E0008080808FF080808A050A050A050A0500808080808080808CCCC3333CCCC3333CC663399CC663399',
  '0000000000000000F0F0F0F0F0F0F0F000000000FFFFFFFFFF0000000000000000000000000000FF8080808080808080AA55AA55AA55AA550101010101010101',
  '00000000AA55AA55993366CC993366CC0303030303030303080808080F080808000000000F0F0F0F080808080F00000000000000F8080808000000000000FFFF',
  '000000000F08080808080808FF00000000000000FF08080808080808F8080808C0C0C0C0C0C0C0C0E0E0E0E0E0E0E0E00707070707070707FFFF000000000000',
  'FFFFFF00000000000000000000FFFFFF010244485060400000000000F0F0F0F00F0F0F0F0000000008080808F8000000F0F0F0F000000000F0F0F0F00F0F0F0F',
  'E3DDB5A9B3DFE1FFFFFFC7FBC3BBC5FFBFBFA39DBD9DA3FFFFFFC3BDBFBDC3FFFDFDC5B9BDB9C5FFFFFFC3BD81BFC3FFF3EDEF83EFEFEFFFFFFFC5B9B9C5FDC3',
  'BFBFA39DBDBDBDFFF7FFE7F7F7F7E3FFFBFFF3FBFBFBBBC7BFBFBBB7AF97BBFFE7F7F7F7F7F7E3FFFFFF89B6B6B6B6FFFFFFA39DBDBDBDFFFFFFC3BDBDBDC3FF',
  'FFFFA39D9DA3BFBFFFFFC5B9B9C5FDFDFFFFA39DBFBFBFFFFFFFC1BFC3FD83FFEFEF83EFEFEDF3FFFFFFBDBDBDB9C5FFFFFFBDBDBDDBE7FFFFFFBEB6B6B6C9FF',
  'FFFFBDDBE7DBBDFFFFFFBDBDB9C5FDC3FFFF81FBE7DF81FFC3DFDFDFDFDFC3FFFFBFDFEFF7FBFDFFC3FBFBFBFBFBC3FFFFF7E3D5F7F7F7F7FFFFEFDF80DFEFFF',
  'FFFFFFFFFFFFFFFFF7F7F7F7FFFFF7FFDBDBDBFFFFFFFFFFDBDB81DB81DBDBFFF7E1D7E3F5C3F7FFFF9D9BF7EFD9B9FFCFB7B7CFB5BBC5FFFBF7EFFFFFFFFFFF',
  'FBF7EFEFEFF7FBFFDFEFF7F7F7EFDFFFF7D5E3C1E3D5F7FFFFF7F7C1F7F7FFFFFFFFFFFFFFF7F7EFFFFFFF81FFFFFFFFFFFFFFFFFFE7E7FFFFFDFBF7EFDFBFFF',
  'C3BDB9A59DBDC3FFF7E7D7F7F7F7C1FFC3BDFDF3CFBF81FFC3BDFDE3FDBDC3FFFBF3EBDB81FBFBFF81BF87FBFDBBC7FFE3DFBF83BDBDC3FF81BDFBF7EFEFEFFF',
  'C3BDBDC3BDBDC3FFC3BDBDC1FDFBC7FFFFFFF7FFFFF7FFFFFFFFF7FFFFF7F7EFF1E7CF9FCFE7F1FFFFFF81FF81FFFFFF8FE7F3F9F3E78FFFC3BDFDF3EFFFEFFF',
  'FFFFFFFF00FFFFFFE7DBBD81BDBDBDFF83DDDDC3DDDD83FFE3DDBFBFBFDDE3FF87DBDDDDDDDB87FF81BFBF87BFBF81FF81BFBF87BFBFBFFFE3DDBFB1BDDDE3FF',
  'BDBDBD81BDBDBDFFE3F7F7F7F7F7E3FFF1FBFBFBFBBBC7FFBDBBB78FB7BBBDFFBFBFBFBFBFBF81FFBD99A5A5BDBDBDFFBD9DADB5B9BDBDFFE7DBBDBDBDDBE7FF',
  '83BDBD83BFBFBFFFE7DBBDBDB5DBE5FF83BDBD83B7BBBDFFC3BDBFC3FDBDC3FFC1F7F7F7F7F7F7FFBDBDBDBDBDBDC3FFBDBDBDDBDBE7E7FFBDBDBDA5A599BDFF',
  'BDBDDBE7DBBDBDFFDDDDDDE3F7F7F7FF81FDFBE7DFBF81FFF7F7F7F700F7F7F75FAF5FAF5FAF5FAFF7F7F7F7F7F7F7F73333CCCC3333CCCC3399CC663399CC66',
  'FFFFFFFFFFFFFFFF0F0F0F0F0F0F0F0FFFFFFFFF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFF007F7F7F7F7F7F7F7F55AA55AA55AA55AAFEFEFEFEFEFEFEFE',
  'FFFFFFFF55AA55AA66CC993366CC9933FCFCFCFCFCFCFCFCF7F7F7F7F0F7F7F7FFFFFFFFF0F0F0F0F7F7F7F7F0FFFFFFFFFFFFFF07F7F7F7FFFFFFFFFFFF0000',
  'FFFFFFFFF0F7F7F7F7F7F7F700FFFFFFFFFFFFFF00F7F7F7F7F7F7F707F7F7F73F3F3F3F3F3F3F3F1F1F1F1F1F1F1F1FF8F8F8F8F8F8F8F80000FFFFFFFFFFFF',
  '000000FFFFFFFFFFFFFFFFFFFF000000FEFDBBB7AF9FBFFFFFFFFFFF0F0F0F0FF0F0F0F0FFFFFFFFF7F7F7F707FFFFFF0F0F0F0FFFFFFFFF0F0F0F0FF0F0F0F0',
].join('');
