import { GrammarUtils, type AstNode, type CstNode } from 'langium';

import type { SourceLocation, SourceRange } from '../location/source-location.ts';
import {
  createRange
} from '../location/source-location.ts';
import type { TextDocumentModel } from '../document/text-document-model.ts';
import type {
  EnumBlock,
  FunctionBlock,
  GenericBlock,
  ImportStatement,
  LabelStatement,
  MacroBlock,
  NamespaceBlock,
  OutlineFile,
  ProgramCounterStatement,
  PseudocommandBlock,
  SegmentDefinition,
  SegmentStatement,
  Statement,
  StructBlock,
  SymbolDirectiveStatement
} from '../langium/generated/ast.ts';
import {
  isEnumBlock,
  isFunctionBlock,
  isGenericBlock,
  isImportStatement,
  isLabelStatement,
  isMacroBlock,
  isNamespaceBlock,
  isProgramCounterStatement,
  isPseudocommandBlock,
  isSegmentDefinition,
  isSegmentStatement,
  isStructBlock,
  isSymbolDirectiveStatement
} from '../langium/generated/ast.ts';
import {
  parseKickAssemblerOutlineDocument,
  type KickAssemblerOutlineParseResult
} from '../parsing/kick-assembler-outline-parser.ts';

export type KickAssemblerOutlineSymbolKind =
  | 'import'
  | 'segment-definition'
  | 'segment'
  | 'program-counter'
  | 'namespace'
  | 'macro'
  | 'function'
  | 'struct'
  | 'enum'
  | 'pseudocommand'
  | 'constant'
  | 'variable'
  | 'label';

export interface KickAssemblerOutlineSymbol {
  name: string;
  kind: KickAssemblerOutlineSymbolKind;
  location: SourceLocation;
  selectionRange: SourceRange;
  detail?: string | undefined;
  children: KickAssemblerOutlineSymbol[];
}

export function buildKickAssemblerOutline(
  document: TextDocumentModel
): KickAssemblerOutlineSymbol[] {
  return buildKickAssemblerOutlineFromParsed(
    parseKickAssemblerOutlineDocument(document)
  );
}

export function buildKickAssemblerOutlineFromParsed(
  parsed: KickAssemblerOutlineParseResult
): KickAssemblerOutlineSymbol[] {
  return collectSymbols(parsed.document.uri.toString(), parsed.model);
}

function collectSymbols(
  uri: string,
  container: OutlineFile | { statements: readonly Statement[] }
): KickAssemblerOutlineSymbol[] {
  const symbols: KickAssemblerOutlineSymbol[] = [];
  let activeSection: KickAssemblerOutlineSymbol | undefined;

  for (const statement of container.statements) {
    if (isImportStatement(statement)) {
      symbols.push(createImportSymbol(uri, statement));
      continue;
    }

    if (isSegmentDefinition(statement)) {
      symbols.push(createSegmentDefinitionSymbol(uri, statement));
      continue;
    }

    if (isSegmentStatement(statement)) {
      const symbol = createSegmentSymbol(uri, statement);
      symbols.push(symbol);
      activeSection = symbol;
      continue;
    }

    if (isProgramCounterStatement(statement)) {
      const symbol = createProgramCounterSymbol(uri, statement);
      appendSymbol(symbols, activeSection, symbol);

      if (hasBlock(statement)) {
        symbol.children.push(...collectSymbols(uri, statement.block));
      } else {
        activeSection = symbol;
      }

      continue;
    }

    if (isNamespaceBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'namespace',
        '.namespace'
      ));
      continue;
    }

    if (isMacroBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'macro',
        '.macro'
      ));
      continue;
    }

    if (isFunctionBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'function',
        '.function'
      ));
      continue;
    }

    if (isStructBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'struct',
        '.struct'
      ));
      continue;
    }

    if (isEnumBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'enum',
        '.enum'
      ));
      continue;
    }

    if (isPseudocommandBlock(statement)) {
      appendSymbol(symbols, activeSection, createNamedBlockSymbol(
        uri,
        statement,
        'pseudocommand',
        '.pseudocommand'
      ));
      continue;
    }

    if (isSymbolDirectiveStatement(statement)) {
      appendSymbol(symbols, activeSection, createDirectiveSymbol(uri, statement));
      continue;
    }

    if (isLabelStatement(statement)) {
      appendSymbol(symbols, activeSection, createLabelSymbol(uri, statement));
      continue;
    }

    if (isGenericBlock(statement)) {
      const nested = collectSymbols(uri, statement.block);
      for (const symbol of nested) {
        appendSymbol(symbols, activeSection, symbol);
      }
    }
  }

  return symbols;
}

