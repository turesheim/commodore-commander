import {
  COMMODORE_CHARACTER_SET_GEOMETRY,
  bytesToCharacterSetDocument,
  createCharacterSetDocumentFromTemplate,
  normalizeCharacterSetDocument,
  type CommodoreCharacterColorMode,
  type CommodoreCharacterSetDocument,
  type CommodoreCharacterSetTemplateId
} from './commodore-character-set-format';

export const COMMODORE_SCREEN_FORMAT = 'commodore-commander.screen';
export const COMMODORE_SCREEN_VERSION = 1;
export const COMMODORE_SCREEN_FILE_EXTENSION = '.screen';
export const COMMODORE_RAW_SCREEN_FILE_EXTENSION = '.scr';
export const COMMODORE_RAW_COLOR_FILE_EXTENSION = '.col';
export const COMMODORE_SEQ_SCREEN_FILE_EXTENSION = '.seq';

export const COMMODORE_SCREEN_DEFAULT_COLUMNS = 40;
export const COMMODORE_SCREEN_DEFAULT_ROWS = 25;
export const COMMODORE_SCREEN_MIN_COLUMNS = 1;
export const COMMODORE_SCREEN_MAX_COLUMNS = 160;
export const COMMODORE_SCREEN_MIN_ROWS = 1;
export const COMMODORE_SCREEN_MAX_ROWS = 100;

export type CommodoreScreenColorMode = CommodoreCharacterColorMode;

export interface CommodoreScreenColors {
  border: number;
  background: number;
  foreground: number;
  multicolor1: number;
  multicolor2: number;
}

export interface CommodoreScreenGeometry {
  columns: number;
  rows: number;
  characterWidth: 8;
  characterHeight: 8;
  characterOrder: 'screen-code';
}

export interface CommodoreScreenMetadata {
  name: string;
  machine: string;
  author?: string;
  description?: string;
}

export interface CommodoreScreenCharacterSet {
  name: string;
  glyphs: string[];
}

export interface CommodoreScreenCell {
  character: number;
  color: number;
}

export interface CommodoreScreenTarget {
  screenAddress: number;
  colorAddress: number;
  characterDataAddress: number;
}

export interface CommodoreScreenDocument {
  format: typeof COMMODORE_SCREEN_FORMAT;
  version: typeof COMMODORE_SCREEN_VERSION;
  metadata: CommodoreScreenMetadata;
  geometry: CommodoreScreenGeometry;
  colorMode: CommodoreScreenColorMode;
  colors: CommodoreScreenColors;
  characterSet: CommodoreScreenCharacterSet;
  target: CommodoreScreenTarget;
  cells: CommodoreScreenCell[];
}

export interface CommodoreScreenDocumentOptions {
  readonly columns?: number;
  readonly rows?: number;
  readonly characterSetTemplateId?: CommodoreCharacterSetTemplateId;
  readonly target?: Partial<CommodoreScreenTarget>;
}

export interface CommodoreScreenSeqImportResult {
  readonly document: CommodoreScreenDocument;
  readonly importedCharacters: number;
}

const EMPTY_GLYPH = '0000000000000000';
const HEX_GLYPH = /^[0-9a-f]{16}$/iu;
const C64_DEFAULT_TEXT_COLOR = 14;
const PETSCII_REVERSE_OFFSET = 0x80;
const PETSCII_REVERSE_ON = 0x12;
const PETSCII_REVERSE_OFF = 0x92;
const PETSCII_CLEAR_SCREEN = 0x93;
const PETSCII_LOWER_UPPER_CHARSET = 0x0e;
const PETSCII_UPPER_GRAPHICS_CHARSET = 0x8e;
const PETSCII_DELETE = 0x14;
const PETSCII_QUOTE = 0x22;
const C64_COLOR_PETSCII_CODES = [
  0x90,
  0x05,
  0x1c,
  0x9f,
  0x9c,
  0x1e,
  0x1f,
  0x9e,
  0x81,
  0x95,
  0x96,
  0x97,
  0x98,
  0x99,
  0x9a,
  0x9b
] as const;
const PETSCII_COLOR_CODES: ReadonlyMap<number, number> = new Map(
  C64_COLOR_PETSCII_CODES.map((code, index) => [code, index])
);

