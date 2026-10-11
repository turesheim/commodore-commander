import type { TextDocumentModel } from '../document/text-document-model.ts';
import { comparePositions, type SourceLocation } from '../location/source-location.ts';
import type { DocumentPosition } from '../location/source-location.ts';
import {
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
  getCommodoreMachineProfile,
  type CommodoreMachineProfileId
} from '../machines/commodore-machine-profiles.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';
import type {
  KickAssemblerSemanticScope,
  KickAssemblerSemanticSymbol
} from '../semantic/kick-assembler-semantic-model.ts';
import {
  createMachineProfileReferenceSymbolDefinitions
} from '../reference/machine-profile-reference-symbols.ts';
import {
  parseReferenceSymbolDefinitions,
  type ReferenceDocumentKind,
  type ReferenceSymbolDefinition,
  type ReferenceSymbolKind
} from '../reference/reference-symbol-catalog.ts';
import type { KickAssemblerSymbolKind } from '../symbols/symbol-types.ts';
import {
  KICK_ASSEMBLER_DIRECTIVES,
  type KickAssemblerDirectiveInfo
} from '../features/kick-assembler-language-facts.ts';

const IDENTIFIER_PATTERN = /^@?[A-Za-z_][A-Za-z0-9_.]*$/u;
const DIRECTIVE_PATTERN = /^[.#][A-Za-z][A-Za-z0-9_]*$/u;
const HEX_LITERAL_PATTERN = /^\$[0-9A-Fa-f]+$/u;
const DIRECTIVE_REFERENCE_URI = 'memory:///kickassembler-directives';
const C64_IO_REFERENCE_MACHINE_PROFILE_IDS:
  ReadonlySet<CommodoreMachineProfileId> = new Set([
    'c64',
    'c128',
    'c64dtv'
  ]);

export type KickAssemblerLookupDocumentKind =
  | 'kickassembler'
  | ReferenceDocumentKind;
export type KickAssemblerLookupOrigin = 'project' | 'reference';
export type KickAssemblerLookupTokenKind =
  | 'identifier'
  | 'hex-literal'
  | 'directive';
export type KickAssemblerLookupKind =
  | KickAssemblerSymbolKind
  | ReferenceSymbolKind;

export interface KickAssemblerLookupDocument {
  kind: KickAssemblerLookupDocumentKind;
  document: TextDocumentModel;
}

export interface KickAssemblerLookupOccurrence {
  name: string;
  qualifiedName?: string;
  normalizedName: string;
  kind: KickAssemblerLookupKind;
  origin: KickAssemblerLookupOrigin;
  location: SourceLocation;
  addressRange?: {
    start: number;
    end: number;
  };
  machineProfileId?: CommodoreMachineProfileId;
  syntax?: string;
  detail?: string;
  description?: string;
}

export interface KickAssemblerLookupTokenMatch {
  text: string;
  normalizedText: string;
  kind: KickAssemblerLookupTokenKind;
  startOffset: number;
  endOffset: number;
}

export interface KickAssemblerLookupIndex {
  /** Source-token locations bound to canonical, case-sensitive project names. */
  projectBindingsByLocation: Map<string, string>;
  /** Canonical qualified names; occurrences retain their source spelling. */
  projectDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>;
  projectReferencesByName: Map<string, KickAssemblerLookupOccurrence[]>;
  referenceDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>;
  referenceReferencesByName: Map<string, KickAssemblerLookupOccurrence[]>;
  referenceDeclarationsByAddressRange: KickAssemblerLookupOccurrence[];
}

export interface KickAssemblerLookupResult {
  queryName: string;
  queryOrigin: KickAssemblerLookupOrigin;
  declarations: KickAssemblerLookupOccurrence[];
  references: KickAssemblerLookupOccurrence[];
}

interface TokenOccurrence extends KickAssemblerLookupTokenMatch {
  location: SourceLocation;
}

interface ProjectDocumentAnalysis {
  symbols: readonly KickAssemblerSemanticSymbol[];
  namespaceScopes: readonly KickAssemblerSemanticScope[];
  tokens: readonly TokenOccurrence[];
}

interface CachedDocumentAnalysis<T> {
  text: string;
  languageId: string;
  analysis: T;
}

interface IndexDocumentSnapshot {
  kind: KickAssemblerLookupDocumentKind;
  uri: string;
  text: string;
  languageId: string;
}

interface CachedLookupIndex {
  documents: readonly IndexDocumentSnapshot[];
  machineProfileId: CommodoreMachineProfileId;
  index: KickAssemblerLookupIndex;
}

export interface KickAssemblerLookupIndexOptions {
  machineProfileId?: CommodoreMachineProfileId;
}

export class KickAssemblerLookupService {
  private readonly projectAnalysis = new Map<string, CachedDocumentAnalysis<ProjectDocumentAnalysis>>();
  private readonly referenceAnalysis = new Map<string, CachedDocumentAnalysis<readonly ReferenceSymbolDefinition[]>>();
  private cachedIndex: CachedLookupIndex | undefined;

  clearDocumentCache(): void {
    this.projectAnalysis.clear();
    this.referenceAnalysis.clear();
    this.cachedIndex = undefined;
  }

  protected analyzeProjectDocument(document: TextDocumentModel): ProjectDocumentAnalysis {
    const model = parseKickAssemblerSemanticModel(document);
    return {
      symbols: model.symbols,
      namespaceScopes: model.scopes.filter(scope => scope.kind === 'namespace'),
      tokens: collectTokenOccurrences(document)
    };
  }

  protected analyzeReferenceDocument(
    kind: ReferenceDocumentKind,
    document: TextDocumentModel
  ): readonly ReferenceSymbolDefinition[] {
    return parseReferenceSymbolDefinitions(kind, document);
  }

  buildIndex(
    documents: readonly KickAssemblerLookupDocument[],
    options: KickAssemblerLookupIndexOptions = {}
  ): KickAssemblerLookupIndex {
    const machineProfileId = options.machineProfileId ?? DEFAULT_COMMODORE_MACHINE_PROFILE_ID;
    if (this.cachedIndex && this.cachedIndex.machineProfileId === machineProfileId &&
        matchesIndexDocuments(this.cachedIndex.documents, documents)) {
      return copyLookupIndex(this.cachedIndex.index);
    }

    const index = this.assembleIndex(documents, { machineProfileId });
    this.cachedIndex = {
      machineProfileId,
      documents: documents.map(({ kind, document }) => ({
        kind, uri: document.uri, text: document.text, languageId: document.languageId
      })),
      // The existing public index remains mutable. Keep a private copy so both
      // first-build and cache-hit callers are isolated from subsequent results.
      index: copyLookupIndex(index)
    };
    return index;
  }

  protected assembleIndex(
    documents: readonly KickAssemblerLookupDocument[],
    options: KickAssemblerLookupIndexOptions
  ): KickAssemblerLookupIndex {
    // Keep only the latest supplied document set; workspace discovery/overlays
    // remain caller-owned. Text, rather than model version, controls reuse.
    retainDocumentAnalyses(this.projectAnalysis, new Set(documents
      .filter(input => input.kind === 'kickassembler')
      .map(input => input.document.uri)));
    retainDocumentAnalyses(this.referenceAnalysis, new Set(documents
      .filter(input => input.kind !== 'kickassembler')
      .map(input => referenceDocumentKey(input.kind, input.document.uri))));

    const projectDeclarationsByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const projectBindingsByLocation = new Map<string, string>();
    const projectReferencesByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceDeclarationsByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceReferencesByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceDeclarationsByAddressRange: KickAssemblerLookupOccurrence[] = [];
    const referenceKeys = new Set<string>();
    const machineProfileId =
      options.machineProfileId ?? DEFAULT_COMMODORE_MACHINE_PROFILE_ID;

    for (const definition of createKickAssemblerDirectiveReferenceDefinitions()) {
      addReferenceDefinition(
        definition,
        referenceKeys,
        referenceDeclarationsByName,
        referenceDeclarationsByAddressRange
      );
    }

    const projectAnalyses = documents.filter(input => input.kind === 'kickassembler')
      .map(input => cachedDocumentAnalysis(
          this.projectAnalysis, input.document.uri, input.document,
          () => this.analyzeProjectDocument(input.document)
        ));

    // Collect every declaration before binding uses: forward/cross-file lookup
    // must not depend on the caller's document order.
    for (const analysis of projectAnalyses) {
      for (const symbol of analysis.symbols) {
        const name = projectSymbolName(symbol);
        const occurrence: KickAssemblerLookupOccurrence = {
          name: symbol.name,
          qualifiedName: name,
          normalizedName: name,
          kind: symbol.kind,
          origin: 'project',
          location: copyLocation(symbol.location),
          ...(symbol.detail ? { detail: symbol.detail } : {})
        };
        projectBindingsByLocation.set(locationKey(symbol.location), name);
        pushOccurrence(projectDeclarationsByName, name, occurrence);
      }
    }

    for (const input of documents) {
      if (input.kind === 'kickassembler') {
        continue;
      }
      if (!isReferenceDocumentVisibleForMachine(input.kind, machineProfileId)) {
        continue;
      }

      const referenceKind = input.kind;
      const definitions = cachedDocumentAnalysis(
        this.referenceAnalysis,
        referenceDocumentKey(referenceKind, input.document.uri),
        input.document,
        () => this.analyzeReferenceDocument(referenceKind, input.document)
      );
      for (const definition of definitions) {
        addReferenceDefinition(
          definition,
          referenceKeys,
          referenceDeclarationsByName,
          referenceDeclarationsByAddressRange
        );
      }
    }

    for (const definition of createMachineProfileReferenceSymbolDefinitions(
      getCommodoreMachineProfile(machineProfileId)
    )) {
      addReferenceDefinition(
        definition,
        referenceKeys,
        referenceDeclarationsByName,
        referenceDeclarationsByAddressRange
      );
    }

    referenceDeclarationsByAddressRange.sort(compareReferenceAddressRanges);

    for (const analysis of projectAnalyses) {
      for (const occurrence of analysis.tokens) {
        const key = locationKey(occurrence.location);
        if (projectBindingsByLocation.has(key)) {
          continue;
        }

        if (occurrence.kind === 'identifier') {
          const name = resolveProjectName(occurrence, analysis.namespaceScopes, projectDeclarationsByName);
          if (name) {
            projectBindingsByLocation.set(key, name);
            const reference = toProjectReferenceOccurrence(occurrence,
              toProjectSymbolKind(projectDeclarationsByName.get(name)?.[0]?.kind));
            reference.qualifiedName = reference.normalizedName = name;
            pushOccurrence(projectReferencesByName, name, reference);
          }
        }

        const referenceDeclarations = referenceDeclarationsForToken(
          occurrence,
          referenceDeclarationsByName,
          referenceDeclarationsByAddressRange
        );
        if (
          referenceDeclarations.length === 0 &&
          !referenceKeys.has(occurrence.normalizedText)
        ) {
          continue;
        }

        pushOccurrence(
          referenceReferencesByName,
          occurrence.normalizedText,
          toReferenceLookupOccurrence(
            occurrence,
            toReferenceSymbolKind(
              referenceDeclarations[0]?.kind
            )
          )
        );
      }
    }

    return {
      projectBindingsByLocation,
      projectDeclarationsByName,
      projectReferencesByName,
      referenceDeclarationsByName,
      referenceReferencesByName,
      referenceDeclarationsByAddressRange
    };
  }

  lookupAtPosition(
    document: TextDocumentModel,
    position: DocumentPosition,
    index: KickAssemblerLookupIndex
  ): KickAssemblerLookupResult | undefined {
    const token = findLookupTokenAtPosition(document, position);
    if (!token) {
      return undefined;
    }

    const name = index.projectBindingsByLocation.get(locationKey(
      createLocation(document, token.startOffset, token.endOffset)
    ));
    const projectDeclarations = name ? index.projectDeclarationsByName.get(name) ?? [] : [];

    if (projectDeclarations.length > 0) {
      return {
        queryName: token.text,
        queryOrigin: 'project',
        declarations: [...projectDeclarations],
        references: [...(index.projectReferencesByName.get(name!) ?? [])]
      };
    }

    const referenceDeclarations = referenceDeclarationsForToken(
      token,
      index.referenceDeclarationsByName,
      index.referenceDeclarationsByAddressRange
    );

    if (referenceDeclarations.length === 0) {
      return undefined;
    }

    return {
      queryName: token.normalizedText,
      queryOrigin: 'reference',
      declarations: [...referenceDeclarations],
      references: [
        ...(index.referenceReferencesByName.get(token.normalizedText) ?? [])
      ]
    };
  }
}

function matchesIndexDocuments(
  snapshots: readonly IndexDocumentSnapshot[],
  documents: readonly KickAssemblerLookupDocument[]
): boolean {
  return snapshots.length === documents.length && snapshots.every((snapshot, index) => {
    const input = documents[index]!;
    return snapshot.kind === input.kind && snapshot.uri === input.document.uri &&
      snapshot.text === input.document.text && snapshot.languageId === input.document.languageId;
  });
}

function copyLookupIndex(index: KickAssemblerLookupIndex): KickAssemblerLookupIndex {
  // Preserve aliases within one result (e.g. address/name views of a reference),
  // while isolating maps, arrays, occurrences, locations and address ranges.
  const occurrences = new Map<KickAssemblerLookupOccurrence, KickAssemblerLookupOccurrence>();
  const copy = (occurrence: KickAssemblerLookupOccurrence): KickAssemblerLookupOccurrence => {
    let result = occurrences.get(occurrence);
    if (!result) {
      result = { ...occurrence, location: copyLocation(occurrence.location) };
      if (occurrence.addressRange) result.addressRange = { ...occurrence.addressRange };
      occurrences.set(occurrence, result);
    }
    return result;
  };
  const copyMap = (map: Map<string, KickAssemblerLookupOccurrence[]>) =>
    new Map([...map].map(([key, values]) => [key, values.map(copy)] as const));
  return {
    projectBindingsByLocation: new Map(index.projectBindingsByLocation),
    projectDeclarationsByName: copyMap(index.projectDeclarationsByName),
    projectReferencesByName: copyMap(index.projectReferencesByName),
    referenceDeclarationsByName: copyMap(index.referenceDeclarationsByName),
    referenceReferencesByName: copyMap(index.referenceReferencesByName),
    referenceDeclarationsByAddressRange: index.referenceDeclarationsByAddressRange.map(copy)
  };
}

function projectSymbolName(symbol: KickAssemblerSemanticSymbol): string {
  // Local/anonymous-label resolution is a separate compiler-semantics task.
  return symbol.kind === 'local-label' || symbol.kind === 'anonymous-label'
    ? symbol.name : symbol.qualifiedName;
}

function resolveProjectName(
  token: TokenOccurrence,
  scopes: readonly KickAssemblerSemanticScope[],
  declarations: Map<string, KickAssemblerLookupOccurrence[]>
): string | undefined {
  // TODO: Add lexical/label-scope identity and import-site namespace context.
  // This step deliberately resolves only the semantic model's namespace chain.
  if (token.text.startsWith('@')) {
    const rootName = token.text.slice(1);
    return declarations.has(rootName) ? rootName : undefined;
  }
  const position = token.location.range.start;
  let prefix = '';
  // Parser order places nested scopes after their parents.
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    const scope = scopes[index]!;
    if (comparePositions(position, scope.range.start) >= 0 &&
        comparePositions(position, scope.range.end) < 0) {
      prefix = scope.qualifiedName ?? '';
      break;
    }
  }
  while (prefix) {
    const name = `${prefix}.${token.text}`;
    if (declarations.has(name)) return name;
    const separator = prefix.lastIndexOf('.');
    prefix = separator >= 0 ? prefix.slice(0, separator) : '';
  }
  return declarations.has(token.text) ? token.text : undefined;
}