function appendSymbol(
  root: KickAssemblerOutlineSymbol[],
  activeSection: KickAssemblerOutlineSymbol | undefined,
  symbol: KickAssemblerOutlineSymbol
): void {
  if (activeSection) {
    activeSection.children.push(symbol);
    return;
  }

  root.push(symbol);
}

function createImportSymbol(
  uri: string,
  statement: ImportStatement
): KickAssemblerOutlineSymbol {
  const lastIndex = statement.parts.length - 1;
  const name = firstOrFallback(
    lastIndex >= 0 ? [statement.parts[lastIndex] ?? statement.directive] : [],
    statement.directive
  );
  const selection = lastIndex >= 0
    ? selectionRangeForPart(statement, lastIndex)
    : nodeRange(statement);

  return createSymbol(uri, statement, {
    kind: 'import',
    name,
    detail: buildDetail(statement.directive, statement.parts),
    selection
  });
}

function createSegmentDefinitionSymbol(
  uri: string,
  statement: SegmentDefinition
): KickAssemblerOutlineSymbol {
  return createSymbol(uri, statement, {
    kind: 'segment-definition',
    name: statement.name,
    detail: buildDetail('.segmentdef', statement.parts),
    selection: propertyRange(statement, 'name')
  });
}

function createSegmentSymbol(
  uri: string,
  statement: SegmentStatement
): KickAssemblerOutlineSymbol {
  return createSymbol(uri, statement, {
    kind: 'segment',
    name: stripQuotes(statement.name),
    detail: buildDetail('.segment', statement.parts),
    selection: propertyRange(statement, 'name')
  });
}

function createProgramCounterSymbol(
  uri: string,
  statement: ProgramCounterStatement
): KickAssemblerOutlineSymbol {
  const label = programCounterLabel(statement.parts);
  const selection = selectionRangeForPc(statement);

  return createSymbol(uri, statement, {
    kind: 'program-counter',
    name: label,
    detail: buildDetail('.pc', statement.parts),
    selection
  });
}

function createNamedBlockSymbol(
  uri: string,
  statement:
    | NamespaceBlock
    | MacroBlock
    | FunctionBlock
    | StructBlock
    | EnumBlock
    | PseudocommandBlock,
  kind:
    | 'namespace'
    | 'macro'
    | 'function'
    | 'struct'
    | 'enum'
    | 'pseudocommand',
  directive: string
): KickAssemblerOutlineSymbol {
  const symbol = createSymbol(uri, statement, {
    kind,
    name: statement.name,
    detail: buildDetail(directive, statement.parts),
    selection: propertyRange(statement, 'name')
  });

  if (hasBlock(statement)) {
    symbol.children.push(...collectSymbols(uri, statement.block));
  }

  return symbol;
}

function createDirectiveSymbol(
  uri: string,
  statement: SymbolDirectiveStatement
): KickAssemblerOutlineSymbol {
  return createSymbol(uri, statement, {
    kind: toDirectiveKind(statement.directive),
    name: statement.name,
    detail: buildDetail(statement.directive, statement.parts),
    selection: propertyRange(statement, 'name')
  });
}

function createLabelSymbol(
  uri: string,
  statement: LabelStatement
): KickAssemblerOutlineSymbol {
  const name = labelName(statement);

  return createSymbol(uri, statement, {
    kind: 'label',
    name,
    detail: statement.parts.length > 0
      ? statement.parts.join(' ')
      : undefined,
    selection: labelSelectionRange(statement, name)
  });
}

function createSymbol(
  uri: string,
  node: AstNode,
  options: {
    kind: KickAssemblerOutlineSymbolKind;
    name: string;
    selection?: SourceRange | undefined;
    detail?: string | undefined;
  }
): KickAssemblerOutlineSymbol {
  const range = nodeRange(node);

  return {
    name: options.name,
    kind: options.kind,
    detail: options.detail,
    location: {
      uri,
      range
    },
    selectionRange: options.selection ?? range,
    children: []
  };
}

function nodeRange(node: AstNode): SourceRange {
  return toSourceRange(node.$cstNode);
}

