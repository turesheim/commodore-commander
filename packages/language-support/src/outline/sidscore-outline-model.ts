import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation, SourceRange } from '../location/source-location.ts';
import { createRange } from '../location/source-location.ts';

export type SidScoreOutlineSymbolKind = 'subtune' | 'effect';

export interface SidScoreOutlineSymbol {
  name: string;
  kind: SidScoreOutlineSymbolKind;
  location: SourceLocation;
  selectionRange: SourceRange;
  detail?: string | undefined;
  children: SidScoreOutlineSymbol[];
}

interface OpenSidScoreBlock {
  symbol: SidScoreOutlineSymbol;
  depth: number;
}

const TUNE_HEADER_PATTERN = /^\s*TUNE\s+(\d+)\b/iu;
const EFFECT_HEADER_PATTERN = /^\s*EFFECT\s+([A-Za-z_][A-Za-z0-9_]*)\b/iu;

export function buildSidScoreOutline(
  document: TextDocumentModel
): SidScoreOutlineSymbol[] {
  const symbols: SidScoreOutlineSymbol[] = [];
  const openBlocks: OpenSidScoreBlock[] = [];
  let braceDepth = 0;

  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    const line = document.lineAt(lineNumber);
    const code = maskSidScoreTrivia(line);

    const tuneMatch = TUNE_HEADER_PATTERN.exec(code);
    if (tuneMatch) {
      const tuneNumber = tuneMatch[1] ?? '1';
      const symbol = createLineSymbol(
        document.uri,
        line,
        lineNumber,
        `Subtune ${tuneNumber}`,
        'subtune',
        `TUNE ${tuneNumber}`,
        selectionRangeForToken(code, lineNumber, tuneNumber)
      );
      symbols.push(symbol);
      pushOpenBlock(openBlocks, symbol, braceDepth, code, tuneMatch[0].length);
    } else {
      const effectMatch = EFFECT_HEADER_PATTERN.exec(code);
      if (effectMatch) {
        const effectName = effectMatch[1] ?? 'Effect';
        const symbol = createLineSymbol(
          document.uri,
          line,
          lineNumber,
          effectName,
          'effect',
          'EFFECT',
          selectionRangeForToken(code, lineNumber, effectName)
        );
        const subtune = findOpenSubtune(openBlocks);
        if (subtune) {
          subtune.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
        pushOpenBlock(
          openBlocks,
          symbol,
          braceDepth,
          code,
          effectMatch[0].length
        );
      }
    }

    braceDepth = Math.max(0, braceDepth + countBraceDelta(code));
    closeCompletedBlocks(openBlocks, braceDepth, lineNumber, line.length);
  }

  closeRemainingBlocks(document, openBlocks);
  return groupImplicitFirstSubtune(document, symbols);
}

function createLineSymbol(
  uri: string,
  line: string,
  lineNumber: number,
  name: string,
  kind: SidScoreOutlineSymbolKind,
  detail: string,
  selectionRange: SourceRange
): SidScoreOutlineSymbol {
  const startCharacter = firstNonWhitespaceCharacter(line);
  const range = createRange(
    lineNumber,
    startCharacter,
    lineNumber,
    line.length
  );

  return {
    name,
    kind,
    detail,
    location: {
      uri,
      range
    },
    selectionRange,
    children: []
  };
}

function pushOpenBlock(
  openBlocks: OpenSidScoreBlock[],
  symbol: SidScoreOutlineSymbol,
  braceDepth: number,
  code: string,
  searchFrom: number
): void {
  if (code.indexOf('{', searchFrom) < 0) {
    return;
  }

  openBlocks.push({
    symbol,
    depth: braceDepth + 1
  });
}

function closeCompletedBlocks(
  openBlocks: OpenSidScoreBlock[],
  braceDepth: number,
  line: number,
  character: number
): void {
  while (
    openBlocks.length > 0 &&
    (openBlocks[openBlocks.length - 1]?.depth ?? 0) > braceDepth
  ) {
    const block = openBlocks.pop();
    if (block) {
      closeSymbol(block.symbol, line, character);
    }
  }
}

