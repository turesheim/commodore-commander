import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createTextDocumentModel, KickAssemblerProjectLoader, KickAssemblerLookupService,
  expandKickAssemblerSource, buildKickAssemblerRenamePlan, buildKickAssemblerSemanticTokens }
  from '../src/runtime/index.ts';

async function fixture(entries: Record<string, string>, roots = ['main']) {
  const documents = new Map(Object.entries(entries).map(([name, text]) => {
    const uri = `file:///project/${name}.asm`;
    return [uri, createTextDocumentModel({ uri, text })];
  }));
  const loader = new KickAssemblerProjectLoader({
    documentLoader: { load: async uri => documents.get(uri)! },
    includeResolver: { resolve: async (include, from) => {
      const uri = new URL(include.specifier, from.uri).toString();
      return documents.has(uri) ? { ...include, resolvedUri: uri, resolutionStrategy: 'relative' } : { ...include, candidatePaths: [uri] };
    } }
  });
  const graph = await loader.loadSourceGraph(roots.map(name => `file:///project/${name}.asm`));
  const programs = roots.map(name => ({ graph, rootUri: `file:///project/${name}.asm` }));
  const inputs = [...documents.values()].map(document => ({ kind: 'kickassembler' as const, document }));
  const service = new KickAssemblerLookupService();
  const index = service.buildProgramIndex(inputs, programs);
  const at = (name: string, line: number, token: string) => {
    const document = documents.get(`file:///project/${name}.asm`)!;
    return service.lookupAtPosition(document, { line, character: document.lineAt(line).indexOf(token) + 1 }, index);
  };
  return { graph, programs, inputs, documents, service, index, at };
}

test('expanded order resolves forward/backward ranks across nested imports with physical locations', async () => {
  const { at, index, documents } = await fixture({
    main: 'jmp !loop++\n!loop: nop\n#import "child.asm"\njmp !loop-\njmp !--',
    child: '!loop: nop\n#import "leaf.asm"\njmp !loop--', leaf: '!loop: nop\n!: nop\n!: nop'
  });
  assert.equal(at('main', 0, '!loop++')!.declarations[0]!.location.uri, 'file:///project/child.asm');
  assert.equal(at('main', 2, '#import')!.references.length, 2, 'Import directive references retain physical locations');
  assert.equal(at('main', 3, '!loop-')!.declarations[0]!.location.uri, 'file:///project/leaf.asm');
  assert.equal(at('child', 2, '!loop--')!.declarations[0]!.location.uri, 'file:///project/child.asm');
  assert.equal(at('main', 4, '!--')!.declarations[0]!.location.range.start.line, 1);
  const tokens = buildKickAssemblerSemanticTokens(documents.get('file:///project/main.asm')!, index);
  assert.equal(tokens.find(token => token.location.range.start.line === 0 && token.type === 'label')!
    .location.range.end.character, 11);
});

test('imported files enter global scope and restore namespaces, file namespaces and private blocks', async () => {
  const { at, index } = await fixture({
    main: '.namespace Outer {\n.const PRIVATE=1\n#import "child.asm"\nAfter: nop\njsr After\n}\n.filenamespace Main\n#import "leaf.asm"\nAfter: nop\njsr After',
    child: 'Global: nop\nlda PRIVATE\n.filenamespace Lib\nTarget: nop\n#import "leaf.asm"\njsr Target',
    leaf: '#importonce\nLeaf: nop'
  });
  for (const name of ['Global', 'Lib.Target', 'Leaf', 'Outer.After', 'Main.After']) {
    assert.ok([...index.projectDeclarationsByName.values()].flat().some(declaration => declaration.qualifiedName === name), name);
  }
  assert.equal(at('child', 1, 'PRIVATE'), undefined);
  assert.equal(at('child', 5, 'Target')!.declarations[0]!.location.range.start.line, 3);
  assert.equal(at('main', 4, 'After')!.declarations[0]!.qualifiedName, 'Outer.After');
  assert.equal(at('main', 9, 'After')!.declarations[0]!.qualifiedName, 'Main.After');
  const block = await fixture({ main: '!loop: nop\n{\n!loop: nop\n#import "child.asm"\njmp !loop-\n}',
    child: '!loop: nop\njmp !loop--' });
  assert.equal(block.at('child', 1, '!loop--')!.declarations[0]!.location.range.start.line, 0);
  assert.equal(block.at('main', 4, '!loop-')!.declarations[0]!.location.range.start.line, 2);
});

test('repeated imports retain occurrences while importonce suppresses repeats and guarded cycles', async () => {
  const repeated = await fixture({ main: 'jmp !++\n#import "child.asm"\n#import "child.asm"', child: '!: nop' });
  assert.equal(repeated.at('main', 0, '!++')!.declarations[0]!.location.uri, 'file:///project/child.asm');
  const expanded = expandKickAssemblerSource(repeated.programs[0]!)!;
  assert.equal(expanded.lines.filter(line => line.document.uri.endsWith('child.asm')).length, 2);
  const once = await fixture({ main: '#importonce\njmp !++\n#import "child.asm"\n#import "child.asm"',
    child: '#importonce\n!: nop\n#import "main.asm"' });
  assert.equal(once.at('main', 1, '!++'), undefined);
  assert.ok(expandKickAssemblerSource(once.programs[0]!));
});

