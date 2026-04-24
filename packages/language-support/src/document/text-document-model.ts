import {
  createPosition,
  type DocumentPosition,
  type SourceRange
} from '../location/source-location.ts';

export interface TextDocumentModelOptions {
  uri: string;
  text: string;
  languageId?: string;
  version?: number;
}

export class TextDocumentModel {
  readonly uri: string;
  readonly text: string;
  readonly languageId: string;
  readonly version: number;

  private readonly lines: string[];
  private readonly lineOffsets: number[];

  constructor(options: TextDocumentModelOptions) {
    this.uri = options.uri;
    this.text = options.text;
    this.languageId = options.languageId ?? 'kickassembler';
    this.version = options.version ?? 1;
    this.lines = options.text.split(/\r?\n/u);
    this.lineOffsets = computeLineOffsets(options.text);
  }

  get lineCount(): number {
    return this.lines.length;
  }

  lineAt(line: number): string {
    const safeLine = clamp(line, 0, this.lines.length - 1);
    const value = this.lines[safeLine];
    if (value === undefined) {
      throw new RangeError(`Line ${line} is outside document ${this.uri}.`);
    }
    return value;
  }

  getText(range?: SourceRange): string {
    if (!range) {
      return this.text;
    }
    const start = this.offsetAt(range.start);
    const end = this.offsetAt(range.end);
    return this.text.slice(start, end);
  }

  offsetAt(position: DocumentPosition): number {
    const safeLine = clamp(position.line, 0, this.lineCount - 1);
    const lineOffset = this.lineOffsets[safeLine] ?? 0;
    const maxCharacter = this.lineAt(safeLine).length;
    const safeCharacter = clamp(position.character, 0, maxCharacter);
    return lineOffset + safeCharacter;
  }

  positionAt(offset: number): DocumentPosition {
    const safeOffset = clamp(offset, 0, this.text.length);
    let low = 0;
    let high = this.lineOffsets.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const lineOffset = this.lineOffsets[middle] ?? 0;
      const nextLineOffset = this.lineOffsets[middle + 1] ?? (this.text.length + 1);

      if (safeOffset < lineOffset) {
        high = middle - 1;
        continue;
      }
      if (safeOffset >= nextLineOffset) {
        low = middle + 1;
        continue;
      }

      const maxCharacter = this.lineAt(middle).length;
      return createPosition(
        middle,
        clamp(safeOffset - lineOffset, 0, maxCharacter)
      );
    }

    const lastLine = this.lineCount - 1;
    return createPosition(lastLine, this.lineAt(lastLine).length);
  }
}

export function createTextDocumentModel(
  options: TextDocumentModelOptions
): TextDocumentModel {
  return new TextDocumentModel(options);
}

function computeLineOffsets(text: string): number[] {
  const offsets = [0];

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];

    if (current === '\r' && text[index + 1] === '\n') {
      offsets.push(index + 2);
      index += 1;
      continue;
    }

    if (current === '\n') {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