export function createDefaultScreenDocument(
  name = 'Untitled Screen',
  options: CommodoreScreenDocumentOptions = {}
): CommodoreScreenDocument {
  const columns = normalizeDimension(
    options.columns,
    COMMODORE_SCREEN_DEFAULT_COLUMNS,
    COMMODORE_SCREEN_MIN_COLUMNS,
    COMMODORE_SCREEN_MAX_COLUMNS
  );
  const rows = normalizeDimension(
    options.rows,
    COMMODORE_SCREEN_DEFAULT_ROWS,
    COMMODORE_SCREEN_MIN_ROWS,
    COMMODORE_SCREEN_MAX_ROWS
  );
  const characterSet = createCharacterSetDocumentFromTemplate(
    options.characterSetTemplateId ?? 'c64-lower-upper',
    `${name} Character Set`
  );

  return createScreenDocumentFromCharacterSet(
    characterSet,
    name,
    columns,
    rows,
    options.target
  );
}

export function createScreenDocumentFromCharacterSet(
  characterSet: CommodoreCharacterSetDocument,
  name = 'Untitled Screen',
  columns = COMMODORE_SCREEN_DEFAULT_COLUMNS,
  rows = COMMODORE_SCREEN_DEFAULT_ROWS,
  target?: Partial<CommodoreScreenTarget>
): CommodoreScreenDocument {
  const normalizedCharacterSet = normalizeCharacterSetDocument(characterSet);
  const normalizedColumns = normalizeDimension(
    columns,
    COMMODORE_SCREEN_DEFAULT_COLUMNS,
    COMMODORE_SCREEN_MIN_COLUMNS,
    COMMODORE_SCREEN_MAX_COLUMNS
  );
  const normalizedRows = normalizeDimension(
    rows,
    COMMODORE_SCREEN_DEFAULT_ROWS,
    COMMODORE_SCREEN_MIN_ROWS,
    COMMODORE_SCREEN_MAX_ROWS
  );

  return {
    format: COMMODORE_SCREEN_FORMAT,
    version: COMMODORE_SCREEN_VERSION,
    metadata: {
      name,
      machine: normalizedCharacterSet.metadata.machine || 'c64'
    },
    geometry: {
      columns: normalizedColumns,
      rows: normalizedRows,
      characterWidth: COMMODORE_CHARACTER_SET_GEOMETRY.glyphWidth,
      characterHeight: COMMODORE_CHARACTER_SET_GEOMETRY.glyphHeight,
      characterOrder: COMMODORE_CHARACTER_SET_GEOMETRY.characterOrder
    },
    colorMode: normalizedCharacterSet.colorMode,
    colors: {
      border: 14,
      background: normalizedCharacterSet.colors.background,
      foreground: normalizedCharacterSet.colors.foreground,
      multicolor1: normalizedCharacterSet.colors.multicolor1,
      multicolor2: normalizedCharacterSet.colors.multicolor2
    },
    characterSet: {
      name: normalizedCharacterSet.metadata.name,
      glyphs: [...normalizedCharacterSet.glyphs]
    },
    target: normalizeScreenTarget(target),
    cells: Array.from(
      { length: normalizedColumns * normalizedRows },
      () => ({
        character: 32,
        color: normalizedCharacterSet.colors.foreground
      })
    )
  };
}

export function parseScreenDocument(content: string): CommodoreScreenDocument {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Screen file must contain a JSON object.');
  }
  if (parsed.format !== COMMODORE_SCREEN_FORMAT) {
    throw new Error(`Unsupported screen format '${String(parsed.format)}'.`);
  }
  if (parsed.version !== COMMODORE_SCREEN_VERSION) {
    throw new Error(`Unsupported screen version '${String(parsed.version)}'.`);
  }

  return normalizeScreenDocument(parsed);
}

export function serializeScreenDocument(
  document: CommodoreScreenDocument
): string {
  const normalized = normalizeScreenDocument(document);
  const { name: _name, ...metadata } = normalized.metadata;
  return `${JSON.stringify({ ...normalized, metadata }, null, 2)}\n`;
}

