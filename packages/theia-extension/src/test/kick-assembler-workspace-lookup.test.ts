import assert from 'node:assert/strict';
import { test } from 'node:test';
import URI from '@theia/core/lib/common/uri';
import { createTextDocumentModel, KickAssemblerLookupService, buildKickAssemblerRenamePlan } from '@commodore-commander/language-support/runtime';
import { KickAssemblerWorkspaceLookup } from '../browser/kick-assembler-workspace-lookup';
import type { KickAssemblerWorkspaceLookupConfiguration } from '../common/kick-assembler-build-service';

const uri = (path: string) => new URI(`file://${path}`);
const defaults: KickAssemblerWorkspaceLookupConfiguration = { programs: [], libraryRootUris: [] };
function fixture(entries: [string, string][]) {
  const texts = new Map(entries);
  const reads: string[] = [];
  const lookup = new KickAssemblerWorkspaceLookup(async resource => {
    const path = resource.path.toString(); reads.push(path);
    const text = texts.get(path);
    return text === undefined ? undefined : createTextDocumentModel({ uri: resource.toString(), text });
  });
  const candidates = entries.map(([path]) => uri(path));
  return { texts, reads, lookup, candidates };
}
const paths = (result: Awaited<ReturnType<KickAssemblerWorkspaceLookup['getDocuments']>>) =>
  result.documents.map(document => new URI(document.uri).path.toString()).sort();

test('inferred program graph excludes unrelated duplicate symbols and includes parents/siblings', async () => {
  const { lookup, candidates, reads } = fixture([
    ['/project/main.asm', '#import "lib/first.inc"\n#import "lib/second.asm"\njsr Target'],
    ['/project/lib/first.inc', 'Entry: jsr Target'],
    ['/project/lib/second.asm', 'Target: rts'],
    ['/project/unrelated.asm', 'Target: rts']
  ]);
  const result = await lookup.getDocuments(uri('/project/lib/first.inc'), candidates, new Map(), defaults);
  assert.deepEqual(paths(result), ['/project/lib/first.inc', '/project/lib/second.asm', '/project/main.asm']);
  assert.equal(reads.filter(path => path === '/project/lib/first.inc').length, 1);
  const index = new KickAssemblerLookupService().buildIndex(result.documents.map(document => ({ kind: 'kickassembler', document })));
  assert.equal(index.projectDeclarationsByName.get('Target')!.length, 1);
});

test('unsaved import edits change ownership and overlays supply new files before disk reads', async () => {
  const { lookup, candidates, texts } = fixture([
    ['/project/main.asm', '#import "old.asm"'], ['/project/old.asm', 'Old: rts'], ['/project/other.asm', 'Other: rts']
  ]);
  const overlays = new Map([[uri('/project/main.asm').toString(), '#import "new.inc"'],
    [uri('/project/new.inc').toString(), 'New: rts']]);
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/main.asm'), candidates, overlays, defaults)),
    ['/project/main.asm', '/project/new.inc']);
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/old.asm'), candidates, overlays, defaults)), ['/project/old.asm']);
  texts.set('/project/main.asm', '#import "other.asm"');
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/main.asm'), candidates, new Map(), defaults)),
    ['/project/main.asm', '/project/other.asm']);
});

test('configured program library roots preserve relative precedence and load external extensionless includes', async () => {
  const { lookup, candidates } = fixture([
    ['/project/main.asm', '#import "shared"\n#import "external"'], ['/project/shared', 'Relative: rts'],
    ['/vendor/shared', 'Vendor: rts'], ['/vendor/external', 'External: rts']
  ]);
  const configuration = { libraryRootUris: [], programs: [{ entryUri: uri('/project/main.asm').toString(), libraryRootUris: ['file:///vendor'] }] };
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/main.asm'), candidates, new Map(), configuration)),
    ['/project/main.asm', '/project/shared', '/vendor/external']);
  const library = await lookup.getDocuments(uri('/vendor/external'), candidates.filter(candidate =>
    candidate.path.toString().startsWith('/project/')), new Map(), configuration);
  assert.equal(library.hasOwners, true);
  assert.deepEqual(paths(library), ['/project/main.asm', '/project/shared', '/vendor/external']);
});

test('shared libraries retain multiple owners with each program library path', async () => {
  const { lookup, candidates } = fixture([
    ['/project/a.asm', '#import "common.inc"\n#import "specific.inc"'],
    ['/project/b.asm', '#import "common.inc"\n#import "specific.inc"'],
    ['/project/common.inc', 'Common: rts'],
    ['/vendor-a/specific.inc', 'A: rts'], ['/vendor-b/specific.inc', 'B: rts'], ['/project/other.asm', 'Other: rts']
  ]);
  const configuration = { libraryRootUris: [], programs: ['a', 'b'].map(name => ({
    entryUri: `file:///project/${name}.asm`, libraryRootUris: [`file:///vendor-${name}`]
  })) };
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/common.inc'), candidates, new Map(), configuration)),
    ['/project/a.asm', '/project/b.asm', '/project/common.inc', '/vendor-a/specific.inc', '/vendor-b/specific.inc']);
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/a.asm'), candidates, new Map(), configuration)),
    ['/project/a.asm', '/project/common.inc', '/vendor-a/specific.inc']);
});

