import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseKickAssemblerOutlineDocument } from '../src/parsing/kick-assembler-outline-parser.ts';
import { parseKickAssemblerSemanticModel } from '../src/semantic/kick-assembler-semantic-parser.ts';
import { KickAssemblerLookupService } from '../src/lookup/kick-assembler-lookup-service.ts';
import { containsPosition } from '../src/location/source-location.ts';
import { createTextDocumentModel } from '../src/document/text-document-model.ts';
import { buildKickAssemblerOutline, buildKickAssemblerOutlineFromParsed, type KickAssemblerOutlineSymbol } from '../src/outline/kick-assembler-outline-model.ts';

test('buildKickAssemblerOutline groups symbols under active segments and nested blocks', () => {
  const document = createTextDocumentModel({
    uri: 'file:///outline.asm',
    text: [
      '#import "library/macros.asm"',
      '.segment Code "Main code"',
      '.const MODE = $01',
      'EntryPoint:',
      '.namespace Utilities {',
      'Helper:',
      '}',
      '.macro LOAD_SCREEN(index) {',
      'Loop:',
      '}',
      '.segment Data "Data area"',
      'SpriteData:',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['library/macros.asm', 'Code', 'Data']
  );
  assert.equal(outline[0]?.kind, 'import');
  assert.equal(outline[1]?.kind, 'segment');
  assert.equal(outline[2]?.kind, 'segment');

  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['MODE', 'EntryPoint', 'Utilities', 'LOAD_SCREEN']
  );
  assert.equal(outline[1]?.children[2]?.kind, 'namespace');
  assert.deepEqual(
    outline[1]?.children[2]?.children.map((symbol) => symbol.name),
    ['Helper']
  );
  assert.equal(outline[1]?.children[3]?.kind, 'macro');
  assert.deepEqual(
    outline[1]?.children[3]?.children.map((symbol) => symbol.name),
    ['Loop']
  );
  assert.deepEqual(
    outline[2]?.children.map((symbol) => symbol.name),
    ['SpriteData']
  );
});

test('buildKickAssemblerOutline derives program counter and import labels from line parts', () => {
  const document = createTextDocumentModel({
    uri: 'file:///pc.asm',
    text: [
      '#importif FEATURE_ENABLED "lib/conditional.asm"',
      '.pc = $0801 "Basic Upstart" {',
      'start:',
      '}',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['lib/conditional.asm', 'Basic Upstart']
  );
  assert.equal(outline[1]?.kind, 'program-counter');
  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['start']
  );
});

test('buildKickAssemblerOutline includes local bang labels and preserves label selection ranges', () => {
  const document = createTextDocumentModel({
    uri: 'file:///labels.asm',
    text: [
      'start:',
      '    !local:',
      '!:',
      'next: .byte 1',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['start', '!local', '!', 'next']
  );
  assert.deepEqual(outline.map((symbol) => symbol.kind), [
    'label',
    'label',
    'label',
    'label'
  ]);
  assert.deepEqual(outline[0]?.selectionRange, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 5 }
  });
  assert.deepEqual(outline[1]?.selectionRange, {
    start: { line: 1, character: 4 },
    end: { line: 1, character: 10 }
  });
  assert.deepEqual(outline[2]?.selectionRange, {
    start: { line: 2, character: 0 },
    end: { line: 2, character: 1 }
  });
  assert.deepEqual(outline[3]?.selectionRange, {
    start: { line: 3, character: 0 },
    end: { line: 3, character: 4 }
  });
});

test('buildKickAssemblerOutline ignores multiline and standalone line comments', () => {
  const document = createTextDocumentModel({
    uri: 'file:///comments.asm',
    text: [
      '/*',
      '    Bouncing ball demo',
      '',
      '    Written by:',
      '    - Øystein Steimler',
      '*/',
      '',
      '// Include .prg file assembly segments',
      '.file [name="demo.prg", segments="Code"]',
      '.segment Code "Main"',
      'start:',
      ''
    ].join('\n')
  });

  const outline = buildKickAssemblerOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['Code']
  );
  assert.equal(outline[0]?.kind, 'segment');
  assert.deepEqual(
    outline[0]?.children.map((symbol) => symbol.name),
    ['start']
  );
});

function assertOutlineRanges(symbols: readonly KickAssemblerOutlineSymbol[]): void {
  for (const symbol of symbols) {
    assert.ok(containsPosition(symbol.location.range, symbol.selectionRange.start));
    assert.ok(containsPosition(symbol.location.range, symbol.selectionRange.end));
    for (const child of symbol.children) {
      assert.ok(containsPosition(symbol.location.range, child.location.range.start));
      assert.ok(containsPosition(symbol.location.range, child.location.range.end));
    }
    assertOutlineRanges(symbol.children);
  }
}

test('outline follows file namespaces, label scopes and their exact semantic declaration ranges', () => {
  const document = createTextDocumentModel({ uri: 'file:///scopes.asm', text: [
    '.filenamespace Game',
    'Actor: {',
    '  Loop:',
    '}',
    '.label Sprite = $2000 {',
    '  Loop:',
    '}',
    '.namespace Util {',
    '  .filenamespace Inner',
    '  Helper:',
    '}',
    'After:',
    '.filenamespace Tail',
    'Last:'
  ].join('\n') });
  const outline = buildKickAssemblerOutline(document);
  assert.deepEqual(outline.map(symbol => symbol.name), ['Game']);
  const game = outline[0]!;
  assert.equal(game.kind, 'namespace');
  assert.equal(game.detail, '.filenamespace');
  assert.deepEqual(game.children.map(symbol => symbol.name), ['Actor', 'Sprite', 'Util', 'After', 'Tail']);
  assert.deepEqual(game.children[0]!.children.map(symbol => symbol.name), ['Loop']);
  assert.deepEqual(game.children[1]!.children.map(symbol => symbol.name), ['Loop']);
  assert.deepEqual(game.children[2]!.children.map(symbol => symbol.name), ['Inner']);
  assert.deepEqual(game.children[2]!.children[0]!.children.map(symbol => symbol.name), ['Helper']);
  assert.deepEqual(game.children[4]!.children.map(symbol => symbol.name), ['Last']);
  const semantic = parseKickAssemblerSemanticModel(document);
  function verify(symbols: readonly KickAssemblerOutlineSymbol[]): void {
    for (const symbol of symbols) {
      const declaration = semantic.symbols.find(entry =>
        entry.name === symbol.name && entry.location.range.start.line === symbol.selectionRange.start.line);
      assert.deepEqual(symbol.selectionRange, declaration?.location.range);
      verify(symbol.children);
    }
  }
  verify(outline);
  assertOutlineRanges(outline);
  assert.deepEqual(game.location.range.end, document.positionAt(document.text.length));
  // The retained structural-parse entry point preserves original EOF positions.
  assert.deepEqual(buildKickAssemblerOutlineFromParsed(parseKickAssemblerOutlineDocument(document)), outline);
});

test('outline keeps reopened namespaces distinct and retains declarations in anonymous blocks', () => {
  const document = createTextDocumentModel({ uri: 'file:///reopened.asm', text: [
    '.namespace Render {', 'First:', '}',
    '.namespace Render {', 'Second:', '}',
    '{', 'HiddenScope:', '}',
    'Outside:'
  ].join('\n') });
  const outline = buildKickAssemblerOutline(document);
  assert.deepEqual(outline.map(symbol => symbol.name), ['Render', 'Render', 'HiddenScope', 'Outside']);
  assert.deepEqual(outline[0]!.children.map(symbol => symbol.name), ['First']);
  assert.deepEqual(outline[1]!.children.map(symbol => symbol.name), ['Second']);
  assertOutlineRanges(outline);
});

test('outline preserves imports, callable blocks and output sections inside a file namespace', () => {
  const document = createTextDocumentModel({ uri: 'file:///sections.asm', text: [
    '#importonce',
    '.filenamespace Demo',
    '.segmentdef Code [start=$1000]',
    '.segment Code',
    '.pc = $1000 "Start" {', 'Entry:', '}',
    '#import "library.inc"',
    '.macro Draw(value) {', '!loop:', '}',
    '.function Value() {', '.var temporary = 1', '}',
    '.struct Point {', '.var x = 0', '}',
    '.enum Direction {', 'Left,', 'Right', '}',
    '.pseudocommand Load value {', 'Body:', '}',
    '.pc = $2000', 'Data:',
    '.segment Other', 'End:'
  ].join('\n') });
  const outline = buildKickAssemblerOutline(document);
  assert.deepEqual(outline.map(symbol => symbol.name), ['#importonce', 'Demo']);
  const demo = outline[1]!;
  assert.deepEqual(demo.children.map(symbol => symbol.name), ['Code', 'Code', 'library.inc', 'Other']);
  const code = demo.children[1]!;
  assert.deepEqual(code.children.map(symbol => symbol.name), ['Start', 'Draw', 'Value', 'Point', 'Direction', 'Load', '.pc $2000']);
  assert.deepEqual(code.children[0]!.children.map(symbol => symbol.name), ['Entry']);
  assert.deepEqual(code.children[1]!.children.map(symbol => symbol.name), ['!loop']);
  assert.deepEqual(code.children[2]!.children.map(symbol => symbol.name), ['temporary']);
  assert.deepEqual(code.children[3]!.children.map(symbol => symbol.name), ['x']);
  assert.deepEqual(code.children[5]!.children.map(symbol => symbol.name), ['Body']);
  assert.deepEqual(code.children[6]!.children.map(symbol => symbol.name), ['Data']);
  assert.deepEqual(demo.children[3]!.children.map(symbol => symbol.name), ['End']);
  assertOutlineRanges(outline);
});

test('outline keeps unfinished scopes useful without fabricating declarations', () => {
  const document = createTextDocumentModel({ uri: 'file:///unfinished.asm', text:
    '.filenamespace Demo\nActor: {\n!loop:\n.const value = 1\n// Fake:\n' });
  const outline = buildKickAssemblerOutline(document);
  assert.deepEqual(outline[0]!.children[0]!.children.map(symbol => symbol.name), ['!loop', 'value']);
  assertOutlineRanges(outline);
  assert.deepEqual(outline[0]!.location.range.end, document.positionAt(document.text.length));
});

test('outline child selections match definition targets for scoped labels with identical names', () => {
  const document = createTextDocumentModel({ uri: 'file:///navigation.asm', text: [
    '.filenamespace Game',
    'Actor: {', 'Loop:', '}',
    '.label Sprite = $2000 {', 'Loop:', '}',
    'jsr Actor.Loop', 'jsr Sprite.Loop'
  ].join('\n') });
  const outline = buildKickAssemblerOutline(document);
  const service = new KickAssemblerLookupService();
  const index = service.buildIndex([{ kind: 'kickassembler', document }]);
  for (const [name, childIndex] of [['Actor', 0], ['Sprite', 1]] as const) {
    const offset = document.text.lastIndexOf(`${name}.Loop`) + name.length + 2;
    const target = service.lookupAtPosition(document, document.positionAt(offset), index);
    assert.equal(target?.declarations.length, 1);
    assert.deepEqual(target?.declarations[0]?.location.range,
      outline[0]!.children[childIndex]!.children[0]!.selectionRange);
  }
});
