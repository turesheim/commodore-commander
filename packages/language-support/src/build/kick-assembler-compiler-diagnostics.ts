import {
  createRange,
  type SourceRange
} from '../location/source-location.ts';
import type { KickAssemblerDiagnosticSeverity } from '../symbols/symbol-types.ts';

export interface KickAssemblerCompilerDiagnostic {
  sourcePath: string;
  severity: KickAssemblerDiagnosticSeverity;
  message: string;
  range: SourceRange;
}

export interface KickAssemblerDiagnosticTokenRange {
  start: number;
  end: number;
}

const DIAGNOSTIC_LINE_PATTERN =
  /^\s*\((.+)\s+(\d+):(\d+)\)\s+(Error|Warning|Info):\s+(.+)$/u;
const STACK_MESSAGE_PATTERN = /^\s*(Error|Warning|Info):\s+(.+)$/u;
const STACK_LOCATION_PATTERN =
  /^\s*at line\s+(\d+),\s*column\s+(\d+)\s+in\s+(.+)$/iu;

export function parseKickAssemblerCompilerDiagnostics(
  output: string
): KickAssemblerCompilerDiagnostic[] {
  const diagnostics: KickAssemblerCompilerDiagnostic[] = [];
  const seen = new Set<string>();
  const addDiagnostic = (
    sourcePath: string | undefined,
    lineNumber: number | undefined,
    columnNumber: number | undefined,
    severity: KickAssemblerDiagnosticSeverity | undefined,
    message: string | undefined
  ): void => {
    if (
      !sourcePath ||
      !lineNumber ||
      !columnNumber ||
      !severity ||
      !message
    ) {
      return;
    }

    const range = createRange(
      lineNumber - 1,
      columnNumber - 1,
      lineNumber - 1,
      columnNumber
    );
    const key = [
      sourcePath,
      severity,
      message,
      range.start.line,
      range.start.character
    ].join('\u0000');

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    diagnostics.push({
      sourcePath,
      severity,
      message,
      range
    });
  };

  for (const line of output.split(/\r?\n/u)) {
    const match = DIAGNOSTIC_LINE_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const sourcePath = match[1]?.trim();
    const lineNumber = parsePositiveInteger(match[2]);
    const columnNumber = parsePositiveInteger(match[3]);
    const severity = toDiagnosticSeverity(match[4]);
    const message = match[5]?.trim();

    addDiagnostic(sourcePath, lineNumber, columnNumber, severity, message);
  }

  if (diagnostics.length > 0) {
    return diagnostics;
  }

  let pendingMessage:
    | {
        severity: KickAssemblerDiagnosticSeverity;
        message: string;
      }
    | undefined;

  for (const line of output.split(/\r?\n/u)) {
    const messageMatch = STACK_MESSAGE_PATTERN.exec(line);
    if (messageMatch) {
      const severity = toDiagnosticSeverity(messageMatch[1]);
      const message = messageMatch[2]?.trim();
      pendingMessage = severity && message ? { severity, message } : undefined;
      continue;
    }

    const locationMatch = STACK_LOCATION_PATTERN.exec(line);
    if (!locationMatch || !pendingMessage) {
      continue;
    }

    addDiagnostic(
      locationMatch[3]?.trim(),
      parsePositiveInteger(locationMatch[1]),
      parsePositiveInteger(locationMatch[2]),
      pendingMessage.severity,
      pendingMessage.message
    );
    pendingMessage = undefined;
  }

  return diagnostics;
}

export function expandKickAssemblerDiagnosticRange(
  lineText: string,
  range: SourceRange
): SourceRange {
  if (range.start.line !== range.end.line) {
    return range;
  }

  const tokenRange = findDiagnosticTokenRange(lineText, range.start.character);
  if (!tokenRange) {
    return range;
  }

  return createRange(
    range.start.line,
    tokenRange.start,
    range.end.line,
    tokenRange.end
  );
}

export function findDiagnosticTokenRange(
  lineText: string,
  character: number
): KickAssemblerDiagnosticTokenRange | undefined {
  const safeCharacter = clamp(character, 0, lineText.length);
  const quotedRange = findQuotedTokenRange(lineText, safeCharacter);
  if (quotedRange) {
    return quotedRange;
  }

  const tokenCharacter = findTokenCharacter(lineText, safeCharacter);
  if (tokenCharacter === undefined) {
    return undefined;
  }

  let start = tokenCharacter;
  while (start > 0 && isTokenCharacter(lineText[start - 1] ?? '')) {
    start -= 1;
  }

  let end = tokenCharacter + 1;
  while (end < lineText.length && isTokenCharacter(lineText[end] ?? '')) {
    end += 1;
  }

  return end > start ? { start, end } : undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toDiagnosticSeverity(
  value: string | undefined
): KickAssemblerDiagnosticSeverity | undefined {
  switch (value?.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return undefined;
  }
}

function findQuotedTokenRange(
  lineText: string,
  character: number
): KickAssemblerDiagnosticTokenRange | undefined {
  let quoteStart: number | undefined;
  let quoteCharacter: string | undefined;

  for (let index = 0; index < lineText.length; index += 1) {
    const current = lineText[index];

    if (!quoteCharacter) {
      if (current === '"' || current === "'") {
        quoteStart = index;
        quoteCharacter = current;
      }
      continue;
    }

    if (current !== quoteCharacter || isEscaped(lineText, index)) {
      continue;
    }

    const start = quoteStart ?? index;
    const end = index + 1;
    if (character >= start && character <= end) {
      return { start, end };
    }

    quoteStart = undefined;
    quoteCharacter = undefined;
  }

  if (
    quoteStart !== undefined &&
    character >= quoteStart &&
    character <= lineText.length
  ) {
    return { start: quoteStart, end: lineText.length };
  }

  return undefined;
}

function findTokenCharacter(
  lineText: string,
  character: number
): number | undefined {
  if (isTokenCharacter(lineText[character] ?? '')) {
    return character;
  }

  if (character > 0 && isTokenCharacter(lineText[character - 1] ?? '')) {
    return character - 1;
  }

  for (let index = character; index < lineText.length; index += 1) {
    const current = lineText[index] ?? '';
    if (!/\s/u.test(current)) {
      return isTokenCharacter(current) ? index : undefined;
    }
  }

  return undefined;
}

function isTokenCharacter(value: string): boolean {
  return /[A-Za-z0-9_$%#.:!?@+-]/u.test(value);
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