test('cycles, missing includes and standalone files keep a bounded reachable context', async () => {
  const { lookup, candidates } = fixture([
    ['/project/a.asm', '#import "b.asm"\n#import "missing.asm"'],
    ['/project/b.asm', '#import "a.asm"'], ['/project/unrelated.asm', 'Other: rts']
  ]);
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/a.asm'), candidates, new Map(), defaults)), ['/project/a.asm', '/project/b.asm']);
  assert.deepEqual(paths(await lookup.getDocuments(uri('/project/unrelated.asm'), candidates, new Map(), defaults)), ['/project/unrelated.asm']);
});

test('rename expands shared declaration owners and preserves callers outside the navigation context', async () => {
  const { lookup, candidates } = fixture([
    ['/project/a.asm', '#import "shared.inc"\njsr Shared'],
    ['/project/b.asm', '#import "shared.inc"\njsr Shared'],
    ['/project/shared.inc', 'Shared: rts'], ['/project/unrelated.asm', 'Shared: rts']
  ]);
  const configuration = { libraryRootUris: [], programs: ['a', 'b'].map(name => ({
    entryUri: `file:///project/${name}.asm`, libraryRootUris: []
  })) };
  const navigation = await lookup.getDocuments(uri('/project/a.asm'), candidates, new Map(), configuration);
  assert.deepEqual(paths(navigation), ['/project/a.asm', '/project/shared.inc']);
  const context = await lookup.getDocuments(uri('/project/shared.inc'), candidates, new Map(), configuration, true);
  const source = context.documents.find(document => document.uri === 'file:///project/a.asm')!;
  const index = new KickAssemblerLookupService().buildProgramIndex(
    context.documents.map(document => ({ kind: 'kickassembler', document })), context.programs);
  const rename = buildKickAssemblerRenamePlan(source, { line: 1, character: 5 }, 'Renamed', index)!;
  assert.deepEqual(rename.edits.map(edit => new URI(edit.uri).path.toString()).sort(),
    ['/project/a.asm', '/project/b.asm', '/project/shared.inc']);
});


test('workspace overlays reach expanded import targets without inheriting caller namespace', async () => {
  const { lookup, candidates } = fixture([
    ['/project/main.asm', '.namespace Caller {\n#import "library.inc"\nAfter: nop\njsr After\n}\njmp !cross+'],
    ['/project/library.inc', 'Wrong: rts'], ['/project/next.inc', '!cross: nop\nGlobal: rts']
  ]);
  const overlays = new Map([['file:///project/main.asm',
    '.namespace Caller {\n#import "next.inc"\nAfter: nop\njsr After\n}\njmp !cross-\njsr Global']]);
  const context = await lookup.getDocuments(uri('/project/main.asm'), candidates, overlays, defaults);
  const service = new KickAssemblerLookupService();
  const index = service.buildProgramIndex(context.documents.map(document => ({ kind: 'kickassembler', document })), context.programs);
  const main = context.documents.find(document => document.uri === 'file:///project/main.asm')!;
  assert.equal(service.lookupAtPosition(main, { line: 3, character: 5 }, index)!.declarations[0]!.qualifiedName, 'Caller.After');
  assert.equal(service.lookupAtPosition(main, { line: 5, character: 6 }, index)!.declarations[0]!.location.uri, 'file:///project/next.inc');
  assert.equal(service.lookupAtPosition(main, { line: 6, character: 5 }, index)!.declarations[0]!.qualifiedName, 'Global');
});

test('discovery exclusions do not block explicit generated imports or configured program roots', async () => {
  const { lookup, candidates } = fixture([
    ['/project/main.asm', '#import "out/generated.inc"\njsr Generated'],
    ['/project/out/generated.inc', 'Generated: rts'],
    ['/project/dist/explicit.asm', '#import "../src-gen/helper.inc"\njsr Helper'],
    ['/project/src-gen/helper.inc', 'Helper: rts'],
    ['/project/src-gen/unrelated.asm', 'Generated: rts']
  ]);
  const inventory = candidates.filter(candidate => candidate.path.toString() === '/project/main.asm');
  const inferred = await lookup.getDocuments(uri('/project/main.asm'), inventory, new Map(), defaults);
  assert.deepEqual(paths(inferred), ['/project/main.asm', '/project/out/generated.inc']);
  const service = new KickAssemblerLookupService();
  const index = service.buildProgramIndex(inferred.documents.map(document => ({ kind: 'kickassembler', document })), inferred.programs);
  const main = inferred.documents.find(document => document.uri === 'file:///project/main.asm')!;
  assert.equal(service.lookupAtPosition(main, { line: 1, character: 6 }, index)?.declarations[0]?.location.uri,
    'file:///project/out/generated.inc');
  const configuration = { libraryRootUris: [], programs: [
    { entryUri: 'file:///project/dist/explicit.asm', libraryRootUris: [] }
  ] };
  const configured = await lookup.getDocuments(uri('/project/src-gen/helper.inc'), inventory, new Map(), configuration);
  assert.equal(configured.hasOwners, true);
  assert.deepEqual(paths(configured), ['/project/dist/explicit.asm', '/project/src-gen/helper.inc']);
});
