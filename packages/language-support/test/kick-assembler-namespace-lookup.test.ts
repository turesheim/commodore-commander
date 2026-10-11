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
  type KickAssemblerLookupIndex,
  type KickAssemblerRenamePlan,
  type TextDocumentModel
} from '../src/runtime/index.ts';
import { scanKickAssemblerDocument } from '../src/parsing/kick-assembler-scanner.ts';

function document(text: string, name = 'main'): TextDocumentModel {
  return createTextDocumentModel({ uri: `file:///project/${name}.asm`, text });
}

function build(service: KickAssemblerLookupService, ...documents: TextDocumentModel[]): KickAssemblerLookupIndex {
  return service.buildIndex(documents.map(document => ({ kind: 'kickassembler', document })));
}

function lookup(service: KickAssemblerLookupService, source: TextDocumentModel, index: KickAssemblerLookupIndex, text: string) {
  const offset = source.text.lastIndexOf(text);
  assert.ok(offset >= 0, `missing query: ${text}`);
  return service.lookupAtPosition(source, source.positionAt(offset), index);
}

function applyRename(source: TextDocumentModel, plan: KickAssemblerRenamePlan): string {
  let text = source.text;
  const edits = plan.edits.filter(edit => edit.uri === source.uri)
    .sort((left, right) => source.offsetAt(right.range.start) - source.offsetAt(left.range.start));
  for (const edit of edits) {
    text = text.slice(0, source.offsetAt(edit.range.start)) + edit.newText + text.slice(source.offsetAt(edit.range.end));
  }
  return text;
}

test('namespace lookup separates identical leaf names and does not expose them at root', () => {
  const source = document([
    '.namespace Left {', 'Draw:', '  jsr Draw', '}',
    '.namespace Right {', 'Draw:', '  jsr Draw', '}',
    '  jsr Left.Draw', '  jsr Right.Draw', '  jsr Draw',
    '  jsr Left.draw', '  jsr left.Draw'
  ].join('\n'));
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  assert.equal(index.projectDeclarationsByName.has('Draw'), false);
  for (const [name, line] of [['Left', 1], ['Right', 5]] as const) {
    const result = lookup(service, source, index, `${name}.Draw`)!;
    assert.equal(result.declarations.length, 1);
    assert.equal(result.declarations[0]!.location.range.start.line, line);
    assert.equal(result.declarations[0]!.qualifiedName, `${name}.Draw`);
    assert.equal(result.references.length, 2);
    const declarationLookup = service.lookupAtPosition(source, { line, character: 1 }, index)!;
    const localLookup = service.lookupAtPosition(source, { line: line + 1, character: 7 }, index)!;
    assert.deepEqual(declarationLookup.declarations, result.declarations);
    assert.deepEqual(localLookup.references, result.references);
  }
  assert.equal(service.lookupAtPosition(source, { line: 10, character: 7 }, index), undefined);
  assert.equal(lookup(service, source, index, 'Left.draw'), undefined);
  assert.equal(lookup(service, source, index, 'left.Draw'), undefined);
});

test('forward and reopened namespace lookup is independent of document order', () => {
  const usage = document('.namespace Shared {\n lda VALUE\n}\n lda Shared.VALUE', 'usage');
  const declaration = document('.namespace Shared {\n .label VALUE = 1\n}', 'declaration');
  const service = new KickAssemblerLookupService();
  for (const documents of [[usage, declaration], [declaration, usage]]) {
    const index = build(service, ...documents);
    const result = lookup(service, usage, index, 'Shared.VALUE')!;
    assert.equal(result.declarations[0]!.location.uri, declaration.uri);
    assert.equal(result.references.length, 2);
    assert.equal(result.references.every(reference => reference.kind === 'label'), true);
  }
});

test('nested namespaces resolve nearest declarations, parent names and explicit root escapes', () => {
  const source = document([
    '.const VALUE = 0',
    '.namespace Outer {', '.const VALUE = 1', '.const PARENT = 2',
    '.namespace Inner {', '.const VALUE = 3', 'lda VALUE', 'lda PARENT', 'lda @VALUE', '}',
    'lda VALUE', 'lda Inner.VALUE', '}', 'lda VALUE', 'lda Outer.Inner.VALUE'
  ].join('\n'));
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  const expected = new Map([[6, 'Outer.Inner.VALUE'], [7, 'Outer.PARENT'], [8, 'VALUE'],
    [10, 'Outer.VALUE'], [13, 'VALUE']]);
  for (const [line, name] of expected) {
    const result = service.lookupAtPosition(source, { line, character: 5 }, index)!;
    assert.equal(result.declarations[0]!.qualifiedName, name);
  }
  assert.equal(index.projectReferencesByName.get('VALUE')!.length, 2);
  assert.equal(service.lookupAtPosition(source, { line: 11, character: 5 }, index), undefined);
  assert.equal(service.lookupAtPosition(source, { line: 14, character: 5 }, index), undefined);
});

test('root-escaped declarations have the same identity through semantic, scanner and editor paths', () => {
  const source = document('.namespace Inner {\n@Outside:\n jsr @Outside\n}\n jsr Outside');
  const model = parseKickAssemblerSemanticModel(source);
  assert.equal(model.symbols.find(symbol => symbol.name === '@Outside')!.qualifiedName, 'Outside');
  assert.equal(scanKickAssemblerDocument(source).symbols.find(symbol => symbol.name === '@Outside')!.qualifiedName, 'Outside');
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  const result = lookup(service, source, index, 'Outside')!;
  assert.equal(result.references.length, 2);
  const plan = buildKickAssemblerRenamePlan(source, { line: 4, character: 6 }, 'Renamed', index)!;
  assert.equal(applyRename(source, plan), '.namespace Inner {\n@Renamed:\n jsr @Renamed\n}\n jsr Renamed');
});