export function normalizeScreenDocument(value: unknown): CommodoreScreenDocument {
  const object = isRecord(value) ? value : {};
  const metadata = isRecord(object.metadata) ? object.metadata : {};
  const geometry = isRecord(object.geometry) ? object.geometry : {};
  const colors = isRecord(object.colors) ? object.colors : {};
  const fallback = createDefaultScreenDocument(
    typeof metadata.name === 'string' ? metadata.name : undefined
  );
  const columns = normalizeDimension(
    geometry.columns,
    fallback.geometry.columns,
    COMMODORE_SCREEN_MIN_COLUMNS,
    COMMODORE_SCREEN_MAX_COLUMNS
  );
  const rows = normalizeDimension(
    geometry.rows,
    fallback.geometry.rows,
    COMMODORE_SCREEN_MIN_ROWS,
    COMMODORE_SCREEN_MAX_ROWS
  );
  const characterSet = normalizeScreenCharacterSet(object.characterSet, fallback);
  const foreground = normalizeColorIndex(colors.foreground, fallback.colors.foreground);
  const cells = Array.isArray(object.cells) ? object.cells : [];

  return {
    format: COMMODORE_SCREEN_FORMAT,
    version: COMMODORE_SCREEN_VERSION,
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
    geometry: {
      columns,
      rows,
      characterWidth: COMMODORE_CHARACTER_SET_GEOMETRY.glyphWidth,
      characterHeight: COMMODORE_CHARACTER_SET_GEOMETRY.glyphHeight,
      characterOrder: COMMODORE_CHARACTER_SET_GEOMETRY.characterOrder
    },
    colorMode: object.colorMode === 'multicolor' ? 'multicolor' : 'hires',
    colors: {
      border: normalizeColorIndex(colors.border, fallback.colors.border),
      background: normalizeColorIndex(colors.background, fallback.colors.background),
      foreground,
      multicolor1: normalizeColorIndex(colors.multicolor1, fallback.colors.multicolor1),
      multicolor2: normalizeColorIndex(colors.multicolor2, fallback.colors.multicolor2)
    },
    characterSet,
    target: normalizeScreenTarget(object.target),
    cells: Array.from(
      { length: columns * rows },
      (_, index) => normalizeScreenCell(cells[index], foreground)
    )
  };
}

export function replaceScreenCharacterSet(
  document: CommodoreScreenDocument,
  characterSet: CommodoreCharacterSetDocument
): CommodoreScreenDocument {
  const normalizedDocument = normalizeScreenDocument(document);
  const normalizedCharacterSet = normalizeCharacterSetDocument(characterSet);
  return {
    ...normalizedDocument,
    metadata: {
      ...normalizedDocument.metadata,
      machine: normalizedCharacterSet.metadata.machine
    },
    colorMode: normalizedCharacterSet.colorMode,
    colors: {
      ...normalizedDocument.colors,
      background: normalizedCharacterSet.colors.background,
      foreground: normalizedCharacterSet.colors.foreground,
      multicolor1: normalizedCharacterSet.colors.multicolor1,
      multicolor2: normalizedCharacterSet.colors.multicolor2
    },
    characterSet: {
      name: normalizedCharacterSet.metadata.name,
      glyphs: [...normalizedCharacterSet.glyphs]
    }
  };
}

export function applyScreenCodeSequence(
  document: CommodoreScreenDocument,
  bytes: Uint8Array
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  return {
    ...normalized,
    cells: Array.from(
      { length: normalized.geometry.columns * normalized.geometry.rows },
      (_, index) => {
        const existing = normalized.cells[index];
        return {
          character: index < bytes.length ? bytes[index] ?? 32 : 32,
          color: existing?.color ?? normalized.colors.foreground
        };
      }
    )
  };
}

export function applySeqScreenImport(
  document: CommodoreScreenDocument,
  bytes: Uint8Array
): CommodoreScreenSeqImportResult {
  return applyPetsciiControlStream(document, bytes);
}

export function screenToCharacterBytes(
  document: CommodoreScreenDocument
): Uint8Array {
  const normalized = normalizeScreenDocument(document);
  return Uint8Array.from(normalized.cells, cell => cell.character & 0xff);
}

export function screenToColorBytes(document: CommodoreScreenDocument): Uint8Array {
  const normalized = normalizeScreenDocument(document);
  return Uint8Array.from(normalized.cells, cell => cell.color & 0x0f);
}