function closeRemainingBlocks(
  document: TextDocumentModel,
  openBlocks: OpenSidScoreBlock[]
): void {
  const lastLine = Math.max(0, document.lineCount - 1);
  const lastCharacter = document.lineAt(lastLine).length;
  while (openBlocks.length > 0) {
    const block = openBlocks.pop();
    if (block) {
      closeSymbol(block.symbol, lastLine, lastCharacter);
    }
  }
}

function closeSymbol(
  symbol: SidScoreOutlineSymbol,
  endLine: number,
  endCharacter: number
): void {
  symbol.location.range = createRange(
    symbol.location.range.start.line,
    symbol.location.range.start.character,
    endLine,
    endCharacter
  );
}

function findOpenSubtune(
  openBlocks: readonly OpenSidScoreBlock[]
): SidScoreOutlineSymbol | undefined {
  for (let index = openBlocks.length - 1; index >= 0; index -= 1) {
    const symbol = openBlocks[index]?.symbol;
    if (symbol?.kind === 'subtune') {
      return symbol;
    }
  }
  return undefined;
}

function groupImplicitFirstSubtune(
  document: TextDocumentModel,
  symbols: SidScoreOutlineSymbol[]
): SidScoreOutlineSymbol[] {
  const firstExplicitSubtuneIndex = symbols.findIndex(
    (symbol) => symbol.kind === 'subtune'
  );
  if (firstExplicitSubtuneIndex < 0) {
    return symbols;
  }

  const firstExplicitSubtune = symbols[firstExplicitSubtuneIndex];
  if (!firstExplicitSubtune) {
    return symbols;
  }

  if (firstExplicitSubtune.name === 'Subtune 1') {
    return symbols;
  }

  const prefixSymbols = symbols.slice(0, firstExplicitSubtuneIndex);
  const implicitSubtune = createImplicitFirstSubtune(
    document,
    firstExplicitSubtune.location.range.start.line,
    prefixSymbols
  );

  return [
    implicitSubtune,
    ...symbols.slice(firstExplicitSubtuneIndex)
  ];
}

function createImplicitFirstSubtune(
  document: TextDocumentModel,
  firstExplicitSubtuneLine: number,
  children: SidScoreOutlineSymbol[]
): SidScoreOutlineSymbol {
  const endLine = Math.max(0, firstExplicitSubtuneLine - 1);
  const endCharacter = firstExplicitSubtuneLine > 0
    ? document.lineAt(endLine).length
    : 0;
  const range = createRange(0, 0, endLine, endCharacter);
  return {
    name: 'Subtune 1',
    kind: 'subtune',
    detail: 'implicit TUNE 1',
    location: {
      uri: document.uri,
      range
    },
    selectionRange: createRange(0, 0, 0, 0),
    children
  };
}

function selectionRangeForToken(
  code: string,
  lineNumber: number,
  token: string
): SourceRange {
  const startCharacter = Math.max(0, code.indexOf(token));
  return createRange(
    lineNumber,
    startCharacter,
    lineNumber,
    startCharacter + token.length
  );
}

function firstNonWhitespaceCharacter(line: string): number {
  const match = /\S/u.exec(line);
  return match?.index ?? 0;
}

function countBraceDelta(code: string): number {
  let delta = 0;
  for (const character of code) {
    if (character === '{') {
      delta += 1;
    } else if (character === '}') {
      delta -= 1;
    }
  }
  return delta;
}

function maskSidScoreTrivia(line: string): string {
  let result = '';
  let inString = false;
  let escaping = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';

    if (inString) {
      result += ' ';
      if (escaping) {
        escaping = false;
      } else if (character === '\\') {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === ';') {
      return result + ' '.repeat(line.length - index);
    }

    if (character === '"') {
      inString = true;
      result += ' ';
      continue;
    }

    result += character;
  }

  return result;
}
