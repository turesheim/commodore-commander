import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTextDocumentModel, KickAssemblerProjectLoader } from '../src/runtime/index.ts';

test('shared graph handles cycles and shared children without repeated loads or diagnostics', async () => {
  const texts = new Map([
    ['file:///a.asm', '#import "shared.asm"\n#import "b.asm"'],
    ['file:///b.asm', '#import "shared.asm"\n#import "a.asm"'],
    ['file:///shared.asm', '#import "missing.asm"\nShared: rts']
  ]);
  const reads: string[] = [];
  const loader = new KickAssemblerProjectLoader({
    documentLoader: { load: async uri => {
      reads.push(uri);
      return createTextDocumentModel({ uri, text: texts.get(uri)! });
    } },
    includeResolver: { resolve: async include => {
      const uri = `file:///${include.specifier}`;
      return texts.has(uri) ? { ...include, resolvedUri: uri, resolutionStrategy: 'relative' }
        : { ...include, candidatePaths: [uri] };
    } }
  });
  const graph = await loader.loadSourceGraph(['file:///a.asm', 'file:///b.asm', 'file:///a.asm']);
  assert.equal(graph.roots.length, 2);
  assert.equal(graph.documents.size, 3);
  assert.equal(new Set(reads).size, reads.length);
  assert.equal(graph.diagnostics.filter(entry => entry.code === 'include-not-found').length, 1);
  assert.equal(graph.diagnostics.filter(entry => entry.code === 'include-cycle').length, 1);
  assert.equal(graph.roots[0]!.children[0], graph.roots[1]!.children[0]);
  const project = await loader.loadProjectFromUri('file:///a.asm');
  assert.equal(project.symbolIndex.find('Shared').length, 1);
});
