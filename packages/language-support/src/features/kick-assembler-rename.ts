import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { DocumentPosition, SourceLocation, SourceRange } from '../location/source-location.ts';
import {
  findLookupTokenAtPosition,
  KickAssemblerLookupService,
  type KickAssemblerLookupIndex,
  type KickAssemblerLookupOccurrence
} from '../lookup/kick-assembler-lookup-service.ts';

export interface KickAssemblerTextEdit {
  range: SourceRange;
  newText: string;
}

export interface KickAssemblerWorkspaceTextEdit extends KickAssemblerTextEdit {
  uri: string;
}

export interface KickAssemblerRenamePlan {
  oldName: string;
  newName: string;
  edits: KickAssemblerWorkspaceTextEdit[];
}

export interface KickAssemblerPrepareRenameResult {
  range: SourceRange;
  placeholder: string;
}

export function prepareKickAssemblerRename(
  document: TextDocumentModel,
  position: DocumentPosition,
  index: KickAssemblerLookupIndex
): KickAssemblerPrepareRenameResult | undefined {
  const token = findLookupTokenAtPosition(document, position);
  if (!token || !isRenameableSymbolName(token.text)) {
    return undefined;
  }

  const lookup = new KickAssemblerLookupService()
    .lookupAtPosition(document, position, index);
  if (!lookup || lookup.queryOrigin !== 'project') {
    return undefined;
  }

  return {
    range: {
      start: document.positionAt(token.startOffset),
      end: document.positionAt(token.endOffset)
    },
    placeholder: token.text
  };
}

export function buildKickAssemblerRenamePlan(
  document: TextDocumentModel,
  position: DocumentPosition,
  newName: string,
  index: KickAssemblerLookupIndex
): KickAssemblerRenamePlan | undefined {
  const token = findLookupTokenAtPosition(document, position);
  if (!token || !isRenameableSymbolName(token.text) || !isRenameableSymbolName(newName)) {
    return undefined;
  }

  const lookup = new KickAssemblerLookupService()
    .lookupAtPosition(document, position, index);
  if (!lookup || lookup.queryOrigin !== 'project') {
    return undefined;
  }

  const occurrences = deduplicateOccurrences([
    ...lookup.declarations,
    ...lookup.references
  ]);
  if (occurrences.length === 0) {
    return undefined;
  }

  return {
    oldName: token.text,
    newName,
    edits: occurrences.map((occurrence) => ({
      uri: occurrence.location.uri,
      range: occurrence.location.range,
      newText: newName
    }))
  };
}

function isRenameableSymbolName(name: string): boolean {
  if (name === '!') {
    return false;
  }

  return /^@?[A-Za-z_][A-Za-z0-9_.]*$/u.test(name) ||
    /^![A-Za-z_@][A-Za-z0-9_.@]*$/u.test(name);
}

function deduplicateOccurrences(
  occurrences: readonly KickAssemblerLookupOccurrence[]
): KickAssemblerLookupOccurrence[] {
  const unique = new Map<string, KickAssemblerLookupOccurrence>();
  for (const occurrence of occurrences) {
    unique.set(locationKey(occurrence.location), occurrence);
  }
  return [...unique.values()];
}

function locationKey(location: SourceLocation): string {
  const { start, end } = location.range;
  return `${location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
}