test('namespace body ranges end at closing braces and tolerate unfinished editor text', () => {
  const source = document([
    '.namespace One { // a closing brace in a comment: }',
    'Entry:', '.function helper() { .return 1 }',
    '.print "}"', '}', 'Entry:', 'jsr Entry',
    '.namespace Unfinished {', 'Entry:', 'jsr Entry'
  ].join('\n'));
  const model = parseKickAssemblerSemanticModel(source);
  const one = model.scopes.find(scope => scope.name === 'One')!;
  assert.deepEqual(one.range.end, { line: 4, character: 0 });
  assert.equal(one.location.range.end.line, 0);
  assert.notEqual(one.range, one.location.range);
  const unfinished = model.scopes.find(scope => scope.name === 'Unfinished')!;
  assert.deepEqual(unfinished.range.end, source.positionAt(source.text.length));
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  assert.equal(service.lookupAtPosition(source, { line: 6, character: 5 }, index)!.declarations[0]!.qualifiedName, 'Entry');
  assert.equal(lookup(service, source, index, 'Entry')!.declarations[0]!.qualifiedName, 'Unfinished.Entry');
});

test('rename changes only the target leaf and preserves every qualified reference prefix', () => {
  const source = document([
    '.namespace Left {', 'Draw:', 'jsr Draw', '}',
    '.namespace Right {', 'Draw:', 'jsr Draw', 'jsr Left.Draw', '}',
    'jsr Left.Draw', 'jsr @Left.Draw', 'jsr Right.Draw',
    '// Left.Draw', '.text "Left.Draw"'
  ].join('\n'));
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  const position = source.positionAt(source.text.indexOf('@Left.Draw') + 7);
  const prepared = prepareKickAssemblerRename(source, position, index)!;
  assert.equal(prepared.placeholder, 'Draw');
  assert.equal(source.text.slice(source.offsetAt(prepared.range.start), source.offsetAt(prepared.range.end)), 'Draw');
  const plan = buildKickAssemblerRenamePlan(source, position, 'Render', index)!;
  assert.equal(plan.oldName, 'Draw');
  assert.equal(plan.edits.length, 5);
  assert.equal(applyRename(source, plan), [
    '.namespace Left {', 'Render:', 'jsr Render', '}',
    '.namespace Right {', 'Draw:', 'jsr Draw', 'jsr Left.Render', '}',
    'jsr Left.Render', 'jsr @Left.Render', 'jsr Right.Draw',
    '// Left.Draw', '.text "Left.Draw"'
  ].join('\n'));
});

test('namespace rename, ambiguous declarations and replacement qualification are rejected', () => {
  const source = document('.namespace Left {\nDraw:\n}\nDraw:\nDraw:\n jsr Left.Draw');
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  assert.equal(prepareKickAssemblerRename(source, { line: 0, character: 12 }, index), undefined);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 0, character: 12 }, 'Other', index), undefined);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 3, character: 1 }, 'Other', index), undefined);
  assert.equal(prepareKickAssemblerRename(source, { line: 5, character: 5 }, index), undefined);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 5, character: 5 }, 'Other', index), undefined);
  assert.equal(buildKickAssemblerRenamePlan(source, { line: 5, character: 12 }, 'Other.Draw', index), undefined);
});

test('workspace symbols expose namespace containers and semantic tokens use the resolved kind', () => {
  const source = document('.namespace Labels {\nValue:\njsr Value\n}\n.namespace Constants {\n.const Value = 1\nlda Value\n}\njsr Labels.Value\nlda Constants.Value');
  const service = new KickAssemblerLookupService();
  const index = build(service, source);
  const symbols = findKickAssemblerWorkspaceSymbols(index, 'Value');
  assert.deepEqual(symbols.map(symbol => symbol.containerName).sort(), ['Constants', 'Labels']);
  assert.equal(findKickAssemblerWorkspaceSymbols(index, 'Constants.Value').length, 1);
  const tokens = buildKickAssemblerSemanticTokens(source, index);
  for (const [line, type] of [[2, 'label'], [6, 'variable'], [8, 'label']] as const) {
    assert.equal(tokens.find(token => token.location.range.start.line === line && token.location.range.start.character === 4)!.type, type);
  }
  assert.equal(tokens.find(token => token.location.range.start.line === 9 && token.location.range.start.character === 4), undefined);
});

test('cached bindings stay isolated and rebuild when unsaved namespace boundaries change', () => {
  const service = new KickAssemblerLookupService();
  const source = document('.namespace One {\nDraw:\njsr Draw\n}\nDraw:\njsr Draw');
  const first = build(service, source);
  const pristine = new KickAssemblerLookupService().buildIndex([{ kind: 'kickassembler', document: source }]);
  first.projectBindingsByLocation.clear();
  first.projectDeclarationsByName.get('One.Draw')![0]!.qualifiedName = 'Corrupted';
  assert.deepEqual(build(service, source), pristine);
  const overlay = document('.namespace One {\nDraw:\njsr Draw\nDraw:\njsr Draw');
  const index = build(service, overlay);
  assert.equal(index.projectDeclarationsByName.has('Draw'), false);
  assert.equal(lookup(service, overlay, index, 'Draw')!.declarations.length, 2);
  const reverted = build(service, source);
  assert.deepEqual(reverted, pristine);
  const removed = build(service);
  assert.equal(removed.projectBindingsByLocation.size, 0);
});
