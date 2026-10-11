import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildKickAssemblerRenamePlan,
  buildKickAssemblerSemanticTokens,
  createTextDocumentModel,
  findKickAssemblerWorkspaceSymbols,
  KickAssemblerLookupService,
  parseKickAssemblerSemanticModel,
  prepareKickAssemblerRename,
  type TextDocumentModel
} from '../src/runtime/index.ts';
import { scanKickAssemblerDocument } from '../src/parsing/kick-assembler-scanner.ts';

function document(lines: string[], name = 'main') {
  return createTextDocumentModel({ uri: `file:///project/${name}.asm`, text: lines.join('\n') });
}
function fixture(source: TextDocumentModel, ...others: TextDocumentModel[]) {
  const service = new KickAssemblerLookupService();
  const index = service.buildIndex([source, ...others].map(document => ({ kind: 'kickassembler', document })));
  const at = (line: number, character = 5) => service.lookupAtPosition(source, { line, character }, index);
  return { service, index, at };
}

test('anonymous block declarations shadow parents and siblings without leaking outside', () => {
  const source = document([
    '.const VALUE = 0', '{', '.const VALUE = 1', 'lda VALUE',
    '{', '.const VALUE = 2', 'lda VALUE', 'lda @VALUE', '}',
    'lda VALUE', '}', '{', '.const VALUE = 3', 'lda VALUE', '}', 'lda VALUE'
  ]);
  const { index, at } = fixture(source);
  for (const [usage, declaration] of [[3, 2], [6, 5], [7, 0], [9, 2], [13, 12], [15, 0]]) {
    assert.equal(at(usage!)!.declarations.length, 1);
    assert.equal(at(usage!)!.declarations[0]!.location.range.start.line, declaration);
  }
  assert.equal(index.projectDeclarationsByName.get('VALUE')!.length, 1);
  assert.equal(index.projectDeclarationsByName.size, 4);
  const symbols = findKickAssemblerWorkspaceSymbols(index, 'VALUE');
  assert.equal(symbols.length, 4);
  assert.equal(symbols.every(symbol => !`${symbol.name}${symbol.containerName ?? ''}`.includes('\0')), true);
});

test('label scopes project qualified names and resolve local and qualified references', () => {
  const source = document([
    '.namespace Game {', 'First: {', 'loop:', 'bne loop', '}',
    'Second: {', 'loop:', 'bne loop', 'jsr First.loop', '}', '}',
    'jsr Game.First.loop', 'jsr Game.Second.loop', 'bne loop'
  ]);
  const { index, at } = fixture(source);
  assert.equal(at(3)!.declarations[0]!.qualifiedName, 'Game.First.loop');
  assert.equal(at(7)!.declarations[0]!.qualifiedName, 'Game.Second.loop');
  assert.equal(at(8)!.declarations[0]!.qualifiedName, 'Game.First.loop');
  assert.equal(at(11)!.declarations[0]!.qualifiedName, 'Game.First.loop');
  assert.equal(at(13), undefined);
  const projected = scanKickAssemblerDocument(source);
  assert.deepEqual(projected.symbols.filter(symbol => symbol.name === 'loop').map(symbol => symbol.qualifiedName),
    ['Game.First.loop', 'Game.Second.loop']);
  assert.equal(findKickAssemblerWorkspaceSymbols(index, 'Game.First.loop')[0]!.containerName, 'Game.First');
  const plan = buildKickAssemblerRenamePlan(source, { line: 3, character: 5 }, 'again', index)!;
  assert.deepEqual(plan.edits.map(edit => edit.range.start.line).sort((a, b) => a - b), [2, 3, 8, 11]);
  assert.equal(plan.edits.every(edit => source.lineAt(edit.range.start.line).slice(edit.range.start.character, edit.range.end.character) === 'loop'), true);
  assert.equal(prepareKickAssemblerRename(source, { line: 1, character: 1 }, index), undefined,
    'Scope owners require qualified-prefix rename support');
});

test('label directives open member scopes without including braces in their expressions', () => {
  const source = document([
    '.label First = $1000 {', '.label Child = $1001 {', '.label VALUE = 3', 'lda VALUE', '}', '}',
    'lda First.Child.VALUE'
  ]);
  const { at } = fixture(source);
  const model = parseKickAssemblerSemanticModel(source);
  assert.equal(model.symbols[0]!.value!.kind, 'literal');
  assert.equal(model.diagnostics.some(diagnostic => diagnostic.code === 'expression-parse'), false);
  assert.equal(at(3)!.declarations[0]!.qualifiedName, 'First.Child.VALUE');
  assert.equal(at(6)!.declarations[0]!.qualifiedName, 'First.Child.VALUE');
});

