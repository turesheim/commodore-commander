import type { SourceLocation } from '../location/source-location.ts';
import type {
  CommodoreIoRegister,
  CommodoreMachineProfile,
  CommodoreRomSymbol
} from '../machines/commodore-machine-profiles.ts';
import type {
  ReferenceAddressRange,
  ReferenceSymbolDefinition,
  ReferenceSymbolKind
} from './reference-symbol-catalog.ts';

export function createMachineProfileReferenceSymbolDefinitions(
  profile: CommodoreMachineProfile
): ReferenceSymbolDefinition[] {
  const definitions: ReferenceSymbolDefinition[] = [];

  for (const memoryMap of profile.memoryMaps) {
    for (const region of memoryMap.regions) {
      definitions.push(
        definitionFromAddressRange(
          profile,
          'machine-memory-address',
          'memory',
          `${memoryMap.id}-${region.name}`,
          formatRangeName(region),
          region,
          [
            profile.displayName,
            memoryMap.name,
            region.kind,
            region.bank
          ],
          region.description
        )
      );
    }
  }

  for (const zeroPage of profile.zeroPage) {
    definitions.push(
      definitionFromAddressRange(
        profile,
        'machine-zero-page',
        'zero-page',
        zeroPage.name,
        zeroPage.name,
        zeroPage,
        [profile.displayName, 'zero page', formatRangeName(zeroPage)],
        zeroPage.description
      )
    );
  }

  for (const register of profile.ioRegisters) {
    if (register.id) {
      definitions.push(
        definitionFromAddressRange(
          profile,
          'machine-io-id',
          'io-id',
          register.id,
          register.id,
          register,
          [
            profile.displayName,
            register.chip,
            formatRangeName(register),
            register.access
          ],
          describeIoRegister(register)
        )
      );
    }

    definitions.push(
      definitionFromAddressRange(
        profile,
        'machine-io-address',
        'io-address',
        register.id ?? register.name,
        formatRangeName(register),
        register,
        [
          profile.displayName,
          register.id,
          register.name,
          register.chip,
          register.access
        ],
        describeIoRegister(register)
      )
    );
  }

  for (const rom of profile.roms) {
    definitions.push(
      definitionFromAddressRange(
        profile,
        'machine-memory-address',
        'rom',
        rom.id,
        formatRangeName(rom),
        rom,
        [profile.displayName, rom.module, rom.name],
        rom.description
      )
    );
  }

  for (const symbol of profile.romSymbols) {
    definitions.push(
      romSymbolDefinition(profile, symbol, symbol.name, symbol.name, 'rom-symbol')
    );
    definitions.push(
      romSymbolDefinition(
        profile,
        symbol,
        formatAddress(symbol.address),
        symbol.name,
        'rom-address'
      )
    );
  }

  return definitions;
}

function definitionFromAddressRange(
  profile: CommodoreMachineProfile,
  kind: ReferenceSymbolKind,
  section: string,
  stableId: string,
  name: string,
  range: ReferenceAddressRange,
  detailParts: Array<string | undefined>,
  description: string | undefined
): ReferenceSymbolDefinition {
  const detail = joinDetail(detailParts);
  return {
    name,
    normalizedName: normalizeReferenceKey(name),
    kind,
    machineProfileId: profile.id,
    addressRange: {
      start: range.start,
      end: range.end
    },
    location: syntheticLocation(profile, section, stableId, name.length),
    ...(detail ? { detail } : {}),
    ...(description ? { description } : {})
  };
}

function romSymbolDefinition(
  profile: CommodoreMachineProfile,
  symbol: CommodoreRomSymbol,
  name: string,
  stableId: string,
  section: string
): ReferenceSymbolDefinition {
  const detail = joinDetail([
    profile.displayName,
    symbol.module.toUpperCase(),
    formatAddress(symbol.address)
  ]);

  return {
    name,
    normalizedName: normalizeReferenceKey(name),
    kind: 'machine-rom-symbol',
    machineProfileId: profile.id,
    addressRange: {
      start: symbol.address,
      end: symbol.address
    },
    location: syntheticLocation(profile, section, stableId, name.length),
    ...(detail ? { detail } : {}),
    description: symbol.description
  };
}

function describeIoRegister(register: CommodoreIoRegister): string {
  const sections = [register.name];

  if (register.bits && register.bits.length > 0) {
    sections.push(register.bits.map((bit) => `- ${bit}`).join('\n'));
  }

  return sections.join('\n\n');
}

function formatRangeName(range: ReferenceAddressRange): string {
  return range.start === range.end
    ? formatAddress(range.start)
    : `${formatAddress(range.start)}-${formatAddress(range.end)}`;
}

function formatAddress(address: number): string {
  const width = address > 0xffff ? 6 : 4;
  return `$${address.toString(16).toUpperCase().padStart(width, '0')}`;
}

function syntheticLocation(
  profile: CommodoreMachineProfile,
  section: string,
  stableId: string,
  length: number
): SourceLocation {
  return {
    uri: `machine-profile:///${profile.id}/${section}/${encodeURIComponent(stableId)}`,
    range: {
      start: {
        line: 0,
        character: 0
      },
      end: {
        line: 0,
        character: Math.max(1, length)
      }
    }
  };
}

function joinDetail(parts: Array<string | undefined>): string | undefined {
  const filtered = parts.filter((part): part is string => Boolean(part && part.trim()));
  return filtered.length > 0 ? filtered.join(' - ') : undefined;
}

function normalizeReferenceKey(name: string): string {
  return name.toUpperCase();
}