export function screenToSeqBytes(document: CommodoreScreenDocument): Uint8Array {
  const normalized = normalizeScreenDocument(document);
  const bytes: number[] = [
    PETSCII_CLEAR_SCREEN,
    screenToPetsciiCharacterSetControl(normalized)
  ];
  let currentColor = C64_DEFAULT_TEXT_COLOR;
  let reverse = false;

  for (const cell of normalized.cells) {
    const color = cell.color & 0x0f;
    if (color !== currentColor) {
      bytes.push(C64_COLOR_PETSCII_CODES[color]);
      currentColor = color;
    }

    const character = cell.character & 0xff;
    const cellReverse = character >= PETSCII_REVERSE_OFFSET;
    if (cellReverse !== reverse) {
      bytes.push(cellReverse ? PETSCII_REVERSE_ON : PETSCII_REVERSE_OFF);
      reverse = cellReverse;
    }

    const screenCode = character & 0x7f;
    bytes.push(screenCodeToPetsciiPrintable(screenCode));
    if (screenCode === PETSCII_QUOTE) {
      bytes.push(PETSCII_QUOTE, PETSCII_DELETE);
    }
  }

  bytes.push(PETSCII_REVERSE_OFF);
  return Uint8Array.from(bytes);
}

export function applyScreenColorBytes(
  document: CommodoreScreenDocument,
  bytes: Uint8Array
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  return {
    ...normalized,
    cells: normalized.cells.map((cell, index) => ({
      ...cell,
      color: index < bytes.length ? bytes[index] & 0x0f : cell.color
    }))
  };
}

export function screenCharacterSetToBytes(
  document: CommodoreScreenDocument
): Uint8Array {
  const normalized = normalizeScreenDocument(document);
  const bytes = new Uint8Array(
    COMMODORE_CHARACTER_SET_GEOMETRY.glyphCount *
      COMMODORE_CHARACTER_SET_GEOMETRY.bytesPerGlyph
  );
  normalized.characterSet.glyphs.forEach((glyph, glyphIndex) => {
    for (let row = 0; row < COMMODORE_CHARACTER_SET_GEOMETRY.bytesPerGlyph; row += 1) {
      bytes[glyphIndex * COMMODORE_CHARACTER_SET_GEOMETRY.bytesPerGlyph + row] =
        Number.parseInt(glyph.slice(row * 2, row * 2 + 2), 16) || 0;
    }
  });
  return bytes;
}

export function replaceScreenCharacterSetBytes(
  document: CommodoreScreenDocument,
  bytes: Uint8Array
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  const imported = bytesToCharacterSetDocument(
    bytes,
    normalized.characterSet.name
  );
  return {
    ...normalized,
    characterSet: {
      ...normalized.characterSet,
      glyphs: imported.glyphs
    }
  };
}

export function formatKickAssemblerScreen(
  document: CommodoreScreenDocument,
  label = 'Screen'
): string {
  const normalized = normalizeScreenDocument(document);
  const safeLabel = toAssemblerLabel(label);
  const characterBytes = screenToCharacterBytes(normalized);
  const colorBytes = screenToColorBytes(normalized);
  const lines = [
    `// ${normalized.metadata.name}`,
    `// Format: ${COMMODORE_SCREEN_FORMAT} v${COMMODORE_SCREEN_VERSION}`,
    `// Layout: ${normalized.geometry.columns} columns, ${normalized.geometry.rows} rows, screen-code cells`,
    '',
    `${safeLabel}Chars:`,
    ...formatByteRows(characterBytes, normalized.geometry.columns),
    '',
    `${safeLabel}Colors:`,
    ...formatByteRows(colorBytes, normalized.geometry.columns)
  ];

  return `${lines.join('\n')}\n`;
}

export function getScreenCell(
  document: CommodoreScreenDocument,
  column: number,
  row: number
): CommodoreScreenCell | undefined {
  const index = screenIndex(document, column, row);
  return index === undefined ? undefined : document.cells[index];
}

export function setScreenCell(
  document: CommodoreScreenDocument,
  column: number,
  row: number,
  cell: Partial<CommodoreScreenCell>
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  const index = screenIndex(normalized, column, row);
  if (index === undefined) {
    return normalized;
  }
  const cells = [...normalized.cells];
  cells[index] = normalizeScreenCell(
    {
      ...cells[index],
      ...cell
    },
    normalized.colors.foreground
  );
  return {
    ...normalized,
    cells
  };
}

