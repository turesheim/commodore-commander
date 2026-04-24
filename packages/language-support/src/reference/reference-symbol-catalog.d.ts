import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation } from '../location/source-location.ts';
export type ReferenceDocumentKind = '6502-reference' | 'c64io-reference';
export type ReferenceSymbolKind = '6502-mnemonic' | 'c64-io-address' | 'c64-io-id';
export interface ReferenceSymbolDefinition {
    name: string;
    normalizedName: string;
    kind: ReferenceSymbolKind;
    location: SourceLocation;
    detail?: string;
    description?: string;
}
export declare function parseReferenceSymbolDefinitions(kind: ReferenceDocumentKind, document: TextDocumentModel): ReferenceSymbolDefinition[];