test('anonymous scopes with the same parser IDs in separate files have distinct bindings', () => {
  const first = document(['{', 'Private:', 'jsr Private', '}'], 'first');
  const second = document(['{', 'Private:', 'jsr Private', '}'], 'second');
  const { index, at } = fixture(first, second);
  const result = at(2)!;
  assert.equal(result.declarations.length, 1);
  assert.equal(result.references.length, 1);
  assert.equal(result.declarations[0]!.location.uri, first.uri);
  const plan = buildKickAssemblerRenamePlan(first, { line: 2, character: 5 }, 'Renamed', index)!;
  assert.equal(plan.edits.length, 2);
  assert.equal(plan.edits.every(edit => edit.uri === first.uri), true);
});

test('macro parameters and body declarations are lexical while expansion remains deferred', () => {
  const source = document([
    '.const value = 1', '.macro First(value) {', 'lda value', '}',
    '.macro Second(value) {', 'lda value', '}', 'lda value'
  ]);
  const { index, at } = fixture(source);
  assert.equal(at(2)!.declarations[0]!.kind, 'parameter');
  assert.equal(at(2)!.declarations[0]!.location.range.start.line, 1);
  assert.equal(at(5)!.declarations[0]!.location.range.start.line, 4);
  assert.equal(at(7)!.declarations[0]!.kind, 'constant');
  const tokens = buildKickAssemblerSemanticTokens(source, index);
  assert.equal(tokens.find(token => token.location.range.start.line === 2 && token.location.range.start.character === 4)!.type, 'parameter');
  const plan = buildKickAssemblerRenamePlan(source, { line: 2, character: 5 }, 'argument', index)!;
  assert.deepEqual(plan.edits.map(edit => edit.range.start.line).sort(), [1, 2]);
});

test('a nearer declaration shadows the entire qualified path and root escape bypasses it', () => {
  const source = document([
    '.namespace Library {', 'Target:', '}', '{', '.const Library = 1',
    'jsr Library.Target', 'jsr @Library.Target', '}'
  ]);
  const { at } = fixture(source);
  assert.equal(at(5), undefined);
  assert.equal(at(6)!.declarations[0]!.qualifiedName, 'Library.Target');
});

test('unsupported multi-label tokens cannot bind to an ordinary same-named label', () => {
  const source = document(['loop:', '!loop:', 'bne !loop-', 'bne loop']);
  const { index, at } = fixture(source);
  assert.equal(at(2), undefined);
  assert.equal(at(3)!.references.length, 1);
  assert.equal(prepareKickAssemblerRename(source, { line: 1, character: 2 }, index), undefined);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 1, character: 2 }, 'again', index), undefined);
});

test('unsaved block boundaries update cached lexical bindings and rename targets', () => {
  const service = new KickAssemblerLookupService();
  const original = document(['VALUE:', '{', 'VALUE:', 'lda VALUE', '}', 'lda VALUE']);
  const build = (source: TextDocumentModel) => service.buildIndex([{ kind: 'kickassembler', document: source }]);
  const index = build(original);
  const local = service.lookupAtPosition(original, { line: 3, character: 5 }, index)!;
  assert.equal(local.declarations[0]!.location.range.start.line, 2);
  const overlay = document(['VALUE:', '{', 'VALUE:', 'lda VALUE', 'lda VALUE']);
  const changed = build(overlay);
  assert.equal(service.lookupAtPosition(overlay, { line: 4, character: 5 }, changed)!.references.length, 2);
  index.projectBindingsByLocation.clear();
  assert.deepEqual(build(original), new KickAssemblerLookupService().buildIndex([{ kind: 'kickassembler', document: original }]));
  const plan = buildKickAssemblerRenamePlan(original, { line: 5, character: 5 }, 'ROOT', build(original))!;
  assert.deepEqual(plan.edits.map(edit => edit.range.start.line).sort(), [0, 5]);
});

test('namespace constants share reopened lexical scope but cannot be accessed as qualified fields', () => {
  const source = document([
    '.namespace NS {', '.const VALUE = 3', 'lda VALUE', '}',
    '.namespace NS {', 'lda VALUE', '}', 'lda NS.VALUE'
  ]);
  const other = document(['.namespace NS {', 'lda VALUE', '}'], 'other');
  const { service, index, at } = fixture(source, other);
  assert.equal(at(2)!.declarations[0]!.location.range.start.line, 1);
  assert.equal(at(5)!.declarations[0]!.location.range.start.line, 1);
  assert.equal(at(5)!.references.length, 3);
  assert.equal(service.lookupAtPosition(other, { line: 1, character: 5 }, index)!.declarations[0]!.location.uri, source.uri);
  assert.equal(at(7), undefined);
});
