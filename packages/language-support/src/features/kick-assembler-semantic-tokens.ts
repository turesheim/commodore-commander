import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation } from '../location/source-location.ts';
import type { KickAssemblerLookupIndex } from '../lookup/kick-assembler-lookup-service.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';
import type { KickAssemblerSemanticSymbolKind } from '../semantic/kick-assembler-semantic-model.ts';
import { isMos6502Mnemonic } from './kick-assembler-language-facts.ts';

export type KickAssemblerSemanticTokenType =
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'namespace'
  | 'class'
  | 'enum'
  | 'enumMember'
  | 'function'
  | 'method'
  | 'parameter'
  | 'variable'
  | 'property'
  | 'label';

export type KickAssemblerSemanticTokenModifier =
  | 'declaration'
  | 'definition'
  | 'readonly'
  | 'generated';

export const KICK_ASSEMBLER_SEMANTIC_TOKEN_TYPES:
  readonly KickAssemblerSemanticTokenType[] = Object.freeze([
    'comment',
    'string',
    'number',
    'keyword',
    'namespace',
    'class',
    'enum',
    'enumMember',
    'function',
    'method',
    'parameter',
    'variable',
    'property',
    'label'
  ]);

export const KICK_ASSEMBLER_SEMANTIC_TOKEN_MODIFIERS:
  readonly KickAssemblerSemanticTokenModifier[] = Object.freeze([
    'declaration',
    'definition',
    'readonly',
    'generated'
  ]);

export interface KickAssemblerSemanticToken {
  location: SourceLocation;
  type: KickAssemblerSemanticTokenType;
  modifiers: KickAssemblerSemanticTokenModifier[];
}

interface LexicalToken {
  text: string;
  location: SourceLocation;
  kind: 'comment' | 'string' | 'number' | 'directive' | 'identifier';
}

