import type { TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation } from '../location/source-location.ts';
export type KickAssemblerSymbolKind = 'label' | 'constant' | 'variable';
export type ValueType = 'byte' | 'word' | 'dword';
export type NumericPresentation = 'decimal' | 'hexadecimal' | 'binary';
export type IncludeDirectiveKind = 'import' | 'importif';
export type KickAssemblerDiagnosticSeverity = 'error' | 'warning' | 'info';
export interface DataSymbolMetadata {
    valueType: ValueType;
    byteLength: number;
    valueCountsPerLine: number[];
    presentation: NumericPresentation;
}
export interface KickAssemblerSymbol {
    name: string;
    kind: KickAssemblerSymbolKind;
    sourceUri: string;
    location: SourceLocation;
    detail?: string;
    data?: DataSymbolMetadata;
}
export interface IncludeDirective {
    kind: IncludeDirectiveKind;
    specifier: string;
    raw: string;
    location: SourceLocation;
}
export interface ResolvedIncludeDirective extends IncludeDirective {
    resolvedUri: string;
    resolutionStrategy: 'relative' | 'search-root';
}
export interface UnresolvedIncludeDirective extends IncludeDirective {
    candidatePaths: string[];
}
export interface KickAssemblerDiagnostic {
    code: string;
    message: string;
    severity: KickAssemblerDiagnosticSeverity;
    location?: SourceLocation;
}
export interface KickAssemblerScanResult {
    document: TextDocumentModel;
    includes: IncludeDirective[];
    symbols: KickAssemblerSymbol[];
    diagnostics: KickAssemblerDiagnostic[];
}
