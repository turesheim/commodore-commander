import {
  createTextDocumentModel,
  type TextDocumentModel
} from '../document/text-document-model.ts';
import {
  comparePositions,
  containsPosition,
  type SourceLocation,
  type SourceRange
} from '../location/source-location.ts';
import type { KickAssemblerOutlineParseResult } from '../parsing/kick-assembler-outline-parser.ts';
import type {
  KickAssemblerSemanticScope,
  KickAssemblerSemanticSymbol
} from '../semantic/kick-assembler-semantic-model.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';

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

/** Document-local declarations; imported files belong to project lookup, not this outline. */
export function buildKickAssemblerOutline(
  document: TextDocumentModel
): KickAssemblerOutlineSymbol[] {
  const model = parseKickAssemblerSemanticModel(document);
  const declarations = new Map<string, KickAssemblerOutlineSymbol>();
  for (const symbol of model.symbols) {
    const kind = outlineKind(symbol);
    if (!kind) continue;
    const directive = model.directives.find(entry =>
      entry.location.range.start.line === symbol.location.range.start.line
      && symbol.detail === `.${entry.name}`);
    const suffix = directive?.operands.slice(symbol.name.length).trim();
    const entry = createSymbol(symbol.name, kind, symbol.location,
      suffix ? `${symbol.detail} ${suffix}` : symbol.detail);
    entry.location.range = directive ? copyRange(directive.location.range) : {
      start: { ...symbol.location.range.start },
      end: { line: symbol.location.range.start.line,
        character: document.lineAt(symbol.location.range.start.line).length }
    };
    declarations.set(symbol.id, entry);
  }

  // Bind a scope to its declaration occurrence, never just to a qualified name:
  // reopened namespaces and repeated local labels remain separate outline entries.
  const scopeOwners = new Map<string, KickAssemblerOutlineSymbol>();
  for (const scope of model.scopes) {
    const owner = model.symbols.find(symbol =>
      declarations.has(symbol.id)
      && symbol.scopeId === scope.parentId
      && symbol.name === scope.name
      && symbol.location.range.start.line === scope.location.range.start.line);
    const entry = owner && declarations.get(owner.id);
    if (entry) scopeOwners.set(scope.id, entry);
  }

  const sections = new Map<string, KickAssemblerOutlineSymbol>();
  for (const segment of model.segments) {
    if (!segment.scopeId) continue; // Definitions are already declarations.
    let selection = segment.location.range;
    let name = segment.name;
    const directive = model.directives.find(entry =>
      entry.location.range.start.line === segment.location.range.start.line
      && entry.name === (segment.kind === 'selection' ? 'segment' : 'pc'));
    if (directive) {
      const operands = directive.operands;
      const token = segment.kind === 'selection'
        ? /^("(?:[^"\\]|\\.)*"|[^\s{]+)/u.exec(operands)?.[0]
        : /"(?:[^"\\]|\\.)*"/u.exec(operands)?.[0]
          ?? /^=?\s*([^\s{]+)/u.exec(operands)?.[1];
      if (token) {
        const line = document.lineAt(segment.location.range.start.line);
        const start = line.indexOf(token, segment.location.range.start.character + directive.name.length + 1);
        selection = {
          start: { line: segment.location.range.start.line, character: start },
          end: { line: segment.location.range.start.line, character: start + token.length }
        };
        if (segment.kind === 'program-counter' && segment.name === '.pc') name = `.pc ${token}`;
      }
    }
    const entry = createSymbol(name,
      segment.kind === 'selection' ? 'segment' : 'program-counter',
      { uri: document.uri, range: selection },
      directive ? `.${directive.name} ${directive.operands}` : undefined);
    entry.location.range = copyRange(segment.location.range);
    sections.set(segment.scopeId, entry);
    scopeOwners.set(segment.scopeId, entry);
  }

  const scopes = new Map(model.scopes.map(scope => [scope.id, scope]));
  const importsByScope = new Map<string, KickAssemblerOutlineSymbol[]>();
  for (const entry of model.imports) {
    // The deepest containing lexical scope owns the import. An active output
    // section is only presentation and must not change that ownership.
    let owner = model.rootScope;
    for (const scope of model.scopes) {
      if (containsPosition(scope.range, entry.location.range.start)
        && comparePositions(scope.range.start, owner.range.start) >= 0) owner = scope;
    }
    const symbol = createSymbol(entry.specifier ?? `#${entry.kind}`, 'import',
      entry.specifierLocation ?? entry.location, document.getText(entry.location.range).trim());
    symbol.location.range = copyRange(entry.location.range);
    const entries = importsByScope.get(owner.id) ?? [];
    entries.push(symbol);
    importsByScope.set(owner.id, entries);
  }

  function collect(scope: KickAssemblerSemanticScope): KickAssemblerOutlineSymbol[] {
    const items: { symbol: KickAssemblerOutlineSymbol; section?: KickAssemblerSemanticScope }[] = [];
    for (const id of scope.symbolIds) {
      const symbol = declarations.get(id);
      if (symbol) items.push({ symbol });
    }
    for (const symbol of importsByScope.get(scope.id) ?? []) items.push({ symbol });
    for (const id of scope.childScopeIds) {
      const child = scopes.get(id)!;
      const owner = scopeOwners.get(id);
      const children = collect(child);
      if (owner) {
        owner.children.push(...children);
        extendRange(owner, child.range);
        if (sections.has(id)) items.push({ symbol: owner, section: child });
      } else {
        // Anonymous/control scopes stay invisible but keep their declarations.
        for (const symbol of children) items.push({ symbol });
      }
    }
    items.sort((a, b) => comparePositions(a.symbol.selectionRange.start, b.symbol.selectionRange.start));
    const result: KickAssemblerOutlineSymbol[] = [];
    let segment: KickAssemblerOutlineSymbol | undefined;
    let active: KickAssemblerOutlineSymbol | undefined;
    for (const { symbol, section } of items) {
      if (symbol.kind === 'segment') {
        result.push(symbol);
        segment = active = symbol;
      } else if (symbol.kind === 'program-counter') {
        (segment?.children ?? result).push(symbol);
        // A braced .pc owns only its body; an unbraced .pc groups following items.
        if (section && comparePositions(section.range.end, section.location.range.end) === 0) active = symbol;
      } else if (symbol.kind === 'import' || symbol.kind === 'segment-definition') {
        result.push(symbol);
      } else {
        (active?.children ?? result).push(symbol);
      }
    }
    for (const symbol of result) extendToChildren(symbol);
    return result;
  }
  return collect(model.rootScope);
}