export function fillScreen(
  document: CommodoreScreenDocument,
  cell: Partial<CommodoreScreenCell>
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  const fillCell = normalizeScreenCell(cell, normalized.colors.foreground);
  return {
    ...normalized,
    cells: Array.from(
      { length: normalized.geometry.columns * normalized.geometry.rows },
      () => fillCell
    )
  };
}

export function getScreenGlyphByte(
  document: CommodoreScreenDocument,
  character: number,
  row: number
): number {
  const glyph = document.characterSet.glyphs[character & 0xff] ?? EMPTY_GLYPH;
  return Number.parseInt(glyph.slice(row * 2, row * 2 + 2), 16) || 0;
}

export function setScreenGlyphByte(
  document: CommodoreScreenDocument,
  character: number,
  row: number,
  value: number
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  if (row < 0 || row >= normalized.geometry.characterHeight) {
    return normalized;
  }
  const glyphs = [...normalized.characterSet.glyphs];
  const characterIndex = character & 0xff;
  const glyph = glyphs[characterIndex] ?? EMPTY_GLYPH;
  glyphs[characterIndex] =
    `${glyph.slice(0, row * 2)}${hexByte(value)}${glyph.slice(row * 2 + 2)}`;
  return {
    ...normalized,
    characterSet: {
      ...normalized.characterSet,
      glyphs
    }
  };
}

export function setScreenHiresPixel(
  document: CommodoreScreenDocument,
  character: number,
  x: number,
  y: number,
  enabled: boolean
): CommodoreScreenDocument {
  const bit = 7 - x;
  const rowValue = getScreenGlyphByte(document, character, y);
  const nextValue = enabled
    ? rowValue | (1 << bit)
    : rowValue & ~(1 << bit);
  return setScreenGlyphByte(document, character, y, nextValue);
}

export function setScreenMulticolorPixel(
  document: CommodoreScreenDocument,
  character: number,
  pairIndex: number,
  y: number,
  colorValue: number
): CommodoreScreenDocument {
  const shift = (3 - pairIndex) * 2;
  const rowValue = getScreenGlyphByte(document, character, y);
  const nextValue = (rowValue & ~(0x03 << shift)) |
    ((colorValue & 0x03) << shift);
  return setScreenGlyphByte(document, character, y, nextValue);
}

export function transformScreenGlyph(
  document: CommodoreScreenDocument,
  character: number,
  transform: (bytes: number[]) => number[]
): CommodoreScreenDocument {
  const normalized = normalizeScreenDocument(document);
  const bytes = Array.from(
    { length: normalized.geometry.characterHeight },
    (_, row) => getScreenGlyphByte(normalized, character, row)
  );
  const transformed = transform(bytes).slice(0, normalized.geometry.characterHeight);
  let next = normalized;
  transformed.forEach((byte, row) => {
    next = setScreenGlyphByte(next, character, row, byte);
  });
  return next;
}

function normalizeScreenCharacterSet(
  value: unknown,
  fallback: CommodoreScreenDocument
): CommodoreScreenCharacterSet {
  const object = isRecord(value) ? value : {};
  const glyphs = Array.isArray(object.glyphs)
    ? object.glyphs.map(normalizeGlyphHex)
    : [];

  return {
    name: normalizeString(object.name, fallback.characterSet.name),
    glyphs: Array.from(
      { length: COMMODORE_CHARACTER_SET_GEOMETRY.glyphCount },
      (_, index) => glyphs[index] ?? fallback.characterSet.glyphs[index] ?? EMPTY_GLYPH
    )
  };
}