function propertyRange(
  node: AstNode,
  property: string,
  index?: number
): SourceRange | undefined {
  const propertyNode = GrammarUtils.findNodeForProperty(
    node.$cstNode,
    property,
    index
  );
  return propertyNode ? toSourceRange(propertyNode) : undefined;
}

function selectionRangeForPart(
  node: AstNode,
  index: number
): SourceRange | undefined {
  return propertyRange(node, 'parts', index);
}

function selectionRangeForPc(
  statement: ProgramCounterStatement
): SourceRange | undefined {
  if (statement.parts.length > 2 && statement.parts[0] === '=') {
    return selectionRangeForPart(statement, statement.parts.length - 1);
  }

  if (statement.parts.length > 1 && statement.parts[0] === '=') {
    return selectionRangeForPart(statement, 1);
  }

  return statement.parts.length > 0
    ? selectionRangeForPart(statement, 0)
    : nodeRange(statement);
}

function toSourceRange(node: CstNode | undefined): SourceRange {
  if (!node) {
    return createRange(0, 0, 0, 0);
  }

  return createRange(
    node.range.start.line,
    node.range.start.character,
    node.range.end.line,
    node.range.end.character
  );
}

function labelName(statement: LabelStatement): string {
  const localName = readStringProperty(statement, 'localName');
  if (localName) {
    return localName;
  }

  const name = readStringProperty(statement, 'name');
  if (name) {
    return name;
  }

  return '!';
}

function labelSelectionRange(
  statement: LabelStatement,
  name: string
): SourceRange | undefined {
  const localNameRange = propertyRange(statement, 'localName');
  if (localNameRange) {
    return localNameRange;
  }

  const nameRange = propertyRange(statement, 'name');
  if (nameRange) {
    return nameRange;
  }

  const bangOnlyRange = propertyRange(statement, 'bangOnly');
  if (bangOnlyRange) {
    return bangOnlyRange;
  }

  return findTextRange(statement, name);
}

function findTextRange(
  node: AstNode,
  text: string
): SourceRange | undefined {
  const cstNode = node.$cstNode;
  const document = node.$document?.textDocument;

  if (!cstNode || !document || text.length === 0) {
    return undefined;
  }

  const offset = cstNode.text.indexOf(text);
  if (offset < 0) {
    return undefined;
  }

  const start = document.positionAt(cstNode.offset + offset);
  const end = document.positionAt(cstNode.offset + offset + text.length);

  return createRange(
    start.line,
    start.character,
    end.line,
    end.character
  );
}


function toDirectiveKind(
  directive: SymbolDirectiveStatement['directive']
): KickAssemblerOutlineSymbolKind {
  switch (directive) {
    case '.const':
      return 'constant';
    case '.var':
      return 'variable';
    case '.label':
      return 'label';
  }
}

function buildDetail(
  directive: string,
  parts: readonly string[]
): string | undefined {
  const suffix = parts.join(' ');
  return suffix ? `${directive} ${suffix}` : directive;
}

function programCounterLabel(parts: readonly string[]): string {
  if (parts.length > 2 && parts[0] === '=') {
    return parts[parts.length - 1] ?? '.pc';
  }

  if (parts.length > 1 && parts[0] === '=' && parts[1]) {
    return `.pc ${parts[1]}`;
  }

  if (parts[0]) {
    return `.pc ${parts[0]}`;
  }

  return '.pc';
}

function firstOrFallback(parts: readonly string[], fallback: string): string {
  return parts[0] ? stripQuotes(parts[0]) : fallback;
}

function readStringProperty(
  node: AstNode,
  property: string
): string | undefined {
  const value = (node as unknown as Record<string, unknown>)[property];
  return typeof value === 'string' ? value : undefined;
}

function hasBlock(
  node:
    | ProgramCounterStatement
    | NamespaceBlock
    | MacroBlock
    | FunctionBlock
    | StructBlock
    | EnumBlock
    | PseudocommandBlock
): node is typeof node & { block: { statements: Statement[] } } {
  return Boolean(node.block);
}

function isQuotedString(value: string): boolean {
  return value.startsWith('"') && value.endsWith('"');
}

function stripQuotes(value: string | undefined): string {
  if (!value) {
    return '';
  }
  return isQuotedString(value) ? value.slice(1, -1) : value;
}
