export { TextDocumentModel, createTextDocumentModel } from '../document/text-document-model.ts';
export { createLocation, createPosition, createRange, comparePositions, containsPosition, isZeroLengthRange } from '../location/source-location.ts';
export { KICK_ASSEMBLER_EXTENSIONS, KICK_ASSEMBLER_LANGUAGE_ID, KICK_ASSEMBLER_LANGUAGE_NAME, KICK_ASSEMBLER_LANGUAGE_SPEC, KICK_ASSEMBLER_SCOPE_NAME } from '../language/kick-assembler-language.ts';
export { KickAssemblerLookupService, findLookupTokenAtPosition } from '../lookup/kick-assembler-lookup-service.ts';
export type { DocumentPosition, SourceLocation, SourceRange } from '../location/source-location.ts';
export type { KickAssemblerLookupDocument, KickAssemblerLookupDocumentKind, KickAssemblerLookupIndex, KickAssemblerLookupKind, KickAssemblerLookupOccurrence, KickAssemblerLookupOrigin, KickAssemblerLookupResult, KickAssemblerLookupTokenKind, KickAssemblerLookupTokenMatch } from '../lookup/kick-assembler-lookup-service.ts';
export type { ReferenceDocumentKind, ReferenceSymbolDefinition, ReferenceSymbolKind } from '../reference/reference-symbol-catalog.ts';
