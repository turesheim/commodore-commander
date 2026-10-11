import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createTextDocumentModel, KickAssemblerLookupService, parseKickAssemblerSemanticModel,
  buildKickAssemblerSemanticTokens, buildKickAssemblerRenamePlan, findLookupTokenAtPosition,
  findKickAssemblerWorkspaceSymbols
} from '../src/runtime/index.ts';

function document(lines: string[], name = 'main') {
  return createTextDocumentModel({ uri: `file:///project/${name}.asm`, text: lines.join('\n') });
}
function fixture(lines: string[], others: ReturnType<typeof document>[] = []) {
  const source = document(lines);
  const service = new KickAssemblerLookupService();
  const index = service.buildIndex([source, ...others].map(document => ({ kind: 'kickassembler', document })));
  const at = (line: number, text: string) => service.lookupAtPosition(source,
    { line, character: source.lineAt(line).indexOf(text) + 1 }, index);
  return { source, service, index, at };
}

test('direction and distance identify individual named and anonymous declarations', () => {
  const { source, index, at } = fixture([
    '!loop: jmp !loop-', 'jmp !loop++', '!loop: nop', '!loop: nop',
    'jmp !loop--', 'jmp !++', '!: nop', '!: jmp !--', 'jmp !loop+++', 'jmp !loop'
  ]);
  for (const [line, text, target] of [[0, '!loop-', 0], [1, '!loop++', 3], [4, '!loop--', 2],
    [5, '!++', 7], [7, '!--', 6]] as const) {
    assert.equal(at(line, text)!.declarations.length, 1);
    assert.equal(at(line, text)!.declarations[0]!.location.range.start.line, target);
  }
  assert.equal(at(8, '!loop+++'), undefined);
  assert.equal(at(9, '!loop'), undefined, 'References require direction');
  assert.equal(at(2, '!loop')!.references.length, 1);
  assert.equal(at(3, '!loop')!.references.length, 1);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 1, character: 6 }, 'again', index), undefined);
  assert.equal(findKickAssemblerWorkspaceSymbols(index, '!loop').length, 3);
});

test('directional search combines parent scopes but excludes children and siblings', () => {
  const { at } = fixture([
    '!loop: nop', '{', 'jmp !loop-', '!loop: nop', 'jmp !loop--', '}',
    '{', 'jmp !loop-', '}', 'Global: jmp !loop-', 'jmp !loop+',
    '{', '!loop: nop', '}', '!loop: nop'
  ]);
  for (const [line, target] of [[2, 0], [4, 0], [7, 0], [9, 0], [10, 14]]) {
    assert.equal(at(line!, '!loop')!.declarations[0]!.location.range.start.line, target);
  }
  const symbols = parseKickAssemblerSemanticModel(document(['Global:', '!loop:', 'bne !loop-'])).symbols;
  assert.equal(symbols[1]!.qualifiedName, '!loop', 'A global label does not establish a multi-label scope');
});

test('reopened namespace multi-labels share their associated scope in one document', () => {
  const { at } = fixture([
    '.namespace NS {', '!loop: nop', '}', '.namespace NS {', '!loop: nop',
    'jmp !loop--', '}', 'jmp !loop-'
  ]);
  assert.equal(at(5, '!loop--')!.declarations[0]!.location.range.start.line, 1);
  assert.equal(at(7, '!loop-'), undefined);
});

test('import crossings and different files do not guess expanded multi-label order', () => {
  const other = document(['!loop: nop'], 'other');
  const { at } = fixture([
    '!loop: nop', '#import "other.asm"', 'jmp !loop-', '!loop: nop', 'jmp !loop-',
    'jmp !loop+', '#import "other.asm"', '!loop: nop'
  ], [other]);
  assert.equal(at(2, '!loop-'), undefined);
  assert.equal(at(4, '!loop-')!.declarations[0]!.location.range.start.line, 3);
  assert.equal(at(5, '!loop+'), undefined);
  assert.equal(fixture(['jmp !loop-'], [other]).at(0, '!loop-'), undefined);
});

test('multi-label tokens and semantic colors include every direction sign', () => {
  const { source, index, at } = fixture(['jmp !loop++', '!loop: nop', '!loop: nop', 'jmp !--', '!: nop', '!: nop']);
  for (let character = 4; character <= 11; character += 1) {
    assert.equal(findLookupTokenAtPosition(source, { line: 0, character })!.text, '!loop++');
  }
  const tokens = buildKickAssemblerSemanticTokens(source, index);
  assert.equal(tokens.find(token => token.location.range.start.line === 0 && token.type === 'label')!.location.range.end.character, 11);
  assert.equal(at(3, '!--'), undefined);
  assert.equal(fixture(['!loop: nop', 'lda (!loop-) + 1']).at(1, '!loop-')!.declarations[0]!.location.range.start.line, 0);
  assert.equal(fixture(['!loop: nop', '// jmp !loop-', '.text "!loop-"']).at(0, '!loop')!.references.length, 0);
});

