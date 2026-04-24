import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceRange } from '../location/source-location.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';
import type { KickAssemblerDiagnostic } from '../symbols/symbol-types.ts';
import type { KickAssemblerIncludePathCandidate } from './kick-assembler-completion.ts';
import type { KickAssemblerTextEdit } from './kick-assembler-rename.ts';

export interface KickAssemblerQuickFixOptions {
  diagnostics?: readonly KickAssemblerDiagnostic[];
  includePathCandidates?: readonly KickAssemblerIncludePathCandidate[];
}

export interface KickAssemblerQuickFix {
  title: string;
  kind: 'quickfix';
  diagnostics: KickAssemblerDiagnostic[];
  edits: KickAssemblerTextEdit[];
  isPreferred?: boolean;
}

export function provideKickAssemblerQuickFixes(
  document: TextDocumentModel,
  range: SourceRange,
  options: KickAssemblerQuickFixOptions = {}
): KickAssemblerQuickFix[] {
  const diagnostics = options.diagnostics ?? parseKickAssemblerSemanticModel(document)
    .diagnostics
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      ...(diagnostic.location ? { location: diagnostic.location } : {})
    }));
  const fixes: KickAssemblerQuickFix[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.location && !rangesIntersect(diagnostic.location.range, range)) {
      continue;
    }

    if (diagnostic.code === 'import-missing-specifier' && diagnostic.location) {
      const fix = quoteImportSpecifierFix(document, diagnostic);
      if (fix) {
        fixes.push(fix);
      }
    }

    if (diagnostic.code === 'include-not-found' && diagnostic.location) {
      fixes.push(
        ...replaceMissingIncludeFixes(
          document,
          diagnostic,
          options.includePathCandidates ?? []
        )
      );
    }
  }

  const includeDirectiveFix = convertDotIncludeFix(document, range);
  if (includeDirectiveFix) {
    fixes.push(includeDirectiveFix);
  }

  return deduplicateFixes(fixes);
}

function quoteImportSpecifierFix(
  document: TextDocumentModel,
  diagnostic: KickAssemblerDiagnostic
): KickAssemblerQuickFix | undefined {
  const lineNumber = diagnostic.location?.range.start.line;
  if (lineNumber === undefined) {
    return undefined;
  }

  const line = document.lineAt(lineNumber);
  const match = /^(\s*#(?:import|importif)\b.*?\s)([^\s"]+)\s*$/u.exec(line);
  const specifier = match?.[2];
  if (!specifier) {
    return undefined;
  }

  const start = line.lastIndexOf(specifier);
  return {
    title: `Quote include path "${specifier}"`,
    kind: 'quickfix',
    diagnostics: [diagnostic],
    edits: [{
      range: {
        start: { line: lineNumber, character: start },
        end: { line: lineNumber, character: start + specifier.length }
      },
      newText: `"${specifier}"`
    }],
    isPreferred: true
  };
}

function replaceMissingIncludeFixes(
  document: TextDocumentModel,
  diagnostic: KickAssemblerDiagnostic,
  candidates: readonly KickAssemblerIncludePathCandidate[]
): KickAssemblerQuickFix[] {
  const lineNumber = diagnostic.location?.range.start.line;
  if (lineNumber === undefined) {
    return [];
  }

  const line = document.lineAt(lineNumber);
  const specifier = quotedSpecifier(line);
  if (!specifier) {
    return [];
  }

  const basename = pathBasename(specifier.value).toLowerCase();
  const replacementRange = {
    start: { line: lineNumber, character: specifier.start },
    end: { line: lineNumber, character: specifier.end }
  };

  return candidates
    .filter((candidate) => !candidate.isDirectory)
    .filter((candidate) => pathBasename(candidate.path).toLowerCase() === basename)
    .slice(0, 5)
    .map((candidate) => ({
      title: `Use include path "${candidate.path}"`,
      kind: 'quickfix' as const,
      diagnostics: [diagnostic],
      edits: [{
        range: replacementRange,
        newText: candidate.path
      }]
    }));
}

function convertDotIncludeFix(
  document: TextDocumentModel,
  range: SourceRange
): KickAssemblerQuickFix | undefined {
  for (let lineNumber = range.start.line; lineNumber <= range.end.line; lineNumber += 1) {
    const line = document.lineAt(lineNumber);
    const match = /^(\s*)\.include\b/u.exec(line);
    if (!match) {
      continue;
    }

    const start = match[1]?.length ?? 0;
    return {
      title: 'Convert .include to #import',
      kind: 'quickfix',
      diagnostics: [],
      edits: [{
        range: {
          start: { line: lineNumber, character: start },
          end: { line: lineNumber, character: start + '.include'.length }
        },
        newText: '#import'
      }],
      isPreferred: true
    };
  }
  return undefined;
}

function quotedSpecifier(
  line: string
): { value: string; start: number; end: number } | undefined {
  const match = /"([^"]+)"/u.exec(line);
  const value = match?.[1];
  if (!value || match.index === undefined) {
    return undefined;
  }
  const start = match.index + 1;
  return {
    value,
    start,
    end: start + value.length
  };
}

function rangesIntersect(left: SourceRange, right: SourceRange): boolean {
  return comparePositions(left.start, right.end) <= 0 &&
    comparePositions(right.start, left.end) <= 0;
}

function comparePositions(
  left: SourceRange['start'],
  right: SourceRange['start']
): number {
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.character - right.character;
}

function pathBasename(path: string): string {
  const normalized = path.replace(/\\/gu, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function deduplicateFixes(
  fixes: readonly KickAssemblerQuickFix[]
): KickAssemblerQuickFix[] {
  const unique = new Map<string, KickAssemblerQuickFix>();
  for (const fix of fixes) {
    const key = `${fix.title}:${fix.edits.map((edit) => (
      `${edit.range.start.line}:${edit.range.start.character}:${edit.range.end.line}:${edit.range.end.character}:${edit.newText}`
    )).join('|')}`;
    unique.set(key, fix);
  }
  return [...unique.values()];
}