function applyPetsciiControlStream(
  document: CommodoreScreenDocument,
  bytes: Uint8Array
): CommodoreScreenSeqImportResult {
  const normalized = normalizeScreenDocument(document);
  const columns = normalized.geometry.columns;
  const rows = normalized.geometry.rows;
  let column = 0;
  let row = 0;
  let currentColor = C64_DEFAULT_TEXT_COLOR;
  let reverse = false;
  let characterSetTemplateId: CommodoreCharacterSetTemplateId | undefined;
  let importedCharacters = 0;
  let cells = createBlankScreenCells(normalized, currentColor);

  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index] ?? 0;

    if (shouldIgnorePetsciiSeqByte(bytes, index)) {
      continue;
    }

    if (value === PETSCII_LOWER_UPPER_CHARSET) {
      characterSetTemplateId = 'c64-lower-upper';
      continue;
    }
    if (value === PETSCII_UPPER_GRAPHICS_CHARSET) {
      characterSetTemplateId = 'c64-upper-graphics';
      continue;
    }
    if (value === PETSCII_REVERSE_ON) {
      reverse = true;
      continue;
    }
    if (value === PETSCII_REVERSE_OFF || value === 0x0d || value === 0x8d) {
      reverse = false;
      if (value !== PETSCII_REVERSE_OFF) {
        column = 0;
        row = Math.min(row + 1, rows);
      }
      continue;
    }
    if (value === 0x13) {
      column = 0;
      row = 0;
      continue;
    }
    if (value === PETSCII_CLEAR_SCREEN) {
      column = 0;
      row = 0;
      reverse = false;
      cells = createBlankScreenCells(normalized, currentColor);
      continue;
    }

    const color = PETSCII_COLOR_CODES.get(value);
    if (color !== undefined) {
      currentColor = color;
      continue;
    }

    const movedCursor = applyPetsciiCursorControl(value, columns, rows, column, row);
    if (movedCursor) {
      column = movedCursor.column;
      row = movedCursor.row;
      continue;
    }

    const screenCode = petsciiPrintableToScreenCode(value);
    if (screenCode === undefined) {
      continue;
    }

    if (row < rows) {
      cells[row * columns + column] = {
        character: reverse
          ? (screenCode | PETSCII_REVERSE_OFFSET) & 0xff
          : screenCode,
        color: currentColor
      };
      importedCharacters += 1;
    }

    const next = advancePetsciiCursor(columns, rows, column, row);
    column = next.column;
    row = next.row;
  }

  let importedDocument: CommodoreScreenDocument = {
    ...normalized,
    cells
  };
  if (characterSetTemplateId) {
    importedDocument = applyScreenCharacterSetTemplate(
      importedDocument,
      characterSetTemplateId
    );
  }

  return {
    document: importedDocument,
    importedCharacters
  };
}

function createBlankScreenCells(
  document: CommodoreScreenDocument,
  color: number
): CommodoreScreenCell[] {
  return Array.from(
    { length: document.geometry.columns * document.geometry.rows },
    () => ({
      character: 32,
      color
    })
  );
}

function shouldIgnorePetsciiSeqByte(bytes: Uint8Array, index: number): boolean {
  const value = bytes[index] ?? 0;
  return value === PETSCII_DELETE ||
    (value === PETSCII_QUOTE && index > 0 && bytes[index - 1] === PETSCII_QUOTE);
}

function applyPetsciiCursorControl(
  value: number,
  columns: number,
  rows: number,
  column: number,
  row: number
): { column: number; row: number } | undefined {
  if (value === 0x11) {
    return { column, row: Math.min(row + 1, rows) };
  }
  if (value === 0x91) {
    return { column, row: Math.max(row - 1, 0) };
  }
  if (value === 0x1d) {
    return advancePetsciiCursor(columns, rows, column, row);
  }
  if (value === 0x9d) {
    if (column > 0) {
      return { column: column - 1, row };
    }
    if (row > 0) {
      return { column: columns - 1, row: row - 1 };
    }
    return { column: 0, row: 0 };
  }
  return undefined;
}

function advancePetsciiCursor(
  columns: number,
  rows: number,
  column: number,
  row: number
): { column: number; row: number } {
  const nextColumn = column + 1;
  if (nextColumn < columns) {
    return { column: nextColumn, row };
  }
  return { column: 0, row: Math.min(row + 1, rows) };
}

function petsciiPrintableToScreenCode(value: number): number | undefined {
  if (value >= 0x20 && value <= 0x3f) {
    return value;
  }
  if (value >= 0x40 && value <= 0x5f) {
    return value - 0x40;
  }
  if (value >= 0x60 && value <= 0x7f) {
    return value - 0x20;
  }
  if (value >= 0xa0 && value <= 0xbf) {
    return value - 0x40;
  }
  if (value === 0xc0) {
    return 0x40;
  }
  if (value >= 0xc1 && value <= 0xda) {
    return value - 0xc0;
  }
  if (value >= 0xdb && value <= 0xdf) {
    return value - 0xc0;
  }
  if (value >= 0xe0 && value <= 0xff) {
    return value - 0x80;
  }
  return undefined;
}

