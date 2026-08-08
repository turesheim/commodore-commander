import {
  createCharacterSetDocumentFromTemplate
} from './commodore-character-set-format';

export interface CommodorePetsciiGlyph {
  readonly screenCode: number;
  readonly petsciiCode?: number;
  readonly glyphHex: string;
  readonly svgPath: string;
}

const C64_UPPER_GRAPHICS_GLYPH_HEX = Object.freeze(
  createCharacterSetDocumentFromTemplate('c64-upper-graphics').glyphs
);

const EMPTY_GLYPH_HEX = '0000000000000000';

export const C64_UPPER_GRAPHICS_SCREEN_GLYPHS: readonly CommodorePetsciiGlyph[] =
  Object.freeze(
    C64_UPPER_GRAPHICS_GLYPH_HEX.map((glyphHex, screenCode) => ({
      screenCode,
      glyphHex,
      svgPath: commodoreGlyphSvgPathFromHex(glyphHex)
    }))
  );

export const C64_UPPER_GRAPHICS_PETSCII_GLYPHS: readonly (
  CommodorePetsciiGlyph | undefined
)[] = Object.freeze(
  Array.from({ length: 256 }, (_unused, petsciiCode) => {
    const screenCode = c64PetsciiToUpperGraphicsScreenCode(petsciiCode);
    if (screenCode === undefined) {
      return undefined;
    }
    const glyphHex = c64UpperGraphicsGlyphHex(screenCode);
    return {
      screenCode,
      petsciiCode,
      glyphHex,
      svgPath: commodoreGlyphSvgPathFromHex(glyphHex)
    };
  })
);

export function c64UpperGraphicsGlyph(
  screenCode: number
): CommodorePetsciiGlyph {
  const normalized = screenCode & 0xff;
  const glyphHex = c64UpperGraphicsGlyphHex(normalized);
  return {
    screenCode: normalized,
    glyphHex,
    svgPath: commodoreGlyphSvgPathFromHex(glyphHex)
  };
}

export function c64UpperGraphicsGlyphFromPetscii(
  petsciiCode: number
): CommodorePetsciiGlyph | undefined {
  const normalized = petsciiCode & 0xff;
  return C64_UPPER_GRAPHICS_PETSCII_GLYPHS[normalized];
}

export function c64PetsciiToUpperGraphicsScreenCode(
  petsciiCode: number
): number | undefined {
  const value = petsciiCode & 0xff;
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
  if (value >= 0xc0 && value <= 0xdf) {
    return value - 0x80;
  }
  if (value >= 0xe0 && value <= 0xff) {
    return value - 0x80;
  }
  return undefined;
}

export function c64UpperGraphicsGlyphSvg(
  screenCode: number,
  title?: string
): string {
  const glyph = c64UpperGraphicsGlyph(screenCode);
  const titleElement = title ? `<title>${escapeSvgText(title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${titleElement}<path fill="currentColor" d="${glyph.svgPath}"/></svg>`;
}

export function commodoreGlyphSvgPathFromHex(glyphHex: string): string {
  const normalized = normalizeGlyphHex(glyphHex);
  const paths: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    const row = Number.parseInt(normalized.slice(y * 2, y * 2 + 2), 16) || 0;
    for (let x = 0; x < 8; x += 1) {
      if ((row & (1 << (7 - x))) !== 0) {
        paths.push(`M${x} ${y}h1v1H${x}z`);
      }
    }
  }
  return paths.join('');
}

function c64UpperGraphicsGlyphHex(screenCode: number): string {
  return C64_UPPER_GRAPHICS_GLYPH_HEX[screenCode & 0xff] ?? EMPTY_GLYPH_HEX;
}

function normalizeGlyphHex(glyphHex: string): string {
  const normalized = glyphHex.replace(/[^0-9a-f]/giu, '').slice(0, 16);
  return normalized.padEnd(16, '0').toUpperCase();
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}
