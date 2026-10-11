import type { TextDocumentModel } from '../document/text-document-model.ts';
import { scanKickAssemblerDocument } from '../parsing/kick-assembler-scanner.ts';
import type { DocumentLoader } from '../resolution/file-system-document-loader.ts';
import type { IncludeResolver } from '../resolution/file-system-include-resolver.ts';
import { SymbolIndex } from '../symbols/symbol-index.ts';
import type {
  KickAssemblerDiagnostic, KickAssemblerScanResult,
  ResolvedIncludeDirective, UnresolvedIncludeDirective
} from '../symbols/symbol-types.ts';

export interface KickAssemblerSourceNode {
  document: TextDocumentModel;
  scan: KickAssemblerScanResult;
  resolvedIncludes: ResolvedIncludeDirective[];
  unresolvedIncludes: UnresolvedIncludeDirective[];
  children: KickAssemblerSourceNode[];
  diagnostics: KickAssemblerDiagnostic[];
}

export interface KickAssemblerProject {
  root: KickAssemblerSourceNode;
  documents: Map<string, KickAssemblerSourceNode>;
  symbolIndex: SymbolIndex;
  diagnostics: KickAssemblerDiagnostic[];
}

export interface KickAssemblerSourceGraph {
  roots: KickAssemblerSourceNode[];
  documents: Map<string, KickAssemblerSourceNode>;
  diagnostics: KickAssemblerDiagnostic[];
}

export interface KickAssemblerProjectLoaderOptions {
  documentLoader: Pick<DocumentLoader, 'load'>;
  includeResolver: IncludeResolver;
}

/** Shared include graph; filesystem/URI access belongs to the supplied adapters. */
export class KickAssemblerProjectLoader {
  private readonly options: KickAssemblerProjectLoaderOptions;

  constructor(options: KickAssemblerProjectLoaderOptions) {
    this.options = options;
  }

  async loadProjectFromUri(rootUri: string): Promise<KickAssemblerProject> {
    const graph = await this.loadSourceGraph([rootUri]);
    const symbolIndex = new SymbolIndex();
    for (const node of graph.documents.values()) symbolIndex.indexSymbols(node.scan.symbols);
    return { root: graph.roots[0]!, documents: graph.documents, symbolIndex, diagnostics: graph.diagnostics };
  }

  async loadSourceGraph(rootUris: readonly string[]): Promise<KickAssemblerSourceGraph> {
    const documents = new Map<string, KickAssemblerSourceNode>();
    const roots: KickAssemblerSourceNode[] = [];
    for (const uri of new Set(rootUris)) roots.push(await this.loadNode(uri, documents, new Set()));
    // Shared children and cycles must not duplicate diagnostics or recurse forever.
    return { roots, documents, diagnostics: [...documents.values()].flatMap(node => node.diagnostics) };
  }

  private async loadNode(uri: string, documents: Map<string, KickAssemblerSourceNode>,
    ancestors: ReadonlySet<string>): Promise<KickAssemblerSourceNode> {
    const existing = documents.get(uri);
    if (existing) return existing;
    const document = await this.options.documentLoader.load(uri);
    const scan = scanKickAssemblerDocument(document);
    const node: KickAssemblerSourceNode = { document, scan, resolvedIncludes: [], unresolvedIncludes: [],
      children: [], diagnostics: [...scan.diagnostics] };
    documents.set(uri, node);
    const path = new Set([...ancestors, uri]);
    for (const include of scan.includes) {
      const resolution = await this.options.includeResolver.resolve(include, document);
      if ('resolvedUri' in resolution) {
        node.resolvedIncludes.push(resolution);
        if (path.has(resolution.resolvedUri)) node.diagnostics.push({ code: 'include-cycle',
          message: `Circular include of "${resolution.specifier}".`, severity: 'warning', location: resolution.location });
        node.children.push(await this.loadNode(resolution.resolvedUri, documents, path));
      } else {
        node.unresolvedIncludes.push(resolution);
        node.diagnostics.push({ code: 'include-not-found', message: `Unable to resolve include "${resolution.specifier}".`,
          severity: 'warning', location: resolution.location });
      }
    }
    return node;
  }
}