test('uncertain conditional, missing and unguarded cyclic imports keep conservative local lookup', async () => {
  for (const directive of ['#importif FLAG "child.asm"', '#import "missing.asm"', '#import "cycle.asm"']) {
    const { at, programs } = await fixture({ main: '!loop: nop\n' + directive + '\njmp !loop-',
      child: '!loop: nop', cycle: '#import "main.asm"' });
    assert.equal(expandKickAssemblerSource(programs[0]!), undefined);
    assert.equal(at('main', 2, '!loop-'), undefined);
  }
});

test('multiple owner contexts preserve targets and reject renames that would change another binding', async () => {
  const { at, index, documents } = await fixture({
    a: '{\n#import "shared.asm"\njsr Shared\n}',
    b: '#import "shared.asm"\nShared: nop', shared: 'jsr Shared'
  }, ['a', 'b']);
  assert.equal(at('shared', 0, 'Shared')!.declarations[0]!.location.uri, 'file:///project/b.asm');
  // Only b declares Shared. Retain its target for the shared source while
  // keeping a unresolved, and prevent a partial physical-source rename.
  assert.equal(at('a', 2, 'Shared'), undefined);
  assert.equal(buildKickAssemblerRenamePlan(documents.get('file:///project/b.asm')!,
    { line: 1, character: 1 }, 'Renamed', index), undefined, 'Partially resolved shared uses reject rename');
  assert.equal(at('shared', 0, 'Shared')!.references.filter(reference => reference.location.uri.endsWith('shared.asm')).length, 1);
  const ambiguous = await fixture({ a: '#import "shared.asm"\nTarget: nop',
    b: '#import "shared.asm"\nTarget: nop', shared: 'jsr Target' }, ['a', 'b']);
  assert.equal(ambiguous.at('shared', 0, 'Target')!.declarations.length, 2);
  assert.equal(ambiguous.at('a', 1, 'Target')!.declarations.length, 1, 'Owners stay isolated');
  assert.equal(buildKickAssemblerRenamePlan(ambiguous.documents.get('file:///project/a.asm')!,
    { line: 1, character: 1 }, 'Renamed', ambiguous.index), undefined);
});

test('expanded lookup cache includes file boundaries and never exposes virtual locations', async () => {
  const { inputs, programs, service, at } = await fixture({
    main: '#import "child.asm"\njsr Lib.Target', child: '.filenamespace Lib\nTarget: rts'
  });
  const index = service.buildProgramIndex(inputs, programs);
  for (const occurrences of [...index.projectDeclarationsByName.values(), ...index.projectReferencesByName.values()]) {
    assert.ok(occurrences.every(occurrence => occurrence.location.uri.startsWith('file:///')));
  }
  index.projectBindingsByLocation.clear();
  const cached = service.buildProgramIndex(inputs, programs);
  assert.equal(service.lookupAtPosition(inputs[0]!.document, { line: 1, character: 8 }, cached)!.declarations.length, 1);
  assert.equal(at('main', 1, 'Lib.Target')!.declarations[0]!.location.range.start.line, 1);
  const virtual = createTextDocumentModel({ uri: 'memory:///boundaries', text: '.filenamespace Lib\nTarget:\nAfter:\n' });
  const build = (endLine: number) => service.buildIndex([{ kind: 'kickassembler', document: virtual,
    fileBoundaries: [{ startLine: 0, endLine }] }]);
  assert.ok([...build(2).projectDeclarationsByName.values()].flat().some(symbol => symbol.qualifiedName === 'After'));
  assert.ok([...build(3).projectDeclarationsByName.values()].flat().some(symbol => symbol.qualifiedName === 'Lib.After'));
  assert.ok([...build(2).projectDeclarationsByName.values()].flat().some(symbol => symbol.qualifiedName === 'After'));
});

test('bundled compiler agrees with global import scope, restored caller scope and expanded multi-label order', async context => {
  if (spawnSync('java', ['-version']).error) { context.skip('Java is unavailable'); return; }
  const entries = {
    main: '*=$1000\n!loop: nop\n{\n!loop: nop\n#import "child.asm"\njmp !loop-\n}\n.namespace Outer {\n#import "library.asm"\nAfter: nop\n}\njmp !loop-\n.word Lib.Target, Outer.After',
    child: '!loop: nop\njmp !loop--', library: '.filenamespace Lib\nTarget: nop'
  };
  const { at } = await fixture(entries);
  assert.equal(at('child', 1, '!loop--')!.declarations[0]!.location.range.start.line, 1);
  assert.equal(at('main', 5, '!loop-')!.declarations[0]!.location.range.start.line, 3);
  assert.equal(at('main', 11, '!loop-')!.declarations[0]!.location.uri, 'file:///project/child.asm');
  assert.equal(at('main', 12, 'Lib.Target')!.declarations[0]!.location.uri, 'file:///project/library.asm');
  const temp = await mkdtemp(path.join(tmpdir(), 'cc-expanded-compiler-'));
  try {
    for (const [name, text] of Object.entries(entries)) await writeFile(path.join(temp, `${name}.asm`), text);
    const jar = fileURLToPath(new URL('../../../resources/KickAss.jar', import.meta.url));
    const result = spawnSync('java', ['-jar', jar, 'main.asm', '-o', 'main.prg', '-symbolfile'], { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal((await readFile(path.join(temp, 'main.prg'))).toString('hex'), '0010eaeaea4c00104c0110eaea4c021009100a10');
  } finally { await rm(temp, { recursive: true, force: true }); }
});