test('editor word rules include anonymous directions without absorbing ordinary arithmetic', async () => {
  const configuration = JSON.parse(await readFile(new URL('../syntaxes/kickassembler.language-configuration.json', import.meta.url), 'utf8'));
  const words = (text: string) => [...text.matchAll(new RegExp(configuration.wordPattern, 'g'))].map(match => match[0]);
  assert.deepEqual(words('jmp !++'), ['jmp', '!++']);
  assert.deepEqual(words('jmp !loop--'), ['jmp', '!loop--']);
  assert.deepEqual(words('lda Label+1'), ['lda', 'Label', '1']);
  assert.deepEqual(words('lda @Library.Target'), ['lda', '@Library.Target']);
});

test('unsaved edits change multi-label rank and cached outputs remain isolated', () => {
  const service = new KickAssemblerLookupService();
  const source = document(['jmp !+', '!: nop', '!: nop']);
  const build = (text: ReturnType<typeof document>) => service.buildIndex([{ kind: 'kickassembler', document: text }]);
  const index = build(source);
  const overlay = document(['jmp !++', '!: nop', '!: nop']);
  assert.equal(service.lookupAtPosition(overlay, { line: 0, character: 5 }, build(overlay))!.declarations[0]!.location.range.start.line, 2);
  index.projectDeclarationsByName.clear();
  assert.equal(service.lookupAtPosition(source, { line: 0, character: 5 }, build(source))!.declarations[0]!.location.range.start.line, 1);
});

test('file namespaces qualify following declarations without changing earlier or importing files', () => {
  const library = document(['.filenamespace Lib', 'Target: rts', '.const VALUE=3', 'lda VALUE', '@Exported: rts'], 'library');
  const { at, index } = fixture(['Before: nop', '#import "library.asm"', 'jsr Lib.Target', '.filenamespace Main', 'After: nop', 'jsr Before', 'jsr Lib.Target', 'jsr @Exported'], [library]);
  assert.equal(index.projectDeclarationsByName.has('Before'), true);
  assert.equal(index.projectDeclarationsByName.has('Main.After'), true);
  assert.equal(at(2, 'Lib.Target')!.declarations[0]!.location.uri, library.uri);
  assert.equal(at(6, 'Lib.Target')!.declarations[0]!.location.uri, library.uri);
  assert.equal(at(5, 'Before')!.declarations[0]!.qualifiedName, 'Before');
  assert.equal(at(7, '@Exported')!.declarations[0]!.qualifiedName, 'Exported');
  const tokens = buildKickAssemblerSemanticTokens(library, index);
  assert.equal(tokens.some(token => token.type === 'namespace' && token.location.range.start.line === 0), true);
});

test('successive file namespaces nest and implicit namespaces close with enclosing braces', () => {
  const { at, index } = fixture([
    '.namespace Outer {', '.filenamespace Inner', 'Local: nop', '}', 'After: nop',
    '.filenamespace A', 'One: nop', '.filenamespace B', 'Two: nop',
    'jsr @Outer.Inner.Local', 'jsr @After', 'jsr @A.One', 'jsr @A.B.Two'
  ]);
  assert.equal(index.projectDeclarationsByName.has('After'), true);
  for (const [line, name, target] of [[9, '@Outer.Inner.Local', 2], [10, '@After', 4], [11, '@A.One', 6], [12, '@A.B.Two', 8]] as const) {
    assert.equal(at(line, name)!.declarations[0]!.location.range.start.line, target);
  }
  assert.equal(parseKickAssemblerSemanticModel(document(['.filenamespace A.B'])).diagnostics[0]!.code, 'invalid-file-namespace');
});

const compilerSource = [
  '*=$1000', '!loop: nop', 'jmp !loop-', 'jmp !loop++', '!loop: nop', '!loop: nop',
  '{', 'jmp !loop--', '!loop: nop', 'jmp !loop--', '}',
  'jmp !++', '!: nop', '!: jmp !--',
  '.namespace Outer {', '.filenamespace Inner', 'Local: nop', '}', 'After: nop',
  '.filenamespace A', 'One: nop', '.filenamespace B', 'Two: nop',
  '.word @Outer.Inner.Local, @After, @A.One, @A.B.Two'
];
test('bundled KickAss agrees with directional targets and file-namespace boundaries', async context => {
  const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
  if (java.error) { context.skip('Java is unavailable'); return; }
  const { at } = fixture(compilerSource);
  for (const [line, text, target] of [[2, '!loop-', 1], [3, '!loop++', 5], [7, '!loop--', 4],
    [9, '!loop--', 5], [11, '!++', 13], [13, '!--', 12], [23, '@Outer.Inner.Local', 16],
    [23, '@A.B.Two', 22]] as const) {
    assert.equal(at(line, text)!.declarations[0]!.location.range.start.line, target);
  }
  const temp = await mkdtemp(path.join(tmpdir(), 'cc-directional-compiler-'));
  try {
    await writeFile(path.join(temp, 'main.asm'), compilerSource.join('\n'));
    const jar = fileURLToPath(new URL('../../../resources/KickAss.jar', import.meta.url));
    const result = spawnSync('java', ['-jar', jar, 'main.asm', '-o', 'main.prg'], { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal((await readFile(path.join(temp, 'main.prg'))).toString('hex'),
      '0010ea4c00104c0810eaea4c0710ea4c08104c1410ea4c1310eaeaeaea1710181019101a10');
  } finally { await rm(temp, { recursive: true, force: true }); }
});
