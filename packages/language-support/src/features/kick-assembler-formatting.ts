import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceRange } from '../location/source-location.ts';
import type { KickAssemblerTextEdit } from './kick-assembler-rename.ts';

export interface KickAssemblerFormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
  finalNewline?: boolean;
}

export function formatKickAssemblerDocument(
  document: TextDocumentModel,
  options: KickAssemblerFormattingOptions = {}
): KickAssemblerTextEdit[] {
  const formatted = formatKickAssemblerText(document.text, options);
  if (formatted === document.text) {
    return [];
  }

  return [{
    range: fullDocumentRange(document),
    newText: formatted
  }];
}

export function formatKickAssemblerText(
  text: string,
  options: KickAssemblerFormattingOptions = {}
): string {
  const tabSize = options.tabSize ?? 4;
  const indentUnit = options.insertSpaces === false ? '\t' : ' '.repeat(tabSize);
  const wantsFinalNewline = options.finalNewline ?? text.endsWith('\n');
  const lines = text.split(/\r?\n/u);
  const sourceHadTrailingLine = lines.length > 1 && lines[lines.length - 1] === '';
  if (sourceHadTrailingLine) {
    lines.pop();
  }

  let indent = 0;
  const output: string[] = [];

  for (const rawLine of lines) {
    const trimmedRight = rawLine.replace(/[ \t]+$/u, '');
    const trimmed = trimmedRight.trim();

    if (trimmed.length === 0) {
      output.push('');
      continue;
    }

    const leadingCloseCount = leadingClosingBraceCount(trimmed);
    indent = Math.max(0, indent - leadingCloseCount);

    output.push(`${indentUnit.repeat(indent)}${normalizeInlineSpacing(trimmed)}`);

    const delta = braceDeltaOutsideTrivia(trimmed);
    if (delta > 0) {
      indent += delta;
    } else if (delta < 0) {
      indent = Math.max(0, indent + delta + leadingCloseCount);
    }
  }

  let result = output.join('\n');
  if (wantsFinalNewline) {
    result += '\n';
  }
  return result;
}

function normalizeInlineSpacing(line: string): string {
  const labelMatch =
    /^((?:![A-Za-z_@][A-Za-z0-9_.@]*|!|@?[A-Za-z_][A-Za-z0-9_.]*)\s*:)(.*)$/u
      .exec(line);
  if (labelMatch) {
    const suffix = (labelMatch[2] ?? '').trim();
    return suffix.length > 0 ? `${labelMatch[1]} ${suffix}` : labelMatch[1] ?? line;
  }

  if (/^\.(?:const|var|label)\b/u.test(line)) {
    return line.replace(/\s*=\s*/u, ' = ');
  }

  return line.replace(/^\s+/u, '');
}

function leadingClosingBraceCount(line: string): number {
  let count = 0;
  while (line[count] === '}') {
    count += 1;
  }
  return count;
}

function braceDeltaOutsideTrivia(line: string): number {
  let delta = 0;
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    const next = line[index + 1];

    if (quote) {
      if (current === '\\') {
        index += 1;
        continue;
      }
      if (current === quote) {
        quote = undefined;
      }
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
      delta += 1;
    } else if (current === '}') {
      delta -= 1;
    }
  }

  return delta;
}

function fullDocumentRange(document: TextDocumentModel): SourceRange {
  const lastLine = document.lineCount - 1;
  return {
    start: {
      line: 0,
      character: 0
    },
    end: {
      line: lastLine,
      character: document.lineAt(lastLine).length
    }
  };
}