function addReferenceDefinition(
  definition: ReferenceSymbolDefinition,
  referenceKeys: Set<string>,
  referenceDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>,
  referenceDeclarationsByAddressRange: KickAssemblerLookupOccurrence[]
): void {
  referenceKeys.add(definition.normalizedName);
  const occurrence = toReferenceOccurrence(definition);
  pushOccurrence(
    referenceDeclarationsByName,
    definition.normalizedName,
    occurrence
  );
  if (occurrence.addressRange) {
    referenceDeclarationsByAddressRange.push(occurrence);
  }
}

function isReferenceDocumentVisibleForMachine(
  kind: ReferenceDocumentKind,
  machineProfileId: CommodoreMachineProfileId
): boolean {
  if (kind === '6502-reference') {
    return true;
  }
  return C64_IO_REFERENCE_MACHINE_PROFILE_IDS.has(machineProfileId);
}

export function findLookupTokenAtPosition(
  document: TextDocumentModel,
  position: DocumentPosition
): KickAssemblerLookupTokenMatch | undefined {
  if (document.text.length === 0) {
    return undefined;
  }

  let probe = clamp(document.offsetAt(position), 0, document.text.length - 1);

  if (
    document.text[probe] === '#' &&
    isIdentifierStart(document.text[probe + 1])
  ) {
    probe += 1;
  }

  if (!isLookupTokenCharacter(document.text[probe])) {
    if (probe > 0 && isLookupTokenCharacter(document.text[probe - 1])) {
      probe -= 1;
    } else {
      return undefined;
    }
  }

  let startOffset = probe;
  let endOffset = probe + 1;

  while (
    startOffset > 0 &&
    isLookupTokenCharacter(document.text[startOffset - 1])
  ) {
    startOffset -= 1;
  }

  while (
    endOffset < document.text.length &&
    isLookupTokenCharacter(document.text[endOffset])
  ) {
    endOffset += 1;
  }

  const text = document.text.slice(startOffset, endOffset);
  const directiveText = directiveTokenText(document, startOffset, endOffset, text);

  if (directiveText) {
    return {
      text: directiveText.text,
      normalizedText: directiveText.text.toUpperCase(),
      kind: 'directive',
      startOffset: directiveText.startOffset,
      endOffset
    };
  }

  if (HEX_LITERAL_PATTERN.test(text)) {
    return {
      text,
      normalizedText: text.toUpperCase(),
      kind: 'hex-literal',
      startOffset,
      endOffset
    };
  }

  if (!IDENTIFIER_PATTERN.test(text)) {
    return undefined;
  }

  return {
    text,
    normalizedText: text.toUpperCase(),
    kind: 'identifier',
    startOffset,
    endOffset
  };
}

