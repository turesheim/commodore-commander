import { createTextDocumentModel, type TextDocumentModel } from '../document/text-document-model.ts';
import type { SourceLocation } from '../location/source-location.ts';
import type { KickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-model.ts';
import { parseKickAssemblerSemanticModel } from '../semantic/kick-assembler-semantic-parser.ts';
import type { KickAssemblerSourceFileBoundary } from '../semantic/kick-assembler-semantic-parser.ts';
import type { KickAssemblerSourceGraph } from './kick-assembler-project-loader.ts';

export interface KickAssemblerProgramSource {
  graph: KickAssemblerSourceGraph;
  rootUri: string;
}

export interface KickAssemblerExpandedSource {
  document: TextDocumentModel;
  lines: readonly { document: TextDocumentModel; line: number }[];
  fileBoundaries: readonly KickAssemblerSourceFileBoundary[];
}

/** Expand each import occurrence, retaining its order, scope and physical location.
 * Uncertain preprocessing falls back to the existing document-local analysis.
 */
export function expandKickAssemblerSource(program: KickAssemblerProgramSource): KickAssemblerExpandedSource | undefined {
  const text: string[] = [];
  const lines: { document: TextDocumentModel; line: number }[] = [];
  const fileBoundaries: KickAssemblerSourceFileBoundary[] = [];
  const once = new Set<string>();
  const active = new Set<string>();
  const models = new Map<string, KickAssemblerSemanticModel>();
  let size = 0;
  const visit = (uri: string): boolean => {
    const node = program.graph.documents.get(uri);
    if (!node) return false;
    if (once.has(uri)) return true;
    const model = models.get(uri) ?? parseKickAssemblerSemanticModel(node.document);
    models.set(uri, model);
    if (active.has(uri) || active.size >= 256) return false;
    // Preprocessor branch selection and legacy deferred imports need a
    // compiler-aware phase. Do not flatten either into a fabricated order.
    if (model.imports.some(entry => entry.kind === 'importif') ||
        model.diagnostics.some(diagnostic => diagnostic.code === 'import-missing-specifier') ||
        /^(?:[ \t]*#(?:if|elif|else|endif|ifdef|ifndef)\b|[ \t]*\.import\s+source\b)/mu.test(node.document.text)) return false;
    if (model.importOnce) once.add(uri);
    active.add(uri);
    const startLine = text.length;
    const imports = new Map(model.imports.map(entry => [entry.location.range.start.line, entry]));
    for (let line = 0; line < node.document.lineCount; line += 1) {
      const entry = imports.get(line);
      // Preserve directive tokens for reference lookup as well as line boundaries.
      const value = node.document.lineAt(line);
      size += value.length + 1;
      if (size > 2_000_000 || text.length >= 100_000) return false;
      text.push(value);
      lines.push({ document: node.document, line });
      if (entry?.kind === 'import') {
        const resolved = node.resolvedIncludes.find(include => include.location.range.start.line === line);
        if (!resolved || !visit(resolved.resolvedUri)) return false;
      }
    }
    fileBoundaries.push({ startLine, endLine: text.length });
    active.delete(uri);
    return true;
  };
  if (!visit(program.rootUri)) return undefined;
  return { document: createTextDocumentModel({ uri: `expanded:${program.rootUri}`, text: text.join('\n') + '\n' }),
    lines, fileBoundaries };
}

export function originalExpandedLocation(source: KickAssemblerExpandedSource, location: SourceLocation): SourceLocation {
  const start = source.lines[location.range.start.line];
  const end = source.lines[location.range.end.line];
  if (!start || !end || start.document.uri !== end.document.uri) return location;
  return { uri: start.document.uri, range: {
    start: { line: start.line, character: location.range.start.character },
    end: { line: end.line, character: location.range.end.character }
  } };
}
