import { FileSystemDocumentLoader, type DocumentLoader } from '../resolution/file-system-document-loader.ts';
import { FileSystemIncludeResolver, type IncludeResolver } from '../resolution/file-system-include-resolver.ts';
import { pathToDocumentUri } from '../resolution/document-uri.ts';
import { KickAssemblerProjectLoader } from './kick-assembler-project-loader.ts';

export type { KickAssemblerSourceNode, KickAssemblerProject } from './kick-assembler-project-loader.ts';

export interface KickAssemblerLanguageSupportOptions {
  documentLoader?: DocumentLoader;
  includeResolver?: IncludeResolver;
  searchRoots?: readonly string[];
}

/** Node adapter for the include graph also used by editor lookup. */
export class KickAssemblerLanguageSupport extends KickAssemblerProjectLoader {
  constructor(options: KickAssemblerLanguageSupportOptions = {}) {
    super({ documentLoader: options.documentLoader ?? new FileSystemDocumentLoader(),
      includeResolver: options.includeResolver ?? new FileSystemIncludeResolver(
        options.searchRoots ? { searchRoots: options.searchRoots } : {}
      ) });
  }

  async loadProjectFromPath(rootPath: string) {
    return this.loadProjectFromUri(pathToDocumentUri(rootPath));
  }
}
