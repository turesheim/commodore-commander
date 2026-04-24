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
export declare function createPosition(line: number, character: number): DocumentPosition;
export declare function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange;
export declare function createLocation(uri: string, startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceLocation;
export declare function comparePositions(left: DocumentPosition, right: DocumentPosition): number;
export declare function containsPosition(range: SourceRange, position: DocumentPosition): boolean;
export declare function isZeroLengthRange(range: SourceRange): boolean;
