"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanKickAssemblerDocument = scanKickAssemblerDocument;
const source_location_ts_1 = require("../location/source-location.ts");
const LABEL_PATTERN = /^\s*(@?[A-Za-z_][A-Za-z0-9_.]*):/u;
const DIRECTIVE_SYMBOL_PATTERNS = [
    {
        kind: 'constant',
        detail: '.const',
        pattern: /^\s*\.const\s+(@?[A-Za-z_][A-Za-z0-9_.]*)\b/u
    },
    {
        kind: 'variable',
        detail: '.var',
        pattern: /^\s*\.var\s+(@?[A-Za-z_][A-Za-z0-9_.]*)\b/u
    },
    {
        kind: 'label',
        detail: '.label',
        pattern: /^\s*\.label\s+(@?[A-Za-z_][A-Za-z0-9_.]*)\b/u
    }
];
const INCLUDE_PATTERN = /^\s*#(import|importif)\b(.*)$/u;
const DATA_DIRECTIVE_PATTERN = /\.(byte|word|dword)\b(.*)$/u;
function scanKickAssemblerDocument(document) {
    const includes = [];
    const symbols = [];
    const diagnostics = [];
    let pendingLabel;
    let activeDataBlock;
    const finalizeDataBlock = () => {
        if (!activeDataBlock) {
            return;
        }
        const metadata = {
            valueType: activeDataBlock.valueType,
            byteLength: activeDataBlock.byteLength,
            valueCountsPerLine: [...activeDataBlock.valueCountsPerLine],
            presentation: activeDataBlock.presentation
        };
        activeDataBlock.symbol.data = metadata;
        activeDataBlock = undefined;
    };
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
        const rawLine = document.lineAt(lineIndex);
        const line = stripLineComment(rawLine);
        if (line.trim().length === 0) {
            finalizeDataBlock();
            pendingLabel = undefined;
            continue;
        }
        const includeDirective = parseIncludeDirective(document, rawLine, line, lineIndex);
        if (includeDirective) {
            includes.push(includeDirective);
        }
        const directiveSymbol = parseDirectiveSymbol(document, rawLine, line, lineIndex);
        if (directiveSymbol) {
            finalizeDataBlock();
            pendingLabel = undefined;
            symbols.push(directiveSymbol);
            continue;
        }
        const labelSymbol = parseLabelSymbol(document, rawLine, line, lineIndex);
        if (labelSymbol) {
            if (activeDataBlock &&
                activeDataBlock.symbol.name !== labelSymbol.name) {
                finalizeDataBlock();
            }
            symbols.push(labelSymbol);
            pendingLabel = labelSymbol;
        }
        const dataDirective = parseDataDirective(line);
        if (dataDirective) {
            if (!pendingLabel && !activeDataBlock) {
                diagnostics.push({
                    code: 'orphan-data-declaration',
                    message: 'Data declaration found without a preceding label. It is not indexed in this pass.',
                    severity: 'info',
                    location: (0, source_location_ts_1.createLocation)(document.uri, lineIndex, 0, lineIndex, rawLine.length)
                });
                continue;
            }
            const targetSymbol = activeDataBlock?.symbol ?? pendingLabel;
            if (!targetSymbol) {
                continue;
            }
            if (!activeDataBlock) {
                activeDataBlock = {
                    symbol: targetSymbol,
                    valueType: dataDirective.valueType,
                    presentation: dataDirective.presentation,
                    byteLength: 0,
                    valueCountsPerLine: []
                };
            }
            else if (activeDataBlock.valueType !== dataDirective.valueType) {
                diagnostics.push({
                    code: 'mixed-data-directives',
                    message: 'Mixed .byte/.word/.dword sequences on one label are not modelled precisely yet.',
                    severity: 'info',
                    location: (0, source_location_ts_1.createLocation)(document.uri, lineIndex, 0, lineIndex, rawLine.length)
                });
            }
            activeDataBlock.byteLength += dataDirective.byteLength;
            activeDataBlock.valueCountsPerLine.push(dataDirective.valueCount);
            if (activeDataBlock.presentation === 'decimal') {
                activeDataBlock.presentation = dataDirective.presentation;
            }
            continue;
        }
        finalizeDataBlock();
        if (!labelSymbol) {
            pendingLabel = undefined;
        }
    }
    finalizeDataBlock();
    return {
        document,
        includes,
        symbols,
        diagnostics
    };
}
function parseLabelSymbol(document, rawLine, line, lineIndex) {
    const match = LABEL_PATTERN.exec(line);
    if (!match) {
        return undefined;
    }
    const name = match[1];
    if (!name) {
        return undefined;
    }
    const startCharacter = rawLine.indexOf(name);
    const safeStartCharacter = startCharacter >= 0 ? startCharacter : 0;
    return {
        name,
        kind: 'label',
        sourceUri: document.uri,
        location: (0, source_location_ts_1.createLocation)(document.uri, lineIndex, safeStartCharacter, lineIndex, safeStartCharacter + name.length)
    };
}
function parseDirectiveSymbol(document, rawLine, line, lineIndex) {
    for (const candidate of DIRECTIVE_SYMBOL_PATTERNS) {
        const match = candidate.pattern.exec(line);
        if (!match) {
            continue;
        }
        const name = match[1];
        if (!name) {
            continue;
        }
        const startCharacter = rawLine.indexOf(name);
        const safeStartCharacter = startCharacter >= 0 ? startCharacter : 0;
        return {
            name,
            kind: candidate.kind,
            sourceUri: document.uri,
            detail: candidate.detail,
            location: (0, source_location_ts_1.createLocation)(document.uri, lineIndex, safeStartCharacter, lineIndex, safeStartCharacter + name.length)
        };
    }
    return undefined;
}
function parseIncludeDirective(document, rawLine, line, lineIndex) {
    const includeMatch = INCLUDE_PATTERN.exec(line);
    if (!includeMatch) {
        return undefined;
    }
    const kind = includeMatch[1];
    if (kind !== 'import' && kind !== 'importif') {
        return undefined;
    }
    const remainder = includeMatch[2] ?? '';
    const quotedSpecifier = /"([^"]+)"/u.exec(remainder);
    if (!quotedSpecifier) {
        return undefined;
    }
    const specifier = quotedSpecifier[1];
    if (!specifier) {
        return undefined;
    }
    const startCharacter = rawLine.indexOf(specifier);
    const safeStartCharacter = startCharacter >= 0 ? startCharacter : 0;
    return {
        kind,
        specifier,
        raw: rawLine,
        location: (0, source_location_ts_1.createLocation)(document.uri, lineIndex, safeStartCharacter, lineIndex, safeStartCharacter + specifier.length)
    };
}
function parseDataDirective(line) {
    const match = DATA_DIRECTIVE_PATTERN.exec(line);
    if (!match) {
        return undefined;
    }
    const valueType = match[1];
    if (!isValueType(valueType)) {
        return undefined;
    }
    const valueText = match[2]?.trim() ?? '';
    const values = splitArguments(valueText);
    if (values.length === 0) {
        return undefined;
    }
    const firstValue = values[0];
    if (!firstValue) {
        return undefined;
    }
    return {
        valueType,
        valueCount: values.length,
        byteLength: values.length * byteWidth(valueType),
        presentation: presentationForValue(firstValue)
    };
}
function isValueType(value) {
    return value === 'byte' || value === 'word' || value === 'dword';
}
function stripLineComment(line) {
    let quotedBy;
    for (let index = 0; index < line.length; index += 1) {
        const current = line[index];
        const next = line[index + 1];
        if ((current === '"' || current === "'") && line[index - 1] !== '\\') {
            quotedBy = quotedBy === current ? undefined : current;
            continue;
        }
        if (quotedBy) {
            continue;
        }
        if (current === ';') {
            return line.slice(0, index);
        }
        if (current === '/' && next === '/') {
            return line.slice(0, index);
        }
    }
    return line;
}
function splitArguments(argumentText) {
    const values = [];
    let current = '';
    let quotedBy;
    let nestingDepth = 0;
    for (let index = 0; index < argumentText.length; index += 1) {
        const character = argumentText[index];
        if ((character === '"' || character === "'") &&
            argumentText[index - 1] !== '\\') {
            quotedBy = quotedBy === character ? undefined : character;
            current += character;
            continue;
        }
        if (!quotedBy) {
            if (character === '(' || character === '[' || character === '{') {
                nestingDepth += 1;
            }
            else if (character === ')' || character === ']' || character === '}') {
                nestingDepth = Math.max(0, nestingDepth - 1);
            }
            else if (character === ',' && nestingDepth === 0) {
                const value = current.trim();
                if (value.length > 0) {
                    values.push(value);
                }
                current = '';
                continue;
            }
        }
        current += character;
    }
    const value = current.trim();
    if (value.length > 0) {
        values.push(value);
    }
    return values;
}
function byteWidth(valueType) {
    switch (valueType) {
        case 'byte':
            return 1;
        case 'word':
            return 2;
        case 'dword':
            return 4;
    }
}
function presentationForValue(value) {
    if (value.startsWith('$')) {
        return 'hexadecimal';
    }
    if (value.startsWith('%')) {
        return 'binary';
    }
    return 'decimal';
}
// TODO(theia-ts-migration): Replace this line scanner with a grammar-backed
// TypeScript parser once the Kick Assembler grammar has been ported cleanly.
// TODO(theia-ts-migration): Extend symbol extraction for macro-generated names,
// namespaces, and conditional-assembly-aware indexing.
//# sourceMappingURL=kick-assembler-scanner.js.map