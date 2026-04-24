"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReferenceSymbolDefinitions = parseReferenceSymbolDefinitions;
const ATTRIBUTE_PATTERN = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/gu;
const GROUP_PATTERN = /<group\b[^>]*>[\s\S]*?<\/group>/gu;
const DESCRIPTION_PATTERN = /<description\b[^>]*>([\s\S]*?)<\/description>/u;
const MNEMONIC_PATTERN = /<mnemonic\b[^>]*?(?:\/>|>[\s\S]*?<\/mnemonic>)/gu;
const ENTRY_PATTERN = /<entry\b[^>]*?(?:\/>|>[\s\S]*?<\/entry>)/gu;
function parseReferenceSymbolDefinitions(kind, document) {
    switch (kind) {
        case '6502-reference':
            return parseMnemonicDefinitions(document);
        case 'c64io-reference':
            return parseC64IoDefinitions(document);
        default: {
            const exhaustive = kind;
            throw new Error(`Unsupported reference document kind: ${exhaustive}`);
        }
    }
}
function parseMnemonicDefinitions(document) {
    const groups = collectMnemonicGroups(document.text);
    const definitions = [];
    for (const match of document.text.matchAll(MNEMONIC_PATTERN)) {
        const rawElement = match[0];
        const startOffset = match.index ?? 0;
        const attributes = collectAttributeMatches(rawElement, startOffset);
        const id = findAttribute(attributes, 'id');
        if (!id || id.value.length === 0) {
            continue;
        }
        const name = findAttribute(attributes, 'name')?.value;
        const flags = findAttribute(attributes, 'flags')?.value;
        const group = groups.find(({ startOffset: start, endOffset: end }) => (startOffset >= start && startOffset < end));
        const description = group?.description ?? extractElementBody(rawElement, 'mnemonic');
        const detailParts = [name];
        if (flags) {
            detailParts.push(`flags=${flags}`);
        }
        const definition = {
            name: id.value,
            normalizedName: normalizeReferenceKey(id.value),
            kind: '6502-mnemonic',
            location: createLocation(document, id.startOffset, id.endOffset)
        };
        const detail = joinDetail(detailParts);
        const clean = cleanDescription(description);
        if (detail) {
            definition.detail = detail;
        }
        if (clean) {
            definition.description = clean;
        }
        definitions.push(definition);
    }
    return definitions;
}
function parseC64IoDefinitions(document) {
    const definitions = [];
    for (const match of document.text.matchAll(ENTRY_PATTERN)) {
        const rawElement = match[0];
        const startOffset = match.index ?? 0;
        const attributes = collectAttributeMatches(rawElement, startOffset);
        const address = findAttribute(attributes, 'address');
        if (!address || address.value.length === 0) {
            continue;
        }
        const id = findAttribute(attributes, 'id');
        const name = findAttribute(attributes, 'name')?.value;
        const description = cleanDescription(extractElementBody(rawElement, 'entry'));
        const addressDefinition = {
            name: address.value,
            normalizedName: normalizeReferenceKey(address.value),
            kind: 'c64-io-address',
            location: createLocation(document, address.startOffset, address.endOffset)
        };
        const addressDetail = joinDetail([id?.value, name]);
        if (addressDetail) {
            addressDefinition.detail = addressDetail;
        }
        if (description) {
            addressDefinition.description = description;
        }
        definitions.push(addressDefinition);
        if (!id || id.value.length === 0) {
            continue;
        }
        const idDefinition = {
            name: id.value,
            normalizedName: normalizeReferenceKey(id.value),
            kind: 'c64-io-id',
            location: createLocation(document, id.startOffset, id.endOffset)
        };
        const idDetail = joinDetail([address.value, name]);
        if (idDetail) {
            idDefinition.detail = idDetail;
        }
        if (description) {
            idDefinition.description = description;
        }
        definitions.push(idDefinition);
    }
    return definitions;
}
function collectMnemonicGroups(text) {
    const groups = [];
    for (const match of text.matchAll(GROUP_PATTERN)) {
        const rawElement = match[0];
        const startOffset = match.index ?? 0;
        const descriptionMatch = DESCRIPTION_PATTERN.exec(rawElement);
        const group = {
            startOffset,
            endOffset: startOffset + rawElement.length
        };
        const description = cleanDescription(descriptionMatch?.[1]);
        if (description) {
            group.description = description;
        }
        groups.push(group);
    }
    return groups;
}
function collectAttributeMatches(rawElement, elementStartOffset) {
    const attributes = [];
    for (const match of rawElement.matchAll(ATTRIBUTE_PATTERN)) {
        const rawAttribute = match[0];
        const matchIndex = match.index ?? 0;
        const value = match[2];
        if (value === undefined) {
            continue;
        }
        const quoteOffset = rawAttribute.indexOf('"');
        if (quoteOffset < 0) {
            continue;
        }
        const startOffset = elementStartOffset + matchIndex + quoteOffset + 1;
        attributes.push({
            name: match[1] ?? '',
            value,
            startOffset,
            endOffset: startOffset + value.length
        });
    }
    return attributes;
}
function findAttribute(attributes, name) {
    return attributes.find((attribute) => attribute.name === name);
}
function extractElementBody(rawElement, elementName) {
    if (rawElement.endsWith('/>')) {
        return undefined;
    }
    const openingEnd = rawElement.indexOf('>');
    const closingStart = rawElement.lastIndexOf(`</${elementName}>`);
    if (openingEnd < 0 || closingStart <= openingEnd) {
        return undefined;
    }
    return rawElement.slice(openingEnd + 1, closingStart);
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
function cleanDescription(description) {
    const trimmed = description?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
function joinDetail(parts) {
    const filtered = parts.filter((part) => Boolean(part && part.trim()));
    return filtered.length > 0 ? filtered.join(' - ') : undefined;
}
function normalizeReferenceKey(name) {
    return name.toUpperCase();
}
//# sourceMappingURL=reference-symbol-catalog.js.map