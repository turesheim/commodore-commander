"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KickAssemblerLookupService = void 0;
exports.findLookupTokenAtPosition = findLookupTokenAtPosition;
const kick_assembler_scanner_ts_1 = require("../parsing/kick-assembler-scanner.ts");
const reference_symbol_catalog_ts_1 = require("../reference/reference-symbol-catalog.ts");
const IDENTIFIER_PATTERN = /^@?[A-Za-z_][A-Za-z0-9_.]*$/u;
const HEX_LITERAL_PATTERN = /^\$[0-9A-Fa-f]+$/u;
class KickAssemblerLookupService {
    buildIndex(documents) {
        const projectDeclarationsByName = new Map();
        const projectReferencesByName = new Map();
        const referenceDeclarationsByName = new Map();
        const referenceReferencesByName = new Map();
        const referenceKeys = new Set();
        for (const input of documents) {
            if (input.kind === 'kickassembler') {
                continue;
            }
            for (const definition of (0, reference_symbol_catalog_ts_1.parseReferenceSymbolDefinitions)(input.kind, input.document)) {
                referenceKeys.add(definition.normalizedName);
                pushOccurrence(referenceDeclarationsByName, definition.normalizedName, toReferenceOccurrence(definition));
            }
        }
        for (const input of documents) {
            if (input.kind !== 'kickassembler') {
                continue;
            }
            const scan = (0, kick_assembler_scanner_ts_1.scanKickAssemblerDocument)(input.document);
            const declarationKeys = new Set();
            for (const symbol of scan.symbols) {
                const occurrence = {
                    name: symbol.name,
                    normalizedName: symbol.name,
                    kind: symbol.kind,
                    origin: 'project',
                    location: symbol.location
                };
                if (symbol.detail) {
                    occurrence.detail = symbol.detail;
                }
                declarationKeys.add(locationKey(symbol.location));
                pushOccurrence(projectDeclarationsByName, symbol.name, occurrence);
            }
            for (const occurrence of collectTokenOccurrences(input.document)) {
                if (declarationKeys.has(locationKey(occurrence.location))) {
                    continue;
                }
                if (occurrence.kind === 'identifier') {
                    pushOccurrence(projectReferencesByName, occurrence.text, toProjectReferenceOccurrence(occurrence, toProjectSymbolKind(projectDeclarationsByName.get(occurrence.text)?.[0]?.kind)));
                }
                if (!referenceKeys.has(occurrence.normalizedText)) {
                    continue;
                }
                pushOccurrence(referenceReferencesByName, occurrence.normalizedText, toReferenceLookupOccurrence(occurrence, toReferenceSymbolKind(referenceDeclarationsByName.get(occurrence.normalizedText)?.[0]?.kind)));
            }
        }
        return {
            projectDeclarationsByName,
            projectReferencesByName,
            referenceDeclarationsByName,
            referenceReferencesByName
        };
    }
    lookupAtPosition(document, position, index) {
        const token = findLookupTokenAtPosition(document, position);
        if (!token) {
            return undefined;
        }
        const projectDeclarations = index.projectDeclarationsByName.get(token.text) ?? [];
        if (projectDeclarations.length > 0) {
            return {
                queryName: token.text,
                queryOrigin: 'project',
                declarations: [...projectDeclarations],
                references: [...(index.projectReferencesByName.get(token.text) ?? [])]
            };
        }
        const referenceDeclarations = index.referenceDeclarationsByName.get(token.normalizedText) ?? [];
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
exports.KickAssemblerLookupService = KickAssemblerLookupService;
function findLookupTokenAtPosition(document, position) {
    if (document.text.length === 0) {
        return undefined;
    }
    let probe = clamp(document.offsetAt(position), 0, document.text.length - 1);
    if (!isLookupTokenCharacter(document.text[probe])) {
        if (probe > 0 && isLookupTokenCharacter(document.text[probe - 1])) {
            probe -= 1;
        }
        else {
            return undefined;
        }
    }
    let startOffset = probe;
    let endOffset = probe + 1;
    while (startOffset > 0 &&
        isLookupTokenCharacter(document.text[startOffset - 1])) {
        startOffset -= 1;
    }
    while (endOffset < document.text.length &&
        isLookupTokenCharacter(document.text[endOffset])) {
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
function collectTokenOccurrences(document) {
    const occurrences = [];
    const text = document.text;
    let offset = 0;
    let inBlockComment = false;
    let stringDelimiter;
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
function findTokenAtOffset(document, offset) {
    return findLookupTokenAtPosition(document, document.positionAt(offset));
}
function createLocation(document, startOffset, endOffset) {
    return {
        uri: document.uri,
        range: {
            start: document.positionAt(startOffset),
            end: document.positionAt(endOffset)
        }
    };
}
function toProjectReferenceOccurrence(occurrence, kind) {
    return {
        name: occurrence.text,
        normalizedName: occurrence.text,
        kind: kind ?? 'label',
        origin: 'project',
        location: occurrence.location
    };
}
function toReferenceLookupOccurrence(occurrence, kind) {
    return {
        name: occurrence.text,
        normalizedName: occurrence.normalizedText,
        kind: kind ??
            (occurrence.kind === 'hex-literal' ? 'c64-io-address' : '6502-mnemonic'),
        origin: 'reference',
        location: occurrence.location
    };
}
function toReferenceOccurrence(definition) {
    const occurrence = {
        name: definition.name,
        normalizedName: definition.normalizedName,
        kind: definition.kind,
        origin: 'reference',
        location: definition.location
    };
    if (definition.detail) {
        occurrence.detail = definition.detail;
    }
    if (definition.description) {
        occurrence.description = definition.description;
    }
    return occurrence;
}
function pushOccurrence(index, name, occurrence) {
    const entries = index.get(name) ?? [];
    entries.push(occurrence);
    index.set(name, entries);
}
function locationKey(location) {
    const { start, end } = location.range;
    return `${location.uri}:${start.line}:${start.character}:${end.line}:${end.character}`;
}
function isLookupTokenCharacter(character) {
    return Boolean(character && /[@$A-Za-z0-9_.]/u.test(character));
}
function advanceToNextLine(text, offset) {
    while (offset < text.length) {
        const current = text[offset];
        offset += 1;
        if (current === '\n') {
            break;
        }
    }
    return offset;
}
function clamp(value, min, max) {
    if (max < min) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function toProjectSymbolKind(kind) {
    return kind === 'label' || kind === 'constant' || kind === 'variable'
        ? kind
        : undefined;
}
function toReferenceSymbolKind(kind) {
    return kind === '6502-mnemonic' ||
        kind === 'c64-io-address' ||
        kind === 'c64-io-id'
        ? kind
        : undefined;
}
//# sourceMappingURL=kick-assembler-lookup-service.js.map