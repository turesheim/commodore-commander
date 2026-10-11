import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTextDocumentModel,
  KickAssemblerLookupService,
  buildKickAssemblerRenamePlan,
  buildKickAssemblerSemanticTokens,
  findKickAssemblerWorkspaceSymbols,
  type KickAssemblerLookupDocument,
  type KickAssemblerLookupIndexOptions
} from '../src/runtime/index.ts';

class CountingIndexService extends KickAssemblerLookupService {
  assemblies = 0;
  protected override assembleIndex(
    documents: readonly KickAssemblerLookupDocument[],
    options: KickAssemblerLookupIndexOptions
  ) {
    this.assemblies++;
    return super.assembleIndex(documents, options);
  }
}

function input(uri: string, text: string, languageId = 'kickassembler', version = 1): KickAssemblerLookupDocument {
  return { kind: 'kickassembler', document: createTextDocumentModel({ uri, text, languageId, version }) };
}
const declaration = () => input('file:///symbols.asm', '.const TARGET = 1\n');
const usage = () => input('file:///main.asm', 'lda TARGET\n');

test('equivalent document instances and versions reuse assembly with isolated mutable results', () => {
  const service = new CountingIndexService();
  const first = service.buildIndex([declaration(), usage()]);
  const documents = [declaration(), input('file:///main.asm', usage().document.text, 'kickassembler', 20)];
  const repeated = service.buildIndex(documents, { machineProfileId: 'c64' });
  assert.equal(service.assemblies, 1);
  assert.deepEqual(repeated, first);
  assert.notEqual(repeated, first);
  assert.notEqual(repeated.projectDeclarationsByName, first.projectDeclarationsByName);
  assert.notEqual(repeated.projectDeclarationsByName.get('TARGET'), first.projectDeclarationsByName.get('TARGET'));
});

test('content, document order, removal and reappearance trigger fresh assembly', () => {
  const service = new CountingIndexService();
  const documents = [declaration(), usage()];
  service.buildIndex(documents);
  const overlay = input('file:///symbols.asm', 'TARGET:\n rts\n');
  const label = service.buildIndex([overlay, usage()]);
  assert.equal(label.projectReferencesByName.get('TARGET')?.[0]?.kind, 'label');
  assert.equal(service.assemblies, 2);
  documents.reverse();
  const reordered = service.buildIndex(documents);
  assert.deepEqual(reordered, new KickAssemblerLookupService().buildIndex(documents));
  assert.equal(service.assemblies, 3);
  const removed = service.buildIndex([usage()]);
  assert.equal(removed.projectDeclarationsByName.has('TARGET'), false);
  assert.equal(service.assemblies, 4);
  assert.deepEqual(service.buildIndex(documents), reordered);
  assert.equal(service.assemblies, 5);
});

test('URI, language ID, reference kind and XML text participate in the index snapshot', () => {
  const service = new CountingIndexService();
  const xml = '<root><mnemonic id="LDA"/><entry address="$d020" id="BORDER"/></root>';
  const reference: KickAssemblerLookupDocument = {
    kind: '6502-reference', document: createTextDocumentModel({ uri: 'file:///reference.xml', text: xml, languageId: 'xml' })
  };
  service.buildIndex([usage(), reference]);
  service.buildIndex([input('file:///other.asm', usage().document.text), reference]);
  service.buildIndex([input('file:///other.asm', usage().document.text, 'other'), reference]);
  reference.kind = 'c64io-reference';
  const io = service.buildIndex([input('file:///other.asm', usage().document.text, 'other'), reference]);
  assert.equal(io.referenceDeclarationsByName.has('LDA'), false);
  assert.equal(io.referenceDeclarationsByName.has('BORDER'), true);
  reference.document = createTextDocumentModel({ uri: 'file:///reference.xml', text: '<iomap/>', languageId: 'xml' });
  const replaced = service.buildIndex([input('file:///other.asm', usage().document.text, 'other'), reference]);
  assert.equal(replaced.referenceDeclarationsByName.has('BORDER'), false);
  assert.equal(service.assemblies, 5);
});

test('machine switches replace cached hardware facts, including switching back', () => {
  const service = new CountingIndexService();
  const documents = [input('file:///main.asm', 'lda $d020\n')];
  const c64 = service.buildIndex(documents);
  const vic = service.buildIndex(documents, { machineProfileId: 'vic20' });
  assert.deepEqual(vic, new KickAssemblerLookupService().buildIndex(documents, { machineProfileId: 'vic20' }));
  assert.notDeepEqual(vic, c64);
  assert.deepEqual(service.buildIndex(documents), c64);
  assert.equal(service.assemblies, 3);
});

test('first-build and cache-hit mutations cannot affect later indexes or reference aliases', () => {
  const service = new CountingIndexService();
  const documents = [declaration(), usage()];
  const expected = new KickAssemblerLookupService().buildIndex(documents);
  const first = service.buildIndex(documents);
  first.projectDeclarationsByName.get('TARGET')![0]!.location.range.end.character = 999;
  first.projectReferencesByName.clear();
  const hit = service.buildIndex(documents);
  assert.deepEqual(hit, expected);
  const range = hit.referenceDeclarationsByAddressRange[0]!;
  assert.ok(hit.referenceDeclarationsByName.get(range.normalizedName)?.includes(range));
  range.addressRange!.end = 999;
  hit.projectDeclarationsByName.get('TARGET')![0]!.kind = 'label';
  hit.referenceDeclarationsByName.clear();
  assert.deepEqual(service.buildIndex(documents), expected);
  assert.equal(service.assemblies, 1);
});

test('explicit clear releases both assembled index and document analysis state', () => {
  const service = new CountingIndexService();
  const documents = [declaration(), usage()];
  service.buildIndex(documents);
  service.clearDocumentCache();
  service.clearDocumentCache();
  assert.deepEqual(service.buildIndex(documents), new KickAssemblerLookupService().buildIndex(documents));
  assert.equal(service.assemblies, 2);
});

test('cached indexes preserve rename, workspace symbols and semantic tokens after unsaved edits', () => {
  const service = new CountingIndexService();
  const check = (documents: readonly KickAssemblerLookupDocument[]) => {
    service.buildIndex(documents);
    const index = service.buildIndex(documents);
    const fresh = new KickAssemblerLookupService().buildIndex(documents);
    const document = documents[1]!.document;
    const position = { line: 0, character: 5 };
    assert.deepEqual(buildKickAssemblerRenamePlan(document, position, 'RENAMED', index),
      buildKickAssemblerRenamePlan(document, position, 'RENAMED', fresh));
    assert.equal(buildKickAssemblerRenamePlan(document, position, 'RENAMED', index)?.edits.length, 2);
    assert.deepEqual(findKickAssemblerWorkspaceSymbols(index, 'TARGET'), findKickAssemblerWorkspaceSymbols(fresh, 'TARGET'));
    assert.deepEqual(buildKickAssemblerSemanticTokens(document, index), buildKickAssemblerSemanticTokens(document, fresh));
  };
  check([declaration(), usage()]);
  check([input('file:///symbols.asm', 'TARGET:\n rts\n'), usage()]);
  assert.equal(service.assemblies, 2);
});