function cachedDocumentAnalysis<T>(
  cache: Map<string, CachedDocumentAnalysis<T>>,
  key: string,
  document: TextDocumentModel,
  analyze: () => T
): T {
  const cached = cache.get(key);
  if (cached && cached.text === document.text && cached.languageId === document.languageId) {
    return cached.analysis;
  }
  const analysis = analyze();
  cache.set(key, { text: document.text, languageId: document.languageId, analysis });
  return analysis;
}

function retainDocumentAnalyses<T>(cache: Map<string, T>, keys: ReadonlySet<string>): void {
  for (const key of cache.keys()) {
    if (!keys.has(key)) {
      cache.delete(key);
    }
  }
}

function referenceDocumentKey(kind: KickAssemblerLookupDocumentKind, uri: string): string {
  return `${kind}:${uri}`;
}

function copyLocation(location: SourceLocation): SourceLocation {
  return {
    uri: location.uri,
    range: { start: { ...location.range.start }, end: { ...location.range.end } }
  };
}

function collectTokenOccurrences(
  document: TextDocumentModel
): TokenOccurrence[] {
  const occurrences: TokenOccurrence[] = [];
  const text = document.text;

  let offset = 0;
  let inBlockComment = false;
  let stringDelimiter: '"' | "'" | undefined;

  while (offset < text.length) {
    const current = text[offset];
    const next = text[offset + 1];

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false;
        offset += 2;
        continue;
      }
      offset += 1;
      continue;
    }

    if (stringDelimiter) {
      if (current === '\\') {
        offset += 2;
        continue;
      }
      if (current === stringDelimiter) {
        stringDelimiter = undefined;
      }
      offset += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      inBlockComment = true;
      offset += 2;
      continue;
    }

    if (current === '/' && next === '/') {
      offset = advanceToNextLine(text, offset + 2);
      continue;
    }

    if (current === '"' || current === "'") {
      stringDelimiter = current;
      offset += 1;
      continue;
    }

    const token = findTokenAtOffset(document, offset);
    if (!token || token.startOffset !== offset) {
      offset += 1;
      continue;
    }

    occurrences.push({
      ...token,
      location: createLocation(document, token.startOffset, token.endOffset)
    });
    offset = token.endOffset;
  }

  return occurrences;
}

