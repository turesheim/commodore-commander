export interface DocumentPosition {
  line: number;
  character: number;
}

export interface SourceRange {
  start: DocumentPosition;
  end: DocumentPosition;
}

export interface SourceLocation {
  uri: string;
  range: SourceRange;
}

export function createPosition(
  line: number,
  character: number
): DocumentPosition {
  return { line, character };
}

export function createRange(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): SourceRange {
  return {
    start: createPosition(startLine, startCharacter),
    end: createPosition(endLine, endCharacter)
  };
}

export function createLocation(
  uri: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number
): SourceLocation {
  return {
    uri,
    range: createRange(startLine, startCharacter, endLine, endCharacter)
  };
}

export function comparePositions(
  left: DocumentPosition,
  right: DocumentPosition
): number {
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.character - right.character;
}

export function containsPosition(
  range: SourceRange,
  position: DocumentPosition
): boolean {
  return (
    comparePositions(range.start, position) <= 0 &&
    comparePositions(position, range.end) <= 0
  );
}

export function isZeroLengthRange(range: SourceRange): boolean {
  return comparePositions(range.start, range.end) === 0;
}