export function buildKickAssemblerSemanticTokens(
  document: TextDocumentModel,
  index?: KickAssemblerLookupIndex
): KickAssemblerSemanticToken[] {
  const tokens: KickAssemblerSemanticToken[] = [];
  const seen = new Set<string>();

  const push = (token: KickAssemblerSemanticToken): void => {
    const key = `${locationKey(token.location)}:${token.type}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    tokens.push(token);
  };

  for (const token of scanLexicalTokens(document)) {
    if (token.kind === 'comment' || token.kind === 'string' || token.kind === 'number') {
      push({
        location: token.location,
        type: token.kind,
        modifiers: []
      });
      continue;
    }

    if (token.kind === 'directive') {
      push({
        location: token.location,
        type: 'keyword',
        modifiers: []
      });
      continue;
    }

    const declaration = index?.projectDeclarationsByName.get(token.text)?.[0];
    if (declaration && isProjectSymbolKind(declaration.kind)) {
      push({
        location: token.location,
        type: semanticTypeForSymbolKind(declaration.kind),
        modifiers: []
      });
      continue;
    }

    const reference = index?.referenceDeclarationsByName.get(token.text.toUpperCase())?.[0];
    if (reference?.kind === '6502-mnemonic' || isMos6502Mnemonic(token.text)) {
      push({
        location: token.location,
        type: 'keyword',
        modifiers: []
      });
      continue;
    }

    if (reference?.kind === 'machine-rom-symbol') {
      push({
        location: token.location,
        type: 'function',
        modifiers: ['readonly']
      });
      continue;
    }

    if (reference?.kind === 'c64-io-id' || reference?.kind === 'machine-io-id') {
      push({
        location: token.location,
        type: 'variable',
        modifiers: ['readonly']
      });
    }
  }

  const model = parseKickAssemblerSemanticModel(document);
  for (const symbol of model.symbols) {
    const modifiers: KickAssemblerSemanticTokenModifier[] = [
      'declaration',
      'definition'
    ];
    if (symbol.kind === 'constant' || symbol.kind === 'enum-member') {
      modifiers.push('readonly');
    }
    if (symbol.generated) {
      modifiers.push('generated');
    }
    push({
      location: symbol.location,
      type: semanticTypeForSymbolKind(symbol.kind),
      modifiers
    });
  }

  return tokens.sort(compareSemanticTokens);
}

function scanLexicalTokens(document: TextDocumentModel): LexicalToken[] {
  const tokens: LexicalToken[] = [];
  const text = document.text;
  let offset = 0;

  while (offset < text.length) {
    const current = text[offset];
    const next = text[offset + 1];

    if (current === '/' && next === '*') {
      const end = text.indexOf('*/', offset + 2);
      const endOffset = end >= 0 ? end + 2 : text.length;
      tokens.push(token(document, offset, endOffset, 'comment'));
      offset = endOffset;
      continue;
    }

    if (current === '/' && next === '/') {
      const endOffset = endOfLine(text, offset + 2);
      tokens.push(token(document, offset, endOffset, 'comment'));
      offset = endOffset;
      continue;
    }

    if (current === ';') {
      const endOffset = endOfLine(text, offset + 1);
      tokens.push(token(document, offset, endOffset, 'comment'));
      offset = endOffset;
      continue;
    }

    if (current === '"' || current === "'") {
      const endOffset = scanQuoted(text, offset, current);
      tokens.push(token(document, offset, endOffset, 'string'));
      offset = endOffset;
      continue;
    }

    if (current === '$' && /[0-9A-Fa-f]/u.test(next ?? '')) {
      const endOffset = scanWhile(text, offset + 1, /[0-9A-Fa-f_]/u);
      tokens.push(token(document, offset, endOffset, 'number'));
      offset = endOffset;
      continue;
    }

    if (current === '%' && /[01]/u.test(next ?? '')) {
      const endOffset = scanWhile(text, offset + 1, /[01_]/u);
      tokens.push(token(document, offset, endOffset, 'number'));
      offset = endOffset;
      continue;
    }

    if (/[0-9]/u.test(current ?? '')) {
      const endOffset = scanWhile(text, offset + 1, /[0-9A-Fa-f_xX.]/u);
      tokens.push(token(document, offset, endOffset, 'number'));
      offset = endOffset;
      continue;
    }

    if ((current === '.' || current === '#') && /[A-Za-z]/u.test(next ?? '')) {
      const endOffset = scanWhile(text, offset + 1, /[A-Za-z0-9_]/u);
      tokens.push(token(document, offset, endOffset, 'directive'));
      offset = endOffset;
      continue;
    }

    if (isIdentifierStart(current)) {
      const endOffset = scanWhile(text, offset + 1, /[A-Za-z0-9_.@!]/u);
      tokens.push(token(document, offset, endOffset, 'identifier'));
      offset = endOffset;
      continue;
    }

    offset += 1;
  }

  return tokens;
}

function token(
  document: TextDocumentModel,
  startOffset: number,
  endOffset: number,
  kind: LexicalToken['kind']
): LexicalToken {
  return {
    text: document.text.slice(startOffset, endOffset),
    location: {
      uri: document.uri,
      range: {
        start: document.positionAt(startOffset),
        end: document.positionAt(endOffset)
      }
    },
    kind
  };
}

function semanticTypeForSymbolKind(
  kind: KickAssemblerSemanticSymbolKind
): KickAssemblerSemanticTokenType {
  switch (kind) {
    case 'namespace':
      return 'namespace';
    case 'macro':
      return 'function';
    case 'function':
      return 'function';
    case 'pseudocommand':
      return 'method';
    case 'struct':
      return 'class';
    case 'enum':
      return 'enum';
    case 'enum-member':
      return 'enumMember';
    case 'constant':
      return 'variable';
    case 'variable':
    case 'for-variable':
      return 'variable';
    case 'parameter':
      return 'parameter';
    case 'segment':
    case 'segment-definition':
      return 'property';
    case 'label':
    case 'local-label':
    case 'anonymous-label':
    case 'generated':
      return 'label';
  }
}

function isProjectSymbolKind(
  kind: string
): kind is KickAssemblerSemanticSymbolKind {
  return kind !== '6502-mnemonic' &&
    kind !== 'c64-io-address' &&
    kind !== 'c64-io-id';
}

function compareSemanticTokens(
  left: KickAssemblerSemanticToken,
  right: KickAssemblerSemanticToken
): number {
  const lineDelta = left.location.range.start.line - right.location.range.start.line;
  if (lineDelta !== 0) {
    return lineDelta;
  }
  return left.location.range.start.character - right.location.range.start.character;
}

function scanQuoted(text: string, startOffset: number, delimiter: string): number {
  let offset = startOffset + 1;
  while (offset < text.length) {
    const current = text[offset];
    if (current === '\\') {
      offset += 2;
      continue;
    }
    offset += 1;
    if (current === delimiter) {
      break;
    }
  }
  return offset;
}

function scanWhile(text: string, startOffset: number, pattern: RegExp): number {
  let offset = startOffset;
  while (offset < text.length && pattern.test(text[offset] ?? '')) {
    offset += 1;
  }
  return offset;
}

function endOfLine(text: string, startOffset: number): number {
  const end = text.indexOf('\n', startOffset);
  return end >= 0 ? end : text.length;
}

function isIdentifierStart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z_@!]/u.test(character));
}

function locationKey(location: SourceLocation): string {
  const { start, end } = location.range;
  return `${location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
}
