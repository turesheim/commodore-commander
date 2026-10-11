import URI from '@theia/core/lib/common/uri';
import { createTextDocumentModel, KickAssemblerProjectLoader,
  type KickAssemblerSourceGraph, type KickAssemblerProgramSource, type TextDocumentModel } from '@commodore-commander/language-support/runtime';
import type { KickAssemblerWorkspaceLookupConfiguration } from '../common/kick-assembler-build-service';

/** URI/editor adapters around the same include graph used by the build planner. */
export class KickAssemblerWorkspaceLookup {
  constructor(private readonly read: (resource: URI) => Promise<TextDocumentModel | undefined>) {}

  async getDocuments(current: URI, candidates: readonly URI[], overlays: ReadonlyMap<string, string>,
    configuration: KickAssemblerWorkspaceLookupConfiguration, includeAllOwners = false) {
    const reads = new Map<string, Promise<TextDocumentModel | undefined>>();
    const load = (resource: URI) => {
      const key = resource.toString();
      let pending = reads.get(key);
      if (!pending) {
        const text = overlays.get(key);
        pending = text === undefined ? this.read(resource)
          : Promise.resolve(createTextDocumentModel({ uri: key, text }));
        reads.set(key, pending);
      }
      return pending;
    };
    const graph = async (roots: readonly URI[], libraryRoots: readonly string[]) => {
      const available: string[] = [];
      for (const root of roots) if (await load(root)) available.push(root.toString());
      const loader = new KickAssemblerProjectLoader({
        documentLoader: { load: async uri => {
          const document = await load(new URI(uri));
          if (!document) throw new Error(`Unavailable source: ${uri}`);
          return document;
        } },
        includeResolver: { resolve: async (include, from) => {
          const relative = new URI(from.uri).parent.resolve(include.specifier).normalizePath();
          const paths = [relative, ...libraryRoots.map(root => new URI(root).resolve(include.specifier).normalizePath())];
          for (const candidate of paths) if (await load(candidate)) return { ...include,
            resolvedUri: candidate.toString(), resolutionStrategy: candidate.isEqual(relative) ? 'relative' : 'search-root' };
          return { ...include, candidatePaths: paths.map(candidate => candidate.toString()) };
        } }
      });
      return loader.loadSourceGraph(available);
    };
    const key = current.toString();
    const selected = new Map<string, TextDocumentModel>();
    const programs: KickAssemblerProgramSource[] = [];
    const add = (documents: Iterable<TextDocumentModel>) => {
      for (const document of documents) selected.set(document.uri, document);
    };
    // An explicit program entry is its own context. A shared library retains
    // all configured owners rather than arbitrarily choosing one program.
    const ownPrograms = configuration.programs.filter(program => program.entryUri === key);
    for (const program of ownPrograms.length > 0 && !includeAllOwners ? ownPrograms : configuration.programs) {
      const project = await graph([new URI(program.entryUri)], program.libraryRootUris);
      if (project.documents.has(key)) {
        add([...project.documents.values()].map(node => node.document));
        programs.push({ graph: project, rootUri: program.entryUri });
      }
    }
    let hasOwners = selected.size > 0;
    if (!hasOwners) {
      const sourceGraph = await graph([...candidates, current], configuration.libraryRootUris);
      const included = new Set([...sourceGraph.documents.values()].flatMap(node =>
        node.resolvedIncludes.map(include => include.resolvedUri)));
      const configured = new Set(configuration.programs.map(program => program.entryUri));
      const candidateKeys = new Set(candidates.map(candidate => candidate.toString()));
      for (const root of sourceGraph.roots) {
        if (!candidateKeys.has(root.document.uri) || included.has(root.document.uri) || configured.has(root.document.uri)) continue;
        const closure = reachable(sourceGraph, root.document.uri);
        if (closure.has(key)) {
          add(closure.values());
          programs.push({ graph: sourceGraph, rootUri: root.document.uri });
        }
      }
      hasOwners = selected.size > 0;
      // Orphan files, cyclic components and files outside a workspace still
      // have their own reachable includes, never every unrelated workspace file.
      if (selected.size === 0) {
        add(reachable(sourceGraph, key).values());
        programs.push({ graph: sourceGraph, rootUri: key });
      }
    }
    return { documents: [...selected.values()], programs, resources: [...reads.keys()].map(uri => new URI(uri)), hasOwners };
  }
}

function reachable(graph: KickAssemblerSourceGraph, root: string): Map<string, TextDocumentModel> {
  const documents = new Map<string, TextDocumentModel>();
  const visit = (uri: string) => {
    const node = graph.documents.get(uri);
    if (!node || documents.has(uri)) return;
    documents.set(uri, node.document);
    for (const include of node.resolvedIncludes) visit(include.resolvedUri);
  };
  visit(root);
  return documents;
}
