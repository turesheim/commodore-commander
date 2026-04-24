import type { SourceLocation } from '../location/source-location.ts';
import type {
  KickAssemblerLookupIndex,
  KickAssemblerLookupKind,
  KickAssemblerLookupOccurrence
} from '../lookup/kick-assembler-lookup-service.ts';

export interface KickAssemblerWorkspaceSymbol {
  name: string;
  kind: KickAssemblerLookupKind;
  location: SourceLocation;
  containerName?: string;
  detail?: string;
}

export function findKickAssemblerWorkspaceSymbols(
  index: KickAssemblerLookupIndex,
  query = ''
): KickAssemblerWorkspaceSymbol[] {
  const normalizedQuery = query.trim().toLowerCase();
  const occurrences = [...index.projectDeclarationsByName.values()].flat();
  const unique = new Map<string, KickAssemblerLookupOccurrence>();

  for (const occurrence of occurrences) {
    if (
      normalizedQuery.length > 0 &&
      !occurrence.name.toLowerCase().includes(normalizedQuery)
    ) {
      continue;
    }
    unique.set(locationKey(occurrence.location), occurrence);
  }

  return [...unique.values()]
    .sort((left, right) => {
      const nameComparison = left.name.localeCompare(right.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return left.location.uri.localeCompare(right.location.uri);
    })
    .map((occurrence) => {
      const symbol: KickAssemblerWorkspaceSymbol = {
        name: occurrence.name,
        kind: occurrence.kind,
        location: occurrence.location
      };
      if (occurrence.detail) {
        symbol.detail = occurrence.detail;
      }
      return symbol;
    });
}

function locationKey(location: SourceLocation): string {
  const { start, end } = location.range;
  return `${location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
}
