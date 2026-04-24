import type { TextDocumentModel } from '../document/text-document-model.ts';
import { scanKickAssemblerDocument } from '../parsing/kick-assembler-scanner.ts';
import {
  FileSystemDocumentLoader,
  type DocumentLoader
} from '../resolution/file-system-document-loader.ts';
import {
  FileSystemIncludeResolver,
  type IncludeResolver
} from '../resolution/file-system-include-resolver.ts';
import { pathToDocumentUri } from '../resolution/document-uri.ts';
import { SymbolIndex } from '../symbols/symbol-index.ts';
import type {
  KickAssemblerDiagnostic,
  KickAssemblerScanResult,
  ResolvedIncludeDirective,
  UnresolvedIncludeDirective
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

export interface KickAssemblerLanguageSupportOptions {
  documentLoader?: DocumentLoader;
  includeResolver?: IncludeResolver;
  searchRoots?: readonly string[];
}

export class KickAssemblerLanguageSupport {
  private readonly documentLoader: DocumentLoader;
  private readonly includeResolver: IncludeResolver;

  constructor(options: KickAssemblerLanguageSupportOptions = {}) {
    this.documentLoader = options.documentLoader ?? new FileSystemDocumentLoader();
    this.includeResolver =
      options.includeResolver ??
      (options.searchRoots
        ? new FileSystemIncludeResolver({ searchRoots: options.searchRoots })
        : new FileSystemIncludeResolver());
  }

  async loadProjectFromPath(rootPath: string): Promise<KickAssemblerProject> {
    return this.loadProjectFromUri(pathToDocumentUri(rootPath));
  }

  async loadProjectFromUri(rootUri: string): Promise<KickAssemblerProject> {
    const documents = new Map<string, KickAssemblerSourceNode>();
    const symbolIndex = new SymbolIndex();
    const root = await this.loadNode(rootUri, documents, symbolIndex);

    return {
      root,
      documents,
      symbolIndex,
      diagnostics: collectDiagnostics(root)
    };
  }

  private async loadNode(
    uri: string,
    documents: Map<string, KickAssemblerSourceNode>,
    symbolIndex: SymbolIndex
  ): Promise<KickAssemblerSourceNode> {
    const existing = documents.get(uri);
    if (existing) {
      return existing;
    }

    const document = await this.documentLoader.load(uri);
    const scan = scanKickAssemblerDocument(document);
    const node: KickAssemblerSourceNode = {
      document,
      scan,
      resolvedIncludes: [],
      unresolvedIncludes: [],
      children: [],
      diagnostics: [...scan.diagnostics]
    };

    documents.set(uri, node);
    symbolIndex.indexSymbols(scan.symbols);

    for (const include of scan.includes) {
      const resolution = await this.includeResolver.resolve(include, document);

      if ('resolvedUri' in resolution) {
        node.resolvedIncludes.push(resolution);
        const child = await this.loadNode(
          resolution.resolvedUri,
          documents,
          symbolIndex
        );
        node.children.push(child);
        continue;
      }

      node.unresolvedIncludes.push(resolution);
      node.diagnostics.push({
        code: 'include-not-found',
        message: `Unable to resolve include "${resolution.specifier}".`,
        severity: 'warning',
        location: resolution.location
      });
    }

    return node;
  }
}

function collectDiagnostics(
  root: KickAssemblerSourceNode
): KickAssemblerDiagnostic[] {
  const diagnostics = [...root.diagnostics];

  for (const child of root.children) {
    diagnostics.push(...collectDiagnostics(child));
  }

  return diagnostics;
}

// TODO(theia-ts-migration): Add definition/reference providers once symbol
// indexing moves beyond label-and-include scaffolding.
