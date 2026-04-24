import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { DocumentPosition, SourceLocation } from '../location/source-location.ts';
import {
  DEFAULT_COMMODORE_MACHINE_PROFILE_ID,
  getCommodoreMachineProfile,
  type CommodoreMachineProfileId
} from '../machines/commodore-machine-profiles.ts';
import { scanKickAssemblerDocument } from '../parsing/kick-assembler-scanner.ts';
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

const IDENTIFIER_PATTERN = /^@?[A-Za-z_][A-Za-z0-9_.]*$/u;
const HEX_LITERAL_PATTERN = /^\$[0-9A-Fa-f]+$/u;
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
export type KickAssemblerLookupTokenKind = 'identifier' | 'hex-literal';
export type KickAssemblerLookupKind =
  | KickAssemblerSymbolKind
  | ReferenceSymbolKind;

export interface KickAssemblerLookupDocument {
  kind: KickAssemblerLookupDocumentKind;
  document: TextDocumentModel;
}

export interface KickAssemblerLookupOccurrence {
  name: string;
  normalizedName: string;
  kind: KickAssemblerLookupKind;
  origin: KickAssemblerLookupOrigin;
  location: SourceLocation;
  addressRange?: {
    start: number;
    end: number;
  };
  machineProfileId?: CommodoreMachineProfileId;
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

export interface KickAssemblerLookupIndexOptions {
  machineProfileId?: CommodoreMachineProfileId;
}

export class KickAssemblerLookupService {
  buildIndex(
    documents: readonly KickAssemblerLookupDocument[],
    options: KickAssemblerLookupIndexOptions = {}
  ): KickAssemblerLookupIndex {
    const projectDeclarationsByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const projectReferencesByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceDeclarationsByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceReferencesByName = new Map<string, KickAssemblerLookupOccurrence[]>();
    const referenceDeclarationsByAddressRange: KickAssemblerLookupOccurrence[] = [];
    const referenceKeys = new Set<string>();
    const machineProfileId =
      options.machineProfileId ?? DEFAULT_COMMODORE_MACHINE_PROFILE_ID;

    for (const input of documents) {
      if (input.kind === 'kickassembler') {
        continue;
      }
      if (!isReferenceDocumentVisibleForMachine(input.kind, machineProfileId)) {
        continue;
      }

      for (const definition of parseReferenceSymbolDefinitions(
        input.kind,
        input.document
      )) {
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

    for (const input of documents) {
      if (input.kind !== 'kickassembler') {
        continue;
      }

      const scan = scanKickAssemblerDocument(input.document);
      const declarationKeys = new Set<string>();

      for (const symbol of scan.symbols) {
        const occurrence: KickAssemblerLookupOccurrence = {
          name: symbol.name,
          normalizedName: symbol.name,
          kind: symbol.kind,
          origin: 'project' as const,
          location: symbol.location
        };
        if (symbol.detail) {
          occurrence.detail = symbol.detail;
        }

        declarationKeys.add(locationKey(symbol.location));
        pushOccurrence(
          projectDeclarationsByName,
          symbol.name,
          occurrence
        );
      }

      for (const occurrence of collectTokenOccurrences(input.document)) {
        if (declarationKeys.has(locationKey(occurrence.location))) {
          continue;
        }

        if (occurrence.kind === 'identifier') {
          pushOccurrence(
            projectReferencesByName,
            occurrence.text,
            toProjectReferenceOccurrence(
              occurrence,
              toProjectSymbolKind(
                projectDeclarationsByName.get(occurrence.text)?.[0]?.kind
              )
            )
          );
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

    const projectDeclarations =
      index.projectDeclarationsByName.get(token.text) ?? [];

    if (projectDeclarations.length > 0) {
      return {
        queryName: token.text,
        queryOrigin: 'project',
        declarations: [...projectDeclarations],
        references: [...(index.projectReferencesByName.get(token.text) ?? [])]
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
    location: occurrence.location
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
      (occurrence.kind === 'hex-literal' ? 'c64-io-address' : '6502-mnemonic'),
    origin: 'reference',
    location: occurrence.location
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
    location: definition.location
  };

  if (definition.addressRange) {
    occurrence.addressRange = definition.addressRange;
  }
  if (definition.machineProfileId) {
    occurrence.machineProfileId = definition.machineProfileId;
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
    kind === 'machine-io-address' ||
    kind === 'machine-io-id' ||
    kind === 'machine-memory-address' ||
    kind === 'machine-rom-symbol' ||
    kind === 'machine-zero-page';
}
