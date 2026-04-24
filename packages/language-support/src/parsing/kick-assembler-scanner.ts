import type { TextDocumentModel } from '../document/text-document-model.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';
import type {
  IncludeDirective,
  KickAssemblerDiagnostic,
  KickAssemblerScanResult,
  KickAssemblerSymbol
} from '../symbols/symbol-types.ts';

export function scanKickAssemblerDocument(
  document: TextDocumentModel
): KickAssemblerScanResult {
  const semanticModel = parseKickAssemblerSemanticModel(document);

  return {
    document,
    includes: semanticModel.imports
      .filter((entry) => (
        (entry.kind === 'import' || entry.kind === 'importif') &&
        entry.specifier
      ))
      .map((entry) => ({
        kind: entry.kind === 'importif' ? 'importif' : 'import',
        specifier: entry.specifier as string,
        raw: document.lineAt(entry.location.range.start.line),
        location: entry.specifierLocation ?? entry.location
      }) satisfies IncludeDirective),
    symbols: semanticModel.symbols.map((symbol) => {
      const mapped: KickAssemblerSymbol = {
        name: symbol.name,
        qualifiedName: symbol.qualifiedName,
        kind: symbol.kind,
        sourceUri: document.uri,
        location: symbol.location
      };
      if (symbol.detail) {
        mapped.detail = symbol.detail;
      }
      if (symbol.data) {
        mapped.data = symbol.data;
      }
      if (symbol.generated) {
        mapped.generated = symbol.generated;
      }
      return mapped;
    }),
    diagnostics: semanticModel.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      ...(diagnostic.location ? { location: diagnostic.location } : {})
    }) satisfies KickAssemblerDiagnostic)
  };
}

// The scanner is now a compatibility facade over the TypeScript semantic model.
// Keep this export stable while project loading and lookup are migrated onto the
// richer semantic API directly.
