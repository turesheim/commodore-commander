import { access } from 'node:fs/promises';
import path from 'node:path';

import type { TextDocumentModel } from '../document/text-document-model.ts';
import type {
  IncludeDirective,
  ResolvedIncludeDirective,
  UnresolvedIncludeDirective
} from '../symbols/symbol-types.ts';
import { documentUriToPath, pathToDocumentUri } from './document-uri.ts';

export interface IncludeResolver {
  resolve(
    include: IncludeDirective,
    fromDocument: TextDocumentModel
  ): Promise<ResolvedIncludeDirective | UnresolvedIncludeDirective>;
}

export interface FileSystemIncludeResolverOptions {
  searchRoots?: readonly string[];
}

export class FileSystemIncludeResolver implements IncludeResolver {
  private readonly searchRoots: readonly string[];

  constructor(options: FileSystemIncludeResolverOptions = {}) {
    this.searchRoots = (options.searchRoots ?? []).map((root) => path.resolve(root));
  }

  async resolve(
    include: IncludeDirective,
    fromDocument: TextDocumentModel
  ): Promise<ResolvedIncludeDirective | UnresolvedIncludeDirective> {
    const fromPath = documentUriToPath(fromDocument.uri);
    const relativeCandidate = path.resolve(path.dirname(fromPath), include.specifier);
    const searchRootCandidates = this.searchRoots.map((root) =>
      path.resolve(root, include.specifier)
    );
    const candidates = [relativeCandidate, ...searchRootCandidates];

    for (const candidate of candidates) {
      if (!(await pathExists(candidate))) {
        continue;
      }

      return {
        ...include,
        resolvedUri: pathToDocumentUri(candidate),
        resolutionStrategy:
          candidate === relativeCandidate ? 'relative' : 'search-root'
      };
    }

    return {
      ...include,
      candidatePaths: candidates
    };
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}
