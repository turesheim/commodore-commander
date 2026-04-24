import type { TextDocumentModel } from '../document/text-document-model.ts';

export type KickAssemblerFoldingRangeKind = 'region' | 'comment' | 'imports';

export interface KickAssemblerFoldingRange {
  startLine: number;
  endLine: number;
  kind: KickAssemblerFoldingRangeKind;
}

interface BraceFrame {
  line: number;
}

export function buildKickAssemblerFoldingRanges(
  document: TextDocumentModel
): KickAssemblerFoldingRange[] {
  return [
    ...braceFoldingRanges(document),
    ...commentFoldingRanges(document),
    ...importFoldingRanges(document)
  ].sort((left, right) => (
    left.startLine === right.startLine
      ? left.endLine - right.endLine
      : left.startLine - right.startLine
  ));
}

function braceFoldingRanges(document: TextDocumentModel): KickAssemblerFoldingRange[] {
  const ranges: KickAssemblerFoldingRange[] = [];
  const stack: BraceFrame[] = [];
  let inBlockComment = false;
  let quote: '"' | "'" | undefined;

  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
    const line = document.lineAt(lineIndex);
    for (let column = 0; column < line.length; column += 1) {
      const current = line[column];
      const next = line[column + 1];

      if (inBlockComment) {
        if (current === '*' && next === '/') {
          inBlockComment = false;
          column += 1;
        }
        continue;
      }

      if (quote) {
        if (current === '\\') {
          column += 1;
          continue;
        }
        if (current === quote) {
          quote = undefined;
        }
        continue;
      }

      if (current === '/' && next === '*') {
        inBlockComment = true;
        column += 1;
        continue;
      }

      if ((current === '/' && next === '/') || current === ';') {
        break;
      }

      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }

      if (current === '{') {
        stack.push({ line: lineIndex });
        continue;
      }

      if (current === '}') {
        const open = stack.pop();
        if (open && lineIndex > open.line) {
          ranges.push({
            startLine: open.line,
            endLine: lineIndex,
            kind: 'region'
          });
        }
      }
    }
  }

  return ranges;
}

function commentFoldingRanges(document: TextDocumentModel): KickAssemblerFoldingRange[] {
  const ranges: KickAssemblerFoldingRange[] = [];
  let blockStartLine: number | undefined;

  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
    const line = document.lineAt(lineIndex);
    let column = 0;
    while (column < line.length) {
      const current = line[column];
      const next = line[column + 1];
      if (blockStartLine === undefined && current === '/' && next === '*') {
        blockStartLine = lineIndex;
        column += 2;
        continue;
      }
      if (blockStartLine !== undefined && current === '*' && next === '/') {
        if (lineIndex > blockStartLine) {
          ranges.push({
            startLine: blockStartLine,
            endLine: lineIndex,
            kind: 'comment'
          });
        }
        blockStartLine = undefined;
        column += 2;
        continue;
      }
      column += 1;
    }
  }

  if (blockStartLine !== undefined && document.lineCount - 1 > blockStartLine) {
    ranges.push({
      startLine: blockStartLine,
      endLine: document.lineCount - 1,
      kind: 'comment'
    });
  }

  return ranges;
}

function importFoldingRanges(document: TextDocumentModel): KickAssemblerFoldingRange[] {
  const ranges: KickAssemblerFoldingRange[] = [];
  let startLine: number | undefined;
  let previousImportLine: number | undefined;

  for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex += 1) {
    const isImport = /^\s*#(?:import|importif|importonce)\b/u
      .test(document.lineAt(lineIndex));
    if (isImport) {
      if (startLine === undefined) {
        startLine = lineIndex;
      }
      previousImportLine = lineIndex;
      continue;
    }

    if (
      startLine !== undefined &&
      previousImportLine !== undefined &&
      previousImportLine > startLine
    ) {
      ranges.push({
        startLine,
        endLine: previousImportLine,
        kind: 'imports'
      });
    }
    startLine = undefined;
    previousImportLine = undefined;
  }

  if (
    startLine !== undefined &&
    previousImportLine !== undefined &&
    previousImportLine > startLine
  ) {
    ranges.push({
      startLine,
      endLine: previousImportLine,
      kind: 'imports'
    });
  }

  return ranges;
}
