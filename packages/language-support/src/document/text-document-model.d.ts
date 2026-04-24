import { type DocumentPosition, type SourceRange } from '../location/source-location.ts';
export interface TextDocumentModelOptions {
    uri: string;
    text: string;
    languageId?: string;
    version?: number;
}
export declare class TextDocumentModel {
    readonly uri: string;
    readonly text: string;
    readonly languageId: string;
    readonly version: number;
    private readonly lines;
    private readonly lineOffsets;
    constructor(options: TextDocumentModelOptions);
    get lineCount(): number;
    lineAt(line: number): string;
    getText(range?: SourceRange): string;
    offsetAt(position: DocumentPosition): number;
    positionAt(offset: number): DocumentPosition;
}
export declare function createTextDocumentModel(options: TextDocumentModelOptions): TextDocumentModel;