/** Retained for callers of the public Langium parse API; semantics own tree shape. */
export function buildKickAssemblerOutlineFromParsed(
  parsed: KickAssemblerOutlineParseResult
): KickAssemblerOutlineSymbol[] {
  return buildKickAssemblerOutline(parsed.sourceDocument ?? createTextDocumentModel({
    uri: parsed.document.uri.toString(), text: parsed.document.textDocument.getText()
  }));
}

function outlineKind(symbol: KickAssemblerSemanticSymbol): KickAssemblerOutlineSymbolKind | undefined {
  switch (symbol.kind) {
    case 'local-label':
    case 'anonymous-label': return 'label';
    case 'label':
    case 'constant':
    case 'variable':
    case 'namespace':
    case 'macro':
    case 'function':
    case 'pseudocommand':
    case 'struct':
    case 'enum':
    case 'segment-definition': return symbol.kind;
    // Parameters, enum members and compiler-generated placeholders keep their
    // existing lookup roles without adding new outline constructs.
    default: return undefined;
  }
}

function createSymbol(name: string, kind: KickAssemblerOutlineSymbolKind,
  location: SourceLocation, detail?: string): KickAssemblerOutlineSymbol {
  return { name, kind, detail,
    location: { uri: location.uri, range: copyRange(location.range) },
    selectionRange: copyRange(location.range), children: [] };
}

function copyRange(range: SourceRange): SourceRange {
  return { start: { ...range.start }, end: { ...range.end } };
}

function extendRange(symbol: KickAssemblerOutlineSymbol, range: SourceRange): void {
  if (comparePositions(range.start, symbol.location.range.start) < 0) symbol.location.range.start = { ...range.start };
  if (comparePositions(range.end, symbol.location.range.end) > 0) symbol.location.range.end = { ...range.end };
}

function extendToChildren(symbol: KickAssemblerOutlineSymbol): void {
  for (const child of symbol.children) {
    extendToChildren(child);
    extendRange(symbol, child.location.range);
  }
}