function screenCodeToPetsciiPrintable(value: number): number {
  if (value < 0x20) {
    return value + 0x40;
  }
  if (value <= 0x3f) {
    return value;
  }
  if (value <= 0x5f) {
    return value + 0x20;
  }
  return value + 0x40;
}

function screenToPetsciiCharacterSetControl(
  document: CommodoreScreenDocument
): number {
  return scoreCharacterSetTemplate(document, 'c64-upper-graphics') >
    scoreCharacterSetTemplate(document, 'c64-lower-upper')
    ? PETSCII_UPPER_GRAPHICS_CHARSET
    : PETSCII_LOWER_UPPER_CHARSET;
}

function scoreCharacterSetTemplate(
  document: CommodoreScreenDocument,
  templateId: CommodoreCharacterSetTemplateId
): number {
  const template = createCharacterSetDocumentFromTemplate(templateId);
  return template.glyphs.reduce(
    (score, glyph, index) =>
      glyph === document.characterSet.glyphs[index] ? score + 1 : score,
    0
  );
}

function applyScreenCharacterSetTemplate(
  document: CommodoreScreenDocument,
  templateId: CommodoreCharacterSetTemplateId
): CommodoreScreenDocument {
  const characterSet = createCharacterSetDocumentFromTemplate(templateId);
  return {
    ...document,
    metadata: {
      ...document.metadata,
      machine: characterSet.metadata.machine
    },
    colorMode: characterSet.colorMode,
    characterSet: {
      name: characterSet.metadata.name,
      glyphs: [...characterSet.glyphs]
    }
  };
}

function normalizeScreenCell(
  value: unknown,
  fallbackColor: number
): CommodoreScreenCell {
  if (Array.isArray(value)) {
    return {
      character: normalizeByte(value[0], 32),
      color: normalizeColorIndex(value[1], fallbackColor)
    };
  }
  if (isRecord(value)) {
    return {
      character: normalizeByte(
        value.character ?? value.char ?? value.code,
        32
      ),
      color: normalizeColorIndex(value.color, fallbackColor)
    };
  }
  if (typeof value === 'number') {
    return {
      character: normalizeByte(value, 32),
      color: fallbackColor
    };
  }
  return {
    character: 32,
    color: fallbackColor
  };
}

function normalizeScreenTarget(value: unknown): CommodoreScreenTarget {
  const object = isRecord(value) ? value : {};
  const fallback = createDefaultScreenTarget();
  return {
    screenAddress: normalizeWord(object.screenAddress, fallback.screenAddress),
    colorAddress: normalizeWord(object.colorAddress, fallback.colorAddress),
    characterDataAddress: normalizeWord(
      object.characterDataAddress,
      fallback.characterDataAddress
    )
  };
}

function createDefaultScreenTarget(): CommodoreScreenTarget {
  return {
    screenAddress: 0x0400,
    colorAddress: 0xd800,
    characterDataAddress: 0x2000
  };
}

function screenIndex(
  document: CommodoreScreenDocument,
  column: number,
  row: number
): number | undefined {
  const integerColumn = Math.trunc(column);
  const integerRow = Math.trunc(row);
  if (
    integerColumn < 0 ||
    integerColumn >= document.geometry.columns ||
    integerRow < 0 ||
    integerRow >= document.geometry.rows
  ) {
    return undefined;
  }
  return integerRow * document.geometry.columns + integerColumn;
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
  return EMPTY_GLYPH;
}

function normalizeByte(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(255, Math.trunc(value)));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/^\$/u, '');
    const parsed = Number.parseInt(trimmed, 16);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(255, parsed));
    }
  }
  return fallback;
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

function normalizeDimension(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.trunc(value)))
    : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatByteRows(bytes: Uint8Array, rowWidth: number): string[] {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += rowWidth) {
    const row = bytes.slice(offset, offset + rowWidth);
    lines.push(
      `    .byte ${Array.from(row, byte => `$${hexByte(byte)}`).join(', ')}`
    );
  }
  return lines;
}

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function toAssemblerLabel(value: string): string {
  const label = value
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (!label) {
    return 'Screen';
  }
  return /^[A-Za-z_]/u.test(label) ? label : `Screen_${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
