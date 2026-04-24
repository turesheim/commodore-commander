import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { DocumentPosition, SourceRange } from '../location/source-location.ts';
import type {
  KickAssemblerLookupIndex,
  KickAssemblerLookupOccurrence
} from '../lookup/kick-assembler-lookup-service.ts';
import {
  type KickAssemblerAddressingModeInfo,
  extractAddressingModes,
  KICK_ASSEMBLER_DIRECTIVES,
  MOS_6502_MNEMONICS
} from './kick-assembler-language-facts.ts';

export type KickAssemblerCompletionKind =
  | 'symbol'
  | 'directive'
  | 'include-path'
  | 'mnemonic'
  | 'addressing-mode';

export interface KickAssemblerIncludePathCandidate {
  path: string;
  isDirectory?: boolean;
  detail?: string;
}

export interface KickAssemblerCompletionOptions {
  index?: KickAssemblerLookupIndex;
  includePathCandidates?: readonly KickAssemblerIncludePathCandidate[];
}

export interface KickAssemblerCompletionItem {
  label: string;
  kind: KickAssemblerCompletionKind;
  insertText: string;
  range: SourceRange;
  detail?: string;
  documentation?: string;
  sortText?: string;
}

interface CompletionContext {
  line: string;
  beforeCursor: string;
  replacementPrefix: string;
  replacementRange: SourceRange;
}

export function provideKickAssemblerCompletions(
  document: TextDocumentModel,
  position: DocumentPosition,
  options: KickAssemblerCompletionOptions = {}
): KickAssemblerCompletionItem[] {
  const context = completionContext(document, position);
  const includePrefix = includePathPrefix(position.line, context.beforeCursor);

  if (includePrefix) {
    return includePathCompletions(
      includePrefix.prefix,
      includePrefix.range,
      options.includePathCandidates ?? []
    );
  }

  const directivePrefix = directiveCompletionPrefix(position.line, context.beforeCursor);
  if (directivePrefix) {
    return directiveCompletions(directivePrefix.prefix, directivePrefix.range);
  }

  const mnemonicContext = mnemonicCompletionContext(context.beforeCursor);
  if (mnemonicContext.kind === 'addressing-mode') {
    return [
      ...addressingModeCompletions(
        mnemonicContext.mnemonic,
        context.replacementPrefix,
        context.replacementRange,
        options.index
      ),
      ...symbolCompletions(context.replacementPrefix, context.replacementRange, options.index)
    ];
  }

  if (isStatementStartCompletion(context.beforeCursor)) {
    return [
      ...mnemonicCompletions(
        mnemonicContext.kind === 'mnemonic' ? mnemonicContext.prefix : context.replacementPrefix,
        context.replacementRange,
        options.index
      ),
      ...symbolCompletions(
        context.replacementPrefix,
        context.replacementRange,
        options.index,
        isCallableStatementSymbol
      )
    ];
  }

  return [
    ...mnemonicCompletions(
      mnemonicContext.kind === 'mnemonic' ? mnemonicContext.prefix : context.replacementPrefix,
      context.replacementRange,
      options.index
    ),
    ...symbolCompletions(context.replacementPrefix, context.replacementRange, options.index)
  ];
}

function completionContext(
  document: TextDocumentModel,
  position: DocumentPosition
): CompletionContext {
  const line = document.lineAt(position.line);
  const character = Math.min(position.character, line.length);
  const beforeCursor = line.slice(0, character);
  const prefix = currentCompletionPrefix(beforeCursor);

  return {
    line,
    beforeCursor,
    replacementPrefix: prefix,
    replacementRange: {
      start: {
        line: position.line,
        character: character - prefix.length
      },
      end: {
        line: position.line,
        character
      }
    }
  };
}

function includePathPrefix(
  line: number,
  beforeCursor: string
): { prefix: string; range: SourceRange } | undefined {
  if (!/#(?:import|importif)\b/u.test(beforeCursor)) {
    return undefined;
  }

  const quoteOffset = beforeCursor.lastIndexOf('"');
  if (quoteOffset >= 0) {
    const quoteCount = [...beforeCursor.slice(0, quoteOffset + 1)]
      .filter((character) => character === '"')
      .length;
    if (quoteCount % 2 === 1) {
      const prefix = beforeCursor.slice(quoteOffset + 1);
      return {
        prefix,
        range: singleLineRange(line, quoteOffset + 1, beforeCursor.length)
      };
    }
  }

  const bareMatch = /#(?:import|importif)\b.*\s([^\s"]*)$/u.exec(beforeCursor);
  const prefix = bareMatch?.[1];
  if (prefix === undefined) {
    return undefined;
  }

  const start = beforeCursor.length - prefix.length;
  return {
    prefix,
    range: singleLineRange(line, start, beforeCursor.length)
  };
}