function findTokenAtOffset(
  document: TextDocumentModel,
  offset: number
): KickAssemblerLookupTokenMatch | undefined {
  return findLookupTokenAtPosition(document, document.positionAt(offset));
}

function createLocation(
  document: TextDocumentModel,
  startOffset: number,
  endOffset: number
): SourceLocation {
  return {
    uri: document.uri,
    range: {
      start: document.positionAt(startOffset),
      end: document.positionAt(endOffset)
    }
  };
}

function toProjectReferenceOccurrence(
  occurrence: TokenOccurrence,
  kind: KickAssemblerSymbolKind | undefined
): KickAssemblerLookupOccurrence {
  return {
    name: occurrence.text,
    normalizedName: occurrence.text,
    kind: kind ?? 'label',
    origin: 'project',
    location: copyLocation(occurrence.location)
  };
}

function toReferenceLookupOccurrence(
  occurrence: TokenOccurrence,
  kind: ReferenceSymbolKind | undefined
): KickAssemblerLookupOccurrence {
  return {
    name: occurrence.text,
    normalizedName: occurrence.normalizedText,
    kind:
      kind ??
      fallbackReferenceKind(occurrence),
    origin: 'reference',
    location: copyLocation(occurrence.location)
  };
}

function toReferenceOccurrence(
  definition: ReferenceSymbolDefinition
): KickAssemblerLookupOccurrence {
  const occurrence: KickAssemblerLookupOccurrence = {
    name: definition.name,
    normalizedName: definition.normalizedName,
    kind: definition.kind,
    origin: 'reference',
    location: copyLocation(definition.location)
  };

  if (definition.addressRange) {
    occurrence.addressRange = { ...definition.addressRange };
  }
  if (definition.machineProfileId) {
    occurrence.machineProfileId = definition.machineProfileId;
  }
  if (definition.syntax) {
    occurrence.syntax = definition.syntax;
  }
  if (definition.detail) {
    occurrence.detail = definition.detail;
  }
  if (definition.description) {
    occurrence.description = definition.description;
  }

  return occurrence;
}

