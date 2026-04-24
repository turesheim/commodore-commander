import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { DocumentPosition, SourceLocation } from '../location/source-location.ts';
import { type ReferenceDocumentKind, type ReferenceSymbolKind } from '../reference/reference-symbol-catalog.ts';
import type { KickAssemblerSymbolKind } from '../symbols/symbol-types.ts';
export type KickAssemblerLookupDocumentKind = 'kickassembler' | ReferenceDocumentKind;
export type KickAssemblerLookupOrigin = 'project' | 'reference';
export type KickAssemblerLookupTokenKind = 'identifier' | 'hex-literal';
export type KickAssemblerLookupKind = KickAssemblerSymbolKind | ReferenceSymbolKind;
export interface KickAssemblerLookupDocument {
    kind: KickAssemblerLookupDocumentKind;
    document: TextDocumentModel;
}
export interface KickAssemblerLookupOccurrence {
    name: string;
    normalizedName: string;
    kind: KickAssemblerLookupKind;
    origin: KickAssemblerLookupOrigin;
    location: SourceLocation;
    detail?: string;
    description?: string;
}
export interface KickAssemblerLookupTokenMatch {
    text: string;
    normalizedText: string;
    kind: KickAssemblerLookupTokenKind;
    startOffset: number;
    endOffset: number;
}
export interface KickAssemblerLookupIndex {
    projectDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>;
    projectReferencesByName: Map<string, KickAssemblerLookupOccurrence[]>;
    referenceDeclarationsByName: Map<string, KickAssemblerLookupOccurrence[]>;
    referenceReferencesByName: Map<string, KickAssemblerLookupOccurrence[]>;
}
export interface KickAssemblerLookupResult {
    queryName: string;
    queryOrigin: KickAssemblerLookupOrigin;
    declarations: KickAssemblerLookupOccurrence[];
    references: KickAssemblerLookupOccurrence[];
}
export declare class KickAssemblerLookupService {
    buildIndex(documents: readonly KickAssemblerLookupDocument[]): KickAssemblerLookupIndex;
    lookupAtPosition(document: TextDocumentModel, position: DocumentPosition, index: KickAssemblerLookupIndex): KickAssemblerLookupResult | undefined;
}
export declare function findLookupTokenAtPosition(document: TextDocumentModel, position: DocumentPosition): KickAssemblerLookupTokenMatch | undefined;