function directiveCompletionPrefix(
  line: number,
  beforeCursor: string
): { prefix: string; range: SourceRange } | undefined {
  const match = /(^|\s)([.#][A-Za-z]*)$/u.exec(beforeCursor);
  const prefix = match?.[2];
  if (!prefix) {
    return undefined;
  }

  const start = beforeCursor.length - prefix.length;
  return {
    prefix,
    range: singleLineRange(line, start, beforeCursor.length)
  };
}

function mnemonicCompletionContext(
  beforeCursor: string
):
  | { kind: 'mnemonic'; prefix: string }
  | { kind: 'addressing-mode'; mnemonic: string }
  | { kind: 'none' } {
  const code = removeLeadingLabel(beforeCursor);
  const trimmed = code.trimStart();

  if (trimmed.length === 0 || trimmed.startsWith('.') || trimmed.startsWith('#')) {
    return { kind: 'none' };
  }

  const firstToken = /^([A-Za-z]{1,3})(\s*)/u.exec(trimmed);
  const mnemonic = firstToken?.[1];
  if (!mnemonic) {
    return { kind: 'none' };
  }

  if (firstToken[2] && firstToken[2].length > 0) {
    return { kind: 'addressing-mode', mnemonic };
  }

  return { kind: 'mnemonic', prefix: mnemonic };
}

function directiveCompletions(
  prefix: string,
  range: SourceRange
): KickAssemblerCompletionItem[] {
  const wantedPrefix = prefix[0] === '#' ? '#' : '.';
  return KICK_ASSEMBLER_DIRECTIVES
    .filter((entry) => entry.prefix === wantedPrefix)
    .filter((entry) => matchesPrefix(entry.insertText, prefix))
    .map((entry, index) => ({
      label: entry.insertText,
      kind: 'directive' as const,
      insertText: entry.insertText,
      range,
      detail: entry.detail,
      documentation: entry.description,
      sortText: `0${index.toString().padStart(3, '0')}`
    }));
}

function includePathCompletions(
  prefix: string,
  range: SourceRange,
  candidates: readonly KickAssemblerIncludePathCandidate[]
): KickAssemblerCompletionItem[] {
  return candidates
    .filter((candidate) => matchesPrefix(candidate.path, prefix))
    .map((candidate, index) => {
      const item: KickAssemblerCompletionItem = {
        label: candidate.path,
        kind: 'include-path',
        insertText: candidate.isDirectory ? `${candidate.path}/` : candidate.path,
        range,
        sortText: `${candidate.isDirectory ? '0' : '1'}${index.toString().padStart(4, '0')}`
      };
      if (candidate.detail) {
        item.detail = candidate.detail;
      }
      return item;
    });
}

function mnemonicCompletions(
  prefix: string,
  range: SourceRange,
  index: KickAssemblerLookupIndex | undefined
): KickAssemblerCompletionItem[] {
  const definitions = mnemonicDefinitions(index);

  return definitions
    .filter((entry) => matchesPrefix(entry.name, prefix))
    .map((entry, itemIndex) => {
      const item: KickAssemblerCompletionItem = {
        label: entry.name.toLowerCase(),
        kind: 'mnemonic',
        insertText: entry.name.toLowerCase(),
        range,
        detail: mnemonicDetail(entry),
        documentation: mnemonicDocumentation(entry),
        sortText: `1${itemIndex.toString().padStart(4, '0')}`
      };
      return item;
    });
}

function addressingModeCompletions(
  mnemonic: string,
  prefix: string,
  range: SourceRange,
  index: KickAssemblerLookupIndex | undefined
): KickAssemblerCompletionItem[] {
  const definition = mnemonicDefinitions(index)
    .find((entry) => entry.name.toUpperCase() === mnemonic.toUpperCase());

  return extractAddressingModes(mnemonic, definition?.description)
    .filter((entry) => matchesPrefix(entry.operand, prefix))
    .map((entry, itemIndex) => {
      const item: KickAssemblerCompletionItem = {
        label: `${mnemonic.toLowerCase()} ${entry.operand}`.trim(),
        kind: 'addressing-mode',
        insertText: entry.operand,
        range,
        detail: addressingModeDetail(entry),
        documentation: addressingModeDocumentation(mnemonic, definition, entry),
        sortText: `0${itemIndex.toString().padStart(4, '0')}`
      };
      return item;
    });
}

function symbolCompletions(
  prefix: string,
  range: SourceRange,
  index: KickAssemblerLookupIndex | undefined,
  filter: ((entry: KickAssemblerLookupOccurrence) => boolean) | undefined = undefined
): KickAssemblerCompletionItem[] {
  if (!index) {
    return [];
  }

  const symbols = [...index.projectDeclarationsByName.values()]
    .flat()
    .concat(
      [...index.referenceDeclarationsByName.values()]
        .flat()
        .filter(isCompletableReferenceSymbol)
    )
    .filter((entry) => filter?.(entry) ?? true)
    .filter((entry) => matchesPrefix(entry.name, prefix));
  const unique = new Map<string, KickAssemblerLookupOccurrence>();
  for (const symbol of symbols) {
    unique.set(symbol.name, symbol);
  }

  return [...unique.values()].map((entry, itemIndex) => {
    const item: KickAssemblerCompletionItem = {
      label: entry.name,
      kind: 'symbol',
      insertText: entry.name,
      range,
      detail: entry.detail ?? entry.kind,
      sortText: `2${itemIndex.toString().padStart(4, '0')}`
    };
    if (entry.description) {
      item.documentation = entry.description;
    }
    return item;
  });
}

function mnemonicDefinitions(
  index: KickAssemblerLookupIndex | undefined
): KickAssemblerLookupOccurrence[] {
  if (!index) {
    return MOS_6502_MNEMONICS.map((name) => ({
      name,
      normalizedName: name,
      kind: '6502-mnemonic' as const,
      origin: 'reference' as const,
      location: {
        uri: 'memory:///6502-reference',
        range: singleLineRange(0, 0, name.length)
      }
    }));
  }

  const entries = [...index.referenceDeclarationsByName.values()]
    .flat()
    .filter((entry) => entry.kind === '6502-mnemonic');
  return entries.length > 0 ? entries : mnemonicDefinitions(undefined);
}

function mnemonicDetail(entry: KickAssemblerLookupOccurrence): string {
  return entry.detail
    ? `6502 mnemonic - ${entry.detail}`
    : '6502 mnemonic';
}

function mnemonicDocumentation(entry: KickAssemblerLookupOccurrence): string {
  const sections = [entry.detail ?? entry.name.toUpperCase()];
  const modes = extractAddressingModes(entry.name, entry.description);

  if (modes.length > 0) {
    sections.push([
      'Addressing modes:',
      ...modes.map((modeInfo) => {
        const syntax = modeInfo.syntax || entry.name.toUpperCase();
        const opcode = modeInfo.opcode ? ` (${modeInfo.opcode})` : '';
        return `- ${modeInfo.mode}: ${syntax}${opcode}`;
      })
    ].join('\n'));
  }

  const summary = firstReferenceParagraph(entry.description);
  if (summary) {
    sections.push(summary);
  }

  return sections.join('\n\n');
}

function addressingModeDetail(entry: KickAssemblerAddressingModeInfo): string {
  return entry.opcode
    ? `${entry.mode} - opcode ${entry.opcode}`
    : entry.mode;
}

function addressingModeDocumentation(
  mnemonic: string,
  definition: KickAssemblerLookupOccurrence | undefined,
  entry: KickAssemblerAddressingModeInfo
): string {
  const sections = [
    definition?.detail ?? mnemonic.toUpperCase(),
    `Mode: ${entry.mode}`
  ];

  if (entry.syntax) {
    sections.push(`Syntax: ${entry.syntax}`);
  }
  if (entry.opcode) {
    sections.push(`Opcode: ${entry.opcode}`);
  }

  const summary = firstReferenceParagraph(definition?.description);
  if (summary) {
    sections.push(summary);
  }

  return sections.join('\n\n');
}

function firstReferenceParagraph(description: string | undefined): string | undefined {
  if (!description) {
    return undefined;
  }

  const withoutReferenceTables = description
    .replace(/<!\[CDATA\[|\]\]>/gu, '')
    .replace(/<pre\b[\s\S]*?<\/pre>/giu, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/giu, '');
  const paragraphMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/iu.exec(withoutReferenceTables);
  const rawText = paragraphMatch?.[1] ?? withoutReferenceTables;
  const text = decodeHtmlEntities(rawText.replace(/<[^>]+>/gu, ' '))
    .replace(/\s+/gu, ' ')
    .trim();

  return text.length > 0 ? text : undefined;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function currentCompletionPrefix(beforeCursor: string): string {
  let start = beforeCursor.length;
  while (start > 0 && /[#.@!/$A-Za-z0-9_-]/u.test(beforeCursor[start - 1] ?? '')) {
    start -= 1;
  }
  return beforeCursor.slice(start);
}

function isStatementStartCompletion(beforeCursor: string): boolean {
  const code = removeLeadingLabel(beforeCursor);
  const prefix = currentCompletionPrefix(code);
  return code.slice(0, code.length - prefix.length).trim().length === 0;
}

function isCallableStatementSymbol(entry: KickAssemblerLookupOccurrence): boolean {
  return entry.kind === 'macro' || entry.kind === 'pseudocommand';
}

function isCompletableReferenceSymbol(
  entry: KickAssemblerLookupOccurrence
): boolean {
  return entry.kind === 'c64-io-id' ||
    entry.kind === 'machine-io-id' ||
    entry.kind === 'machine-rom-symbol';
}

function removeLeadingLabel(text: string): string {
  return text.replace(
    /^\s*(?:![A-Za-z_@][A-Za-z0-9_.@]*|!|@?[A-Za-z_][A-Za-z0-9_.]*)\s*:\s*/u,
    ''
  );
}

function matchesPrefix(value: string, prefix: string): boolean {
  if (prefix.length === 0) {
    return true;
  }
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

function singleLineRange(
  line: number,
  startCharacter: number,
  endCharacter: number
): SourceRange {
  return {
    start: {
      line,
      character: Math.max(0, startCharacter)
    },
    end: {
      line,
      character: Math.max(0, endCharacter)
    }
  };
}