function referenceDeclarationsForToken(
  token: Pick<KickAssemblerLookupTokenMatch, 'kind' | 'normalizedText'>,
  referenceDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>,
  referenceDeclarationsByAddressRange: readonly KickAssemblerLookupOccurrence[]
): KickAssemblerLookupOccurrence[] {
  const exact = referenceDeclarationsByName.get(token.normalizedText) ?? [];
  if (token.kind !== 'hex-literal') {
    return exact;
  }

  const address = parseHexLiteral(token.normalizedText);
  if (address === undefined) {
    return exact;
  }

  const ranged = referenceDeclarationsByAddressRange.filter((occurrence) => {
    const range = occurrence.addressRange;
    return Boolean(range && address >= range.start && address <= range.end);
  });

  return [...exact, ...ranged.filter((occurrence) => !exact.includes(occurrence))];
}

function parseHexLiteral(value: string): number | undefined {
  if (!HEX_LITERAL_PATTERN.test(value)) {
    return undefined;
  }
  const parsed = Number.parseInt(value.slice(1), 16);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareReferenceAddressRanges(
  left: KickAssemblerLookupOccurrence,
  right: KickAssemblerLookupOccurrence
): number {
  const leftRange = left.addressRange;
  const rightRange = right.addressRange;
  if (!leftRange || !rightRange) {
    return leftRange ? -1 : rightRange ? 1 : 0;
  }

  const leftWidth = leftRange.end - leftRange.start;
  const rightWidth = rightRange.end - rightRange.start;
  if (leftWidth !== rightWidth) {
    return leftWidth - rightWidth;
  }
  return left.name.localeCompare(right.name);
}

function pushOccurrence(
  index: Map<string, KickAssemblerLookupOccurrence[]>,
  name: string,
  occurrence: KickAssemblerLookupOccurrence
): void {
  const entries = index.get(name) ?? [];
  entries.push(occurrence);
  index.set(name, entries);
}

function locationKey(location: SourceLocation): string {
  const { start, end } = location.range;
  return `${location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
}

function isLookupTokenCharacter(character: string | undefined): boolean {
  return Boolean(character && /[@$A-Za-z0-9_.]/u.test(character));
}

function advanceToNextLine(text: string, offset: number): number {
  while (offset < text.length) {
    const current = text[offset];
    offset += 1;

    if (current === '\n') {
      break;
    }
  }

  return offset;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function toProjectSymbolKind(
  kind: KickAssemblerLookupKind | undefined
): KickAssemblerSymbolKind | undefined {
  if (isReferenceSymbolKind(kind)) {
    return undefined;
  }
  return kind;
}

function toReferenceSymbolKind(
  kind: KickAssemblerLookupKind | undefined
): ReferenceSymbolKind | undefined {
  return isReferenceSymbolKind(kind) ? kind : undefined;
}

function isReferenceSymbolKind(
  kind: KickAssemblerLookupKind | undefined
): kind is ReferenceSymbolKind {
  return kind === '6502-mnemonic' ||
    kind === 'c64-io-address' ||
    kind === 'c64-io-id' ||
    kind === 'kickassembler-directive' ||
    kind === 'kickassembler-preprocessor-directive' ||
    kind === 'machine-io-address' ||
    kind === 'machine-io-id' ||
    kind === 'machine-memory-address' ||
    kind === 'machine-rom-symbol' ||
    kind === 'machine-zero-page';
}

function createKickAssemblerDirectiveReferenceDefinitions():
  ReferenceSymbolDefinition[] {
  return KICK_ASSEMBLER_DIRECTIVES.map((directive, index) =>
    toDirectiveReferenceDefinition(directive, index)
  );
}

function toDirectiveReferenceDefinition(
  directive: KickAssemblerDirectiveInfo,
  index: number
): ReferenceSymbolDefinition {
  return {
    name: directive.insertText,
    normalizedName: directive.insertText.toUpperCase(),
    kind: directive.prefix === '#'
      ? 'kickassembler-preprocessor-directive'
      : 'kickassembler-directive',
    location: {
      uri: DIRECTIVE_REFERENCE_URI,
      range: {
        start: {
          line: index,
          character: 0
        },
        end: {
          line: index,
          character: directive.insertText.length
        }
      }
    },
    ...(directive.syntax ? { syntax: directive.syntax } : {}),
    detail: directive.detail,
    description: directive.description
  };
}

function directiveTokenText(
  document: TextDocumentModel,
  startOffset: number,
  endOffset: number,
  text: string
): { text: string; startOffset: number } | undefined {
  if (DIRECTIVE_PATTERN.test(text)) {
    return {
      text,
      startOffset
    };
  }

  if (
    startOffset > 0 &&
    document.text[startOffset - 1] === '#' &&
    IDENTIFIER_PATTERN.test(text)
  ) {
    const candidate = `#${text}`;
    if (DIRECTIVE_PATTERN.test(candidate)) {
      return {
        text: candidate,
        startOffset: startOffset - 1
      };
    }
  }

  return undefined;
}

function fallbackReferenceKind(
  occurrence: TokenOccurrence
): ReferenceSymbolKind {
  if (occurrence.kind === 'hex-literal') {
    return 'c64-io-address';
  }
  if (occurrence.kind === 'directive') {
    return occurrence.normalizedText.startsWith('#')
      ? 'kickassembler-preprocessor-directive'
      : 'kickassembler-directive';
  }
  return '6502-mnemonic';
}

function isIdentifierStart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z_]/u.test(character));
}
